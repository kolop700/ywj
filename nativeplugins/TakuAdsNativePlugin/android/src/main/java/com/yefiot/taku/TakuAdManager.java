package com.yefiot.taku;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

// 公开 API 包名（官方 Demo TakuMediation/Taku_Android_Demo 源码 import 实锤）：
//   基础/公共类    -> com.anythink.core.api（ATSDK、ATAdInfo、AdError …）
//   激励视频        -> com.anythink.rewardvideo.api（ATRewardVideoAd / ATRewardVideoListener）
//   插屏            -> com.anythink.interstitial.api（ATInterstitial / ATInterstitialListener）
//   横幅/原生/开屏   -> com.anythink.banner.api / com.anythink.nativead.api / com.anythink.splashad.api
import com.anythink.core.api.ATAdInfo;
import com.anythink.core.api.ATSDK;
import com.anythink.core.api.AdError;
import com.anythink.interstitial.api.ATInterstitial;
import com.anythink.interstitial.api.ATInterstitialListener;
import com.anythink.rewardvideo.api.ATRewardVideoAd;
import com.anythink.rewardvideo.api.ATRewardVideoListener;

// Litemize（莱特摩比 / com.ltmb）自定义 Adapter：OAID 传递
//   LTAdDeviceManager.setUserOAID(context, oaid) —— 官方《自定义 Adapter 配置》要求，
//                                                   必须在 ATSDK.init 之前调用，否则影响填充率与收益；
//   DeviceIdentifier                            —— Litemize SDK 自带的 OAID 采集器（core-3.4.1.aar）。
import com.ltmb.ltsdk.check.LTAdDeviceManager;
import com.ltmb.ltsdk.dev.sm.oaid.DeviceIdentifier;
import com.ltmb.ltsdk.dev.sm.oaid.IRegisterCallback;

import io.dcloud.feature.uniapp.common.UniJSCallback;

import java.util.HashMap;
import java.util.Map;

/**
 * Taku 广告管理器单例（Android）
 *
 * 职责：
 *  1) 持有初始化状态与全局 Context；
 *  2) 统一提供主线程执行器（原生 SDK 回调线程 -> 主线程 -> JS invoke）；
 *  3) 广告实例生命周期管理（placementId -> 实例+监听器），防止泄漏与重复回调；
 *  4) 调用 Taku 官方 SDK 真实 API（已按 help.takuad.com 官方文档子页填写）：
 *     初始化说明 /docs/jjZJbi、激励视频广告 /docs/i0WOv2、插屏广告 /docs/Yn1nat
 *
 * 【API 包名说明】已对照官方 Demo（TakuMediation/Taku_Android_Demo）源码 import
 * 实锤：公开 API 按广告样式拆分在各 .api 子包（core/rewardvideo/interstitial…），
 * com.anythink.china.api 仅为直投下载等中国区辅助接口，非聚合主 API。
 * 类名/方法名均取自官方文档原文，勿改。
 *
 * 【线程约定】所有入口必须在主线程调用（对应 Module 的 @UniJSMethod 主线程注解）；
 * 广告监听器回调可能来自 SDK 任意线程，统一经 runOnMain 后再 invoke JS。
 */
public class TakuAdManager {

    private static final String TAG = "TakuAdManager";

    private static volatile TakuAdManager sInstance;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private Context appContext;
    private volatile boolean inited = false;

    // 广告实例注册表：key = placementId
    private final Map<String, AdHolder> rewardedMap = new HashMap<>();
    private final Map<String, AdHolder> interstitialMap = new HashMap<>();

    /** 单个广告位的一切原生状态：SDK 广告对象 + 最近一次 load 注册的 JS 事件回调 */
    private static class AdHolder {
        ATRewardVideoAd rewardedAd;
        ATInterstitial interstitialAd;
        UniJSCallback cbs; // 事件回调采用"最近一次 load"的实例（fireEvent 判空，无则丢弃）
    }

    public static TakuAdManager getInstance() {
        if (sInstance == null) {
            synchronized (TakuAdManager.class) {
                if (sInstance == null) {
                    sInstance = new TakuAdManager();
                }
            }
        }
        return sInstance;
    }

    private TakuAdManager() {
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

    /** 事件上报（listener 回调线程安全）：AdHolder 版本 */
    private void fire(AdHolder holder, String event, int code, String msg) {
        if (holder != null && holder.cbs != null) {
            TakuAdBridgeModule.fireEvent(holder.cbs, event, code, msg);
        }
    }

    /** 事件上报：直接 cbs 版本（init 前空状态兜底用） */
    private void fire(UniJSCallback cbs, String event, int code, String msg) {
        TakuAdBridgeModule.fireEvent(cbs, event, code, msg);
    }

    // ==================== 初始化 ====================
    // 官方文档（初始化说明 /docs/jjZJbi）：
    //   ATSDK.init(context, appId, appKey);  // 同步初始化，可立即开始加载广告
    //   ATSDK.start();                        // v6.2.95+ 国内 SDK 启动入口（建议主进程前台调用）
    // 注意：须在用户同意隐私授权后调用；多进程只在主进程初始化。
    public boolean init(Context context, String appId, String appKey) {
        appContext = context != null ? context.getApplicationContext() : null;
        if (appContext == null) {
            Log.e(TAG, "init failed: no context");
            return false;
        }
        // 【Litemize 文档要求】初始化 Taku 之前把 OAID 交给聚合 SDK，否则影响广告填充率与收益。
        setupOaid();
        try {
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
    // 官方文档（激励视频广告 /docs/i0WOv2）：
    //   ATRewardVideoAd(Context, placementId) + setAdListener(ATRewardVideoListener) + load()
    //   isAdReady() 判断 + show(Activity) 展示
    public void loadRewardedVideo(String placementId, UniJSCallback cbs) {
        if (!checkInited(placementId, cbs)) return;
        final AdHolder holder = getHolder(rewardedMap, placementId);
        holder.cbs = cbs; // 事件统一走本次 load 的回调

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
                    fire(holder, "onAdFailed", error == null ? -1 : error.getCode(),
                            error == null ? "load failed" : error.getFullErrorInfo());
                }

                @Override
                public void onRewardedVideoAdPlayStart(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded play start: " + placementId);
                    // JS 侧：onAdShow=真实展示计数；onAdPlayStart=播放开始（业务仅日志）
                    fire(holder, "onAdShow", 0, null);
                    fire(holder, "onAdPlayStart", 0, null);
                }

                @Override
                public void onRewardedVideoAdPlayEnd(ATAdInfo atAdInfo) {
                    Log.i(TAG, "rewarded play end: " + placementId);
                    fire(holder, "onAdPlayEnd", 0, null);
                }

                @Override
                public void onRewardedVideoAdPlayFailed(AdError error, ATAdInfo atAdInfo) {
                    // 展示失败：复用 onAdFailed，让 JS 侧走既有"激励不可用->插屏兜底"逻辑
                    Log.e(TAG, "rewarded play failed: " + placementId);
                    fire(holder, "onAdFailed", error == null ? -1 : error.getCode(),
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
    // 官方文档（插屏广告 /docs/Yn1nat）：
    //   ATInterstitial(Context, placementId) + setAdListener(ATInterstitialListener) + load()
    //   isAdReady() 判断 + show(Activity) 展示
    public void loadInterstitial(String placementId, UniJSCallback cbs) {
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
                    fire(holder, "onAdFailed", error == null ? -1 : error.getCode(),
                            error == null ? "load failed" : error.getFullErrorInfo());
                }

                @Override
                public void onInterstitialAdClicked(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial clicked: " + placementId);
                    fire(holder, "onAdClicked", 0, null);
                }

                @Override
                public void onInterstitialAdShow(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial show: " + placementId);
                    fire(holder, "onAdShow", 0, null);
                }

                @Override
                public void onInterstitialAdClose(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial close: " + placementId);
                    fire(holder, "onAdClosed", 0, null);
                }

                @Override
                public void onInterstitialAdVideoStart(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial video start: " + placementId);
                    fire(holder, "onAdPlayStart", 0, null); // JS 侧未注册则自动丢弃
                }

                @Override
                public void onInterstitialAdVideoEnd(ATAdInfo atAdInfo) {
                    Log.i(TAG, "interstitial video end: " + placementId);
                    fire(holder, "onAdPlayEnd", 0, null); // JS 侧未注册则自动丢弃
                }

                @Override
                public void onInterstitialAdVideoError(AdError error) {
                    // 视频播放出错：仅记录（JS 无对应事件位，展示流程以 onAdClosed 收尾）
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

    // ==================== 横幅（JS 悬浮式）/ 原生信息流（二期） ====================
    // 官方文档已确认形态：
    //   - 横幅：ATBannerView extends View，setPlacementId + setLocalExtra(AD_WIDTH/AD_HEIGHT)
    //            + loadAd + destroy；监听 setBannerAdListener(ATBannerListener)（onBannerLoaded/
    //            onBannerFailed/onBannerShow/onBannerClicked/onBannerClose）—— /docs/fygHI5
    //   - 原生：ATNative(Context, placementId, ATNativeNetworkListener) + makeAdRequest
    //            + getNativeAd + renderAdContainer(ATNativeAdView, selfRenderView) —— /docs/NqTq8g
    // 待 M4（横幅）/二期（原生）在 Module 中实现。

    // ==================== 工具 ====================

    private boolean checkInited(String placementId, UniJSCallback cbs) {
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
