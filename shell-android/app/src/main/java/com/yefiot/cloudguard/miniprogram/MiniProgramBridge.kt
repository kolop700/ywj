package com.yefiot.cloudguard.miniprogram

import android.util.Log
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import com.yefiot.cloudguard.pay.PayBridge
import org.json.JSONObject

/**
 * 拉起微信小程序桥接（miniprogram.launch）。
 *
 * 依赖微信 OpenSDK（与支付同一 aar：app/libs/wechat-sdk-android.aar，全量包已含 modelbiz）。
 *
 * 前置条件（微信开放平台）：
 *   - 「移动应用」AppId 与目标小程序需绑定同一开放平台账号，否则 sendReq 直接失败；
 *   - 目标小程序需为正式版（type=0 对应线上版本）。
 *   appId 由 JS 侧下发（utils → my 页 WX_MINI_PROGRAM 配置，待填项）。
 *
 * 回调链路：用户从微信返回 → WXEntryActivity.onResp（WXLaunchMiniProgram.Resp）→ 仅日志留痕。
 *           本桥 resolveOk 语义为「拉起指令已发出」，不等待用户操作结果（无需回包）。
 */
class MiniProgramBridge(
    private val activity: MainActivity,
    private val channel: JsChannel
) {

    companion object {
        private const val TAG = "MiniProgramBridge"
    }

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "miniprogram.launch" -> launch(params, callbackId)
            else -> return false
        }
        return true
    }

    /** 拉起微信小程序（WXLaunchMiniProgram.Req；userName 为小程序原始 ID gh_xxx） */
    private fun launch(params: JSONObject, callbackId: String) {
        val appId = params.optString("appId")
        val userName = params.optString("userName")
        if (appId.isEmpty() || userName.isEmpty()) {
            channel.resolveErr(callbackId, "missing appId/userName（微信开放平台 AppId 未配置？）")
            return
        }
        try {
            // 记录 appId：WXEntryActivity 解析回跳 intent 需要（与支付共用同一本地存储）
            PayBridge.rememberWxAppId(activity, appId)

            val api = WXAPIFactory.createWXAPI(activity, appId, true)
            api.registerApp(appId)
            val req = WXLaunchMiniProgram.Req().apply {
                this.userName = userName
                this.path = params.optString("path")
                this.miniprogramType = params.optInt("type", 0)
            }
            if (api.sendReq(req)) {
                channel.resolveOk(callbackId)
            } else {
                channel.resolveErr(callbackId, "sendReq failed（微信未安装，或开放平台未关联小程序）")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "launch mini program error", t)
            channel.resolveErr(callbackId, "launch mini program error: ${t.message}")
        }
    }
}
