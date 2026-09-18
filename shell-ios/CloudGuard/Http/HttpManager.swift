import Foundation

/// 原生 HTTP 管理器（iOS）。
///
/// 背景同 Android 端 http/HttpManager.kt：业务后端（xy.yefiot.com）未返回 CORS
/// 允许头，H5 在 WKWebView 内用 XHR 调用会被同源策略拦截（net::ERR_FAILED），
/// 导致登录/注册/验证码等接口全部失败。本模块让 JS 通过原生 URLSession 发起请求，
/// 彻底绕开 CORS。
///
/// 对应 utils/h5-native-bridge.js 的 NativeApp.request / NativeApp.upload：
///   http.request 入参 { url, method, header, data, timeout } -> { statusCode, data }
///   http.upload  入参 { url, name, fileName, mimeType, fileBase64, formData } -> { statusCode, data }
/// 其中 request 的 data 会尝试 JSON 解析（对齐 uni.request），upload 的 data 为响应原文。
///
/// 网络请求在 URLSession 后台线程执行，回传统一经 JsChannel 切回主线程。
final class HttpManager {

    private let channel: JsChannel
    private let session: URLSession

    init(channel: JsChannel) {
        self.channel = channel
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "http.request": doRequest(params: params, callbackId: callbackId)
        case "http.upload": doUpload(params: params, callbackId: callbackId)
        default: channel.resolveErr(callbackId, "unknown http method: \(method)")
        }
    }

    // MARK: - http.request

    private func doRequest(params: [String: Any], callbackId: String) {
        guard let rawUrl = params["url"] as? String, !rawUrl.isEmpty else {
            channel.resolveErr(callbackId, "empty url")
            return
        }
        let method = ((params["method"] as? String) ?? "GET").uppercased()
        let header = params["header"] as? [String: Any] ?? [:]
        let data = params["data"]
        let needsBody = (method != "GET" && method != "HEAD")

        guard let url = buildUrl(rawUrl, method: method, data: data) else {
            channel.resolveErr(callbackId, "invalid url: \(rawUrl)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        addHeaders(&request, header: header)
        // uni.request 的 timeout 单位为毫秒
        if let n = params["timeout"] as? NSNumber, n.doubleValue > 0 {
            request.timeoutInterval = n.doubleValue / 1000.0
        }

        if needsBody {
            request.httpBody = serializeBody(data)
            if request.value(forHTTPHeaderField: "Content-Type") == nil {
                request.setValue("application/json;charset=utf-8", forHTTPHeaderField: "Content-Type")
            }
        }

        let task = session.dataTask(with: request) { [weak self] body, response, error in
            guard let self = self else { return }
            if let error = error {
                self.channel.resolveErr(callbackId, "http error: \(error.localizedDescription)")
                return
            }
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let text = body.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            self.channel.resolveOk(callbackId, ["statusCode": code, "data": self.parseBody(text)])
        }
        task.resume()
    }

    // MARK: - http.upload

    private func doUpload(params: [String: Any], callbackId: String) {
        guard let rawUrl = params["url"] as? String, let url = URL(string: rawUrl), !rawUrl.isEmpty else {
            channel.resolveErr(callbackId, "empty url")
            return
        }
        let name = (params["name"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "file"
        let fileName = (params["fileName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "upload_\(Int(Date().timeIntervalSince1970 * 1000))"
        let mime = (params["mimeType"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "application/octet-stream"
        let fileBase64 = params["fileBase64"] as? String ?? ""
        let formData = params["formData"] as? [String: Any] ?? [:]
        let header = params["header"] as? [String: Any] ?? [:]
        let fileData = Data(base64Encoded: fileBase64) ?? Data()

        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        func append(_ s: String) {
            if let d = s.data(using: .utf8) { body.append(d) }
        }
        for (key, value) in formData {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n")
            append("\(stringify(value))\r\n")
        }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mime)\r\n\r\n")
        body.append(fileData)
        append("\r\n")
        append("--\(boundary)--\r\n")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        addHeaders(&request, header: header)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            if let error = error {
                self.channel.resolveErr(callbackId, "upload error: \(error.localizedDescription)")
                return
            }
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            self.channel.resolveOk(callbackId, ["statusCode": code, "data": text])
        }
        task.resume()
    }

    // MARK: - 工具

    /// 附加请求头（跳过 Content-Type，交由请求体决定）
    private func addHeaders(_ request: inout URLRequest, header: [String: Any]) {
        for (key, value) in header {
            if key.lowercased() == "content-type" { continue }
            let s = stringify(value)
            if !s.isEmpty { request.setValue(s, forHTTPHeaderField: key) }
        }
    }

    /// GET/HEAD 时把 data（字典）拼成 query string
    private func buildUrl(_ url: String, method: String, data: Any?) -> URL? {
        if method != "GET" && method != "HEAD" { return URL(string: url) }
        guard let dict = data as? [String: Any], !dict.isEmpty else { return URL(string: url) }
        guard var comps = URLComponents(string: url) else { return URL(string: url) }
        var items = comps.queryItems ?? []
        for (k, v) in dict {
            items.append(URLQueryItem(name: k, value: stringify(v)))
        }
        comps.queryItems = items
        return comps.url ?? URL(string: url)
    }

    /// 请求体序列化：字符串原样、字典/数组转 JSON、空值置空
    private func serializeBody(_ data: Any?) -> Data {
        guard let data = data, !(data is NSNull) else { return Data() }
        if let str = data as? String { return str.data(using: .utf8) ?? Data() }
        if JSONSerialization.isValidJSONObject(data),
           let d = try? JSONSerialization.data(withJSONObject: data, options: []) {
            return d
        }
        return "\(data)".data(using: .utf8) ?? Data()
    }

    /// 尝试把响应体解析为 JSON（对齐 uni.request），失败则原样返回字符串
    private func parseBody(_ body: String) -> Any {
        let t = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return "" }
        guard let d = t.data(using: .utf8) else { return t }
        if let obj = try? JSONSerialization.jsonObject(with: d, options: [.fragmentsAllowed]) {
            return obj
        }
        return t
    }

    /// 任意值 -> 字符串（NSNull / nil 视为空串）
    private func stringify(_ v: Any?) -> String {
        guard let v = v, !(v is NSNull) else { return "" }
        if let s = v as? String { return s }
        return "\(v)"
    }
}
