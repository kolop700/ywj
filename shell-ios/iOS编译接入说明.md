# iOS 编译接入说明（P3：Taku 广告 + Apple IAP）

> 本说明面向在 Mac 上编译 `shell-ios`（CloudGuard）的同学。
> 当前代码已全部交付；**无 Mac 环境期间无法编译验证**，请按本文步骤在 Mac 上完成编译与联调。

---

## 一、本期交付内容（P3 + 微信小程序桥）

| 文件 | 状态 | 说明 |
|---|---|---|
| `CloudGuard/Ad/AdBridge.swift` | 重写 | Taku 真实实现（init/setUserType/激励/插屏/开屏/横幅）；`#if canImport(AnyThinkSDK)` 双形态：SDK 未集成时自动降级为桩 |
| `CloudGuard/Pay/PayBridge.swift` | 新增 | StoreKit 1 内购桥；事件经 `pay.onEvent` 回传 receipt/transactionId/orderNo |
| `CloudGuard/MiniProgram/MiniProgramBridge.swift` | 新增 | 拉起微信小程序桥（`miniprogram.launch`）；`#if canImport(WechatOpenSDK)` 双形态：SDK 未集成时降级为桩（见第五节） |
| `CloudGuard/SceneDelegate.swift` / `AppDelegate.swift` | 修改 | 微信回跳转发 `MiniProgramBridge.handleOpenURL` / `handleOpenUniversalLink`（scheme + Universal Link） |
| `CloudGuard/BridgeRouter.swift` | 修改 | `pay.*` / `miniprogram.*` 方法路由 + `dispose()`（页面销毁清理广告视图/支付观察者） |
| `CloudGuard/WebViewController.swift` | 修改 | `deinit` 调用 `router.dispose()` |
| `project.yml` | 修改 | 新增 `StoreKit.framework`；**微信 OpenSDK 依赖已启用**（framework + 7 个系统库）；Taku framework 引入模板（默认注释，见第四、五节） |
| `CloudGuard/Info.plist` | 修改 | 已追加 `NSUserTrackingUsageDescription`（ATT）、`SKAdNetworkItems`（优量汇/穿山甲）、`LSApplicationQueriesSchemes`（微信/支付宝）、`CFBundleURLTypes`（微信回跳 `wx4c80533df6184dda` 已填） |
| `CloudGuard/WebApp/**` | 已同步 | H5 产物（含 VIP 页面、IAP receipt 上报逻辑、Taku 平台分组凭据），由 `npm run sync:h5` 生成 |
| 后端 `backend-vip-php/v1/` | 新增 | `verifyIapOrder/index.php` + `vip/_lib.php` IAP 校验函数 + `vip_pay_config.php` 苹果配置 |

前端关联改动（已构建进 WebApp，不需在 Xcode 侧操作）：
- `utils/payUtils.js`：IAP 支付成功后先调 `verifyIapOrder` 上报苹果收据（重试 3 次），再查单确认；
- `common/taku-sdk.js`：`TAKU_CONFIG` 改为平台分组（`android` / `ios`），iOS 凭据填入 `TAKU_CONFIG.ios`；
  另：登录后自动透传 `userId`（缓存键 `taku_user_id`，退登清除），原生 **SHA-256 哈希后**随
  customData 以 `user_id` 字段上报 Taku，供后台按用户对账（不传原始 ID）。
- `workbench_package/pages/my/index.vue`：管理员登录入口新增 H5 分支——经 `NativeApp.launchMiniProgram`
  拉起 ywjxcx 管理端（`WX_MINI_PROGRAM.appId` 已填 `wx4c80533df6184dda`，见第五节）；
- `utils/h5-native-bridge.js`：新增 `NativeApp.launchMiniProgram(options)`（桥方法 `miniprogram.launch`）。

---

## 二、前置环境

- macOS Sequoia 15.6 及以上 + **Xcode 26 及以上**（部署目标 iOS 15.0）
  - 苹果要求：自 2026-04-28 起，上传 App Store Connect 必须使用 **iOS 26 SDK（Xcode 26+）** 构建；
  - Xcode 26.2 / 26.3 支持 macOS Sequoia 15.6+；Xcode 26.4 及以上需 macOS Tahoe 26.2+（两者均满足上传要求）。
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)：`brew install xcodegen`
- CocoaPods（集成 Taku 聚合 SDK + 莱特摩比 SDK，`shell-ios/Podfile` 已配好）：`brew install cocoapods`
- Taku iOS SDK 接入：**已改为 CocoaPods 集成**（`AnyThinkiOS` 6.5.73 + 酷映 Adx 适配器 6.5.78.2.0，2026-09 经 trunk 核实公开源可用），无需再手动下载 framework（详见第四节）
- 微信 OpenSDK 2.0.8：**已放置** `shell-ios/Vendor/WechatOpenSDK/WechatOpenSDK.xcframework` 且依赖已启用
  （官方 XCFramework 静态库，含 arm64 真机 + 模拟器切片；见第五节）
- 待配置凭据（见第四、五、六节）：
  - Taku 后台 iOS 应用 AppId / AppKey / 各广告位 placementId
  - 微信开放平台「移动应用」AppId（wx 开头；须与小程序绑定同一开放平台账号，见第五节 5.1）
  - App Store Connect 内购商品（已按 `vip_products.php` 约定 ID，见第六节）

---

## 三、编译步骤

### 3.1 一键脚本（推荐）

仓库根目录执行：

```bash
bash scripts/build-ios.sh            # 构建 + 导出 ipa（本地验证）
bash scripts/build-ios.sh upload     # 构建 + 导出 + 直接上传 App Store Connect（TestFlight）
```

脚本自动完成：framework 执行位修复 → `xcodegen generate` → `pod install`（存在 Podfile 时）→ `archive`（自动改用 `.xcworkspace`）→ 导出/上传。
无 Mac 时可用仓库内置 GitHub Actions 云构建（`.github/workflows/ios-release.yml`：Actions 手动触发或推送 `v*` 标签，
Secrets 配置清单见该文件头部注释）。

### 3.2 手动步骤

```bash
# 1) 生成 Xcode 工程（每次修改 project.yml 后需重新执行）
cd shell-ios
xcodegen generate

# 2) 打开工程
open CloudGuard.xcodeproj
```

> 导出/上传 ipa 的配置见 `shell-ios/ExportOptions.plist`（method=app-store-connect、TeamID=737647MFYB、自动签名）。

工程设置要点：
- **签名**：`project.yml` 中 `DEVELOPMENT_TEAM` 已预填 `737647MFYB`（Shenzhen Yefiot IoT Tech,.LTD，与 `weijia-2.mobileprovision` 同团队），
  Mac 上打开工程自动选中；如团队/证书不同，在 Xcode → Signing & Capabilities 重新选择（Automatic 签名）。
- **Bundle ID**：`com.yefiot.communityios`（`project.yml` 中 `PRODUCT_BUNDLE_IDENTIFIER`，与 `证书/weijia-2.mobileprovision` 一致，2026-09-04 签发、App Store 分发）。
  如需更改，需同步四处：开发者后台（App ID + 描述文件）、`project.yml`、后端 `vip_pay_config.php` 的 `apple.bundle_id`、App Store Connect 应用记录。
- **App 图标**：已内置 `CloudGuard/Assets.xcassets/AppIcon.appiconset`（1024×1024、**无 alpha 通道**，App Store 上传硬性要求）。
  换图标时直接替换 `Icon-1024.png`（保持无 alpha、满幅直角，系统自动切圆角），无需改配置。
- **H5 产物更新**：仓库根目录执行 `npm run build:h5 && npm run sync:h5` 后，Xcode 直接重新编译即可
  （`WebApp` 为 folder reference，新文件自动包含，无需重跑 `xcodegen`）。

> **可以先不带广告 SDK 编译**：此时 `AdBridge.swift` 走 `#else` 桩分支——编译通过、广告位自动隐藏，
> 可先行验证 H5、支付链路与 IAP。Taku SDK 就绪后再做第四节。

---

## 四、Taku 广告 SDK 集成

### 4.1 集成方式（CocoaPods，已配置）

`shell-ios/Podfile` 已配好 Taku 全量 pod（2026-09-22 经 CocoaPods trunk 核实公开源可用，无需再从下载中心手动下载 framework）：

```ruby
target 'CloudGuard' do
  pod 'AnyThinkiOS', '6.5.73'                                    # Taku 聚合 SDK 主包
  pod 'AnyThinkMediationAdxSmartdigimktCNAdapter', '6.5.78.2.0' # 酷映 Adx SDK（necessary，下载中心标注必装）
  pod 'LitemobAd', '1.5.9'             # 莱特摩比 SDK 主包
  pod 'LitemobTakuAdapter', '1.1.3'    # 莱特摩比 Taku 适配器
end
```

> 历史说明（已作废）：此前判断「AnyThinkSDK.framework 不在公开 pod 源、需下载后放 Vendor/ 并改 project.yml」，
> 已由 Taku 下载中心生成的 pod 代码（`AnyThinkiOS`）推翻——trunk 核实 6.5.73 可直接安装。

### 4.2 构建步骤

`xcodegen generate` → `pod install` → 打开 `CloudGuard.xcworkspace` 编译（顺序不能颠倒，此后每次改 `project.yml` 都要重跑这两步）。

若个别 Adapter 有额外系统库依赖，按 Taku 各 Adapter 文档在 `project.yml` 补充（本方案广告源为莱特摩比，依赖由 LitemobTakuAdapter pod 自动处理）。

### 4.3 双形态机制（无需手动开关）

`AdBridge.swift` 顶部 `#if canImport(AnyThinkSDK)` 编译期自动判断：
- framework 已加入 target → 真实实现；
- 未加入 → 桩实现（init 返回失败、页面隐藏广告位），保证工程始终可编译。

### 4.4 Taku 后台配置（iOS 应用）

1. **应用管理**：创建 iOS 应用 → 记录 `AppId / AppKey`；
2. **广告位**（流量管理-广告位）：为 iOS 应用创建 5 类广告位（横幅/插屏/激励视频/原生信息流/开屏），记录 `placementId`；
3. **广告平台**：配置至少 1 个 iOS 平台账号（优量汇/穿山甲）并绑定；
4. **流量分组**（VIP 免广告，与 Android 同一套规则思路）：
   - 新建分组「VIP免广告」，自定义规则 `user_type = vip`，分组**优先级置顶**；
   - 组内所有 iOS 广告位**不配置任何广告源**（空瀑布）；
   - 其余流量走默认分组正常展示。
5. **用户对账**（自动，无需配置）：登录/开通后 App 会随 customData 附带 `user_id`
   （userId 的 SHA-256 哈希前 16 位），后台广告请求日志/分组报表可按该字段核对到人。

### 4.5 凭据填入点（前端两处）

| 配置 | 文件 | 位置 |
|---|---|---|
| iOS AppId / AppKey | `common/taku-sdk.js` | `TAKU_CONFIG.ios`（运行时按平台自动选择，Android 不受影响） |
| iOS 5 个 placementId | `store/modules/ad.js` | `AD_IDS.ios`（banner/interstitial/rewardedVideo/informationflow/splash） |

填完后重新构建同步 H5：

```bash
# 仓库根目录
npm run build:h5 && npm run sync:h5
```

> 注：iOS 端原生信息流（`AD_IDS.ios.informationflow`）当前为预留位，`ad.native.show` 直接成功返回（不展示），
> 与 Android 二期实现对齐；其余 4 类广告位已完整可用。

### 4.6 Info.plist（已配置，无需改动）

- `NSUserTrackingUsageDescription`：ATT 弹窗文案（iOS 14.5+ 访问 IDFA 前弹窗；由 `AdBridge.requestTrackingIfNeeded` 在 ad.init 链路主动请求，授权回调完成/超时后才放行初始化）；
- `SKAdNetworkItems`：**已按 Taku 下载中心完整列表合并**（2026-09-22，共 109 个，覆盖优量汇/穿山甲/莱特摩比链路全部归因 ID）；
- `LSApplicationQueriesSchemes`：**已按 Taku ADX 建议列表合并**（2026-09-22，共 38 个，含微信/支付宝/拼多多/淘宝/美团/快手/小红书等外询白名单）。

### 4.7 Litemize（莱特摩比）自定义广告平台（接入路径已确认，2026-09-17 核实）

> Android 端已通过「Taku 自定义广告平台」接入莱特摩比（Litemize，包名 `com.ltmb`）：
> 使用其官方 `adapter-topon` aar + core SDK（见 `nativeplugins/TakuAdsNativePlugin/android/`）。
> iOS 端文档与 SDK 已核实完毕（官方飞书《iOS集成手册》系列文档已全部通读）。

**核实结果：**

- 莱特摩比 iOS SDK 与 Taku 适配器**均已发布到 CocoaPods 官方源**，可直接安装：
  - `pod 'LitemobAd', '1.5.9'` — SDK 主包（当前最新，飞书文档指定版本）；
  - `pod 'LitemobTakuAdapter', '1.1.3'` — Taku 适配器（当前最新，飞书文档指定版本）。
- 官方支持两种集成方式：CocoaPods（推荐）与手动部署。手动部署要求：24 个系统依赖库、
  链接器标志 `-ObjC`、`LitemobSDK.framework` Embed & Sign、`PrivacyInfo.xcprivacy`（iOS17+）。
  **采用 CocoaPods 时依赖与嵌入由 pod 自动处理；`-ObjC` 无论何种方式都必须配置**（`project.yml` 已加）。

**集成步骤（Mac 上，按序）：**

1. `shell-ios/Podfile` 已备好（版本已锁定，内容如下）：

   ```ruby
   platform :ios, '15.0'
   target 'CloudGuard' do
     pod 'AnyThinkiOS', '6.5.73'                                    # Taku 聚合 SDK 主包
     pod 'AnyThinkMediationAdxSmartdigimktCNAdapter', '6.5.78.2.0' # 酷映 Adx SDK（necessary）
     pod 'LitemobAd', '1.5.9'
     pod 'LitemobTakuAdapter', '1.1.3'
   end
   ```

2. Taku 主包已确认走公开 pod 源（`AnyThinkiOS`，2026-09-22 经 trunk 核实），第四节按 pod 方式集成，无需手动下载放 Vendor；
3. 构建顺序：`xcodegen generate` → `pod install` → 打开 `CloudGuard.xcworkspace` 编译
   （此后每次改 `project.yml` 都要重跑这两步）；
4. **Taku 后台**（iOS 应用 → 广告平台 → 自定义广告平台 → 新建）：
   - 平台名 `LiteMob`；Adapter 类名（按广告类型填）：
     `LMTakuRewardedVideoAdapter`（激励视频）、`LMTakuSplashAdapter`（开屏）、
     `LMTakuNativeAdapter`（信息流）、`LMTakuBannerAdapter`（横幅）、`LMTakuInterstitialAdapter`（插屏）；
   - 莱特摩比 appId：以 **key 大写**形式上送；代码位：填对应广告位 id；**头部竞价：是**；
5. **联调**（《广告测试》文档，先用测试参数跑通，再换正式）：

   | 类型 | 测试代码位 ID |
   |---|---|
   | 开屏 | `95085211902` |
   | 插屏 | `98303834805` |
   | 信息流-自渲染 | `96140484501` |
   | 信息流-模板 | `95047372401` |
   | 激励视频 | `96488470604` |
   | 横幅 Banner | `91850343003` |

   测试 appId：`1148`（仅供测试，通过后在莱特摩比后台创建正式广告位）。

**错误码参考（《iOS错误码》）：**

- `error.domain` = `LMAdErrorDomain`（`com.litemob.ad.error`）；
- `error.code`：`1001` 未初始化/初始化失败、`1002` 加载/竞价超时、`1003` 无填充、
  `1004` 展示失败、`1005` 重复加载、`1006` 重复展示（`#import <LitemobSDK/LMError.h>`）。

> 说明：Litemize 位于 Taku 广告源层，对 AdBridge / JS / H5 **透明**，前端与桥接代码无需改动。
> OAID 传递（Android 特有）在 iOS 无对应项；iOS 侧广告标识为 IDFA（ATT 弹窗由 `AdBridge` 在 ad.init 链路主动请求，Info.plist 文案已就绪）。
> 上线前需在莱特摩比后台为 iOS 应用（Bundle ID `com.yefiot.communityios`）开通正式 appId 与代码位。

---

## 五、微信 OpenSDK 集成（App 拉起小程序）

> 用途：H5 页面「我的 → 管理员登录」经原生桥拉起 ywjxcx 管理端小程序（管理员在小程序内选社区、改参数）。
> **不集成 SDK 也能编译**（桥走桩分支，调用返回明确错误提示），只是该入口不可用。

### 5.1 微信开放平台配置（一次性，需审核）

1. **注册/登录** [微信开放平台](https://open.weixin.qq.com) → 管理中心 → **移动应用**：
   - 创建「移动应用」（名称建议与云卫家一致，需上传图标）；
   - **iOS 应用信息**（开发配置 → iOS 应用）照此填：
     - `iPhone 应用 → Bundle ID`：`com.yefiot.communityios`（必填，与打包工程/描述文件一致）；
     - `iPhone 应用 → 测试 Bundle ID`：留空；
     - `iPhone 应用 → Universal Links`：`https://xy.yefiot.com/app/`（末尾带斜杠；配套部署见 5.6）；
     - `iPhone 应用 → 备用 Universal Links`：留空；
     - `iPad 应用`：全部留空（App 仅支持 iPhone，`TARGETED_DEVICE_FAMILY=1`）。
   - **Android 应用信息**：`包名` 填 `com.yefiot.community`，`签名` 填打包证书的 MD5
     （去 `:` 小写，`keytool -list -v -keystore xxx.jks` 获取）；
   - 提交后等待审核通过（一般 1 个工作日），记录 **AppId（wx 开头）**；
   - 若已有 Android 移动应用，可在同一条目下补 iOS 应用信息，共用同一 AppId。
2. **关联小程序**：管理中心 → 移动应用 → 「关联小程序」→ 搜索并添加 `wxcdc46554970d5e77`（ywjxcx）；
   小程序管理员在微信小程序后台确认。**未关联时 send/sendReq 直接失败**（App 表现为「打开小程序失败」）。
3. **支付关联**（VIP 微信支付复用同一 AppId）：商户平台 → 产品中心 → AppID 账号管理，
   把商户号 `1612795620` 与该移动应用 AppId 关联。
4. **AppId 写入三处（值必须一致；已填 `wx4c80533df6184dda`）**：

   | 位置 | 文件 | 说明 |
   |---|---|---|
   | H5 前端 | `workbench_package/pages/my/index.vue` | `WX_MINI_PROGRAM.appId`（H5 桥拉起小程序用） |
   | 后端 | `vip_pay_config.php` | `wechat.app_id`（VIP 微信支付下单用） |
   | iOS 壳 | `CloudGuard/Info.plist` | `CFBundleURLSchemes` 第一项 = `wx` + AppId（回跳 scheme） |

   前端改动后需重新 `npm run build:h5 && npm run sync:h5`（已随本次完成）。

### 5.2 框架与依赖（已放置并启用）

```
shell-ios/Vendor/WechatOpenSDK/
└── WechatOpenSDK.xcframework    （官方 2.0.8 XCFramework，静态库，已入库）
```

`project.yml` 微信依赖段**已启用**，直接执行 `xcodegen generate` 即可：

```yaml
      - framework: Vendor/WechatOpenSDK/WechatOpenSDK.xcframework   # 静态库：Do Not Embed，仅链接
      - sdk: libz.tbd
      - sdk: libsqlite3.tbd
      - sdk: libc++.tbd
      - sdk: Security.framework
      - sdk: CoreTelephony.framework
      - sdk: SystemConfiguration.framework
      - sdk: CFNetwork.framework
```

> 升级 SDK：替换 `Vendor/WechatOpenSDK/WechatOpenSDK.xcframework` 后重跑 `xcodegen generate`。
> Git for Windows 提交会丢失 framework 二进制执行位，`scripts/build-ios.sh` 已内置 `chmod +x` 修复。

### 5.3 Info.plist 回跳 scheme（已填）

`CloudGuard/Info.plist` → `CFBundleURLTypes` → `CFBundleURLSchemes` 第一项为 `wx` + 开放平台 AppId
（当前已填 `wx4c80533df6184dda`）。如有变更，必须与该 AppId 保持一致。
拉起小程序后用户返回 App 时，微信经该 scheme 回跳（SceneDelegate / AppDelegate → MiniProgramBridge）。

> **Universal Link**：2.0.8 起 `registerApp` 仅提供 `registerApp(_:universalLink:)` 双参数版本；
> 桥内默认值 `MiniProgramBridge.defaultUniversalLink` 已配 `https://xy.yefiot.com/app/`，
> 四处一致性配置（开放平台后台 / AASA 部署 / entitlements / 代码）见 5.6。

### 5.4 双形态机制（无需手动开关）

`MiniProgramBridge.swift` 顶部 `#if canImport(WechatOpenSDK)` 编译期判断：
- framework 已加入 target → 真实实现（`WXApi.registerApp(_:universalLink:)` + `WXLaunchMiniProgramReq`）；
- 未加入 → 桩实现，调用返回「未集成微信 SDK」错误提示，工程始终可编译。

### 5.5 App 侧链路（已实现，无需改动）

「我的 → 管理员登录」→ 校验管理员身份（`t_room_user.user_type=2`）→ H5 调
`NativeApp.launchMiniProgram({appId, userName: 'gh_67863dc191ba', path: 'manageModule/pages/adminLogin/adminLogin?fromApp=1'})`
→ iOS 桥 `WXLaunchMiniProgramReq` 拉起 ywjxcx 管理端 → 管理员在小程序内配置（社区选择等）→ 自行返回 App。

### 5.6 Universal Link 完整配置（微信回跳）

微信自 OpenSDK 1.8.6 起校验 Universal Link：微信会拼接路径后经 UL 唤起本 App（回跳、分享、
授权均依赖）。四处配置必须指向同一链接 `https://xy.yefiot.com/app/`：

| # | 位置 | 内容 | 状态 |
|---|---|---|---|
| 1 | 微信开放平台 → iOS 应用 → Universal Links | `https://xy.yefiot.com/app/` | 按 5.1 填写 |
| 2 | 服务器 AASA 校验文件 | `/.well-known/apple-app-site-association`（仓库模板：`shell-ios/UniversalLink/`） | **待部署**（见下） |
| 3 | App entitlements | `applinks:xy.yefiot.com`（`CloudGuard/CloudGuard.entitlements`，project.yml 已引用） | 已配 |
| 4 | 代码 registerApp | `MiniProgramBridge.defaultUniversalLink` | 已配 |

**服务器部署 AASA（一次性）**：
- 把 `shell-ios/UniversalLink/apple-app-site-association` 上传到 `/var/www/html/.well-known/apple-app-site-association`
  （URL 即 `https://xy.yefiot.com/.well-known/apple-app-site-association`，与 API 的 web 根一致）；
- 要求：**直接 200 返回、不可重定向**；`Content-Type: application/json`（nginx 对无扩展名文件默认
  `application/octet-stream`，若微信校验不通过，在 server 块加：
  `location = /.well-known/apple-app-site-association { default_type application/json; }`）。

**苹果开发者后台（一次性）**：
- Identifiers → App ID `com.yefiot.communityios` → 勾选 **Associated Domains** 能力；
- 自动签名（本项目已配 `-allowProvisioningUpdates`）会自动更新描述文件；CI 若导入固定描述文件
  （Secrets `BUILD_PROVISION_BASE64`），需在后台重新生成后替换。

**验证**：iPhone Safari 访问 `https://xy.yefiot.com/app/abc`，页面上出现「在"云卫家"中打开」入口即 UL 生效。

---

## 六、Apple IAP 配置

### 6.1 App Store Connect 内购商品（与后端档位一一对应）

| product_id（后端） | App Store Connect 商品 ID（ios_iap_id） | 价格 | 时长 |
|---|---|---|---|
| `vip_month_1` | `com.yefiot.community.vip.month1` | ¥6.00 | 1 个月 |
| `vip_month_3` | `com.yefiot.community.vip.month3` | ¥15.00 | 3 个月 |
| `vip_month_12` | `com.yefiot.community.vip.month12` | ¥48.00 | 12 个月 |

- **商品类型建议**：「非续期订阅」；若选消耗型也可（后端按 `months` 顺延到期时间，不依赖苹果订阅状态）。
- 商品 ID 必须与上表完全一致（后端 `vip_products.php` 的 `ios_iap_id` 用于从收据中匹配交易）。
- 每个商品需填写本地化展示名/描述、审核截图，价格档位与上表一致。
- 商品首次创建后状态为「准备提交」，联调阶段用沙箱即可购买；提审时在版本页勾选这些内购项一并提交。

### 6.2 App 专用共享密钥（可选）

App Store Connect → 你的 App → App 内购买项目 → 「App 专用共享密钥」生成并填入后端
`vip_pay_config.php` 的 `apple.shared_secret`。
说明：非续期订阅校验可不填（留空则 verifyReceipt 请求不带 password）；后续若改用自动续期订阅**必须填写**。

### 6.3 沙箱联调

- 设备：设置 → App Store → 沙箱账户（用未注册过 Apple ID 的邮箱新建）；
- 或使用 **StoreKit Test**（Xcode：File → New → StoreKit Configuration，本地 `.storekit` 文件）离线验证，
  注意 StoreKit Test 的收据环境为沙箱，后端已自动处理（生产校验返回 21007 → 重试沙箱）。

---

## 六、后端部署（IAP 入账依赖）

1. 上传文件到服务器（与现有 VIP 接口同级）：
   - `v1/verifyIapOrder/index.php`（新增）
   - `v1/vip/_lib.php`（**全量覆盖**，新增 5 个 IAP 校验函数）
   - `v1/vip_pay_config.php`（新增 `apple` 配置节，`bundle_id` 已填 `com.yefiot.communityios`，与工程/描述文件一致）
2. 若无 URL 白名单/鉴权中间件则上传即生效（与 `getVipStatus` 相同约定）。
3. 链路：客户端上报 receipt → 后端生产/沙箱 verifyReceipt → 校验商品匹配与凭证防重用 →
   幂等置 paid + 会员顺延（`t_vip_user.last_order_no` 幂等键）。
4. **可选加固**：App Store Connect → App 信息 → App Store 服务器通知（V2），
   用于「用户付款但客户端未上报」的丢单补偿场景；当前以客户端上报 + 重试为主。

---

## 八、验证清单（Mac 上按序执行）

1. **编译**：`xcodegen generate` + Xcode 编译通过（未放 Taku SDK 时也应通过，桩分支）。
2. **H5/VIP 页面**：真机运行，工作台 → 我的 → 会员中心可打开；VIP 商品列表正常（走线上 `getVipProducts`）。
3. **广告（放入 SDK 后）**：
   - DEBUG 构建日志中 Taku 初始化成功（`ATAPI.setLogEnabled(true)` 仅 DEBUG 生效）；
   - 横幅/插屏/激励/开屏可正常展示；
   - Litemize（莱特摩比）联调：Taku 后台自定义平台配测试 appId `1148` + 测试代码位（见 4.7），
     命中「LiteMob」广告源正常返回（无填充时对照错误码 `1003`）；
4. **VIP 免广告分组**：登录 VIP 账号 → 触发广告请求 → Taku 后台「流量分组」日志确认
   `user_type=vip` 命中「VIP免广告」空瀑布分组（无填充属预期）；杀进程冷启动开屏同样无广告。
5. **IAP 全链路**（沙箱）：
   登录普通账号 → 会员中心选档位 → Apple 购买弹窗 → 购买成功 →
   `pay.onEvent(pay.success)` 携带 receipt → JS 调 `verifyIapOrder` →
   查单 `queryVipOrder` 返回 `paid` → 本地 `taku_user_type` 变 `vip`、广告消失。
6. **边界**：取消支付（回到页面提示已取消，订单保持 pending）；重复点击（原生拦截 in-flight）；
   同一沙箱账号重复购买（前次未入账订单会在下次购买流程中被补验入账）。
7. **拉起小程序**（需第五节配置完成）：开放平台审核通过 + 已关联小程序 + AppId 三处已填 →
   我的 → 管理员登录（需管理员账号）→ 应跳转微信并打开 ywjxcx 管理端「管理员登录」页；
   小程序内配置完参数返回 App，H5 状态正常（无白屏/闪退）。

---

## 九、常见问题排查

| 现象 | 排查 |
|---|---|
| 管理员登录提示「未配置微信开放平台 AppId，暂无法跳转」 | JS 侧 `WX_MINI_PROGRAM.appId` 为空：填入开放平台 AppId 后重新 `npm run build:h5 && npm run sync:h5`（第五节 5.1） |
| 拉起小程序失败（提示 send failed / sendReq failed） | 常见原因：移动应用未关联小程序（5.1-2）、Bundle ID/签名与开放平台登记不一致、设备未安装微信、`type` 与小程序版本不符（开发版填 1、体验版填 2） |
| 桥返回「未集成微信 SDK（WechatOpenSDK）」 | 确认 `Vendor/WechatOpenSDK/WechatOpenSDK.xcframework` 存在且 `project.yml` 依赖段未被注释：重跑 `xcodegen generate`（5.2） |
| 编译报 `canImport(AnyThinkSDK)` 走桩分支（广告不展示） | framework 未真正加入 target：确认 `project.yml` 注释已打开、重跑 `xcodegen generate`、Xcode 中 target → Frameworks 可见 |
| 编译报 `ATAPI.sharedInstance()` / `ATAdManager.shared()` 不存在 | 确认 SDK 版本为 Taku 官方最新（本项目按官方 API：`sharedInstance()`、`shared()` 均为有括号函数） |
| `customData` 赋值类型报错 | 官方为 `[AnyHashable: Any]`：`var data: [AnyHashable: Any] = [:]; data["user_type"] = ...` |
| 广告 delegate 不回调 | `AdBridge` 实例由 `BridgeRouter` 持有（勿短生命周期）；load 之后才能 show（`rewardedVideoReady(forPlacementID:)` 等） |
| IAP 成功但 receipt 为空 | 已内置 `SKReceiptRefreshRequest` 刷新；沙箱需登录沙箱账号；真机首次购买收据落盘后才可读 |
| verifyReceipt 返回 21007 | 后端已自动「生产失败 → 重试沙箱」，无需处理 |
| ATT 弹窗不出现 | 需 iOS 14.5+ 真机且 App 在前台；弹窗由 `AdBridge.initAd`（H5 隐私同意后触发）主动请求，授权回调完成（或 5 秒兜底超时）后才返回 ad.init；确认 plist 文案存在 |
| Bitcode 相关报错 | `project.yml` 已设 `ENABLE_BITCODE: NO`，如报错确认该设置未被覆盖 |
| VIP 用户仍看到广告 | 顺序检查：登录后 `syncVipStatus` 是否成功（接口返回 is_vip=1）→ storage `taku_user_type=vip` → Taku 后台分组规则/优先级 → 运行中 adControl 是否整页关闭 |

---

## 十、文件速查

```
shell-ios/
├── project.yml                       # XcodeGen 工程定义（微信 SDK 已启用；-ObjC 已配；Taku/LiteMob 注释模板在此）
├── ExportOptions.plist               # ipa 导出/上传配置（scripts/build-ios.sh 使用）
├── UniversalLink/                    # UL 校验文件（apple-app-site-association，部署见 5.6）
├── iOS编译接入说明.md                 # 本文档
├── Vendor/                           # 微信 SDK 已就位（第五节）；待放入：Taku framework（第四节）、LiteMob
└── CloudGuard/
    ├── Ad/AdBridge.swift             # Taku 广告桥（双形态）
    ├── Pay/PayBridge.swift           # StoreKit IAP 桥
    ├── MiniProgram/MiniProgramBridge.swift  # 拉起微信小程序桥（双形态）
    ├── BridgeRouter.swift            # ad.* / pay.* / miniprogram.* 路由 + dispose
    ├── CloudGuard.entitlements       # Associated Domains（applinks:xy.yefiot.com）
    ├── SceneDelegate.swift           # 微信回跳转发（wx scheme + Universal Link）
    ├── AppDelegate.swift             # 微信回跳兜底
    ├── WebViewController.swift       # deinit → router.dispose()
    ├── Info.plist                    # ATT / SKAdNetwork / 外询白名单 / 微信回跳 scheme
    └── WebApp/                       # H5 产物（npm run sync:h5 生成，勿手改）
```
