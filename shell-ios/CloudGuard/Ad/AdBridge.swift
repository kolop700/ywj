import Foundation
import UIKit
import CryptoKit

#if canImport(AnyThinkSDK)
import AnyThinkSDK
#endif

/// 广告桥接（ad.* / iOS）。
///
/// 双形态实现（编译期自动选择）：
///   1) `#if canImport(AnyThinkSDK)`（Taku iOS SDK 已集成）——真实实现：
///      - ad.init：ATAPI 初始化 + customData(user_type + user_id哈希) 下发（幂等，可重复调用）；
///      - ad.setUserType：UserDefaults 持久化 + 运行时更新 customData（对后续广告请求生效）；
///      - 激励视频 / 插屏 / 开屏 / 横幅：load + show 全套，结果经 ad.onEvent 异步下发；
///      - rect 说明：JS 以 CSS px 上报，WKWebView 中 CSS px 与 pt 1:1，无需 dpr 换算
///        （Android 侧需乘 dpr，见 shell-android AdBridge.showBanner）。
///   2) `#else`（SDK 未集成）——桩实现：init 返回失败使页面隐藏广告位；load/show 立即
///      下发 onAdFailed，兼容「不校验 isReady 即调用」的页面降级逻辑。
///
/// 事件载荷： { placementId, event, code, msg }
///   event ∈ onAdLoaded/onAdFailed/onAdShow/onAdClicked/onAdClosed/onReward/onAdPlayStart/onAdPlayEnd
final class AdBridge: NSObject {

    /// userType 本地持久化键（与 JS storage 键同名，便于对照排查）
    private static let userTypeDefaultsKey = "taku_user_type"

    private weak var host: WebViewController?
    private let channel: JsChannel

    /// 当前用户类型：'vip' | 'normal'（Taku 自定义流量分组 user_type）
    private var userType: String

    /// 用户 ID 原始值（仅内存保存；applyCustomData 时哈希后以 user_id 上报，供后台按用户对账，不传原始 ID）
    private var userId: String = ""

#if canImport(AnyThinkSDK)
    private var sdkStarted = false

    /// 横幅悬浮视图：positionKey -> ATBannerView
    private var bannerViews: [String: ATBannerView] = [:]
    /// 待挂载的横幅：positionKey -> (placementId, 目标矩形)；加载完成回调时自动挂载
    private var pendingBanners: [String: (placementId: String, rect: CGRect)] = [:]
#endif

    init(host: WebViewController, channel: JsChannel) {
        self.host = host
        self.channel = channel
        self.userType = UserDefaults.standard.string(forKey: AdBridge.userTypeDefaultsKey) ?? "normal"
        super.init()
    }

    // MARK: - 方法路由

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "ad.init":
            initAd(params: params, callbackId: callbackId)
        case "ad.setUserType":
            setUserType(params: params, callbackId: callbackId)
        case "ad.banner.hide":
            hideBanner(params: params, callbackId: callbackId)
        case "ad.native.show", "ad.native.hide":
            // 原生信息流（预留，二期实现）：与 Android 行为一致，直接成功返回
            channel.resolveOk(callbackId)
        default:
            handleAdAction(method: method, params: params, callbackId: callbackId)
        }
    }

    /// 页面销毁：清理横幅悬浮视图等资源（由 BridgeRouter.dispose 调用）
    func dispose() {
#if canImport(AnyThinkSDK)
        for (_, view) in bannerViews {
            view.removeFromSuperview()
        }
        bannerViews.removeAll()
        pendingBanners.removeAll()
#endif
    }

    // MARK: - 初始化 / 用户类型（两形态共用）

    private func initAd(params: [String: Any], callbackId: String?) {
        let appId = params["appId"] as? String ?? ""
        let appKey = params["appKey"] as? String ?? ""
        // 【VIP 免广告-流量分组】初始化前先落地用户类型：
        // 保证「开屏」等冷启动首个广告请求即命中 VIP 流量分组（官方要求 init 前设置）。
        if let ut = params["userType"] as? String, !ut.isEmpty {
            userType = (ut == "vip") ? "vip" : "normal"
            UserDefaults.standard.set(userType, forKey: AdBridge.userTypeDefaultsKey)
        }
        // 用户对账：userId 显式下发（空串 = 清除，键缺省 = 保持现值）
        if params.keys.contains("userId") {
            userId = params["userId"] as? String ?? ""
        }
        if appId.isEmpty || appKey.isEmpty {
            // 未配置凭据按「无广告」处理：返回成功但保持未就绪状态（避免异常噪音）
            channel.resolve(callbackId, 0, ["msg": "no ad config"])
            return
        }
#if canImport(AnyThinkSDK)
        // customData 在 start 前设置，保证初始化后的首个广告请求即携带分组信息
        applyCustomData()
        if sdkStarted {
            channel.resolve(callbackId, 0, ["msg": "already inited"])
            return
        }
#if DEBUG
        // 输出 IDFA 与设备信息，仅用于集成调试；禁止带入 Release 包
        ATAPI.setLogEnabled(true)
#endif
        do {
            // 初始化幂等（可重复调用）；本方法由 H5 在隐私同意后触发，不在启动路径调用
            try ATAPI.sharedInstance().start(withAppID: appId, appKey: appKey)
            sdkStarted = true
            channel.resolve(callbackId, 0, ["msg": "success"])
        } catch {
            channel.resolveErr(callbackId, "ATSDK init failed: \(error.localizedDescription)")
        }
#else
        channel.resolveErr(callbackId, "iOS ad sdk not integrated")
#endif
    }

    private func setUserType(params: [String: Any], callbackId: String?) {
        let t = (params["userType"] as? String == "vip") ? "vip" : "normal"
        userType = t
        UserDefaults.standard.set(t, forKey: AdBridge.userTypeDefaultsKey)
        // 用户对账：userId 显式下发（空串 = 清除，键缺省 = 保持现值）
        if params.keys.contains("userId") {
            userId = params["userId"] as? String ?? ""
        }
#if canImport(AnyThinkSDK)
        // 运行时更新全局自定义参数，对后续广告请求生效（已加载未展示的广告由 H5 adControl 兜底）
        applyCustomData()
#endif
        channel.resolveOk(callbackId)
    }

#if canImport(AnyThinkSDK)

    // ==================== 真实实现（Taku iOS SDK） ====================

    /// Taku 全局自定义参数（自定义流量分组）：
    /// 后台「流量分组 → 自定义规则」配置 user_type = vip 命中「VIP 免广告」分组（空广告源）。
    /// user_id 为 SHA-256 哈希前缀（假名标识，仅用于后台对账，不影响分组匹配）。
    private func applyCustomData() {
        var data: [AnyHashable: Any] = [:]
        data["user_type"] = userType
        let hashedId = AdBridge.hashUserId(userId)
        if !hashedId.isEmpty {
            data["user_id"] = hashedId
        }
        ATAPI.sharedInstance().customData = data
    }

    /// userId → SHA-256 十六进制前 16 位（不直接上报原始用户 ID）
    private static func hashUserId(_ raw: String) -> String {
        guard !raw.isEmpty else { return "" }
        let digest = SHA256.hash(data: Data(raw.utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return String(hex.prefix(16))
    }

    private func handleAdAction(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "ad.loadRewarded":
            loadRewarded(params: params, callbackId: callbackId)
        case "ad.showRewarded":
            showRewarded(params: params, callbackId: callbackId)
        case "ad.loadInterstitial":
            loadInterstitial(params: params, callbackId: callbackId)
        case "ad.showInterstitial":
            showInterstitial(params: params, callbackId: callbackId)
        case "ad.banner.show":
            showBanner(params: params, callbackId: callbackId)
        case "ad.splash.load":
            loadSplash(params: params, callbackId: callbackId)
        case "ad.splash.show":
            showSplash(params: params, callbackId: callbackId)
        default:
            channel.resolveErr(callbackId, "unknown ad method: \(method)")
        }
    }

    // ---- 激励视频 ----

    private func loadRewarded(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        let extra: [AnyHashable: Any] = [:]
        ATAdManager.shared().loadAD(withPlacementID: placementId, extra: extra, delegate: self)
        // 加载结果经 ad.onEvent 异步下发；立即释放调用（与 Android 行为一致）
        channel.resolveOk(callbackId)
    }

    private func showRewarded(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        guard let vc = host?.topViewController() else {
            fail(params: params, callbackId: callbackId, msg: "host released")
            return
        }
        guard ATAdManager.shared().rewardedVideoReady(forPlacementID: placementId) else {
            fail(params: params, callbackId: callbackId, msg: "ad not ready")
            return
        }
        let config = ATShowConfig(scene: params["sceneId"] as? String ?? "", showCustomExt: "")
        ATAdManager.shared().showRewardedVideo(withPlacementID: placementId,
                                               config: config,
                                               inViewController: vc,
                                               delegate: self)
        channel.resolveOk(callbackId)
    }

    // ---- 插屏 ----

    private func loadInterstitial(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        let extra: [AnyHashable: Any] = [:]
        ATAdManager.shared().loadAD(withPlacementID: placementId, extra: extra, delegate: self)
        channel.resolveOk(callbackId)
    }

    private func showInterstitial(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        guard let vc = host?.topViewController() else {
            fail(params: params, callbackId: callbackId, msg: "host released")
            return
        }
        guard ATAdManager.shared().interstitialReady(forPlacementID: placementId) else {
            fail(params: params, callbackId: callbackId, msg: "ad not ready")
            return
        }
        let config = ATShowConfig(scene: params["sceneId"] as? String ?? "", showCustomExt: "")
        ATAdManager.shared().showInterstitial(withPlacementID: placementId,
                                              showConfig: config,
                                              inViewController: vc,
                                              delegate: self,
                                              nativeMixViewBlock: nil)
        channel.resolveOk(callbackId)
    }

    // ---- 开屏 ----

    private func loadSplash(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        var extra: [AnyHashable: Any] = [:]
        // 开屏请求容忍超时（秒）：超时后 didTimeoutLoadingSplashAD 回调下发失败事件
        extra[kATSplashExtraTolerateTimeoutKey] = NSNumber(value: 8)
        ATAdManager.shared().loadAD(withPlacementID: placementId,
                                    extra: extra,
                                    delegate: self,
                                    containerView: nil)
        channel.resolveOk(callbackId)
    }

    private func showSplash(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        guard let host = host, let window = host.view.window else {
            fail(params: params, callbackId: callbackId, msg: "window not available")
            return
        }
        guard ATAdManager.shared().splashReady(forPlacementID: placementId) else {
            fail(params: params, callbackId: callbackId, msg: "ad not ready")
            return
        }
        let config = ATShowConfig(scene: params["sceneId"] as? String ?? "", showCustomExt: "")
        let extra: [AnyHashable: Any] = [:]
        ATAdManager.shared().showSplash(withPlacementID: placementId,
                                        config: config,
                                        window: window,
                                        inViewController: host,
                                        extra: extra,
                                        delegate: self)
        channel.resolveOk(callbackId)
    }

    // ---- 横幅（悬浮在 WebView 之上，按 JS 上报矩形定位） ----

    private func showBanner(params: [String: Any], callbackId: String?) {
        let placementId = params["placementId"] as? String ?? ""
        guard !placementId.isEmpty else {
            fail(params: params, callbackId: callbackId, msg: "empty placementId")
            return
        }
        let positionKey = (params["positionKey"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "default"

        // rect 缺省 = 仅预加载（taku-sdk.js preloadBannerAd），不挂载视图
        guard let rectDict = params["rect"] as? [String: Any],
              let left = cgFloat(rectDict["left"]),
              let top = cgFloat(rectDict["top"]),
              let width = cgFloat(rectDict["width"]),
              let height = cgFloat(rectDict["height"]),
              width > 0, height > 0 else {
            loadBanner(placementId: placementId, size: nil)
            channel.resolveOk(callbackId)
            return
        }
        // CSS px == pt（WKWebView），rect 直接使用
        let rect = CGRect(x: left, y: top, width: width, height: height)
        pendingBanners[positionKey] = (placementId: placementId, rect: rect)

        // 已就绪（多为预加载命中）直接挂载；否则按目标尺寸加载，didFinishLoadingAD 回调后自动挂载
        if ATAdManager.shared().bannerAdReady(forPlacementID: placementId) {
            mountBanner(placementId: placementId, positionKey: positionKey, rect: rect)
        } else {
            loadBanner(placementId: placementId, size: rect.size)
        }
        channel.resolveOk(callbackId)
    }

    private func loadBanner(placementId: String, size: CGSize?) {
        var extra: [AnyHashable: Any] = [:]
        if let size = size {
            // 尺寸需与 Taku 后台配置的横幅比例一致（等比例缩放规则）
            extra[kATAdLoadingExtraBannerAdSizeKey] = NSValue(cgSize: size)
        }
        ATAdManager.shared().loadAD(withPlacementID: placementId, extra: extra, delegate: self)
    }

    private func mountBanner(placementId: String, positionKey: String, rect: CGRect) {
        let mount = { [weak self] in
            guard let self = self, let host = self.host else { return }
            let config = ATShowConfig(scene: "", showCustomExt: "")
            guard let bannerView = ATAdManager.shared().retrieveBannerView(forPlacementID: placementId,
                                                                           config: config) else {
                self.emitEvent(placementId: placementId, event: "onAdFailed", code: -1, msg: "retrieve banner view failed")
                return
            }
            // 重建挂载：同 positionKey 旧视图先移除
            self.bannerViews[positionKey]?.removeFromSuperview()
            bannerView.delegate = self
            bannerView.presentingViewController = host
            bannerView.translatesAutoresizingMaskIntoConstraints = true
            bannerView.autoresizingMask = []
            bannerView.frame = rect
            host.view.addSubview(bannerView)
            self.bannerViews[positionKey] = bannerView
        }
        if Thread.isMainThread {
            mount()
        } else {
            DispatchQueue.main.async(execute: mount)
        }
    }

    private func hideBanner(params: [String: Any], callbackId: String?) {
        let positionKey = (params["positionKey"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "default"
        if let view = bannerViews[positionKey] {
            view.removeFromSuperview()
            bannerViews.removeValue(forKey: positionKey)
        }
        pendingBanners.removeValue(forKey: positionKey)
        channel.resolveOk(callbackId)
    }

    /// NSNumber/Double/Int -> CGFloat（rect 来自 JSON，数值类型不定）
    private func cgFloat(_ value: Any?) -> CGFloat? {
        if let d = value as? Double { return CGFloat(d) }
        if let i = value as? Int { return CGFloat(i) }
        if let n = value as? NSNumber { return CGFloat(truncating: n) }
        return nil
    }

#else

    // ==================== 桩实现（SDK 未集成） ====================

    private func handleAdAction(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "ad.loadRewarded", "ad.showRewarded",
             "ad.loadInterstitial", "ad.showInterstitial",
             "ad.banner.show", "ad.splash.load", "ad.splash.show":
            fail(params: params, callbackId: callbackId)
        default:
            channel.resolveErr(callbackId, "unknown ad method: \(method)")
        }
    }

    private func hideBanner(params: [String: Any], callbackId: String?) {
        channel.resolveOk(callbackId)
    }

#endif

    // MARK: - 事件与失败回传（两形态共用）

    /// load/show 失败：异步下发 onAdFailed，并立即释放调用
    private func fail(params: [String: Any], callbackId: String?, msg: String = "iOS ad sdk not integrated") {
        let placementId = params["placementId"] as? String ?? (params["positionKey"] as? String ?? "")
        emitEvent(placementId: placementId, event: "onAdFailed", code: -1, msg: msg)
        channel.resolveOk(callbackId)
    }

    private func emitEvent(placementId: String, event: String, code: Int, msg: String) {
        channel.emit("ad.onEvent", [
            "placementId": placementId,
            "event": event,
            "code": code,
            "msg": msg
        ])
    }
}

#if canImport(AnyThinkSDK)

// MARK: - Taku 回调（事件 -> ad.onEvent）
//
// 说明：delegate 方法统一使用显式 @objc(selector) 声明，规避头文件 nullability 标注差异
// 导致的 Swift 导入签名不匹配（SDK 按 selector 回调，与此处 Swift 参数类型无关）。

extension AdBridge: ATAdLoadingDelegate, ATRewardedVideoDelegate, ATInterstitialDelegate, ATSplashDelegate, ATBannerDelegate {}

@objc extension AdBridge {

    // ---- 加载通用（ATAdLoadingDelegate） ----

    @objc(didFinishLoadingADWithPlacementID:)
    func didFinishLoadingADWithPlacementID(_ placementID: String) {
        emitEvent(placementId: placementID, event: "onAdLoaded", code: 0, msg: "")
        // 横幅：加载完成后挂载等待中的悬浮视图
        for (key, pending) in pendingBanners where pending.placementId == placementID {
            mountBanner(placementId: placementID, positionKey: key, rect: pending.rect)
        }
    }

    @objc(didFailToLoadADWithPlacementID:error:)
    func didFailToLoadADWithPlacementID(_ placementID: String, error: NSError?) {
        emitEvent(placementId: placementID, event: "onAdFailed", code: error?.code ?? -1, msg: error?.localizedDescription ?? "")
    }

    // ---- 激励视频（ATRewardedVideoDelegate） ----

    @objc(rewardedVideoDidRewardSuccessForPlacemenID:extra:)
    func rewardedVideoDidRewardSuccessForPlacemenID(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onReward", code: 0, msg: "")
    }

    // 兼容修正拼写的版本（部分 SDK 版本可能已修正 PlacemenID -> PlacementID）
    @objc(rewardedVideoDidRewardSuccessForPlacementID:extra:)
    func rewardedVideoDidRewardSuccessForPlacementID(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onReward", code: 0, msg: "")
    }

    @objc(rewardedVideoDidStartPlayingForPlacementID:extra:)
    func rewardedVideoDidStartPlaying(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdPlayStart", code: 0, msg: "")
    }

    @objc(rewardedVideoDidEndPlayingForPlacementID:extra:)
    func rewardedVideoDidEndPlaying(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdPlayEnd", code: 0, msg: "")
    }

    @objc(rewardedVideoDidFailToPlayForPlacementID:error:extra:)
    func rewardedVideoDidFailToPlay(_ placementID: String, error: NSError?, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdFailed", code: error?.code ?? -1, msg: error?.localizedDescription ?? "")
    }

    @objc(rewardedVideoDidCloseForPlacementID:rewarded:extra:)
    func rewardedVideoDidClose(_ placementID: String, rewarded: Bool, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClosed", code: 0, msg: rewarded ? "rewarded" : "")
    }

    @objc(rewardedVideoDidClickForPlacementID:extra:)
    func rewardedVideoDidClick(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClicked", code: 0, msg: "")
    }

    // ---- 插屏（ATInterstitialDelegate） ----

    @objc(interstitialDidShowForPlacementID:extra:)
    func interstitialDidShow(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdShow", code: 0, msg: "")
    }

    @objc(interstitialFailedToShowForPlacementID:error:extra:)
    func interstitialFailedToShow(_ placementID: String, error: NSError?, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdFailed", code: error?.code ?? -1, msg: error?.localizedDescription ?? "")
    }

    @objc(interstitialDidStartPlayingVideoForPlacementID:extra:)
    func interstitialDidStartPlayingVideo(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdPlayStart", code: 0, msg: "")
    }

    @objc(interstitialDidEndPlayingVideoForPlacementID:extra:)
    func interstitialDidEndPlayingVideo(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdPlayEnd", code: 0, msg: "")
    }

    @objc(interstitialDidCloseForPlacementID:extra:)
    func interstitialDidClose(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClosed", code: 0, msg: "")
    }

    @objc(interstitialDidClickForPlacementID:extra:)
    func interstitialDidClick(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClicked", code: 0, msg: "")
    }

    // ---- 开屏（ATSplashDelegate） ----

    @objc(didFinishLoadingSplashADWithPlacementID:isTimeout:)
    func didFinishLoadingSplashAD(_ placementID: String, isTimeout: Bool) {
        // isTimeout=true 表示加载完成但已超时（仍视为加载成功，展示窗口由 JS 控制）
        emitEvent(placementId: placementID, event: "onAdLoaded", code: 0, msg: isTimeout ? "timeout" : "")
    }

    @objc(didTimeoutLoadingSplashADWithPlacementID:)
    func didTimeoutLoadingSplashAD(_ placementID: String) {
        emitEvent(placementId: placementID, event: "onAdFailed", code: -1, msg: "splash load timeout")
    }

    @objc(splashDidShowForPlacementID:extra:)
    func splashDidShow(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdShow", code: 0, msg: "")
    }

    @objc(splashDidCloseForPlacementID:extra:)
    func splashDidClose(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClosed", code: 0, msg: "")
    }

    @objc(splashDidClickForPlacementID:extra:)
    func splashDidClick(_ placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClicked", code: 0, msg: "")
    }

    @objc(splashDidShowFailedForPlacementID:error:extra:)
    func splashDidShowFailed(_ placementID: String, error: NSError?, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdFailed", code: error?.code ?? -1, msg: error?.localizedDescription ?? "")
    }

    // ---- 横幅（ATBannerDelegate） ----

    @objc(bannerView:didShowAdWithPlacementID:extra:)
    func bannerViewDidShow(_ bannerView: ATBannerView, placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdShow", code: 0, msg: "")
    }

    @objc(bannerView:didClickWithPlacementID:extra:)
    func bannerViewDidClick(_ bannerView: ATBannerView, placementID: String, extra: NSDictionary?) {
        emitEvent(placementId: placementID, event: "onAdClicked", code: 0, msg: "")
    }

    @objc(bannerView:didTapCloseButtonWithPlacementID:extra:)
    func bannerViewDidTapClose(_ bannerView: ATBannerView, placementID: String, extra: NSDictionary?) {
        // 用户点击横幅关闭按钮：移除对应悬浮视图
        for (key, view) in bannerViews where view === bannerView {
            view.removeFromSuperview()
            bannerViews.removeValue(forKey: key)
            pendingBanners.removeValue(forKey: key)
        }
        emitEvent(placementId: placementID, event: "onAdClosed", code: 0, msg: "")
    }
}

#endif
