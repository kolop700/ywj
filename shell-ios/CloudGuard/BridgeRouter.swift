import Foundation
import UIKit

/// 桥接路由器：把 JS 的 method 分发到各原生能力模块（对应 Android 端 BridgeRouter）。
///
/// 与 utils/h5-native-bridge.js 的方法清单严格对应：
///   device.getInfo / permission.request / scan.qrcode
///   ble.* / image.* / share.* / app.* / ad.* / pay.* / http.* / miniprogram.*
///
/// 所有处理统一切到主线程执行。
final class BridgeRouter {

    private weak var host: WebViewController?
    private let channel: JsChannel

    private let ble: BleManager
    private let media: MediaManager
    private let share: ShareManager
    private let update: UpdateManager
    private let ad: AdBridge
    private let pay: PayBridge
    private let http: HttpManager
    private let miniProgram: MiniProgramBridge

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
        self.ble = BleManager(host: host, channel: channel)
        self.media = MediaManager(host: host, channel: channel)
        self.share = ShareManager(host: host, channel: channel)
        self.update = UpdateManager(host: host, channel: channel)
        self.ad = AdBridge(host: host, channel: channel)
        self.pay = PayBridge(channel: channel)
        self.http = HttpManager(channel: channel)
        self.miniProgram = MiniProgramBridge(channel: channel)
    }

    func dispatch(method: String, params: [String: Any], callbackId: String) {
        DispatchQueue.main.async { [weak self] in
            self?.safeRoute(method: method, params: params, callbackId: callbackId)
        }
    }

    /// 页面销毁：释放各能力模块持有的资源（广告悬浮视图、支付队列观察者等）
    func dispose() {
        ad.dispose()
        pay.dispose()
    }

    private func safeRoute(method: String, params: [String: Any], callbackId: String) {
        do {
            try route(method: method, params: params, callbackId: callbackId)
        } catch {
            channel.resolveErr(callbackId, "bridge error: \(error.localizedDescription)")
        }
    }

    private func route(method: String, params: [String: Any], callbackId: String) throws {
        switch true {
        case method == "device.getInfo":
            channel.resolveOk(callbackId, deviceInfo())
        case method == "permission.request":
            handlePermission(params: params, callbackId: callbackId)
        case method == "scan.qrcode":
            host?.requestScan(callbackId: callbackId)
        case method.hasPrefix("ble."):
            ble.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("image."):
            media.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("share."):
            share.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("app."):
            update.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("ad."):
            ad.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("pay."):
            pay.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("miniprogram."):
            _ = miniProgram.handle(method: method, params: params, callbackId: callbackId)
        case method.hasPrefix("http."):
            http.handle(method: method, params: params, callbackId: callbackId)
        default:
            channel.resolveErr(callbackId, "unknown method: \(method)")
        }
    }

    // MARK: - 权限

    /// iOS 权限在首次使用时由系统弹窗；此处按请求清单返回 granted=true（真实授权结果由系统决定）。
    private func handlePermission(params: [String: Any], callbackId: String) {
        let perms = params["permissions"] as? [String] ?? []
        var result: [String: Any] = [:]
        for p in perms { result[p] = true }
        channel.resolveOk(callbackId, result)
    }

    // MARK: - 设备信息

    private func deviceInfo() -> [String: Any] {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? ""
        let build = info?["CFBundleVersion"] as? String ?? ""
        return [
            "platform": "ios",
            "system": "iOS \(UIDevice.current.systemVersion)",
            "model": UIDevice.current.model,
            "brand": "Apple",
            "version": version,
            "buildNumber": build,
            "appId": Bundle.main.bundleIdentifier ?? ""
        ]
    }
}
