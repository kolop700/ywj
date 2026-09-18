package com.yefiot.taku;

import android.util.Log;

import com.alibaba.fastjson.JSONObject;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.common.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

/**
 * TakuAdsNativePlugin 无界面 API 模块（Android）
 *
 * 与 JS 层 common/taku-sdk.js 的调用契约一一对应（方法名/参数/事件不可擅自改动）：
 * 







 *
 *   initTaku({appId, appKey}, cb)            -> cb({code, msg}) code=0 成功
 *   loadRewardedVideoAd({placementId}, cbs)  -> cbs 事件：onAdLoaded/onAdFailed/onAdShow/
 *                                                onAdClicked/onAdClosed/onReward/onAdPlayStart/onAdPlayEnd
 *   showRewardedVideoAd({placementId})
 *   loadInterstitialAd({placementId, scenarioId?, extraData?}, cbs)
 *   showInterstitialAd({placementId})
 *   showBannerAd({...}, cbs)  /  hideBannerAd(positionKey)     （悬浮式，预留）
 *   showNativeAd({...}, cbs)  /  hideNativeAd(positionKey)     （原生信息流，预留）
 *
 * 事件回传协议（原生 -> JS，每次事件 invoke 一次）：
 *   { event: "onAdLoaded" | "onAdFailed" | ... , code: 0 | -1 | 错误码, msg: "..." }
 *
 * 注意：初始化/激励视频/插屏已按官方文档子页填写真实 SDK API（见 TakuAdManager）；
 * 横幅（M4）、原生信息流（二期）仍为 TODO 桩。所有 @UniJSMethod 均走主线程
 * （Taku SDK 要求主线程创建广告对象/load/show）。
 */
public class TakuAdBridgeModule extends UniModule {

    private static final String TAG = "TakuAdBridge";

    // ==================== 初始化 ====================

    /**
     * 初始化 Taku SDK（用户同意隐私政策后由 JS 调用）
     * 对应官方文档：Android接入指南 -> 初始化说明（ATSDK.init + ATSDK.start，主线程）
     */
    @UniJSMethod
    public void initTaku(JSONObject options, UniJSCallback cb) {
        String appId = options == null ? "" : options.getString("appId");
        String appKey = options == null ? "" : options.getString("appKey");
        Log.i(TAG, "initTaku appId=" + appId + " appKey=" + (appKey == null ? "" : "***"));

        if (appId == null || appId.isEmpty() || appKey == null || appKey.isEmpty()) {
            invoke(cb, 0, "success", null); // 空配置 = 插件未启用，按成功处理，JS 层自动降级隐藏广告
            return;
        }
        if (TakuAdManager.getInstance().isInited()) {
            invoke(cb, 0, "already inited", null);
            return;
        }

        boolean ok = TakuAdManager.getInstance().init(mUniSDKInstance.getContext(), appId, appKey);
        invoke(cb, ok ? 0 : -1, ok ? "success" : "ATSDK init failed", null);
    }

    // ==================== 激励视频 ====================

    /**
     * 加载激励视频。官方文档：Android接入指南 -> 广告样式 -> 激励视频广告
     */
    @UniJSMethod
    public void loadRewardedVideoAd(JSONObject options, UniJSCallback cbs) {
        String placementId = options == null ? "" : options.getString("placementId");
        Log.i(TAG, "loadRewardedVideoAd placementId=" + placementId);
        if (placementId == null || placementId.isEmpty()) {
            fireEvent(cbs, "onAdFailed", -1, "empty placementId");
            return;
        }
        // 真实 API 已在 TakuAdManager.loadRewardedVideo 接线（ATRewardVideoAd + ATRewardVideoListener）
        TakuAdManager.getInstance().loadRewardedVideo(placementId, cbs);
    }

    /**
     * 展示激励视频（需 load 成功）。官方文档同上
     */
    @UniJSMethod
    public void showRewardedVideoAd(JSONObject options) {
        String placementId = options == null ? "" : options.getString("placementId");
        Log.i(TAG, "showRewardedVideoAd placementId=" + placementId);
        TakuAdManager.getInstance().showRewardedVideo(placementId, mUniSDKInstance.getContext());
    }

    // ==================== 插屏 ====================

    /**
     * 加载插屏。官方文档：Android接入指南 -> 广告样式 -> 插屏广告
     * @param options {placementId, scenarioId?, extraData?}
     */
    @UniJSMethod
    public void loadInterstitialAd(JSONObject options, UniJSCallback cbs) {
        String placementId = options == null ? "" : options.getString("placementId");
        Log.i(TAG, "loadInterstitialAd placementId=" + placementId);
        if (placementId == null || placementId.isEmpty()) {
            fireEvent(cbs, "onAdFailed", -1, "empty placementId");
            return;
        }
        // 真实 API 已在 TakuAdManager.loadInterstitial 接线（ATInterstitial + ATInterstitialListener）
        TakuAdManager.getInstance().loadInterstitial(placementId, cbs);
    }

    /**
     * 展示插屏（需 load 成功）
     */
    @UniJSMethod
    public void showInterstitialAd(JSONObject options) {
        String placementId = options == null ? "" : options.getString("placementId");
        Log.i(TAG, "showInterstitialAd placementId=" + placementId);
        TakuAdManager.getInstance().showInterstitial(placementId, mUniSDKInstance.getContext());
    }

    // ==================== 横幅（JS 悬浮式，预留） ====================

    @UniJSMethod
    public void showBannerAd(JSONObject options, UniJSCallback cbs) {
        Log.i(TAG, "showBannerAd(JS悬浮式) 预留，页面横幅请使用 <taku-banner> 组件");
        // TODO(M4)：官方形态已确认（横幅广告 /docs/fygHI5）：
        //   ATBannerView(Context) + setPlacementId + setLocalExtra(AD_WIDTH/AD_HEIGHT)
        //   + loadAd + destroy；setBannerAdListener(ATBannerListener) 事件映射：
        //   onBannerLoaded->onAdLoaded / onBannerFailed->onAdFailed / onBannerShow->onAdShow
        //   onBannerClicked->onAdClicked / onBannerClose->onAdClosed
        // 需持有 Activity 并将 ATBannerView addView 到窗口（悬浮式）
    }

    @UniJSMethod
    public void hideBannerAd(String positionKey) {
        Log.i(TAG, "hideBannerAd positionKey=" + positionKey);
        // TODO(M4)
    }

    // ==================== 原生信息流（预留） ====================

    @UniJSMethod
    public void showNativeAd(JSONObject options, UniJSCallback cbs) {
        Log.i(TAG, "showNativeAd 预留（二期）");
        // TODO(二期)：官方形态已确认（原生广告 /docs/NqTq8g）：
        //   ATNative(Context, placementId, ATNativeNetworkListener) + makeAdRequest
        //   + getNativeAd() + renderAdContainer(ATNativeAdView, selfRenderView)
        //   + prepare(ATNativeAdView, ATNativePrepareInfo)；事件经 NativeAd.setNativeEventListener
        //   （onAdImpressed/onAdClicked/onAdVideoStart/onAdVideoEnd）
    }

    @UniJSMethod
    public void hideNativeAd(String positionKey) {
        Log.i(TAG, "hideNativeAd positionKey=" + positionKey);
        // TODO(二期)
    }

    // ==================== 事件回传工具 ====================

    /**
     * 同步回调（init 用）：cb({code, msg})
     */
    private void invoke(final UniJSCallback cb, final int code, final String msg, final JSONObject extra) {
        if (cb == null) return;
        runOnMain(new Runnable() {
            @Override
            public void run() {
                JSONObject res = new JSONObject();
                res.put("code", code);
                res.put("msg", msg == null ? "" : msg);
                if (extra != null) res.put("extra", extra);
                cb.invoke(res);
            }
        });
    }

    /**
     * 事件回调（load 类广告用）：cbs({event, code, msg})
     */
    public static void fireEvent(final UniJSCallback cbs, final String event,
                                 final int code, final String msg) {
        if (cbs == null) return;
        TakuAdManager.getInstance().runOnMain(new Runnable() {
            @Override
            public void run() {
                JSONObject res = new JSONObject();
                res.put("event", event);
                res.put("code", code);
                res.put("msg", msg == null ? "" : msg);
                cbs.invoke(res);
            }
        });
    }

    private void runOnMain(Runnable runnable) {
        TakuAdManager.getInstance().runOnMain(runnable);
    }
}
