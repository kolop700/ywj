package com.yefiot.cloudguard.bridge

import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import org.json.JSONObject

/**
 * JS 通道：封装「原生 -> JS」的两类回传。
 *
 *  1) 调用回传： window.__nativeCallback(callbackId, { code, data, msg })
 *     - code === 0 成功，其余失败
 *  2) 事件推送： window.__nativeEmit(eventName, data)
 *
 * 所有回传统一在主线程通过 evaluateJavascript 执行，避免 WebView 线程问题。
 */
class JsChannel(private val webView: WebView) {

    private val handler = Handler(Looper.getMainLooper())

    fun resolve(callbackId: String?, code: Int, data: JSONObject? = null, msg: String? = null) {
        if (callbackId.isNullOrEmpty()) return
        val res = JSONObject()
        res.put("code", code)
        if (msg != null) res.put("msg", msg)
        if (data != null) res.put("data", data)
        evaluate("window.__nativeCallback(${JSONObject.quote(callbackId)}, ${JSONObject.quote(res.toString())});")
    }

    fun resolveOk(callbackId: String?, data: JSONObject? = null) = resolve(callbackId, 0, data)

    fun resolveErr(callbackId: String?, msg: String, code: Int = -1) = resolve(callbackId, code, null, msg)

    fun emit(event: String, data: JSONObject) {
        evaluate("window.__nativeEmit(${JSONObject.quote(event)}, ${JSONObject.quote(data.toString())});")
    }

    private fun evaluate(js: String) {
        handler.post {
            try {
                webView.evaluateJavascript(js, null)
            } catch (_: Throwable) {
                // WebView 已销毁等情况静默忽略
            }
        }
    }
}
