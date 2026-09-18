# ============================================================
# TakuAdsNativePlugin - Proguard 混淆规则
# 来源：Taku 官方接入指南 "4.1 Proguard配置"
#   https://help.takuad.com/docs/Y1jCCK
# 注意：渠道广告平台（穿山甲/优量汇等）的 keep 规则由其 aar 自带
#       consumer 规则合并，无需在此重复；如混淆后渠道异常，再对照
#       官方 SDK 压缩包 proguard-android.txt（本发布包未附带）。
# ============================================================

# ---- Taku SDK 核心 keep（官方原样） ----
-keep public class com.anythink.** {
    *;
}
-keepclassmembers class com.anythink.** {
    *;
}

-keep public class com.anythink.network.**
-keepclassmembers class com.anythink.network.** {
    public *;
}

-dontwarn com.anythink.hb.**
-keep class com.anythink.hb.**{ *;}

-dontwarn com.anythink.china.api.**
-keep class com.anythink.china.api.**{ *;}

-keep class com.anythink.myoffer.ui.**{ *;}
-keepclassmembers public class com.anythink.myoffer.ui.** {
    public *;
}

# ---- 插件自身类 keep（被 JS 反射调用，不可混淆） ----
-keep class com.yefiot.taku.** { *; }

# ============================================================
# Litemize 自定义广告平台（TaKu 自定义 Adapter）
# Taku SDK 根据后台配置的全路径类名反射创建 Adapter，
# 以下类绝不可混淆，否则运行时找不到 Adapter 类。
# 类路径出自 Litemize《TaKu自定义Adapter配置》文档：
#   信息流  com.example.topon_adapter.adapter.LtAdNativeAdapter
#   激励视频 com.example.topon_adapter.adapter.LtAdRewardVideoAdapter
#   开屏    com.example.topon_adapter.adapter.LtAdSplashAdapter
#   插屏    com.example.topon_adapter.adapter.LtAdInterstitialAdapter
#   Banner  com.example.topon_adapter.adapter.LtAdBannerAdapter
# ============================================================
-keep class com.example.topon_adapter.** { *; }

# ============================================================
# Litemize SDK keep（com.ltmb.ltsdk）
-keep class com.ltmb.** { *; }
-dontwarn com.ltmb.**

# ---- Litemize 官方混淆配置（来源《SDK 集成》文档 v3.4.1） ----
# 跳过所有序列化类
-keep class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator *;
}

-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
}

-keepclassmembers class ** {
    void writeObject(java.io.ObjectOutputStream);
    void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# 禁止修改方法修饰
-keepclassmembernames class ** {
    protected <methods>;
}

-keep class android.**{*;}
-keep class androidx.**{*;}

# 跳过SDK混淆
-keep class com.ltmb.ltadsdk.**{*;}

# 跳过日志
-keep class com.command.core.**{*;}
