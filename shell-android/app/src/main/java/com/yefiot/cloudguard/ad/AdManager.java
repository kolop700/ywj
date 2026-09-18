package com.yefiot.cloudguard.ad;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;

// Taku（AnyThink）公开 API 包名（对照官方 Demo 实锤）：
//   com.anythink.core.api / com.anythink.rewardvideo.api / com.anythink.interstitial.api / com.anythink.banner.api
import com.anythink.banner.api.ATBannerListener;
import com.anythink.banner.api.ATBannerView;
import com.anythink.core.api.ATAdInfo;
import com.anythink.core.api.ATSDK;
import com.anythink.core.api.AdError;
import com.anythink.interstitial.api.ATInterstitial;
import com.anythink.interstitial.api.ATInterstitialListener;
import com.anythink.rewardvideo.api.ATRewardVideoAd;
import com.anythink.rewardvideo.api.ATRewardVideoListener;
import com.anythink.splashad.api.ATSplashAd;
import com.anythink.splashad.api.ATSplashAdExtraInfo;
import com.anythink.splashad.api.ATSplashAdListener;

// Litemize（莱特摩比 / com.ltmb）自定义 Adapter：OAID 传递
//   LTAdDeviceManager.setUserOAID(context, oaid) —— 官方《自定义 Adapter 配置》要求，
//                                                   必须在 ATSDK.init 之前调用，否则影响填充率与收益；
//   DeviceIdentifier                            —— Litemize SDK 自带的 OAID 采集器（core-3.4.1.aar），
//                                                   无需额外集成第三方 OAID SDK。
import com.ltmb.ltsdk.check.LTAdDeviceManager;
import com.ltmb.ltsdk.dev.sm.oaid.DeviceIdentifier;
import com.ltmb.ltsdk.dev.sm.oaid.IRegisterCallback;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Taku 广告管理器单例（Android）。
 *
 * 由原自研 uni-app 插件 TakuAdManager 移植而来，唯一改动：
 *   把 DCloud 的 UniJSCallback 替换为自定义 AdCallback（事件经 AdBridge 转发到 JS ad.onEvent）。
 *
 * 职责与调用契约保持不变：
 *   init(context, appId, appKey) / loadRewardedVideo / showRewardedVideo /
 *   loadInterstitial / showInterstitial / loadSplash / showSplash / isInited / runOnMain
 * 所有入口必须在主线程调用（广告 SDK 要求）。
 */
public class AdManager {

    /** 广告事件回调（替代 UniJSCallback）：把 {event, code, msg} 回传 JS */
    public interface AdCallback {
        void onEvent(String event, int code, String msg);
    }

    private static final String TAG = "AdManager";

    private static volatile AdManager sInstance;

    /**
     * 调试开关：true 时打开 Taku 网络日志（logcat 可见每个广告位实际选中的广告源/平台）。
     * 【1.0.0 正式包】已置为 false；排查线上广告来源时临时改回 true 重新打包。
     */
    private static final boolean AD_DEBUG = false;

    /** 【VIP 免广告】用户类型（流量分组）本地缓存：冷启动时在 ATSDK.init 之前读取并设置 */
    private static final String PREF_NAME = "taku_prefs";
    private static final String KEY_USER_TYPE = "user_type";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private Context appContext;
    private volatile boolean inited = false;

    private final Map<String, AdHolder> rewardedMap = new HashMap<>();
    private final Map<String, AdHolder> interstitialMap = new HashMap<>();

    /** 单个广告位状态：SDK 广告对象 + 最近一次 load 注册的事件回调 */
    private static class AdHolder {
        ATRewardVideoAd rewardedAd;
        ATInterstitial interstitialAd;
        AdCallback cbs;
    }

    public static AdManager getInstance() {
        if (sInstance == null) {
            synchronized (AdManager.class) {
                if (sInstance == null) {
                    sInstance = new AdManager();
                }
            }
        }
        return sInstance;
    }

    private AdManager() {
    }

    public boolean isInited() {
        return inited;
    }

    public Context getAppContext() {
        return appContext;
    }

    /** 将任务切到主线程执行；已在主线程则直接执行 */
    public void runOnMain(Runnable runnable) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            runnable.run();
        } else {
            mainHandler.post(runnable);
        }
    }

    /**
     * 把本次展示真正成交的广告源格式化成一行文本 —— 用来确认「广告到底来自哪个平台」。
     *
     * networkName        ：Taku 后台配置的广告平台名（自定义平台则为配置时填的平台名称）
     * networkFirmId      ：Taku 的广告平台编号（与后台「广告平台」列表一一对应）
     * adsourceId         ：该广告源在 Taku 后台的 ID
     * networkPlacementId ：第三方平台自己的广告位 ID（如莱特摩比/下游平台侧）
     *
     * 在 logcat 搜 “adInfo” 即可看到，也可在 H5 侧 onAdShow 事件的 msg 里拿到。
     */
    private String netInfo(ATAdInfo info) {
        if (info == null) return "adInfo=null";
        try {
            return "network=" + info.getNetworkName()
                    + ", firmId=" + info.getNetworkFirmId()
                    + ", adsourceId=" + info.getAdsourceId()
                    + ", networkPlacementId=" + info.getNetworkPlacementId()
                    + ", ecpm=" + info.getEcpm()
                    + ", showId=" + info.getShowId();
        } catch (Throwable t) {
            return "adInfo err: " + t.getMessage();
        }
    }

    private void fire(AdHolder holder, String event, int code, String msg) {
        if (holder != null && holder.cbs != null) {
            holder.cbs.onEvent(event, code, msg);
        }
    }

    private void fire(AdCallback cbs, String event, int code, String msg) {
        if (cbs != null) {
            cbs.onEvent(event, code, msg);
        }
    }

    /**
     * Taku 的 AdError.getCode() 返回 String（而非 int），
     * 这里安全转换为 int 供 JS 端使用；无错误对象或无法解析时回退 -1。
     */
    private static int codeOf(AdError error) {
        if (error == null) return -1;
        try {
            return Integer.parseInt(error.getCode().trim());
        } catch (Exception e) {
            return -1;
        }
    }

    // ==================== 初始化 ====================
    // 官方文档：ATSDK.init(context, appId, appKey) + ATSDK.start()
    // 须在用户同意隐私授权后调用。
    public boolean init(Context context, String appId, String appKey) {
        appContext = context != null ? context.getApplicationContext() : null;
        if (appContext == null) {
            Log.e(TAG, "init failed: no context");
            return false;
        }
        // 【Litemize 文档要求】初始化 Taku 之前把 OAID 交给聚合 SDK，否则影响广告填充率与收益。
        setupOaid();
        try {
            // 打开 Taku 网络日志：logcat 会打印每个广告位选中的广告源（平台名 / firmId / 瀑布流 / ecpm）。
            ATSDK.setNetworkLogDebug(AD_DEBUG);
            // 【VIP 免广告-流量分组】按本地缓存的用户类型（user_type=vip/normal）设置全局自定义规则。
            // 官方要求：ATSDK.init() 之前调用（后台按 user_type=vip 建「无广告源」分组拦截 VIP 请求）。
            applyUserTypeForInit();
            ATSDK.init(appContext, appId, appKey);
            ATSDK.start();
            inited = true;
            Log.i(TAG, "ATSDK init + start ok, appId=" + appId);
        } catch (Throwable t) {
            inited = false;
            Log.e(TAG, "ATSDK init exception: " + t.getMessage(), t);
        }
        return inited;
    }

    /**
     * 【VIP 免广告】设置用户类型（"vip"；其它值一律归一为 "normal"）。
     *
     * 双通道保障（Taku「自定义流量分组」官方机制）：
     *   1) 立即持久化到本地：下次冷启动由 init() 在 ATSDK.init() 之前读取并设置，
     *      保证「开屏」等冷启动请求也命中 VIP 流量分组（开屏不受页面级广告开关约束）；
     *   2) SDK 已初始化时直接调用 ATSDK.initCustomMap 更新，后续广告请求即携带新分组标记。
     *
     * 说明：需 Taku 后台配置规则（user_type=vip → 空广告源分组 + 最高优先级）后才实际拦截；
     *      H5 侧另有 adControl 全关兜底（见 utils/vipUtils.js）。
     */
    public void setUserType(String type) {
        final String t = "vip".equalsIgnoreCase(type) ? "vip" : "normal";
        if (appContext != null) {
            appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .edit().putString(KEY_USER_TYPE, t).apply();
        }
        if (inited) {
            try {
                Map<String, Object> customMap = new HashMap<>();
                customMap.put("user_type", t);
                ATSDK.initCustomMap(customMap);
                Log.i(TAG, "initCustomMap updated: user_type=" + t);
            } catch (Throwable e) {
                Log.e(TAG, "initCustomMap update failed: " + e.getMessage());
            }
        } else {
            Log.i(TAG, "user_type cached (apply before ATSDK.init next launch): " + t);
        }
    }

    /** 读取本地缓存的用户类型（默认 "normal"） */
    private String getUserTypeCached() {
        if (appContext == null) return "normal";
        return appContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                .getString(KEY_USER_TYPE, "normal");
    }

    /** init() 内调用：在 ATSDK.init 之前把 user_type 设为全局自定义规则（流量分组） */
    private void applyUserTypeForInit() {
        try {
            Map<String, Object> customMap = new HashMap<>();
            customMap.put("user_type", getUserTypeCached());
            ATSDK.initCustomMap(customMap);
            Log.i(TAG, "initCustomMap set: user_type=" + getUserTypeCached());
        } catch (Throwable e) {
            Log.e(TAG, "initCustomMap pre-init failed: " + e.getMessage());
        }
    }

    /**
     * Litemize OAID 传递（官方文档：LTAdDeviceManager.setUserOAID，推荐设置，影响填充率）。
     *
     * 两步走，保证 ATSDK.init 之前尽量已有 OAID：
     *   1) 同步尝试 DeviceIdentifier.getOAID(context)，拿到就立即 setUserOAID；
     *   2) 同时用 register(Application, IRegisterCallback) 注册 OAID 采集，
     *      回调里再补一次 —— 首次启动时 OAID 常需等 MSA/厂商服务返回，同步拿不到。
     *
     * 全程 try/catch 兜底：OAID 属优化项，任何异常都不得影响广告 SDK 正常初始化。
     */
    private void setupOaid() {
        // 1) 同步尝试
        try {
            String oaid = DeviceIdentifier.getOAID(appContext);
            if (oaid != null && oaid.length() > 0) {
                LTAdDeviceManager.setUserOAID(appContext, oaid);
                Log.i(TAG, "OAID set (sync) ok");
            } else {
                Log.i(TAG, "OAID not ready (sync), waiting for async callback");
            }
        } catch (Throwable t) {
            Log.w(TAG, "OAID sync get failed: " + t.getMessage());
        }

        // 2) 异步注册，回调后再补一次（切回主线程执行，避免回调线程问题）
        try {
            if (!(appContext instanceof Application)) {
                Log.w(TAG, "OAID register skipped: appContext is not Application");
                return;
            }
            DeviceIdentifier.register((Application) appContext, new IRegisterCallback() {
                @Override
                public void onComplete(final String oaid, Exception e) {
                    if (oaid == null || oaid.length() == 0) {
                        Log.w(TAG, "OAID async empty: " + (e == null ? "unknown" : e.getMessage()));
                        return;
                    }
                    runOnMain(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                LTAdDeviceManager.setUserOAID(appContext, oaid);
                                Log.i(TAG, "OAID set (async) ok");
                            } catch (Throwable t) {
                                Log.w(TAG, "OAID async set failed: " + t.getMessage());
                            }
                        }
                    });
                }
            });
        } catch (Throwable t) {
            Log.w(TAG, "OAID register failed: " + t.getMessage());
        }
    }

    // ==================== 激励视频 ====================
    public void loadRewardedVideo(String placementId, AdCallback cbs) {
        if (!checkInited(placementId, cbs)) return;
        final AdHolder holder = getHolder(rewardedMap, placementId);
        holder.cbs = cbs;

        if (holder.rewardedAd == null) {
            holder.rewardedAd = new ATRewardVideoAd(appContext, placementId);
            holder.rewardedAd.setAdListener(new ATRewardVideoListener() {
                @Override
                public void onRewardedVideoAdLoaded() {
                    Log.i(TAG, "rewarded loaded: " + placementId);
                    fire(holder, "onAdLoaded", 0, null);
                }

                @Override
                public void onRewardedVideoAdFailed(AdError error) {
                    Log.e(TAG, "rewarded load failed: " + placementId);
                    fire(holder, "onAdFailed", codeOf(error),
                            error == null ? "load failed" : error.getFullErrorInfo());
                }

                @Override
                public void onRewardedVideoAdPlayStart(ATAdInfo atAdInfo) {
                    Log.i(TAG, "adInfo rewarded show | " + netInfo(atAdInfo));
                    fire(holder, "onAdShow", 0, netInfo(atAdInfo));
                    fire(holder, "onAdPlayStart", 0, null);
                }

                @Override
                public void onRewardedVideoAdPlayEnd(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded play end: " + placementId);
                    fire(holder, "onAdPlayEnd", 0, null);
                }

                @Override
                public void onRewardedVideoAdPlayFailed(AdError error, ATAdInfo atAdInfo) {
                    Log.e(TAG, "rewarded play failed: " + placementId);
                    fire(holder, "onAdFailed", codeOf(error),
                            error == null ? "play failed" : error.getFullErrorInfo());
                }

                @Override
                public void onRewardedVideoAdClosed(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded closed: " + placementId);
                    fire(holder, "onAdClosed", 0, null);
                }

                @Override
                public void onReward(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded onReward: " + placementId);
                    fire(holder, "onReward", 0, null);
                }

                @Override
                public void onRewardedVideoAdPlayClicked(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded clicked: " + placementId);
                    fire(holder, "onAdClicked", 0, null);
                }
            });
        }
        holder.rewardedAd.load();
    }

    public void showRewardedVideo(String placementId, Context activityContext) {
        AdHolder holder = rewardedMap.get(placementId);
        if (holder == null || holder.rewardedAd == null) {
            Log.w(TAG, "showRewardedVideo skipped: not loaded, placementId=" + placementId);
            return;
        }
        if (!holder.rewardedAd.isAdReady()) {
            Log.w(TAG, "showRewardedVideo skipped: ad not ready, placementId=" + placementId);
            fire(holder, "onAdFailed", -3, "ad not ready");
            return;
        }
        if (!(activityContext instanceof Activity)) {
            Log.e(TAG, "showRewardedVideo skipped: context not Activity");
            fire(holder, "onAdFailed", -4, "context not activity");
            return;
        }
        holder.rewardedAd.show((Activity) activityContext);
    }

    // ==================== 插屏 ====================
    public void loadInterstitial(String placementId, AdCallback cbs) {
        if (!checkInited(placementId, cbs)) return;
        final AdHolder holder = getHolder(interstitialMap, placementId);
        holder.cbs = cbs;

        if (holder.interstitialAd == null) {
            holder.interstitialAd = new ATInterstitial(appContext, placementId);
            holder.interstitialAd.setAdListener(new ATInterstitialListener() {
                @Override
                public void onInterstitialAdLoaded() {
                    Log.i(TAG, "interstitial loaded: " + placementId);
                    fire(holder, "onAdLoaded", 0, null);
                }

                @Override
                public void onInterstitialAdLoadFail(AdError error) {
                    Log.e(TAG, "interstitial load failed: " + placementId);
                    fire(holder, "onAdFailed", codeOf(error),
                            error == null ? "load failed" : error.getFullErrorInfo());
                }

                @Override
                public void onInterstitialAdClicked(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial clicked: " + placementId);
                    fire(holder, "onAdClicked", 0, null);
                }

                @Override
                public void onInterstitialAdShow(ATAdInfo atAdInfo) {
                    Log.i(TAG, "adInfo interstitial show | " + netInfo(atAdInfo));
                    fire(holder, "onAdShow", 0, netInfo(atAdInfo));
                }

                @Override
                public void onInterstitialAdClose(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial close: " + placementId);
                    fire(holder, "onAdClosed", 0, null);
                }

                @Override
                public void onInterstitialAdVideoStart(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial video start: " + placementId);
                    fire(holder, "onAdPlayStart", 0, null);
                }

                @Override
                public void onInterstitialAdVideoEnd(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial video end: " + placementId);
                    fire(holder, "onAdPlayEnd", 0, null);
                }

                @Override
                public void onInterstitialAdVideoError(AdError error) {
                    Log.e(TAG, "interstitial video error: " + placementId + ", "
                            + (error == null ? "" : error.getFullErrorInfo()));
                }
            });
        }
        holder.interstitialAd.load();
    }

    public void showInterstitial(String placementId, Context activityContext) {
        AdHolder holder = interstitialMap.get(placementId);
        if (holder == null || holder.interstitialAd == null) {
            Log.w(TAG, "showInterstitial skipped: not loaded, placementId=" + placementId);
            return;
        }
        if (!holder.interstitialAd.isAdReady()) {
            Log.w(TAG, "showInterstitial skipped: ad not ready, placementId=" + placementId);
            fire(holder, "onAdFailed", -3, "ad not ready");
            return;
        }
        if (!(activityContext instanceof Activity)) {
            Log.e(TAG, "showInterstitial skipped: context not Activity");
            fire(holder, "onAdFailed", -4, "context not activity");
            return;
        }
        holder.interstitialAd.show((Activity) activityContext);
    }

    // ==================== 横幅（Banner，悬浮视图） ====================

    private final Map<String, BannerHolder> bannerMap = new HashMap<>();

    /** 横幅状态：按 positionKey（页面路由 + 广告位）维度保存 */
    private static class BannerHolder {
        ATBannerView bannerView;
        String placementId;
        boolean loaded;
        AdCallback cbs;
    }

    /**
     * 开启/复用横幅（不负责挂载视图，挂载由调用方将 getBannerView 结果 addView 到容器）。
     * 同一 positionKey 且广告位相同 → 复用已加载实例（未加载成功则重试 loadAd）；
     * 更换广告位 → 销毁旧实例重建。
     */
    public void showBanner(String positionKey, String placementId, Context activityContext, AdCallback cbs) {
        if (!checkInited(placementId, cbs)) return;
        BannerHolder holder = bannerMap.get(positionKey);
        if (holder == null) {
            holder = new BannerHolder();
            bannerMap.put(positionKey, holder);
        }
        holder.cbs = cbs;

        if (holder.bannerView != null && placementId.equals(holder.placementId)) {
            if (!holder.loaded) {
                holder.bannerView.loadAd();
            }
            return;
        }

        // 更换广告位：销毁旧实例
        if (holder.bannerView != null) {
            detachViewInternal(holder.bannerView);
            try {
                holder.bannerView.destroy();
            } catch (Throwable ignored) {
            }
            holder.bannerView = null;
            holder.loaded = false;
        }

        final BannerHolder h = holder;
        final String pid = placementId;
        Context ctx = activityContext != null ? activityContext : appContext;
        ATBannerView view = new ATBannerView(ctx);
        view.setPlacementId(pid);
        view.setBannerAdListener(new ATBannerListener() {
            @Override
            public void onBannerLoaded() {
                h.loaded = true;
                Log.i(TAG, "banner loaded: " + pid);
                fire(h.cbs, "onAdLoaded", 0, null);
            }

            @Override
            public void onBannerFailed(AdError error) {
                h.loaded = false; // 加载失败：无有效广告，后续展示需重新 loadAd
                Log.e(TAG, "banner load failed: " + pid);
                fire(h.cbs, "onAdFailed", codeOf(error),
                        error == null ? "load failed" : error.getFullErrorInfo());
            }

            @Override
            public void onBannerClicked(ATAdInfo atAdInfo) {
                Log.i(TAG, "banner clicked: " + pid);
                fire(h.cbs, "onAdClicked", 0, null);
            }

            @Override
            public void onBannerShow(ATAdInfo atAdInfo) {
                Log.i(TAG, "adInfo banner show | " + netInfo(atAdInfo));
                fire(h.cbs, "onAdShow", 0, netInfo(atAdInfo));
            }

            @Override
            public void onBannerClose(ATAdInfo atAdInfo) {
                Log.i(TAG, "banner close: " + pid);
                fire(h.cbs, "onAdClosed", 0, null);
            }

            @Override
            public void onBannerAutoRefreshed(ATAdInfo atAdInfo) {
                // 刷新成功：当前持有有效广告 —— 页面切换/回切复用时不再重新竞价（配合预加载实现秒显）
                h.loaded = true;
                Log.i(TAG, "banner auto refreshed: " + pid);
            }

            @Override
            public void onBannerAutoRefreshFail(AdError error) {
                // 刷新失败：素材已失效 —— 页面再次展示时重新加载（loadAd）
                h.loaded = false;
                Log.w(TAG, "banner auto refresh fail: " + pid);
            }
        });
        holder.bannerView = view;
        holder.placementId = placementId;
        view.loadAd();
    }

    /** 获取横幅视图（供容器挂载） */
    public ATBannerView getBannerView(String positionKey) {
        BannerHolder holder = bannerMap.get(positionKey);
        return holder == null ? null : holder.bannerView;
    }

    /** 销毁指定位置横幅（释放内存） */
    public void destroyBanner(String positionKey) {
        BannerHolder holder = bannerMap.remove(positionKey);
        if (holder != null && holder.bannerView != null) {
            detachViewInternal(holder.bannerView);
            try {
                holder.bannerView.destroy();
            } catch (Throwable ignored) {
            }
            holder.bannerView = null;
        }
    }

    private static void detachViewInternal(View view) {
        ViewParent parent = view.getParent();
        if (parent instanceof ViewGroup) {
            ((ViewGroup) parent).removeView(view);
        }
    }

    // ==================== 开屏（Splash，启动级广告） ====================

    private final Map<String, SplashHolder> splashMap = new HashMap<>();

    /** 开屏状态：SDK 广告对象 + 事件回调 + 展示容器（弱引用，避免强持有 Activity 视图） */
    private static class SplashHolder {
        ATSplashAd splashAd;
        AdCallback cbs;
        WeakReference<ViewGroup> containerRef;
    }

    /**
     * 加载开屏广告（冷启动时调用一次；加载结果经 onAdLoaded / onAdFailed 事件下发）。
     * onAdLoaded 的布尔参数不做语义区分，统一视为「可尝试展示」，
     * 由 showSplash 的 isAdReady 兜底把关，规避不同 SDK 版本参数含义差异。
     */
    public void loadSplash(String placementId, AdCallback cbs) {
        if (!checkInited(placementId, cbs)) return;
        SplashHolder holder = splashMap.get(placementId);
        if (holder == null) {
            holder = new SplashHolder();
            splashMap.put(placementId, holder);
        }
        holder.cbs = cbs;

        if (holder.splashAd == null) {
            final SplashHolder h = holder;
            final String pid = placementId;
            holder.splashAd = new ATSplashAd(appContext, pid, new ATSplashAdListener() {
                @Override
                public void onAdLoaded(boolean isSuccess) {
                    Log.i(TAG, "splash loaded: " + pid + ", flag=" + isSuccess);
                    fire(h.cbs, "onAdLoaded", 0, null);
                }

                @Override
                public void onAdLoadTimeout() {
                    Log.e(TAG, "splash load timeout: " + pid);
                    fire(h.cbs, "onAdFailed", -1, "load timeout");
                }

                @Override
                public void onNoAdError(AdError error) {
                    Log.e(TAG, "splash no ad: " + pid);
                    fire(h.cbs, "onAdFailed", codeOf(error),
                            error == null ? "no ad" : error.getFullErrorInfo());
                }

                @Override
                public void onAdShow(ATAdInfo atAdInfo) {
                    Log.i(TAG, "adInfo splash show | " + netInfo(atAdInfo));
                    fire(h.cbs, "onAdShow", 0, netInfo(atAdInfo));
                }

                @Override
                public void onAdClick(ATAdInfo atAdInfo) {
                    Log.i(TAG, "splash clicked: " + pid);
                    fire(h.cbs, "onAdClicked", 0, null);
                }

                @Override
                public void onAdDismiss(ATAdInfo atAdInfo, ATSplashAdExtraInfo extraInfo) {
                    Log.i(TAG, "splash dismiss: " + pid);
                    fire(h.cbs, "onAdClosed", 0, null);
                    // 关闭即回收：清空容器并隐藏，释放广告对象（开屏每次启动仅展示一次）
                    releaseSplashContainer(h);
                    destroySplashAd(h);
                }
            });
        }
        holder.splashAd.loadAd();
    }

    /**
     * 展示开屏广告（需先 load 成功且在启动窗口内）。
     * 展示前才把容器置为可见；失败路径不触碰容器，避免遮挡 WebView。
     */
    public void showSplash(String placementId, Context activityContext, ViewGroup container, AdCallback cbs) {
        SplashHolder holder = splashMap.get(placementId);
        if (holder == null || holder.splashAd == null) {
            Log.w(TAG, "showSplash skipped: not loaded, placementId=" + placementId);
            fire(cbs, "onAdFailed", -3, "splash not loaded");
            return;
        }
        holder.cbs = cbs;
        if (!holder.splashAd.isAdReady()) {
            Log.w(TAG, "showSplash skipped: ad not ready, placementId=" + placementId);
            fire(holder.cbs, "onAdFailed", -3, "ad not ready");
            return;
        }
        if (!(activityContext instanceof Activity) || container == null) {
            Log.e(TAG, "showSplash skipped: invalid context/container");
            fire(holder.cbs, "onAdFailed", -4, "context not activity");
            return;
        }
        holder.containerRef = new WeakReference<>(container);
        container.setVisibility(View.VISIBLE);
        holder.splashAd.show((Activity) activityContext, container);
    }

    /** 清空开屏容器并隐藏（由 onAdDismiss 触发） */
    private void releaseSplashContainer(SplashHolder holder) {
        ViewGroup container = holder.containerRef == null ? null : holder.containerRef.get();
        if (container != null) {
            container.removeAllViews();
            container.setVisibility(View.GONE);
        }
        holder.containerRef = null;
    }

    /** 释放开屏广告对象（展示结束或加载废弃后调用） */
    private void destroySplashAd(SplashHolder holder) {
        if (holder.splashAd != null) {
            try {
                holder.splashAd.onDestory();
            } catch (Throwable ignored) {
            }
            holder.splashAd = null;
        }
    }

    // ==================== 工具 ====================

    private boolean checkInited(String placementId, AdCallback cbs) {
        if (appContext == null || !inited) {
            Log.w(TAG, "load skipped: SDK not inited, placementId=" + placementId);
            fire(cbs, "onAdFailed", -2, "sdk not inited");
            return false;
        }
        return true;
    }

    private AdHolder getHolder(Map<String, AdHolder> map, String placementId) {
        AdHolder holder = map.get(placementId);
        if (holder == null) {
            holder = new AdHolder();
            map.put(placementId, holder);
        }
        return holder;
    }
}
