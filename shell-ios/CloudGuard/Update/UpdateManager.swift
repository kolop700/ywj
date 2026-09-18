import Foundation
import UIKit

/// App 更新与系统能力（app.* / iOS）。
///
///   app.download {url, taskId}       -> URLSession 下载，事件 app.onDownloadProgress
///   app.installPackage {filePath}    -> iOS 不允许安装 APK，提示走 App Store
///   app.openStore {url}              -> 跳转 App Store
///   app.openSettings {}              -> 打开本应用系统设置
///   app.quit {}                      -> 退出应用
final class UpdateManager: NSObject {

    private weak var host: WebViewController?
    private let channel: JsChannel

    private var session: URLSession!
    private struct DownloadContext {
        let taskId: String
        let callbackId: String
    }
    private var downloads: [Int: DownloadContext] = [:]

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
        super.init()
        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "app.download": download(params: params, callbackId: callbackId)
        case "app.installPackage": installPackage(callbackId: callbackId)
        case "app.openStore": openStore(params: params, callbackId: callbackId)
        case "app.openSettings": openSettings(callbackId: callbackId)
        case "app.quit": quit(callbackId: callbackId)
        default: channel.resolveErr(callbackId, "unknown app method: \(method)")
        }
    }

    // MARK: - 下载

    private func download(params: [String: Any], callbackId: String?) {
        guard let urlStr = params["url"] as? String, let url = URL(string: urlStr), !urlStr.isEmpty else {
            channel.resolveErr(callbackId, "url 为空")
            return
        }
        let taskId = (params["taskId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            ?? "dl_\(Int(Date().timeIntervalSince1970 * 1000))"
        let task = session.downloadTask(with: url)
        downloads[task.taskIdentifier] = DownloadContext(taskId: taskId, callbackId: callbackId ?? "")
        task.resume()
    }

    // MARK: - 安装 / 商店

    private func installPackage(callbackId: String?) {
        channel.resolveErr(callbackId, "iOS 端请通过 App Store 更新")
    }

    private func openStore(params: [String: Any], callbackId: String?) {
        var urlStr = params["url"] as? String ?? ""
        if urlStr.isEmpty {
            urlStr = "itunes.apple.com"
        }
        // 将 http(s) 的 itunes 链接转换为 itms-apps 以直达 App Store
        if urlStr.contains("itunes.apple.com") && !urlStr.hasPrefix("itms-apps") {
            urlStr = urlStr.replacingOccurrences(of: "https://", with: "itms-apps://")
                .replacingOccurrences(of: "http://", with: "itms-apps://")
        }
        guard let url = URL(string: urlStr) else {
            channel.resolveErr(callbackId, "无效的商店地址")
            return
        }
        UIApplication.shared.open(url, options: [:]) { [weak self] ok in
            if ok { self?.channel.resolveOk(callbackId) }
            else { self?.channel.resolveErr(callbackId, "打开商店失败") }
        }
    }

    private func openSettings(callbackId: String?) {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            channel.resolveErr(callbackId, "打开设置失败")
            return
        }
        UIApplication.shared.open(url, options: [:]) { [weak self] ok in
            if ok { self?.channel.resolveOk(callbackId) }
            else { self?.channel.resolveErr(callbackId, "打开设置失败") }
        }
    }

    private func quit(callbackId: String?) {
        channel.resolveOk(callbackId)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            exit(0)
        }
    }
}

// MARK: - URLSessionDownloadDelegate

extension UpdateManager: URLSessionDownloadDelegate {

    func urlSession(_ session: URLSession,
                    downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64,
                    totalBytesExpectedToWrite: Int64) {
        guard let ctx = downloads[downloadTask.taskIdentifier] else { return }
        let percent = totalBytesExpectedToWrite > 0
            ? Int((totalBytesWritten * 100) / totalBytesExpectedToWrite)
            : 0
        channel.emit("app.onDownloadProgress", [
            "taskId": ctx.taskId,
            "percent": percent,
            "downloadedSize": totalBytesWritten,
            "totalSize": totalBytesExpectedToWrite
        ])
    }

    func urlSession(_ session: URLSession,
                    downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {
        guard let ctx = downloads.removeValue(forKey: downloadTask.taskIdentifier) else { return }
        let name = downloadTask.response?.suggestedFilename ?? UUID().uuidString
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: dest)
        do {
            try FileManager.default.moveItem(at: location, to: dest)
            channel.resolveOk(ctx.callbackId, ["filePath": dest.path])
        } catch {
            channel.resolveErr(ctx.callbackId, "下载保存失败: \(error.localizedDescription)")
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error = error, let ctx = downloads.removeValue(forKey: task.taskIdentifier) else { return }
        channel.resolveErr(ctx.callbackId, "下载失败: \(error.localizedDescription)")
    }
}
