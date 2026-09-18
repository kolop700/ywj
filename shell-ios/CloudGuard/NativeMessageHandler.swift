import Foundation
import WebKit

/// WKScriptMessageHandler：接收注入脚本 window.NativeBridge.call 的 postMessage，
/// 解析出 method / params / callbackId 后交给 BridgeRouter 分发。
///
/// 载荷（由文档注入脚本构造）：
///   { method: String, params: String(JSON), callbackId: String }
final class NativeMessageHandler: NSObject, WKScriptMessageHandler {

    weak var router: BridgeRouter?

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        let method = body["method"] as? String ?? ""
        let paramsJson = body["params"] as? String ?? "{}"
        let callbackId = body["callbackId"] as? String ?? ""

        var params: [String: Any] = [:]
        if let data = paramsJson.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            params = obj
        }

        router?.dispatch(method: method, params: params, callbackId: callbackId)
    }
}
