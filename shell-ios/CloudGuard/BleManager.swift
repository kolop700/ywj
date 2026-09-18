import Foundation
import CoreBluetooth

/// 蓝牙（BLE）原生实现（iOS / CoreBluetooth），方法名/参数/事件与 utils/h5-native-bridge.js 严格对应。
///
/// 关键时序（1:1 对齐 Android BleManager 与前端 bleUtils）：
///   ble.open -> ble.startDiscovery（回调内自动上报设备）-> 事件 ble.onDeviceFound
///   -> ble.connect（带 timeout）-> ble.getServices -> ble.getCharacteristics
///   -> ble.write（value 为 base64）-> ble.closeConnection -> ble.closeAdapter
///
/// 说明：iOS 不暴露 MAC 地址，deviceId 采用 CBPeripheral.identifier.uuidString；
/// 同一 App 内该标识稳定，前端仅用于连接定位，无跨端一致性要求。
final class BleManager: NSObject {

    private weak var host: WebViewController?
    private let channel: JsChannel
    /// 懒初始化（见 ensureCentral）：避免 App 一启动就弹出蓝牙授权
    private var central: CBCentralManager?

    /// 已发现/已连接的设备（strong 持有，CBPeripheral 需保持引用）
    private var peripherals: [String: CBPeripheral] = [:]
    private var servicesCache: [String: [CBService]] = [:]

    private var pendingOpen: [String] = []
    private var pendingConnect: [String: String] = [:]      // deviceId -> callbackId
    private var pendingServices: [String: String] = [:]     // deviceId -> callbackId
    private var pendingChars: [String: String] = [:]        // "deviceId|serviceId" -> callbackId
    private var pendingWrite: [String: String] = [:]        // deviceId -> callbackId
    private var connectTimers: [String: Timer] = [:]

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
        super.init()
    }

    /// 懒创建 CBCentralManager：首次真正使用蓝牙时才创建，此时系统才弹授权弹窗
    @discardableResult
    private func ensureCentral() -> CBCentralManager {
        if let existing = central { return existing }
        let manager = CBCentralManager(delegate: self, queue: .main,
                                       options: [CBCentralManagerOptionShowPowerAlertKey: false])
        central = manager
        return manager
    }

    // MARK: - 分发

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "ble.open": open(callbackId)
        case "ble.startDiscovery": startDiscovery(params: params, callbackId: callbackId)
        case "ble.stopDiscovery": stopDiscovery(callbackId)
        case "ble.connect": connect(params: params, callbackId: callbackId)
        case "ble.getServices": getServices(params: params, callbackId: callbackId)
        case "ble.getCharacteristics": getCharacteristics(params: params, callbackId: callbackId)
        case "ble.write": write(params: params, callbackId: callbackId)
        case "ble.closeConnection": closeConnection(params: params, callbackId: callbackId)
        case "ble.closeAdapter": closeAdapter(callbackId)
        default: channel.resolveErr(callbackId, "unknown ble method: \(method)")
        }
    }

    // MARK: - 适配器

    private func open(_ callbackId: String?) {
        // 首次调用即创建；state 为 .unknown 时会挂起，待状态就绪后回传
        switch ensureCentral().state {
        case .poweredOn:
            emitAdapterState()
            channel.resolveOk(callbackId, ["state": "on"])
        case .unknown, .resetting:
            // 状态尚未就绪：挂起，待状态更新后回传
            if let cb = callbackId { pendingOpen.append(cb) }
        case .poweredOff:
            emitAdapterState()
            channel.resolveErr(callbackId, "蓝牙未开启")
        case .unauthorized:
            emitAdapterState()
            channel.resolveErr(callbackId, "蓝牙未授权")
        case .unsupported:
            emitAdapterState()
            channel.resolveErr(callbackId, "当前设备不支持蓝牙")
        @unknown default:
            channel.resolveErr(callbackId, "蓝牙状态未知")
        }
    }

    private func closeAdapter(_ callbackId: String?) {
        central?.stopScan()
        for (id, p) in peripherals {
            if p.state == .connected || p.state == .connecting {
                central?.cancelPeripheralConnection(p)
            }
            _ = id
        }
        peripherals.removeAll()
        servicesCache.removeAll()
        cancelAllTimers()
        emitAdapterState()
        channel.resolveOk(callbackId)
    }

    private func emitAdapterState() {
        channel.emit("ble.onAdapterStateChange", [
            "available": central?.state == .poweredOn,
            "discovering": central?.isScanning ?? false
        ])
    }

    // MARK: - 扫描

    private func startDiscovery(params: [String: Any], callbackId: String?) {
        let manager = ensureCentral()
        guard manager.state == .poweredOn else {
            channel.resolveErr(callbackId, "蓝牙未开启")
            return
        }
        let allowDuplicates = (params["allowDuplicatesKey"] as? Bool) ?? false
        let options: [String: Any] = [CBCentralManagerScanOptionAllowDuplicatesKey: allowDuplicates]
        manager.scanForPeripherals(withServices: nil, options: options)
        emitAdapterState()
        channel.resolveOk(callbackId)
    }

    private func stopDiscovery(_ callbackId: String?) {
        central?.stopScan()
        emitAdapterState()
        channel.resolveOk(callbackId)
    }

    // MARK: - 连接

    private func connect(params: [String: Any], callbackId: String?) {
        guard let deviceId = params["deviceId"] as? String, !deviceId.isEmpty else {
            channel.resolveErr(callbackId, "deviceId 为空")
            return
        }
        let manager = ensureCentral()
        guard manager.state == .poweredOn else {
            channel.resolveErr(callbackId, "蓝牙不可用")
            return
        }
        guard let peripheral = resolvePeripheral(deviceId) else {
            channel.resolveErr(callbackId, "未找到设备: \(deviceId)")
            return
        }
        let timeoutMs = (params["timeout"] as? NSNumber)?.doubleValue ?? 15000
        let timeout = max(1.0, timeoutMs / 1000.0)

        peripheral.delegate = self
        pendingConnect[deviceId] = callbackId ?? ""
        manager.connect(peripheral, options: nil)

        connectTimers[deviceId]?.invalidate()
        let timer = Timer.scheduledTimer(withTimeInterval: timeout, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            if let cb = self.pendingConnect.removeValue(forKey: deviceId) {
                self.connectTimers[deviceId]?.invalidate()
                self.connectTimers.removeValue(forKey: deviceId)
                self.central?.cancelPeripheralConnection(peripheral)
                self.channel.resolveErr(cb, "连接超时")
            }
        }
        connectTimers[deviceId] = timer
    }

    private func resolvePeripheral(_ deviceId: String) -> CBPeripheral? {
        if let p = peripherals[deviceId] { return p }
        guard let uuid = UUID(uuidString: deviceId) else { return nil }
        if let p = ensureCentral().retrievePeripherals(withIdentifiers: [uuid]).first {
            peripherals[deviceId] = p
            return p
        }
        return nil
    }

    private func cancelTimer(_ deviceId: String) {
        connectTimers[deviceId]?.invalidate()
        connectTimers.removeValue(forKey: deviceId)
    }

    private func cancelAllTimers() {
        connectTimers.values.forEach { $0.invalidate() }
        connectTimers.removeAll()
    }

    // MARK: - 服务 / 特征值

    private func getServices(params: [String: Any], callbackId: String?) {
        guard let deviceId = params["deviceId"] as? String, !deviceId.isEmpty else {
            channel.resolveErr(callbackId, "deviceId 为空")
            return
        }
        guard let peripheral = peripherals[deviceId], peripheral.state == .connected else {
            channel.resolveErr(callbackId, "设备未连接")
            return
        }
        if let services = servicesCache[deviceId], !services.isEmpty {
            channel.resolveOk(callbackId, ["services": buildServicesJson(services)])
            return
        }
        pendingServices[deviceId] = callbackId ?? ""
        peripheral.discoverServices(nil)
    }

    private func getCharacteristics(params: [String: Any], callbackId: String?) {
        guard let deviceId = params["deviceId"] as? String, !deviceId.isEmpty else {
            channel.resolveErr(callbackId, "deviceId 为空")
            return
        }
        let serviceId = (params["serviceId"] as? String ?? "").lowercased()
        guard let peripheral = peripherals[deviceId], peripheral.state == .connected else {
            channel.resolveErr(callbackId, "设备未连接")
            return
        }
        guard let service = servicesCache[deviceId]?.first(where: {
            $0.uuid.uuidString.lowercased() == serviceId
        }) else {
            channel.resolveErr(callbackId, "未找到服务: \(serviceId)")
            return
        }
        if let chars = service.characteristics, !chars.isEmpty {
            channel.resolveOk(callbackId, ["characteristics": buildCharacteristicsJson(chars)])
            return
        }
        pendingChars["\(deviceId)|\(serviceId)"] = callbackId ?? ""
        peripheral.discoverCharacteristics(nil, for: service)
    }

    private func buildServicesJson(_ services: [CBService]) -> [[String: Any]] {
        return services.map { s in
            ["uuid": s.uuid.uuidString.lowercased(), "isPrimary": s.isPrimary]
        }
    }

    private func buildCharacteristicsJson(_ chars: [CBCharacteristic]) -> [[String: Any]] {
        return chars.map { c in
            let p = c.properties
            return [
                "uuid": c.uuid.uuidString.lowercased(),
                "properties": [
                    "read": p.contains(.read),
                    "write": p.contains(.write),
                    "notify": p.contains(.notify),
                    "indicate": p.contains(.indicate),
                    "writeNoResponse": p.contains(.writeWithoutResponse)
                ]
            ]
        }
    }

    // MARK: - 写入

    private func write(params: [String: Any], callbackId: String?) {
        guard let deviceId = params["deviceId"] as? String, !deviceId.isEmpty else {
            channel.resolveErr(callbackId, "deviceId 为空")
            return
        }
        let serviceId = (params["serviceId"] as? String ?? "").lowercased()
        let charId = (params["characteristicId"] as? String ?? "").lowercased()
        let valueB64 = params["value"] as? String ?? ""

        guard let peripheral = peripherals[deviceId], peripheral.state == .connected else {
            channel.resolveErr(callbackId, "设备未连接")
            return
        }
        guard let characteristic = servicesCache[deviceId]?
            .first(where: { $0.uuid.uuidString.lowercased() == serviceId })?
            .characteristics?
            .first(where: { $0.uuid.uuidString.lowercased() == charId }) else {
            channel.resolveErr(callbackId, "未找到特征值: \(charId)")
            return
        }
        guard let data = Data(base64Encoded: valueB64) else {
            channel.resolveErr(callbackId, "value 解码失败")
            return
        }

        let type: CBCharacteristicWriteType = characteristic.properties.contains(.write) ? .withResponse : .withoutResponse
        pendingWrite[deviceId] = callbackId ?? ""
        peripheral.writeValue(data, for: characteristic, type: type)
        // 无响应写入不会触发 didWriteValueFor，直接回传成功
        if type == .withoutResponse {
            pendingWrite.removeValue(forKey: deviceId)
            channel.resolveOk(callbackId)
        }
    }

    private func closeConnection(params: [String: Any], callbackId: String?) {
        guard let deviceId = params["deviceId"] as? String, !deviceId.isEmpty else {
            channel.resolveOk(callbackId)
            return
        }
        if let peripheral = peripherals[deviceId] {
            central?.cancelPeripheralConnection(peripheral)
        }
        servicesCache.removeValue(forKey: deviceId)
        cancelTimer(deviceId)
        channel.resolveOk(callbackId)
    }
}

// MARK: - CBCentralManagerDelegate

extension BleManager: CBCentralManagerDelegate {

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        emitAdapterState()
        if central.state == .poweredOn {
            let callbacks = pendingOpen
            pendingOpen.removeAll()
            callbacks.forEach { channel.resolveOk($0, ["state": "on"]) }
        } else if central.state == .poweredOff || central.state == .unauthorized || central.state == .unsupported {
            let callbacks = pendingOpen
            pendingOpen.removeAll()
            callbacks.forEach { channel.resolveErr($0, "蓝牙不可用") }
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any],
                        rssi RSSI: NSNumber) {
        let deviceId = peripheral.identifier.uuidString
        peripherals[deviceId] = peripheral
        let name = (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? peripheral.name ?? ""
        let record: [String: Any] = [
            "deviceId": deviceId,
            "name": name,
            "localName": name,
            "RSSI": RSSI.intValue
        ]
        channel.emit("ble.onDeviceFound", ["devices": [record]])
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        let deviceId = peripheral.identifier.uuidString
        cancelTimer(deviceId)
        if let cb = pendingConnect.removeValue(forKey: deviceId) {
            channel.resolveOk(cb)
        }
        // 预取服务，加速后续 getServices
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager,
                        didFailToConnect peripheral: CBPeripheral, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        cancelTimer(deviceId)
        if let cb = pendingConnect.removeValue(forKey: deviceId) {
            channel.resolveErr(cb, "连接失败: \(error?.localizedDescription ?? "unknown")")
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        cancelTimer(deviceId)
        servicesCache.removeValue(forKey: deviceId)
        if let cb = pendingConnect.removeValue(forKey: deviceId) {
            channel.resolveErr(cb, "连接已断开")
        }
    }
}

// MARK: - CBPeripheralDelegate

extension BleManager: CBPeripheralDelegate {

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        guard let cb = pendingServices.removeValue(forKey: deviceId) else {
            // 无挂起回调（预取场景），仅缓存
            if let services = peripheral.services {
                servicesCache[deviceId] = services
            }
            return
        }
        if let error = error {
            channel.resolveErr(cb, "服务发现失败: \(error.localizedDescription)")
            return
        }
        let services = peripheral.services ?? []
        servicesCache[deviceId] = services
        channel.resolveOk(cb, ["services": buildServicesJson(services)])
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        let key = "\(deviceId)|\(service.uuid.uuidString.lowercased())"
        guard let cb = pendingChars.removeValue(forKey: key) else { return }
        if let error = error {
            channel.resolveErr(cb, "特征值发现失败: \(error.localizedDescription)")
            return
        }
        channel.resolveOk(cb, ["characteristics": buildCharacteristicsJson(service.characteristics ?? [])])
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        let deviceId = peripheral.identifier.uuidString
        guard let cb = pendingWrite.removeValue(forKey: deviceId) else { return }
        if let error = error {
            channel.resolveErr(cb, "写入失败: \(error.localizedDescription)")
        } else {
            channel.resolveOk(cb)
        }
    }
}
