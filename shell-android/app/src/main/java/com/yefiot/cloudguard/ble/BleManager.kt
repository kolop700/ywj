package com.yefiot.cloudguard.ble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * 蓝牙（BLE）原生实现，方法名/参数/事件与 utils/h5-native-bridge.js 严格对应。
 *
 * 关键时序（1:1 保留前端 bleUtils 的等待逻辑）：
 *   ble.open -> ble.startDiscovery(回调内自动上报设备) -> 事件 ble.onDeviceFound
 *   -> ble.connect（超时参数来自前端） -> ble.getServices -> ble.getCharacteristics
 *   -> ble.write（value 为 base64） -> ble.closeConnection -> ble.closeAdapter
 *
 * 连接成功后主动 requestMtu(247)，确保开门指令（约 30 字节）单次 ATT 写入成功。
 */
class BleManager(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private val handler = Handler(Looper.getMainLooper())
    private val bluetoothManager =
        activity.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val adapter: BluetoothAdapter? get() = bluetoothManager?.adapter

    private val gatts = ConcurrentHashMap<String, BluetoothGatt>()
    private val servicesCache = ConcurrentHashMap<String, List<BluetoothGattService>>()
    private val pendingConnectCallbacks = ConcurrentHashMap<String, String>()
    private val pendingServiceCallbacks = ConcurrentHashMap<String, String>()
    private val pendingWriteCallbacks = ConcurrentHashMap<String, String>()
    private val connectTimeouts = ConcurrentHashMap<String, Runnable>()
    // 服务发现 / 写入的超时兜底：BLE 栈回调丢失时明确失败，避免 JS 侧 Promise 永久挂起（「一直正在开门」）。
    private val serviceTimeouts = ConcurrentHashMap<String, Runnable>()
    private val writeTimeouts = ConcurrentHashMap<String, Runnable>()

    // 双通道扫描回调：同时用「低延迟」与「低功耗」两种模式扫描。
    // 依据：原版 DCloud(BluetoothOver21) 未调用 setScanMode，走系统默认（低功耗）；
    // 而部分 ROM 对高占空比(LOW_LATENCY)的长扫描有静默节流，单一模式可能整段漏收某类设备。
    // 两个通道结果都汇入 submitDevice，重复由前端去重。
    private val scanCallbacks = mutableListOf<ScanCallback>()
    private var stateReceiver: BroadcastReceiver? = null
    // 扫描期间收到广播的总次数（含重复上报），随设备数据回传 seq 字段。
    // 前端据此显示「原生上报 N 次」：数值持续增长=扫描确实在跑，长时间不变=扫描已死，
    // 用于区分「门锁没广播」与「扫描根本没运行」两种故障。
    private var scanSeq = 0

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "ble.open" -> open(callbackId)
            "ble.startDiscovery" -> startDiscovery(params, callbackId)
            "ble.stopDiscovery" -> stopDiscovery(callbackId)
            "ble.connect" -> connect(params, callbackId)
            "ble.getServices" -> getServices(params, callbackId)
            "ble.getCharacteristics" -> getCharacteristics(params, callbackId)
            "ble.write" -> write(params, callbackId)
            "ble.closeConnection" -> closeConnection(params, callbackId)
            "ble.closeAdapter" -> closeAdapter(callbackId)
            else -> return false
        }
        return true
    }

    // ==================== 适配器 ====================

    private fun open(callbackId: String?) {
        val ad = adapter
        if (ad == null) {
            channel.resolveErr(callbackId, "当前设备不支持蓝牙")
            return
        }
        // 【关键】必须先申请权限，再读取适配器状态。
        // Android 12+ 未授予 BLUETOOTH_CONNECT/BLUETOOTH_SCAN 时，读取 isEnabled/isDiscovering
        // 可能抛 SecurityException，导致整条蓝牙链路在第一步（open）就中断，
        // 表现为「一直在搜索但搜不到设备」。
        ensurePermissions(scanPermissions()) { granted ->
            Log.d("BleManager", "open permissions granted=$granted")
            if (!granted) {
                channel.resolveErr(callbackId, "缺少蓝牙/定位权限")
                return@ensurePermissions
            }
            registerStateReceiver()
            emitAdapterState()
            // 蓝牙未开启时必须返回失败：前端 bleUtils.initBluetooth 依赖 fail 分支提示
            // "请打开蓝牙和定位功能"；否则会误判成功，直到扫描阶段才报错（与 iOS 端行为不一致）。
            val enabled = try {
                ad.isEnabled
            } catch (_: Throwable) {
                false
            }
            if (!enabled) {
                channel.resolveErr(callbackId, "蓝牙未开启")
                return@ensurePermissions
            }
            channel.resolveOk(callbackId, JSONObject().put("state", "on"))
        }
    }

    private fun closeAdapter(callbackId: String?) {
        val sc = scanner()
        scanCallbacks.forEach { cb ->
            try {
                sc?.stopScan(cb)
            } catch (_: Throwable) {
            }
        }
        scanCallbacks.clear()
        gatts.keys.toList().forEach { closeGatt(it) }
        // 全量清理服务缓存与未完成回调：防止下次开门复用上一次连接的旧 service/characteristic 对象
        //（旧对象+新连接写入会丢失栈回调），同时让挂起中的 Promise 立即失败而不是永久等待。
        servicesCache.clear()
        serviceTimeouts.values.forEach { handler.removeCallbacks(it) }
        serviceTimeouts.clear()
        writeTimeouts.values.forEach { handler.removeCallbacks(it) }
        writeTimeouts.clear()
        pendingConnectCallbacks.values.forEach { if (it.isNotEmpty()) channel.resolveErr(it, "蓝牙已关闭") }
        pendingConnectCallbacks.clear()
        pendingServiceCallbacks.values.forEach { if (it.isNotEmpty()) channel.resolveErr(it, "蓝牙已关闭") }
        pendingServiceCallbacks.clear()
        pendingWriteCallbacks.values.forEach { if (it.isNotEmpty()) channel.resolveErr(it, "蓝牙已关闭") }
        pendingWriteCallbacks.clear()
        unregisterStateReceiver()
        channel.resolveOk(callbackId)
    }

    private fun scanner() = try {
        adapter?.bluetoothLeScanner
    } catch (_: SecurityException) {
        null
    }

    private fun registerStateReceiver() {
        if (stateReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED) emitAdapterState()
            }
        }
        stateReceiver = receiver
        ContextCompat.registerReceiver(
            activity,
            receiver,
            IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    private fun unregisterStateReceiver() {
        stateReceiver?.let {
            try {
                activity.unregisterReceiver(it)
            } catch (_: Throwable) {
            }
        }
        stateReceiver = null
    }

    private fun emitAdapterState() {
        val ad = adapter
        val obj = JSONObject()
        obj.put(
            "available",
            try {
                ad?.isEnabled ?: false
            } catch (_: Throwable) {
                false
            }
        )
        obj.put(
            "discovering",
            try {
                ad?.isDiscovering ?: false
            } catch (_: SecurityException) {
                false
            }
        )
        channel.emit("ble.onAdapterStateChange", obj)
    }

    // ==================== 扫描 ====================

    private fun startDiscovery(params: JSONObject, callbackId: String?) {
        val ad = adapter
        val enabled = try {
            ad?.isEnabled ?: false
        } catch (_: Throwable) {
            false
        }
        if (ad == null || !enabled) {
            channel.resolveErr(callbackId, "蓝牙未开启")
            return
        }
        ensurePermissions(scanPermissions()) { granted ->
            Log.d("BleManager", "startDiscovery permissions granted=$granted")
            if (!granted) {
                channel.resolveErr(callbackId, "缺少蓝牙/定位权限")
                return@ensurePermissions
            }
            val sc = scanner()
            if (sc == null) {
                channel.resolveErr(callbackId, "蓝牙扫描不可用")
                return@ensurePermissions
            }
            // 停止旧的扫描回调（若存在）
            scanCallbacks.forEach { old ->
                try {
                    sc.stopScan(old)
                } catch (_: Throwable) {
                }
            }
            scanCallbacks.clear()

            // 双通道：主通道 LOW_LATENCY（notify=true，负责回传启动结果），
            // 辅通道 LOW_POWER（与原版 DCloud 的默认模式等价，静默兜底）。
            // Android 同一应用同一时刻只允许一个 BLE 扫描；若预扫描仍在进行，
            // 直接再次 startScan 会触发 onScanFailed(SCAN_FAILED_ALREADY_STARTED=1)，
            // 表现为「搜索不到设备」。先停止旧扫描，再延迟启动新扫描。
            val mainCb = makeScanCallback(sc, callbackId, ScanSettings.SCAN_MODE_LOW_LATENCY, true)
            val auxCb = makeScanCallback(sc, callbackId, ScanSettings.SCAN_MODE_LOW_POWER, false)
            scanCallbacks.add(mainCb)
            scanCallbacks.add(auxCb)

            handler.postDelayed({
                startScanWithRetry(sc, mainCb, ScanSettings.SCAN_MODE_LOW_LATENCY, callbackId, true)
                startScanWithRetry(sc, auxCb, ScanSettings.SCAN_MODE_LOW_POWER, callbackId, false)
                emitAdapterState()
            }, 150)
        }
    }

    /** 创建扫描回调：结果汇入 submitDevice；SCAN_FAILED_ALREADY_STARTED 时先停自身再延迟重试（最多 2 次）。 */
    private fun makeScanCallback(
        sc: BluetoothLeScanner,
        callbackId: String?,
        scanMode: Int,
        notify: Boolean
    ): ScanCallback {
        var retry = 0
        return object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                submitDevice(result)
            }

            override fun onBatchScanResults(results: MutableList<ScanResult>?) {
                results?.forEach { submitDevice(it) }
            }

            override fun onScanFailed(errorCode: Int) {
                Log.e("BleManager", "onScanFailed mode=$scanMode errorCode=$errorCode retry=$retry")
                if (errorCode == 1 && retry < 2) {
                    retry++
                    try {
                        sc.stopScan(this)
                    } catch (_: Throwable) {
                    }
                    handler.postDelayed({
                        try {
                            val settings = ScanSettings.Builder().setScanMode(scanMode).build()
                            sc.startScan(null, settings, this)
                            Log.d("BleManager", "retry startScan ok mode=$scanMode retry=$retry")
                        } catch (e: Throwable) {
                            Log.e("BleManager", "retry startScan failed mode=$scanMode: ${e.message}")
                        }
                    }, 500)
                } else if (notify) {
                    // 必须回报失败，否则 JS 端以为「搜索中」而实际扫描已死。
                    emitAdapterState()
                    channel.resolveErr(callbackId, "扫描失败: $errorCode")
                }
            }
        }
    }

    /** 同步启动一次扫描（失败重试 1 次）；notify 为 true 时把结果回传 JS。 */
    private fun startScanWithRetry(
        sc: BluetoothLeScanner,
        cb: ScanCallback,
        scanMode: Int,
        callbackId: String?,
        notify: Boolean
    ) {
        var attempt = 0
        while (attempt < 2) {
            try {
                val settings = ScanSettings.Builder().setScanMode(scanMode).build()
                sc.startScan(null, settings, cb)
                Log.d("BleManager", "startScan ok mode=$scanMode attempt=$attempt")
                if (notify) channel.resolveOk(callbackId)
                return
            } catch (e: Throwable) {
                attempt++
                Log.e("BleManager", "startScan failed mode=$scanMode attempt=$attempt: ${e.message}")
                try {
                    sc.stopScan(cb)
                } catch (_: Throwable) {
                }
                if (attempt >= 2 && notify) {
                    channel.resolveErr(callbackId, "扫描异常: ${e.message}")
                }
            }
        }
    }

    private fun stopDiscovery(callbackId: String?) {
        val sc = scanner()
        scanCallbacks.forEach { cb ->
            try {
                sc?.stopScan(cb)
            } catch (_: Throwable) {
            }
        }
        scanCallbacks.clear()
        emitAdapterState()
        channel.resolveOk(callbackId)
    }

    private fun submitDevice(result: ScanResult?) {
        val device = result?.device ?: return
        val record = result.scanRecord
        scanSeq++
        val obj = JSONObject()
        obj.put("deviceId", device.address)
        obj.put("seq", scanSeq)
        // 广播名兜底链：ScanRecord.getDeviceName() -> BluetoothDevice.name -> 解析原始广播字节(0x08/0x09)。
        // Android <=11 上 getDeviceName() 对部分 BLE 广播包返回 null（名称其实在原始字节里），
        // 导致前端永远匹配不到门锁（表现为「已发现 N 个设备但未匹配」）。
        val name = record?.deviceName?.takeIf { it.isNotEmpty() }
            ?: safeDeviceName(device).takeIf { it.isNotEmpty() }
            ?: parseLocalName(record?.bytes)
            ?: ""
        obj.put("name", name)
        obj.put("localName", record?.deviceName?.takeIf { it.isNotEmpty() } ?: name)
        obj.put("RSSI", result.rssi)
        // 原始广播数据（base64）+ 广播服务 UUID，供排查门锁标识
        obj.put("advertisData", record?.bytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) } ?: "")
        val uuids = JSONArray()
        record?.serviceUuids?.forEach { uuids.put(it.uuid.toString().lowercase()) }
        obj.put("advertisServiceUUIDs", uuids)
        Log.d("BleManager", "found ${device.address} name=$name rssi=${result.rssi} adv=${obj.optString("advertisData")}")
        val data = JSONObject().put("devices", JSONArray().put(obj))
        channel.emit("ble.onDeviceFound", data)
    }

    /** 从原始广播字节中解析「完整/短本地名称」(AD type 0x08/0x09)；解析不到返回 null */
    private fun parseLocalName(bytes: ByteArray?): String? {
        if (bytes == null || bytes.isEmpty()) return null
        var i = 0
        while (i < bytes.size) {
            val len = bytes[i].toInt() and 0xFF
            if (len == 0 || i + len >= bytes.size) break
            val type = bytes[i + 1].toInt() and 0xFF
            if (type == 0x08 || type == 0x09) {
                return try {
                    String(bytes, i + 2, len - 1, Charsets.UTF_8)
                } catch (_: Throwable) {
                    null
                }
            }
            i += len + 1
        }
        return null
    }

    private fun safeDeviceName(device: android.bluetooth.BluetoothDevice): String = try {
        device.name ?: ""
    } catch (_: SecurityException) {
        ""
    }

    // ==================== 连接 ====================

    private fun connect(params: JSONObject, callbackId: String?) {
        val deviceId = params.optString("deviceId")
        if (deviceId.isEmpty()) {
            channel.resolveErr(callbackId, "deviceId 为空")
            return
        }
        val timeout = params.optLong("timeout", 15000L)
        val ad = adapter
        if (ad == null) {
            channel.resolveErr(callbackId, "蓝牙不可用")
            return
        }
        ensurePermissions(connectPermissions()) { granted ->
            if (!granted) {
                channel.resolveErr(callbackId, "缺少蓝牙连接权限")
                return@ensurePermissions
            }
            try {
                val device = ad.getRemoteDevice(deviceId)
                closeGatt(deviceId)
                val gatt = device.connectGatt(activity, false, gattCallback)
                gatts[deviceId] = gatt
                // 若该设备上一次连接仍挂着未完成回调（异常残留），先明确失败，避免其永久悬空
                pendingConnectCallbacks.remove(deviceId)?.let { old ->
                    if (old.isNotEmpty()) channel.resolveErr(old, "已被新的连接请求取代")
                }
                pendingConnectCallbacks[deviceId] = callbackId ?: ""
                val timeoutRun = Runnable {
                    if (pendingConnectCallbacks.containsKey(deviceId)) {
                        pendingConnectCallbacks.remove(deviceId)
                        channel.resolveErr(callbackId, "连接超时")
                        closeGatt(deviceId)
                    }
                }
                connectTimeouts[deviceId] = timeoutRun
                handler.postDelayed(timeoutRun, timeout)
            } catch (e: SecurityException) {
                channel.resolveErr(callbackId, "连接异常: ${e.message}")
            } catch (e: IllegalArgumentException) {
                channel.resolveErr(callbackId, "无效的 deviceId: $deviceId")
            }
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            val deviceId = gatt?.device?.address ?: return
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                // 过期 gatt（重连前的旧连接）的连接回调直接忽略，避免干扰新连接
                if (gatts[deviceId] !== gatt) {
                    try {
                        gatt?.close()
                    } catch (_: Throwable) {
                    }
                    return
                }
                connectTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                // 每次新连接必须重新发现服务：清掉上一次连接遗留的缓存。
                // 复用旧 service/characteristic 对象写入会导致栈回调丢失（前端永久「正在开门」）。
                servicesCache.remove(deviceId)
                try {
                    gatt.requestMtu(247)
                } catch (_: Throwable) {
                }
                pendingConnectCallbacks.remove(deviceId)?.let { channel.resolveOk(it) }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                // 仅处理「当前活跃 gatt」的断连；旧连接的迟到回调不能误删新连接及其回调
                if (gatts[deviceId] !== gatt) {
                    try {
                        gatt?.close()
                    } catch (_: Throwable) {
                    }
                    return
                }
                connectTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                writeTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                pendingConnectCallbacks.remove(deviceId)?.let { channel.resolveErr(it, "连接已断开") }
                pendingServiceCallbacks.remove(deviceId)?.let { cb ->
                    if (cb.isNotEmpty()) channel.resolveErr(cb, "连接已断开")
                }
                pendingWriteCallbacks.remove(deviceId)?.let { cb ->
                    if (cb.isNotEmpty()) channel.resolveErr(cb, "连接已断开")
                }
                servicesCache.remove(deviceId)
                gatts.remove(deviceId)
                try {
                    gatt?.close()
                } catch (_: Throwable) {
                }
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            val deviceId = gatt?.device?.address ?: return
            // 过期 gatt 的服务发现结果会污染缓存，直接忽略
            if (gatts[deviceId] !== gatt) return
            serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
            if (status == BluetoothGatt.GATT_SUCCESS && gatt != null) {
                servicesCache[deviceId] = gatt.services?.toList() ?: emptyList()
                pendingServiceCallbacks.remove(deviceId)?.let { cb ->
                    if (cb.isNotEmpty()) channel.resolveOk(cb, JSONObject().put("services", buildServicesJson(deviceId)))
                }
            } else {
                pendingServiceCallbacks.remove(deviceId)?.let { cb ->
                    if (cb.isNotEmpty()) channel.resolveErr(cb, "服务发现失败: $status")
                }
            }
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?,
            status: Int
        ) {
            val deviceId = gatt?.device?.address ?: return
            // 过期 gatt 的写回调不能误消费新连接的 pending
            if (gatts[deviceId] !== gatt) return
            writeTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
            pendingWriteCallbacks.remove(deviceId)?.let { cb ->
                if (cb.isNotEmpty()) {
                    if (status == BluetoothGatt.GATT_SUCCESS) channel.resolveOk(cb)
                    else channel.resolveErr(cb, "写入失败: $status")
                }
            }
        }
    }

    // ==================== 服务 / 特征值 ====================

    private fun getServices(params: JSONObject, callbackId: String?) {
        val deviceId = params.optString("deviceId")
        val gatt = gatts[deviceId]
        if (gatt == null) {
            channel.resolveErr(callbackId, "设备未连接")
            return
        }
        if (servicesCache.containsKey(deviceId)) {
            channel.resolveOk(callbackId, JSONObject().put("services", buildServicesJson(deviceId)))
            return
        }
        // 覆盖式挂载（重入时后到的生效）
        pendingServiceCallbacks[deviceId] = callbackId ?: ""
        serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
        // 超时兜底：BLE 栈回调丢失时明确失败，避免前端 Promise 永久挂起
        val timeoutRun = Runnable {
            if (pendingServiceCallbacks.containsKey(deviceId)) {
                pendingServiceCallbacks.remove(deviceId)
                channel.resolveErr(callbackId, "服务发现超时")
            }
        }
        serviceTimeouts[deviceId] = timeoutRun
        handler.postDelayed(timeoutRun, 5000)
        try {
            if (!gatt.discoverServices()) {
                pendingServiceCallbacks.remove(deviceId)
                serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                channel.resolveErr(callbackId, "服务发现启动失败")
            }
        } catch (e: SecurityException) {
            pendingServiceCallbacks.remove(deviceId)
            serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
            channel.resolveErr(callbackId, "服务发现异常: ${e.message}")
        }
    }

    private fun buildServicesJson(deviceId: String): JSONArray {
        val arr = JSONArray()
        val services = servicesCache[deviceId] ?: return arr
        for (s in services) {
            val o = JSONObject()
            o.put("uuid", s.uuid.toString().lowercase())
            o.put("isPrimary", s.type == BluetoothGattService.SERVICE_TYPE_PRIMARY)
            arr.put(o)
        }
        return arr
    }

    private fun getCharacteristics(params: JSONObject, callbackId: String?) {
        val deviceId = params.optString("deviceId")
        val serviceId = params.optString("serviceId").lowercase()
        val service = servicesCache[deviceId]?.firstOrNull {
            it.uuid.toString().lowercase() == serviceId
        }
        if (service == null) {
            channel.resolveErr(callbackId, "未找到服务: $serviceId")
            return
        }
        val arr = JSONArray()
        for (c in service.characteristics) {
            val o = JSONObject()
            o.put("uuid", c.uuid.toString().lowercase())
            val p = c.properties
            val props = JSONObject()
            props.put("read", p and BluetoothGattCharacteristic.PROPERTY_READ != 0)
            props.put("write", p and BluetoothGattCharacteristic.PROPERTY_WRITE != 0)
            props.put("notify", p and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0)
            props.put("indicate", p and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0)
            props.put("writeNoResponse", p and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0)
            o.put("properties", props)
            arr.put(o)
        }
        channel.resolveOk(callbackId, JSONObject().put("characteristics", arr))
    }

    private fun write(params: JSONObject, callbackId: String?) {
        val deviceId = params.optString("deviceId")
        val serviceId = params.optString("serviceId").lowercase()
        val charId = params.optString("characteristicId").lowercase()
        val valueB64 = params.optString("value")
        val gatt = gatts[deviceId]
        if (gatt == null) {
            channel.resolveErr(callbackId, "设备未连接")
            return
        }
        val ch = servicesCache[deviceId]
            ?.firstOrNull { it.uuid.toString().lowercase() == serviceId }
            ?.characteristics
            ?.firstOrNull { it.uuid.toString().lowercase() == charId }
        if (ch == null) {
            channel.resolveErr(callbackId, "未找到特征值: $charId")
            return
        }
        val bytes = try {
            Base64.decode(valueB64, Base64.DEFAULT)
        } catch (_: Throwable) {
            null
        }
        if (bytes == null) {
            channel.resolveErr(callbackId, "value 解码失败")
            return
        }
        try {
            ch.writeType = if (ch.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) {
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            } else {
                BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            }
            @Suppress("DEPRECATION")
            ch.value = bytes
            writeTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
            pendingWriteCallbacks[deviceId] = callbackId ?: ""
            // 超时兜底：写回调丢失时明确失败，避免前端 Promise 永久挂起（门已开但页面卡「正在开门」）
            val timeoutRun = Runnable {
                if (pendingWriteCallbacks.containsKey(deviceId)) {
                    pendingWriteCallbacks.remove(deviceId)
                    channel.resolveErr(callbackId, "写入响应超时")
                }
            }
            writeTimeouts[deviceId] = timeoutRun
            handler.postDelayed(timeoutRun, 5000)
            @Suppress("DEPRECATION")
            val ok = gatt.writeCharacteristic(ch)
            if (!ok) {
                pendingWriteCallbacks.remove(deviceId)
                writeTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
                channel.resolveErr(callbackId, "写入请求下发失败")
            }
        } catch (e: SecurityException) {
            channel.resolveErr(callbackId, "写入异常: ${e.message}")
        }
    }

    private fun closeConnection(params: JSONObject, callbackId: String?) {
        val deviceId = params.optString("deviceId")
        closeGatt(deviceId)
        servicesCache.remove(deviceId)
        channel.resolveOk(callbackId)
    }

    private fun closeGatt(deviceId: String) {
        // 连接被关闭时，该设备上挂起的服务发现/写入必须明确失败，否则前端 Promise 永久挂起
        pendingServiceCallbacks.remove(deviceId)?.let { cb ->
            if (cb.isNotEmpty()) channel.resolveErr(cb, "连接已关闭")
        }
        pendingWriteCallbacks.remove(deviceId)?.let { cb ->
            if (cb.isNotEmpty()) channel.resolveErr(cb, "连接已关闭")
        }
        serviceTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
        writeTimeouts.remove(deviceId)?.let { handler.removeCallbacks(it) }
        val gatt = gatts.remove(deviceId) ?: return
        try {
            gatt.disconnect()
        } catch (_: Throwable) {
        }
        try {
            gatt.close()
        } catch (_: Throwable) {
        }
    }

    // ==================== 权限 ====================

    private fun scanPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // 兼容国内 OEM：部分厂商 ROM 在 Android 12+ 仍要求位置权限才返回扫描结果，
            // 因此除蓝牙权限外同时申请位置权限（Manifest 已声明）。
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    private fun connectPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            emptyArray()
        }

    private fun hasAll(perms: Array<String>): Boolean = perms.all {
        ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun ensurePermissions(perms: Array<String>, cb: (Boolean) -> Unit) {
        if (perms.isEmpty() || hasAll(perms)) {
            cb(true)
            return
        }
        activity.requestPermissions(perms) { result -> cb(result.values.all { it }) }
    }
}
