# 云卫家 H5 原生壳 - 混淆规则
# 当前 release 未开启 minifyEnabled，本文件主要作为后续开启混淆的基线。

# 保留 JS 桥接接口（WebView 通过反射调用 @JavascriptInterface 方法）
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 保留桥接相关类
-keep class com.yefiot.cloudguard.bridge.** { *; }

# ===== Taku（AnyThink）聚合 SDK =====
-keep class com.anythink.** { *; }
-dontwarn com.anythink.**

# ===== Litemize（莱特摩比）SDK =====
# 【重要】包名是 com.ltmb.*，不是 com.litemize.*
#   （原版本写的是 -keep class com.litemize.**，该包在整个工程里根本不存在，是条废规则；
#     已用解包全文检索确认：core-3.4.1.aar / 全部 23 个 aar / 最终 dex 中均无 com.litemize 包，
#     "litemize" 仅作为 LitemizeCommentDetailsActivity 类名的一部分出现。）
#   以下规则逐条对应官方《SDK集成与工程配置》v3.4.1 → 「6. 混淆配置」。
#   虽然当前 release 未开启 minifyEnabled，此条不影响出包；
#   但一旦开启混淆而这里写错，Litemize 全部类会被裁掉，广告会直接失效。
-keep class com.ltmb.ltsdk.** { *; }
-keep class com.ltmb.ltadsdk.** { *; }
-dontwarn com.ltmb.**

# 三方自定义广告网络（Litemize 侧的 adapter，官方文档明确要求 keep）
-keep class com.ltmb.tobidadapter.** { *; }
-keep class com.ltmb.gromoreadapter.** { *; }
-keep class com.ltmb.beiziadapter.** { *; }
-keep class com.ltmb.qcadapter.** { *; }
-keep class com.example.topon_adapter.** { *; }

# SDK 内部日志库（官方文档要求）
-keep class com.command.core.** { *; }

# 随 Litemize aar 一起打包进来的下游 SDK（本工程 aar 中实际存在）
-keep class com.smartdigimkt.** { *; }
-keep class com.zm.** { *; }
-dontwarn com.smartdigimkt.**
-dontwarn com.zm.**

# ===== 微信 OpenSDK =====
-keep class com.tencent.mm.opensdk.** { *; }
-keep class com.tencent.wxop.** { *; }
-keep class com.tencent.mm.sdk.** { *; }
-dontwarn com.tencent.mm.opensdk.**

# ===== ZXing =====
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ===== Gson =====
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# 通用
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
