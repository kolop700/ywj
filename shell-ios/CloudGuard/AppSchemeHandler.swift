import Foundation
import WebKit

/// 本地资源 scheme 处理器：把 cloudguard://app/<path> 映射到 App Bundle 内 WebApp 目录。
///
/// 目的：对齐 Android 端 WebViewAssetLoader（https://appassets.androidplatform.net），
/// 给 H5 一个稳定的 origin（cloudguard://app），使 localStorage / Blob / URL.createObjectURL
/// 等能力在 WKWebView 中正常工作（loadFileURL 的 file:// origin 在部分场景下受限）。
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {

    static let scheme = "cloudguard"
    /// 资源根路径标识（cloudguard://app/xxx -> WebApp/xxx）
    static let host = "app"

    private let queue = DispatchQueue(label: "com.yefiot.cloudguard.scheme", qos: .userInitiated)

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: AppSchemeHandler.scheme, code: -1))
            return
        }

        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let rel = path.hasPrefix("/") ? String(path.dropFirst()) : path

        guard let fileURL = AppSchemeHandler.resolveResource(rel) else {
            urlSchemeTask.didFailWithError(NSError(domain: AppSchemeHandler.scheme, code: -2,
                                                   userInfo: [NSLocalizedDescriptionKey: "resource not found: \(rel)"]))
            return
        }

        queue.async {
            do {
                let data = try Data(contentsOf: fileURL)
                let mime = AppSchemeHandler.mimeType(for: fileURL.pathExtension)
                let headers: [String: String] = [
                    "Content-Type": mime,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
                let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                               headerFields: headers)!
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
            } catch {
                urlSchemeTask.didFailWithError(error)
            }
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // 单次读取，无需处理取消
    }

    // MARK: - 资源解析

    private static func resolveResource(_ rel: String) -> URL? {
        let fileManager = FileManager.default
        // 1) Bundle 内 WebApp 目录（文件夹引用方式打包）
        if let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("WebApp") {
            let candidate = resourceRoot.appendingPathComponent(rel)
            if fileManager.fileExists(atPath: candidate.path) { return candidate }
        }
        // 2) Bundle 根（WebApp 被平铺的场景）
        if let root = Bundle.main.resourceURL {
            let candidate = root.appendingPathComponent(rel)
            if fileManager.fileExists(atPath: candidate.path) { return candidate }
        }
        return nil
    }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "webp": return "image/webp"
        case "bmp": return "image/bmp"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "ico": return "image/x-icon"
        case "map": return "application/json; charset=utf-8"
        case "mp4": return "video/mp4"
        case "mp3": return "audio/mpeg"
        default: return "application/octet-stream"
        }
    }
}
