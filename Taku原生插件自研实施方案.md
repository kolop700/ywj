# Taku 原生插件自研实施方案（不依赖 taku-001）

> 决策：不使用插件市场第三方插件 taku-001，完全按官方文档自研 Android / iOS 双端 uni-app 原生插件。
> 本方案是"实施设计 + 文档对照"文档，供开发人员（或外包）与 AI 协作执行，不包含完整源码（源码在骨架阶段由 AI 生成）。

---

## 0. 文档目的与背景

- 业务代码（uni-app Vue3 + HBuilderX）已完成 Taku 广告接入，JS 层契约位于 `common/taku-sdk.js`，广告逻辑位于 `utils/adUtils.js`，页面位于 9 个正式页。
- 自研插件只做一件事：**按既有 JS 契约，在原生层实现对 Taku 官方 SDK 的封装**。页面与业务代码零改动。
- 本方案目标读者：负责 Android 插件（Windows + Android Studio）与 iOS 插件（Mac + Xcode）的实现者。

---

## 1. 总体架构与既有资产

```
┌ JS 层（已完成，不再改动）──────────────────────────────────────┐
│ common/taku-sdk.js  →  TakuAds.init/load*/show*/hide*        │
│ utils/adUtils.js    →  激励/插屏调用 + 日限 15 + 间隔 10s      │
│ 页面 9 个            →  <taku-banner placement-id> + showAd() │
└──────────────┬───────────────────────────────────────────────┘











               uni.requireNativePlugin('TakuAdBridge')
┌──────────────▼──────────────────────── 自研产物（本方案） ────┐
│ nativeplugins/TakuAdsNativePlugin/       （Android，Java）   │
│ nativeplugins/TakuAdsNativePlugin-iOS/   （iOS，ObjC）       │
└──────────────┬───────────────────────────────────────────────┘
               直接调用
┌──────────────▼───────────── Taku 官方原生 SDK（需登录下载） ──┐
│ Android: com.anythink.china.* 聚合包（aar/jar + res）        │
│ iOS:     Taku iOS SDK（framework/pods，AT* 类与协议）        │
└──────────────────────────────────────────────────────────────┘
```

既有 JS 契约 = 插件的"验收标准"。契约全文见 `common/taku-sdk.js` 头部注释（L14-L26）与本方案第 3 节。

---

## 2. 官方文档对照阅读指引

实现者需同时打开两份文档，先通读再动手。

### 2.1 DCloud：uni-app 原生插件开发文档（"怎么把插件写合规"）

| 章节 | 内容 | 对应本方案 |
| --- | --- | --- |
| 原生插件概述与目录结构 | nativeplugins 目录、package.json、android/ios 子工程 | 4.1 / 5.1 |
| Module 扩展开发 | UniModule 基类、@UniJSMethod、UniJSCallback 回传 | 4.3 / 5.2 |
| Component 扩展开发 | UniComponent 基类、属性 props、fireEvent 事件、视图挂载/销毁 | 4.4 / 5.3 |
| 插件打包与真机运行 | 云打包勾选、自定义基座、离线打包 | 8. 里程碑 |
| 常见问题 | 线程、Context 获取、资源合并冲突 | 4.6 / 6 |

### 2.2 Taku：官方 SDK 文档（help.takuad.com，"原生 API 怎么调"）

> 登录 takuad.com 后台后从 SDK 下载页生成下载包；文档各页是代码示例的权威来源。
> 本文所有"官方 API 示例"位置均以站点左侧目录路径描述，实现时打开对应页面取真实方法签名。

**Android 接入指南（目录：Android 接入指南）**

| Taku 文档页面 | 解决什么 | 落到插件哪里 |
| --- | --- | --- |
| 集成 → 接入指南（Y1jCCK） | aar/jar+res 导入、gradle 配置、权限、ABI、混淆 keep、Android 9 适配、多进程 WebView | 4.2 / 4.6 |
| 集成 → 初始化说明 | SDK 初始化代码（AppId/AppKey）、隐私合规设置 | 4.3 `initTaku` |
| 广告样式 → 激励视频广告 | 加载/展示/监听器回调（onReward 时机） | 4.3 激励方法 + 事件表 |
| 广告样式 → 插屏广告 | 加载/展示/回调 | 4.3 插屏方法 |
| 广告样式 → 横幅广告 | 横幅 View 创建、尺寸、刷新、销毁 | 4.4 组件实现 |
| 广告样式 → 原生广告（预留） | 信息流（二期，本期可不做） | 备注预留 |
| 高级设置 → 回调信息说明 | 各回调字段/时机汇总 | 第 3 节事件表校准 |
| 政策合规 → 隐私设置 | 隐私授权 API（欧盟/中国合规） | 4.6 |
| 集成测试 → 错误码说明 | 错误码含义（如无填充） | JS 层透传 msg |
| 集成测试 → 如何测试广告 / 测试要点清单 | 测试广告位验证步骤 | 7. 验证方案 |

**iOS 接入指南（目录：iOS 接入指南）**

| Taku 文档页面 | 解决什么 | 落到插件哪里 |
| --- | --- | --- |
| 集成 → iOS v6.5.xx SDK 迁移指南 / 集成 | SDK 引入方式（pods/manual）、版本要求 | 5.1 |
| 集成 → 广告样式 → 激励视频广告 | ATAdManager(RewardedVideo) + ATRewardedVideoDelegate | 5.2 |
| 集成 → 广告样式 → 插屏广告 | ATInterstitialDelegate | 5.2 |
| 集成 → 广告样式 → 横幅广告 | 横幅视图与 ATBannerDelegate | 5.3 |
| 广告样式 → 原生广告 / 自渲染 | 信息流（二期预留） | 备注 |
| 回调信息说明 | 回调时机/字段 | 第 3 节 |
| 政策合规 → 隐私政策&数据收集 | GDPR/中国隐私授权 API | 5.4 |
| 常用信息速查 → Protocol / Class | AT* 协议与类的速查索引（实现时对照） | 5.2 |
| 广告平台 → 广告平台 SKAdNetwork 获取链接 | SKAdNetwork 列表（上架用） | 5.4 |
| 集成测试 → 如何测试广告 / DebugUI / 错误码 | 联调方法 | 7. |

---

## 3. API 契约（JS ↔ 原生，必须逐字一致）

### 3.1 Module：`TakuAdBridge`（两端同名，JS 用 `uni.requireNativePlugin('TakuAdBridge')` 获取）

| JS 调用（taku-sdk.js 内） | 原生方法（module） | 参数（JSON） | 回传 |
| --- | --- | --- | --- |
| `TakuAds.init({appId, appKey}, cb)` | `initTaku` | `{appId, appKey}` | cb：`{code:0,msg}` code=0 成功 |
| `TakuAds.loadRewardedVideoAd({placementId}, cbs)` | `loadRewardedVideoAd` | `{placementId}` | cbs 事件（见 3.2） |
| `TakuAds.showRewardedVideoAd({placementId})` | `showRewardedVideoAd` | `{placementId}` | 展示中事件经 cbs |
| `TakuAds.loadInterstitialAd({placementId, scenarioId?, extraData?}, cbs)` | `loadInterstitialAd` | `{placementId, scenarioId?, extraData?}` | cbs 事件 |
| `TakuAds.showInterstitialAd({placementId})` | `showInterstitialAd` | `{placementId}` | 同上 |
| `TakuAds.showBannerAd(params, cbs)`（悬浮式，预留） | `showBannerAd` | 见官方 JS 悬浮式文档 | cbs |
| `TakuAds.hideBannerAd(positionKey)` | `hideBannerAd` | positionKey 标识 | - |
| `TakuAds.showNativeAd(params, cbs)`（预留） | `showNativeAd` | 官方文档 | cbs |
| `TakuAds.hideNativeAd(positionKey)` | `hideNativeAd` | positionKey | - |

> 注：以上方法名/事件名来自本项目既有 JS 契约（即 taku-001 文档定义的插件 API）。**自研时原生侧方法名必须与上表一致**，否则 JS 层需要改动。原生方法体内部的 Taku SDK 调用则完全以 Taku 官方文档为准。

### 3.2 事件表（原生 → JS，经 cbs 对象的键调用或事件抛出）

| 事件键 | 含义 | 业务侧用途（utils/adUtils.js） |
| --- | --- | --- |
| `onAdLoaded` | 广告加载成功 | 记录可播状态 |
| `onAdFailed` | 加载/展示失败（携带 code/msg） | 激励失败降级插屏、日志 |
| `onAdShow` | 广告开始展示 | **扣每日次数、记 lastXTime** |
| `onAdClicked` | 用户点击 | 统计 |
| `onAdClosed` | 广告关闭 | 继续开门流程 |
| `onReward` | 激励达成（发奖信号） | 标记发奖 |
| `onAdPlayStart` / `onAdPlayEnd` | 视频起播/结束（可选） | 兼容插件文档 |

### 3.3 Component：`taku-banner`（两端同名）

| 项 | 约定 |
| --- | --- |
| 属性 | `placement-id`（string，变化时重新加载） |
| 事件（组件层 fireEvent） | `ad-loaded` / `ad-failed` / `ad-show` / `ad-clicked` / `ad-closed`（页面层可按需监听） |
| 视觉 | 宽度撑满父容器，高度按 Taku 官方横幅标准（Android/iOS 相同广告位策略）；无填充时不渲染内容并保持占位尺寸（空 View） |
| 生命周期 | 组件 attach → 用 placement-id 加载；detach → 销毁广告实例，防叠加 |

---

## 4. Android 插件设计：`nativeplugins/TakuAdsNativePlugin/`

### 4.1 目录结构（自研目标形态）

```
nativeplugins/TakuAdsNativePlugin/
├── package.json                  # 插件清单（name/version/模块与组件声明，字段以 DCloud 文档为准）
└── android/
    ├── build.gradle              # 依赖 taku_libs、compileSdk>=28、AndroidX/Jetifier 按需
    ├── src/main/
    │   ├── AndroidManifest.xml   # 合并 Taku 权限 + 官方 manifest 组件
    │   ├── java/com/xxx/taku/
    │   │   ├── TakuAdBridgeModule.java      # UniModule 子类
    │   │   ├── TakuAdBannerComponent.java   # UniComponent 子类
    │   │   ├── TakuManager.java             # 单例：持有 init 状态 + placementId → 广告实例表
    │   │   └── AdEventListener.java         # Taku 各 Listener 的公共实现（翻译成回调）
    │   └── res/                  # 必要资源（若官方包有）
    ├── taku_libs/                # 官方 release_folder 解压的 aar/jar（可 gitignore）
    ├── taku_res/                 # 官方 res（若有，走 sourceSets 引入）
    └── proguard-rules.pro        # 官方 proguard-android.txt 内容合并
```

### 4.2 Taku SDK 集成要点（官方"接入指南"页）

1. SDK 下载：后台 → SDK 下载 → 选"中国内地" + 勾选聚合渠道 → 生成下载 → 解压得到 `release_folder(xxxxxxxxx)`。
2. libs → 放 `taku_libs/`，`build.gradle` 用 `api fileTree(dir: 'taku_libs', include: ['*.jar','*.aar'])` 引入；res → `taku_res/` 并配置 sourceSets（若官方包有 res 目录）。
3. `compileSdkVersion` ≥ 28；工程如用 AndroidX 需开启 `android.useAndroidX=true`（DCloud 基座默认已 AndroidX，通常无需 support-v7；如有聚合渠道要求再按官方页补依赖）。
4. ABI：`abiFilters 'armeabi-v7a','arm64-v8a'`（默认建议；含 x86 渠道如快手按官方说明）。
5. 权限合并：官方权限清单（INTERNET / ACCESS_NETWORK_STATE / ACCESS_WIFI_STATE 等）写入插件 Manifest；**READ_PHONE_STATE 等敏感权限按官方"调用时机"说明在需要时才申请**（广告 SDK 内部申请）。
6. Android 9+：`networkSecurityConfig`（明文流量，若官方包要求）；多进程 WebView 用 `WebView.setDataDirectorySuffix()`（在 DCloud 工程中进程名为 :xxx 时判断）——**该逻辑在插件内尽量自查兼容，不能改 DCloud 主 Application 时留注释说明在离线打包/云打包配置中处理**。

### 4.3 `TakuAdBridgeModule` 方法实现设计

```java
public class TakuAdBridgeModule extends UniModule {
    // 每个 @UniJSMethod 与 3.1 表一一对应；实现模式统一为：
    //   TakuManager.getInstance().xxx(参数翻译, 回调翻译器)
    // 回调翻译器：把 Taku SDK 的 Listener 回调翻译成 cbs.onAdLoaded / onAdFailed / ...
}
```

- `initTaku`：取 AppId/AppKey → 调官方"初始化说明"API → 成功 `cb({code:0})`；**官方文档若提供"隐私同意开关"（中国区合规 API），必须在 init 前设置同意状态**，与项目约定一致（Android 系统隐私弹窗同意后才进 onLaunch，init 时机天然合规）。
- `loadRewardedVideoAd` / `showRewardedVideoAd`：按官方"激励视频广告"页示例；`onReward` 只应回调一次（官方语义），插件层保证不透传多余奖励。
- `loadInterstitialAd` / `showInterstitialAd`：按官方"插屏广告"页。
- 线程：Taku SDK 有回调线程，**所有 cbs 回传统一 post 到主线程**执行（UniModule 回调线程安全前提下统一主线程更稳）。
- placementId 校验：空串直接 `cbs.onAdFailed({code:-1,msg:'empty placementId'})`，与 JS 层"空位不加载"呼应（双保险）。

### 4.4 `taku-banner` 组件设计

- 继承 `UniComponent<View>`，createView 时返回一个容器 View；容器内创建官方横幅 View（宽=父容器宽，高按官方规格）。
- 属性监听：`placement-id` 变化 → 销毁旧实例 → 重新 load；attach/detach 管理生命周期。
- 回调：加载失败 → 容器显示占位（透明空 View），避免白块；点击/展示等 → `fireEvent` 抛出（事件名见 3.3）。
- 尺寸建议：组件最小高度给 60-80dp（防止无填充抖动），CSS 侧 `.ad-view min-height:120rpx` 已配套。

### 4.5 事件回传与状态（Android）

- `TakuManager` 单例持有：`inited` 标志、`Map<String, 广告实例/监听器>`（key=placementId）。
- 同一 placementId 只保留一份监听器引用；load 新广告前清理旧监听，防泄漏与重复回调。
- 所有对 JS 的回调封装成工具方法：`invokeCbs(cbs, eventName, payload)`，统一打日志（便于 `adb logcat` 排查）。

### 4.6 打包注意（Android）

- 混淆：proguard 规则按官方 `proguard-android.txt` 与 keep 文件（`com.anythink.**` 等）整段合并；**云打包开启混淆时验证**。
- 资源 keep：若开 shrinkResources，按官方 keep.xml 白名单。
- 插件包体积：libs 多渠道时体积较大属正常；发布前可按需裁剪未勾选渠道。

---

## 5. iOS 插件设计：`nativeplugins/TakuAdsNativePlugin-iOS/`

### 5.1 目录与依赖

```
nativeplugins/TakuAdsNativePlugin-iOS/
├── package.json
├── TakuAdsNativePlugin-iOS.podspec   # s.dependency 'TakuSDK'（或手动 framework，按官方集成文档）
└── ios/
    ├── TakuAdBridgeModule.m/.h       # UniModule 子类
    ├── TakuAdBannerComponent.m/.h    # UniComponent<UIView> 子类
    ├── TakuAdDelegateProxy.m         # 各 AT*Delegate 的公共实现（翻译成 JS 事件）
    └── TakuManager.h/.m              # 单例（init 状态、placementId → 实例表）
```

- SDK 引入以官方"iOS 集成"页为准（v6.x，pods 或手动集成均可，离线打包工程中验证）。
- 最低 iOS 版本、SKAdNetwork 支持按官方"Adapter 最低要求/SKAdNetwork 获取链接"页核对。

### 5.2 Module 实现要点

- 类名：`TakuAdBridgeModule`（与 Android module 名一致即可被 JS 统一拿到；iOS 侧 module 名取自 package.json 声明）。
- 方法签名与 3.1 表一致：`initTaku:callback:`、`loadRewardedVideoAd:callback:`（cbs 作为 callback 的 NSDictionary 传入）等，参数用 NSDictionary。
- 内部调用 Taku iOS API（官方文档"常用信息速查"目录已确认存在 `ATAdManager` 及其分类 `ATAdManager(RewardedVideo)/ATAdManager(Interstitial)/ATAdManager(Banner)`，协议 `ATRewardedVideoDelegate/ATInterstitialDelegate/ATBannerDelegate`）：
  - 每个方法体按官方对应"广告样式"页示例填写；delegate 方法在 `TakuAdDelegateProxy` 中实现后，翻译为 `cbs[@"onAdLoaded"]` 等 block 调用（cbs 里各事件是 block：`cbs[@"onAdLoaded"]()`）。
  - **回调统一切主线程**（dispatch_async main queue）再执行 cbs，避免 JS 层时序问题。
- init 与隐私：iOS 无系统弹窗，项目已有应用内同意流程（agreement store），init 在同意后调用；官方若有隐私授权 API（GDPR/中国区），插件暴露可选项并在 init 文档注明。

### 5.3 Banner 组件实现要点

- `TakuAdBannerComponent` 继承 `UniComponent<UIView>`：返回容器 UIView，内含官方横幅视图（autolayout：宽撑满、高按规格）。
- 属性 `placement-id`：KVO/`setAttribute` 变化时销毁旧横幅、按新 id 重建。
- 回调：失败 → 空视图占位；事件经 `fireEvent` 上报。
- 页面切后台/恢复、App 前后台：横幅 SDK 自带处理；组件 detach 时 `showBannerAd nil / destroy` 防叠加。

### 5.4 上架合规（iOS）

- Info.plist：如官方要求添加 ATS 例外（通常 HTTPS 无需）；AdSupport 用途说明若 SDK 需要。
- SKAdNetwork：按官方"SKAdNetwork 获取链接"页把 Taku 及聚合渠道的 SK 列表并入工程 Info.plist（上架归因必需）。
- 隐私标签：Taku SDK 收集项已在隐私政策声明（privacy.vue/privacy.html 已列），App Store 隐私标签同步填写。
- 激励回调：若官方文档强调"服务端激励回调（S2S）"，本项目采用客户端 `onReward` 直接发奖，无需 S2S（二期可选）。

---

## 6. 双端行为一致性要求（验收红线）

1. `init` 在未配置 AppId/AppKey 或插件缺失时：两端都应走 JS 层降级（init 回调失败、页面横幅隐藏、开门不弹广告），原生侧**不得崩溃**。
2. 事件名、参数结构两端一致（3.1/3.2 表），JS 层不出现平台分支。
3. 激励 `onReward` 单次语义；`onAdShow` 在"真正开始展示"时回调（adUtils 以它扣次数）。
4. 横幅组件空 placementId / 无填充：显示透明占位，不报错不崩溃；页面退出销毁实例。
5. 线程：所有原生→JS 回调主线程。
6. 冷启动、前后台切换、页面快速进出横幅无叠加、无泄漏（用 logcat/Xcode Console 观察 destroy 日志）。

---

## 7. 验证方案（双端自定义基座阶段）

| 步骤 | 验证内容 |
| --- | --- |
| 1 | 未配置 appId 冷启动：无崩溃、无网络请求、横幅不出现 |
| 2 | 配置测试 appId/placementId：init `code:0` |
| 3 | 后台 ad_prod_app='0'：全关无广告；'1'：仅横幅；'11'/'13'：开门后激励/插屏 |
| 4 | 测试激励位：开门成功 → 弹激励 → 关闭 → 流程继续；快速连点只弹一次 |
| 5 | 测试插屏位：同 4；激励失败（断网/无填充）→ 自动降级插屏（adUtils 既有逻辑） |
| 6 | 横幅：9 页进出不叠加、无填充隐藏、返回登录态切换 adType 后横幅消失/出现 |
| 7 | 日限：连续开门 ≥15 次后当日不再弹；间隔 <10s 不弹 |
| 8 | 真机双端回归 + 混淆/Release 包复测（Android） |

---

## 8. 里程碑、依赖材料与分工

| # | 里程碑 | 依赖材料 | 环境/人力 |
| --- | --- | --- | --- |
| M1 | 方案评审（本文档） | - | 当前 |
| M2 | Android 插件骨架 + `initTaku` + 激励最小闭环 | Taku Android SDK 下载包；Taku 后台测试 AppId/placementId | Windows + Android Studio；AI 生成骨架 |
| M3 | Android 补全：插屏 + `taku-banner` 组件 + 混淆/隐私项 | 同上 | 同上 |
| M4 | Android 自定义基座全量验证（第 7 节） | DCloud 账号（云打包/自定义基座） | Windows + HBuilderX |
| M5 | iOS 插件骨架 + init + 激励最小闭环 | Taku iOS SDK；Mac + Xcode | macOS 环境 |
| M6 | iOS 补全插屏 + banner + ATS/SKAdNetwork | 同上 | macOS |
| M7 | 双端回归 + 隐私文件线上同步 + 上架材料 | 线上服务器发布权限 | 双方 |

所需外部材料清单（前置，非代码）：
1. takuad.com 后台账号与应用（AppId/AppKey）——已就绪可随时注册
2. Android / iOS 的 SDK 下载包（登录后台 → SDK 下载 → 勾选渠道）
3. 后台创建正式/测试广告位 placementId（Android/iOS 分平台）
4. 渠道开户（穿山甲等，可后置；测试期用 Taku 测试位/直投）
5. iOS 侧一台 Mac（唯一硬性环境缺口）

---

## 9. 风险与备选

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Taku 官方 API 细节与本文假设不符 | 返工 | 本文所有"官方 API"均为占位说明，M2/M5 开工前先对照官方子页面代码示例校准 |
| iOS 无 Mac 环境 | iOS 插件无法编译验证 | 找外包/借机；代码骨架先行，验证延后；Android 不受影响先上线 |
| 广告渠道开户周期长 | 测试期无填充 | 用 Taku 测试广告位；未开通前横幅空位自动隐藏不阻塞业务 |
| 云打包自定义基座周期 | 联调等待 | 提前准备 DCloud 账号与打包证书（Android 签名可在打包页上传） |
| 自研质量风险（泄漏/叠加/崩溃） | 线上事故 | 第 6 节红线进 CodeReview；真机回归；灰度发布 |

备选路径：若中途拿到 taku-001 授权（Android），可随时切换为现成插件（契约同源，JS 层无感）；自研 Android 工程可保留做对照/兜底。

---

## 10. 附录：与既有 JS 代码的衔接点（实现自查清单）

| 文件 | 与本方案的关系 |
| --- | --- |
| `common/taku-sdk.js` | 契约源（勿改）；`TAKU_CONFIG` 填 AppId/AppKey |
| `store/modules/ad.js` | `AD_IDS` 填 Android/iOS placementId |
| `utils/adUtils.js` | 激励/插屏调度；依赖 3.2 事件表 |
| 9 个页面 + `App.vue` | 依赖 `<taku-banner>` 与 module 名 `TakuAdBridge`（勿改） |
| `manifest.json` | 自研插件就绪后补 `app-plus.nativePlugins` 声明（当前刻意未加） |
| `privacy.vue` / `privacy.html` | 已含 Taku SDK 声明；线上文件需同步 |
