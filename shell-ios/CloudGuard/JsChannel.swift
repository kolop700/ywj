import Foundation
import WebKit

/// JS 通道：封装「原生 -> JS」的两类回传（对应 Android 端 JsChannel）。
///
///  1) 调用回传： window.__nativeCallback(callbackId, { code, data, msg })
///     - code === 0 成功，其余失败
///  2) 事件推送： window.__nativeEmit(eventName, data)
///
/// 所有回传统一在主线程通过 evaluateJavaScript 执行。
/// 注意：第二个参数为「JSON 字符串」（与 utils/h5-native-bridge.js 的解析约定一致）。
final class JsChannel {

    private weak var webView: WKWebView?

    init(webView: WKWebView?) {
        self.webView = webView
    }

    func attach(_ webView: WKWebView) {
        self.webView = webView
    }

    func resolve(_ callbackId: String?, code: Int, data: [String: Any]? = nil, msg: String? = nil) {
        guard let cb = callbackId, !cb.isEmpty else { return }
        var res: [String: Any] = ["code": code]
        if let msg = msg { res["msg"] = msg }
        if let data = data { res["data"] = data }
        let json = JsChannel.encode(res)
        evaluate("window.__nativeCallback(\(JsChannel.stringLiteral(cb)), \(JsChannel.stringLiteral(json)));")
    }

    func resolveOk(_ callbackId: String?, _ data: [String: Any]? = nil) {
        resolve(callbackId, code: 0, data: data)
    }

    func resolveErr(_ callbackId: String?, _ msg: String, code: Int = -1) {
        resolve(callbackId, code: code, data: nil, msg: msg)
    }

    func emit(_ event: String, _ data: [String: Any]) {
        let json = JsChannel.encode(data)
        evaluate("window.__nativeEmit(\(JsChannel.stringLiteral(event)), \(JsChannel.stringLiteral(json)));")
    }

    private func evaluate(_ js: String) {
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.webView else { return }
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    /// 对象 -> JSON 字符串
    static func encode(_ obj: Any) -> String {
        if let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
           let s = String(data: data, encoding: .utf8) {
            return s
        }
        return "{}"
    }

    /// 字符串 -> JS 字符串字面量（含引号）
    static func stringLiteral(_ s: String) -> String {
        if let data = try? JSONSerialization.data(withJSONObject: [s], options: []),
           var str = String(data: data, encoding: .utf8) {
            str.removeFirst()
            str.removeLast()
            return str
        }
        return "\"\""
    }
}
