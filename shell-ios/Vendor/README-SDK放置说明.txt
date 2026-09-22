云卫家 iOS 壳 SDK 放置说明（shell-ios/Vendor/）
==================================================

本目录存放 iOS 壳工程的外部 SDK 第三方二进制文件。
放入文件后，到 shell-ios/project.yml 取消对应 framework 依赖的注释，
再执行 xcodegen generate（Mac 上），即可启用对应能力。
（注：桥接层按 #if canImport(...) 自动切换真实/桩实现，无需改代码。
      微信 OpenSDK 属例外——文件与依赖均已就绪，无需任何操作。）

--------------------------------------------------
1) WechatOpenSDK/  —— 微信 OpenSDK（已就位，v2.0.8 XCFramework，含支付）
--------------------------------------------------
文件：WechatOpenSDK.xcframework
      （ios-arm64 真机 + ios-arm64_x86_64-simulator 模拟器）
来源：微信开放平台官方下载（https://developers.weixin.qq.com/doc/oplatform/Downloads/iOS_Resource.html）
作用：拉起微信小程序（管理员登录）、微信分享/支付
工程：已启用（project.yml 已配置 framework + 7 个系统库，直接 xcodegen generate 即可）
注意：Git for Windows 无法记录文件执行位，首次在 Mac 上使用若报权限错误：
      chmod +x WechatOpenSDK.xcframework/ios-arm64/WechatOpenSDK.framework/WechatOpenSDK
      （scripts/build-ios.sh 已内置该修复）

--------------------------------------------------
2) AnyThinkSDK/  —— Taku 广告 SDK（已改用 CocoaPods，无需放入本目录）
--------------------------------------------------
更新（2026-09-22）：Taku 聚合主包与必要的酷映 Adx 适配器均已发布到 CocoaPods 官方源
      （经 trunk 核实），已在 shell-ios/Podfile 配好，无需再从下载中心手动下载 framework：
        pod 'AnyThinkiOS', '6.5.73'                                    # 聚合 SDK 主包
        pod 'AnyThinkMediationAdxSmartdigimktCNAdapter', '6.5.78.2.0' # 酷映 Adx SDK（necessary）
      构建顺序：xcodegen generate → pod install → 打开 CloudGuard.xcworkspace 编译
同步：下载中心的 SKAdNetwork IDs（109 个）与外询白名单（38 个）已合并进
      shell-ios/CloudGuard/Info.plist（2026-09-22），无需再手工维护。
（历史：此前判断「AnyThinkSDK.framework 不在公开源、需下载放 Vendor」已作废。）

--------------------------------------------------
3) LiteMob/  —— 莱特摩比（Litemize）iOS SDK
--------------------------------------------------
方式：已确认 CocoaPods 公开源可用（2026-09），推荐 pod 集成——shell-ios/Podfile 已备好：
      pod 'LitemobAd', '1.5.9'           # SDK 主包（文档指定版本）
      pod 'LitemobTakuAdapter', '1.1.3'  # Taku 适配器（文档指定版本）
      构建顺序：xcodegen generate → pod install → 打开 CloudGuard.xcworkspace
备用：若走手动部署（莱特摩比《手动部署》文档），framework 放入本目录并在
      project.yml 取消「Litemize」注释；需额外补 24 个系统依赖库与
      PrivacyInfo.xcprivacy（iOS17）——完整清单见 iOS编译接入说明.md 4.7
说明：Litemize 在 Taku 中按「自定义广告平台」接入（与 Android 端 adapter-topon
      同构），Taku 后台 Adapter 类名：LMTakuRewardedVideoAdapter/LMTakuSplashAdapter/
      LMTakuNativeAdapter/LMTakuBannerAdapter/LMTakuInterstitialAdapter；
      JS/H5/AdBridge 层无需改动。完整接入步骤见 shell-ios/iOS编译接入说明.md 4.7。

--------------------------------------------------
移除 / 更新 SDK 时
--------------------------------------------------
直接替换本目录内文件即可；若文件名变化，同步修改 project.yml 中的引用路径。
