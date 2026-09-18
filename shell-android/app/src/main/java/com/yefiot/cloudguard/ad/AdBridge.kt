package com.yefiot.cloudguard.ad

import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONObject

/**
 * 广告桥接（ad.*）：把 JS 调用转给 AdManager，并把广告事件经 ad.onEvent 推回 JS。
 *
 * 事件载荷： { placementId, event, code, msg }
 *  - JS 侧 utils/h5-native-bridge.js 的 createAdBridgeAdapter 按 placementId 路由，
 *    再按 event 分发给 common/taku-sdk.js 注册的回调。
 *
 * load 类方法不等待最终结果（结果经 ad.onEvent 异步下发），立即回传 code=0 释放调用；
 * 广告实际加载结果由 onAdLoaded / onAdFailed 事件表达。
 */
class AdBridge(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private val manager = AdManager.getInstance()

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "ad.init" -> initAd(params, callbackId)
            "ad.loadRewarded" -> {
                manager.loadRewardedVideo(params.optString("placementId"), makeCallback(params.optString("placementId")))
                channel.resolveOk(callbackId)
            }
            "ad.showRewarded" -> {
                manager.showRewardedVideo(params.optString("placementId"), activity)
                channel.resolveOk(callbackId)
            }
            "ad.loadInterstitial" -> {
                manager.loadInterstitial(params.optString("placementId"), makeCallback(params.optString("placementId")))
                channel.resolveOk(callbackId)
            }
            "ad.showInterstitial" -> {
                manager.showInterstitial(params.optString("placementId"), activity)
                channel.resolveOk(callbackId)
            }
            "ad.banner.show" -> showBanner(params, callbackId)
            "ad.banner.hide" -> {
                val positionKey = params.optString("positionKey").ifEmpty { "default" }
                manager.getBannerView(positionKey)?.let { activity.detachBannerView(it) }
                channel.resolveOk(callbackId)
            }
            // 开屏：load 后结果经 onAdLoaded/onAdFailed 事件下发；show 注入最顶层容器展示
            "ad.splash.load" -> {
                manager.loadSplash(params.optString("placementId"), makeCallback(params.optString("placementId")))
                channel.resolveOk(callbackId)
            }
            "ad.splash.show" -> {
                manager.showSplash(
                    params.optString("placementId"),
                    activity,
                    activity.getSplashLayer(),
                    makeCallback(params.optString("placementId"))
                )
                channel.resolveOk(callbackId)
            }
            // 原生信息流（预留，二期实现）
            "ad.native.show", "ad.native.hide" -> channel.resolveOk(callbackId)
            // 【VIP 免广告-流量分组】设置用户类型（vip/normal）→ 更新 Taku 全局自定义规则
            "ad.setUserType" -> {
                manager.setUserType(params.optString("userType"))
                channel.resolveOk(callbackId)
            }
            else -> return false
        }
        return true
    }

    /**
     * 展示横幅：创建/复用 ATBannerView，并按 JS 上报的矩形（CSS px × dpr）悬浮定位。
     * params: { placementId, positionKey, rect: {left, top, width, height}, dpr }
     */
    private fun showBanner(params: JSONObject, callbackId: String?) {
        val placementId = params.optString("placementId")
        if (placementId.isEmpty()) {
            channel.resolveErr(callbackId, "empty placementId")
            return
        }
        val positionKey = params.optString("positionKey").ifEmpty { "default" }
        manager.showBanner(positionKey, placementId, activity, makeCallback(placementId))
        val view = manager.getBannerView(positionKey)
        val rect = params.optJSONObject("rect")
        if (view != null && rect != null) {
            val dpr = if (params.has("dpr")) params.optDouble("dpr", 1.0) else 1.0
            val left = (rect.optDouble("left", 0.0) * dpr).toInt()
            val top = (rect.optDouble("top", 0.0) * dpr).toInt()
            val width = (rect.optDouble("width", 0.0) * dpr).toInt()
            activity.attachBannerView(view, left, top, width)
        }
        channel.resolveOk(callbackId)
    }

    private fun initAd(params: JSONObject, callbackId: String?) {
        val appId = params.optString("appId")
        val appKey = params.optString("appKey")
        // 【VIP 免广告-流量分组】初始化前先落地用户类型：
        // setUserType 在 SDK 未初始化时仅写本地缓存，由 manager.init() 在 ATSDK.init 之前统一生效，
        // 保证「开屏」等冷启动首个请求就命中 VIP 流量分组（官方要求 init 前调用）。
        val userType = params.optString("userType")
        if (userType.isNotEmpty()) {
            manager.setUserType(userType)
        }
        if (appId.isEmpty() || appKey.isEmpty()) {
            channel.resolve(callbackId, 0, JSONObject().put("msg", "success"))
            return
        }
        if (manager.isInited()) {
            channel.resolve(callbackId, 0, JSONObject().put("msg", "already inited"))
            return
        }
        val ok = manager.init(activity.applicationContext, appId, appKey)
        if (ok) {
            channel.resolve(callbackId, 0, JSONObject().put("msg", "success"))
        } else {
            channel.resolveErr(callbackId, "ATSDK init failed")
        }
    }

    private fun makeCallback(placementId: String): AdManager.AdCallback =
        AdManager.AdCallback { event, code, msg ->
            val payload = JSONObject().apply {
                put("placementId", placementId)
                put("event", event)
                put("code", code)
                put("msg", msg ?: "")
            }
            channel.emit("ad.onEvent", payload)
        }
}
