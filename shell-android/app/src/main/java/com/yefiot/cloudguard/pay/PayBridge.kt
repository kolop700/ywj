package com.yefiot.cloudguard.pay

import android.content.Context
import android.util.Log
import com.alipay.sdk.app.PayTask
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelpay.PayReq
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * 支付桥接（pay.*）：把 JS 调用转给微信 OpenSDK / 支付宝 SDK，支付结果经 pay.onEvent 推回 JS。
 *
 * 事件载荷： { channel: 'wechat'|'alipay', event: 'pay.success'|'pay.cancel'|'pay.fail', code, msg }
 *  - JS 侧 utils/payUtils.js 订阅 pay.onEvent 收到回调后，再轮询后端 queryVipOrder 确认最终状态
 *    （事件仅作触发信号，订单状态以后端为准，可容忍事件丢失）。
 *
 * 微信回调链路：JS 调 pay.wechat → PayReq → IWXAPI.sendReq → 微信 App → 用户操作
 *              → WXEntryActivity（应用包名.wxapi）onResp → PayBridge.dispatchWxPayResp → pay.onEvent
 * 支付宝回调链路：JS 调 pay.alipay → PayTask.payV2（子线程阻塞）→ 同步返回 resultStatus → pay.onEvent
 *
 * 前置条件（见 app/libs/README-SDK放置说明.txt）：
 *   app/libs/ 下放入微信 OpenSDK aar（wechat-sdk-android.aar）与支付宝 aar（alipaySdk-15.8.x.aar）
 */
class PayBridge(activity: MainActivity, private val channel: JsChannel) {

    companion object {
        private const val TAG = "PayBridge"
        private const val PREF_NAME = "pay_bridge"
        private const val KEY_WX_APP_ID = "wx_app_id"

        @Volatile
        private var instance: PayBridge? = null

        /**
         * 微信支付回调入口（由 WXEntryActivity 转发）。
         * 实例不存在时静默忽略：前端 payUtils.js 有 queryVipOrder 轮询兜底，不会丢单。
         */
        fun dispatchWxPayResp(resp: BaseResp) {
            instance?.onWxPayResp(resp)
        }

        /**
         * 记录最近一次微信 AppId（支付 / 拉起小程序的回跳 intent 解析都依赖它）。
         * 写入本地以覆盖「操作后进程被杀、微信重新拉起」场景。
         */
        fun rememberWxAppId(context: Context, appId: String) {
            try {
                context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .edit().putString(KEY_WX_APP_ID, appId).apply()
            } catch (_: Throwable) {
            }
        }

        /**
         * 最近一次使用过的微信 AppId。
         * WXEntryActivity 解析回调 intent 需要它；无记录（从未支付/未拉起过小程序）时返回空串。
         */
        fun rememberedWxAppId(context: Context): String {
            return try {
                context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_WX_APP_ID, "") ?: ""
            } catch (_: Throwable) {
                ""
            }
        }
    }

    private val activityRef = WeakReference(activity)
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    init {
        instance = this
    }

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "pay.wechat" -> wechatPay(params, callbackId)
            "pay.alipay" -> alipayPay(params, callbackId)
            else -> return false
        }
        return true
    }

    /** 页面销毁：清引用 + 停线程池 */
    fun dispose() {
        if (instance === this) instance = null
        executor.shutdown()
    }

    /** 调起微信支付（PayReq 二次签名参数由后端 createVipOrder 组装下发） */
    private fun wechatPay(params: JSONObject, callbackId: String) {
        val activity = activityRef.get()
        if (activity == null) {
            channel.resolveErr(callbackId, "activity released")
            return
        }
        val appId = params.optString("appid")
        val prepayId = params.optString("prepayid")
        val sign = params.optString("sign")
        if (appId.isEmpty() || prepayId.isEmpty() || sign.isEmpty()) {
            channel.resolveErr(callbackId, "missing wechat pay params")
            return
        }
        try {
            // 记住 appId：WXEntryActivity 解析回调 intent 需要（进程被杀重启场景兜底）
            rememberWxAppId(activity, appId)

            val api = WXAPIFactory.createWXAPI(activity, appId, true)
            api.registerApp(appId)
            val req = PayReq().apply {
                this.appId = appId
                partnerId = params.optString("partnerid")
                // 显式 this：外层存在同名局部 val，不使用 this 会被解析为对其赋值
                this.prepayId = params.optString("prepayid")
                packageValue = params.optString("package")
                nonceStr = params.optString("noncestr")
                timeStamp = params.optString("timestamp")
                this.sign = params.optString("sign")
            }
            if (api.sendReq(req)) {
                // 结果经 pay.onEvent 异步下发，此处立即释放调用
                channel.resolveOk(callbackId)
            } else {
                channel.resolveErr(callbackId, "wechat sendReq failed (wechat not installed?)")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "wechatPay error", t)
            channel.resolveErr(callbackId, "wechat pay error: ${t.message}")
        }
    }

    /** 调起支付宝支付（orderStr 由后端 RSA2 签名组装） */
    private fun alipayPay(params: JSONObject, callbackId: String) {
        val activity = activityRef.get()
        if (activity == null) {
            channel.resolveErr(callbackId, "activity released")
            return
        }
        val orderStr = params.optString("orderStr")
        if (orderStr.isEmpty()) {
            channel.resolveErr(callbackId, "missing orderStr")
            return
        }
        // 立即释放调用；payV2 为阻塞调用，放子线程执行避免卡住桥接主线程
        channel.resolveOk(callbackId)
        executor.execute {
            try {
                // 支付宝 SDK 官方推荐：同步阻塞调用（isShowPayLoading=true 展示自带 loading）
                val result: Map<String, String> = PayTask(activity).payV2(orderStr, true)
                val status = result["resultStatus"] ?: ""
                val event = when (status) {
                    "9000" -> "pay.success"   // 支付成功
                    "6001" -> "pay.cancel"    // 用户中途取消
                    else -> "pay.fail"        // 4000/5000/6002 等一律按失败处理，前端可重试
                }
                emitEvent("alipay", event, status.toIntOrNull() ?: -1, result["memo"] ?: "")
            } catch (t: Throwable) {
                Log.e(TAG, "alipayPay error", t)
                emitEvent("alipay", "pay.fail", -1, t.message ?: "alipay error")
            }
        }
    }

    /** 微信支付回调（由 WXEntryActivity 转发）：errCode → 事件 */
    fun onWxPayResp(resp: BaseResp) {
        val event: String
        val msg: String
        when (resp.errCode) {
            BaseResp.ErrCode.ERR_OK -> {
                event = "pay.success"
                msg = ""
            }
            BaseResp.ErrCode.ERR_USER_CANCEL -> {
                event = "pay.cancel"
                msg = ""
            }
            else -> {
                event = "pay.fail"
                msg = resp.errStr ?: ""
            }
        }
        emitEvent("wechat", event, resp.errCode, msg)
    }

    private fun emitEvent(payChannelName: String, event: String, code: Int, msg: String) {
        val payload = JSONObject().apply {
            put("channel", payChannelName)
            put("event", event)
            put("code", code)
            put("msg", msg)
        }
        channel.emit("pay.onEvent", payload)
    }
}
