import Foundation
import UIKit

/// 分享原生实现（share.wechat / iOS）。
///
/// 采用系统 UIActivityViewController：已安装微信时分享面板内含「微信/朋友圈」；
/// 无需强制集成微信 OpenSDK 即可运行。如需精致化分享（自定义缩略图/直达朋友圈/深链回跳），
/// 可后续集成微信 SDK 并替换本实现。
final class ShareManager {

    private weak var host: WebViewController?
    private let channel: JsChannel

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
    }

    func handle(method: String, params: [String: Any], callbackId: String) {
        guard method == "share.wechat" else {
            channel.resolveErr(callbackId, "unknown share method: \(method)")
            return
        }
        share(params: params, callbackId: callbackId)
    }

    private func share(params: [String: Any], callbackId: String?) {
        var items: [Any] = []

        if let base64 = params["imageBase64"] as? String, !base64.isEmpty,
           let data = Data(base64Encoded: base64), let image = UIImage(data: data) {
            items.append(image)
        }
        if let href = params["href"] as? String, !href.isEmpty {
            items.append(href)
        }
        if let title = params["title"] as? String, !title.isEmpty {
            items.append(title)
        }
        if let summary = params["summary"] as? String, !summary.isEmpty {
            items.append(summary)
        }
        if items.isEmpty {
            items.append(params["title"] as? String ?? "")
        }

        guard let presenter = host?.topViewController() else {
            channel.resolveErr(callbackId, "分享失败: 无可用界面")
            return
        }

        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = activity.popoverPresentationController, let view = host?.view {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
        }
        activity.completionWithItemsHandler = { [weak self] _, completed, _, _ in
            self?.channel.resolveOk(callbackId, ["errMsg": completed ? "share:ok" : "share:cancel"])
        }
        presenter.present(activity, animated: true)
    }
}
