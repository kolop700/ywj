package com.yefiot.cloudguard.bridge

import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * WebView 注入的 JS 桥对象，对应 utils/h5-native-bridge.js 中的：
 *   window.NativeBridge.call(method, paramsJson, callbackId)
 *
 * 注意：本方法由 WebView 私有线程回调，内部统一转发到主线程处理。
 */
class NativeBridge(private val router: BridgeRouter) {

    @JavascriptInterface
    fun call(method: String, paramsJson: String, callbackId: String) {
        val params = try {
            if (paramsJson.isNullOrBlank()) JSONObject() else JSONObject(paramsJson)
        } catch (_: Throwable) {
            JSONObject()
        }
        router.dispatch(method, params, callbackId)
    }
}
