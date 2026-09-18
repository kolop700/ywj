package com.yefiot.cloudguard.bridge

import android.os.Build
import android.os.Handler
import android.os.Looper
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.ad.AdBridge
import com.yefiot.cloudguard.ble.BleManager
import com.yefiot.cloudguard.http.HttpManager
import com.yefiot.cloudguard.media.MediaManager
import com.yefiot.cloudguard.miniprogram.MiniProgramBridge
import com.yefiot.cloudguard.pay.PayBridge
import com.yefiot.cloudguard.share.ShareManager
import com.yefiot.cloudguard.update.UpdateManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * 桥接路由器：把 JS 的 method 分发到各原生能力模块。
 *
 * 与 utils/h5-native-bridge.js 的方法清单严格对应：
 *   device.getInfo / permission.request / scan.qrcode
 *   ble.* / image.* / share.* / app.* / ad.* / pay.* / miniprogram.*
 *
 * 所有处理统一切到主线程执行（Activity / WebView / 广告 SDK 均要求主线程）。
 */
class BridgeRouter(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private val bleManager = BleManager(activity, channel)
    private val mediaManager = MediaManager(activity, channel)
    private val shareManager = ShareManager(activity, channel)
    private val updateManager = UpdateManager(activity, channel)
    private val adBridge = AdBridge(activity, channel)
    private val httpManager = HttpManager(channel)
    private val payBridge = PayBridge(activity, channel)
    private val miniProgramBridge = MiniProgramBridge(activity, channel)

    /** 页面销毁时释放桥接资源（清 PayBridge 静态引用等，避免泄漏 WebView） */
    fun dispose() {
        payBridge.dispose()
    }

    fun dispatch(method: String, params: JSONObject, callbackId: String) {
        mainHandler.post { safeRoute(method, params, callbackId) }
    }

    private fun safeRoute(method: String, params: JSONObject, callbackId: String) {
        try {
            route(method, params, callbackId)
        } catch (t: Throwable) {
            channel.resolveErr(callbackId, "bridge error: ${t.message}")
        }
    }

    private fun route(method: String, params: JSONObject, callbackId: String) {
        when {
            method == "device.getInfo" -> channel.resolveOk(callbackId, deviceInfo())
            method == "permission.request" -> handlePermission(params, callbackId)
            method == "scan.qrcode" -> activity.requestScan(callbackId)
            method.startsWith("ble.") -> bleManager.handle(method, params, callbackId)
            method.startsWith("image.") -> mediaManager.handle(method, params, callbackId)
            method.startsWith("share.") -> shareManager.handle(method, params, callbackId)
            method.startsWith("app.") -> updateManager.handle(method, params, callbackId)
            method.startsWith("ad.") -> adBridge.handle(method, params, callbackId)
            method.startsWith("pay.") -> payBridge.handle(method, params, callbackId)
            method.startsWith("miniprogram.") -> miniProgramBridge.handle(method, params, callbackId)
            method.startsWith("http.") -> httpManager.handle(method, params, callbackId)
            else -> channel.resolveErr(callbackId, "unknown method: $method")
        }
    }

    private fun handlePermission(params: JSONObject, callbackId: String) {
        val arr = params.optJSONArray("permissions") ?: JSONArray()
        val perms = ArrayList<String>()
        for (i in 0 until arr.length()) {
            val p = arr.optString(i)
            if (p.isNotEmpty()) perms.add(p)
        }
        activity.requestPermissions(perms.toTypedArray()) { result ->
            val obj = JSONObject()
            result.forEach { (k, v) -> obj.put(k, v) }
            channel.resolveOk(callbackId, obj)
        }
    }

    private fun deviceInfo(): JSONObject {
        val pi = activity.packageManager.getPackageInfo(activity.packageName, 0)
        val obj = JSONObject()
        obj.put("platform", "android")
        obj.put("system", "Android ${Build.VERSION.RELEASE}")
        obj.put("model", Build.MODEL)
        obj.put("brand", Build.BRAND)
        obj.put("version", pi.versionName ?: "")
        obj.put(
            "buildNumber",
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode.toString() else pi.versionCode.toString()
        )
        obj.put("appId", activity.packageName)
        return obj
    }
}
