package com.yefiot.cloudguard.wxapi

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram
import com.tencent.mm.opensdk.modelpay.PayResp
import com.tencent.mm.opensdk.openapi.IWXAPI
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import com.yefiot.cloudguard.pay.PayBridge

/**
 * 微信回调入口（必须位于 应用包名.wxapi 包下）。
 *
 * 支付回调：用户完成/取消微信支付后回到本 Activity，经 IWXAPIEventHandler.onResp 拿到
 * PayResp，转发给 PayBridge → 以 pay.onEvent 事件推回 H5；JS 侧（utils/payUtils.js）
 * 收到事件后再轮询后端 queryVipOrder 确认订单，最终状态以后端为准。
 *
 * AppId 来源：PayBridge.rememberedWxAppId（支付发起或拉起小程序时落本地），
 * 兼容「操作后进程被杀、微信重新拉起本页」场景；无记录时直接 finish。
 *
 * 小程序说明：App 拉起小程序（miniprogram.launch，见 MiniProgramBridge）后，
 * 用户从微信返回时同样以回调 intent 回到本页，WXLaunchMiniProgram.Resp 分支仅日志留痕。
 *
 * 分享说明：当前分享采用「系统分享 Intent 定向微信」方案（见 ShareManager），无 SDK 回调；
 * 若后续接入微信分享 SDK，在此补充 SendMessageToWX.Resp 分支即可。
 */
class WXEntryActivity : AppCompatActivity(), IWXAPIEventHandler {

    private var wxApi: IWXAPI? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appId = PayBridge.rememberedWxAppId(this)
        if (appId.isEmpty()) {
            finish()
            return
        }
        try {
            wxApi = WXAPIFactory.createWXAPI(this, appId, false)
            // handleIntent 同步回调 onResp（有效回调）或返回 false（非微信回调 intent）
            if (wxApi?.handleIntent(intent, this) != true) {
                finish()
            }
        } catch (t: Throwable) {
            finish()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        try {
            if (wxApi?.handleIntent(intent, this) != true) {
                finish()
            }
        } catch (t: Throwable) {
            finish()
        }
    }

    override fun onReq(req: BaseReq?) {
        // 微信主动请求本应用（如分享后跳回），当前无处理
        finish()
    }

    override fun onResp(resp: BaseResp?) {
        when (resp) {
            is PayResp -> PayBridge.dispatchWxPayResp(resp)
            is WXLaunchMiniProgram.Resp -> {
                // 用户从拉起的小程序返回：无业务动作，仅日志留痕（extMsg 为小程序返回信息）
                Log.i("WXEntryActivity", "launch mini program resp errCode=${resp.errCode}")
            }
        }
        finish()
    }
}
