import Foundation
import UIKit

#if canImport(WechatOpenSDK)
import WechatOpenSDK
#endif

/// 拉起微信小程序桥接（miniprogram.launch，对应 Android MiniProgramBridge）。
///
/// - 依赖：WechatOpenSDK（已放置 shell-ios/Vendor/WechatOpenSDK/，project.yml 已启用依赖，见 iOS编译接入说明.md）；
///   未集成时以 #if canImport(WechatOpenSDK) 自动编译为桩实现（调用返回明确错误提示）。
/// - 前置：微信开放平台「移动应用」（appId）与目标小程序绑定同一开放平台账号，否则 send 直接失败。
/// - 回跳：拉起小程序后由微信经 wx{appId}:// 回跳本 App → SceneDelegate/AppDelegate 转发 handleOpenURL。
/// - 本桥 resolveOk 语义为「拉起指令已发出」，不等待用户操作结果（无需回包）。
final class MiniProgramBridge: NSObject {

    /// 微信开放平台「移动应用」配置的 Universal Link（与开放平台后台、AASA 文件三处一致）。
    /// 说明：2.0.8 起 SDK 仅提供 registerApp(_:universalLink:)，universalLink 须为合法 https 串；
    ///      当前域名 xy.yefiot.com 为项目自有服务器（AASA 部署文件见 shell-ios/UniversalLink/，
    ///      服务器路径 /var/www/html/.well-known/apple-app-site-association）。
    ///      如开放平台后台修改了 UL，请同步修改此处或经 H5 参数 universalLink 传入。
    private static let defaultUniversalLink = "https://xy.yefiot.com/app/"

    private let channel: JsChannel

    init(channel: JsChannel) {
        self.channel = channel
        super.init()
    }

    func handle(method: String, params: [String: Any], callbackId: String) -> Bool {
        guard method == "miniprogram.launch" else { return false }
        launch(params: params, callbackId: callbackId)
        return true
    }

    /// 拉起微信小程序（WXLaunchMiniProgramReq；userName 为小程序原始 ID gh_xxx）
    private func launch(params: [String: Any], callbackId: String?) {
        let appId = params["appId"] as? String ?? ""
        let userName = params["userName"] as? String ?? ""
        if appId.isEmpty || userName.isEmpty {
            channel.resolveErr(callbackId, "missing appId/userName（微信开放平台 AppId 未配置？）")
            return
        }

        #if canImport(WechatOpenSDK)
        // 注册 AppId（回跳 URL 解析依赖；重复调用无副作用）
        // 2.0.8 起仅提供 registerApp(_:universalLink:) 双参数版本（Universal Link 需与开放平台后台一致，
        // 未配置真实 UL 时占位值不影响拉起小程序；可经 H5 参数 universalLink 传入覆盖）
        let universalLink = params["universalLink"] as? String ?? Self.defaultUniversalLink
        WXApi.registerApp(appId, universalLink: universalLink)

        let req = WXLaunchMiniProgramReq()
        req.userName = userName
        req.path = params["path"] as? String ?? ""
        let type = params["type"] as? Int ?? 0
        req.miniProgramType = WXMiniProgramType(rawValue: UInt(type)) ?? .release

        if WXApi.send(req) {
            channel.resolveOk(callbackId)
        } else {
            channel.resolveErr(callbackId, "send failed（微信未安装，或开放平台未关联小程序）")
        }
        #else
        channel.resolveErr(callbackId, "未集成微信 SDK（WechatOpenSDK）：按 shell-ios/iOS编译接入说明.md 添加依赖后可用")
        #endif
    }

    /// 处理微信回跳 URL（SceneDelegate / AppDelegate 转发）；返回是否已消费
    @discardableResult
    static func handleOpenURL(_ url: URL) -> Bool {
        #if canImport(WechatOpenSDK)
        return WXApi.handleOpen(url, delegate: callbackDelegate)
        #else
        return false
        #endif
    }

    /// 处理微信经 Universal Link 回跳（SceneDelegate scene(_:continue:) / AppDelegate 转发）；返回是否已消费
    @discardableResult
    static func handleOpenUniversalLink(_ userActivity: NSUserActivity) -> Bool {
        #if canImport(WechatOpenSDK)
        return WXApi.handleOpenUniversalLink(userActivity, delegate: callbackDelegate)
        #else
        return false
        #endif
    }

    #if canImport(WechatOpenSDK)
    /// 微信回调 delegate（拉起小程序返回时回调；无业务动作，仅日志留痕）
    private static let callbackDelegate = CallbackDelegate()

    private final class CallbackDelegate: NSObject, WXApiDelegate {
        func onReq(_ req: BaseReq) {
            // 微信主动请求本应用：暂无需处理
        }

        func onResp(_ resp: BaseResp) {
            // 拉起小程序返回：WXLaunchMiniProgramResp（errCode=0 表示正常返回）
            NSLog("[MiniProgramBridge] wx resp type=\(resp.type) errCode=\(resp.errCode)")
        }
    }
    #endif
}
