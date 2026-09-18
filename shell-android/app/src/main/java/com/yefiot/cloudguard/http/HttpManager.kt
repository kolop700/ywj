package com.yefiot.cloudguard.http

import android.util.Base64
import com.yefiot.cloudguard.bridge.JsChannel
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * 原生 HTTP 管理器（Android）。
 *
 * 为什么需要它：业务后端（xy.yefiot.com）未返回 CORS 允许头，H5 在 WebView 内用 XHR
 * 调用会被同源策略拦截（net::ERR_FAILED），导致登录/注册/验证码等接口全部失败。
 * 本模块让 JS 通过原生 OkHttp 发起请求，彻底绕开 CORS。
 *
 * 对应 utils/h5-native-bridge.js 的 NativeApp.request / NativeApp.upload：
 *   http.request 入参 { url, method, header, data } -> { statusCode, data }
 *   http.upload  入参 { url, name, fileName, mimeType, fileBase64, formData } -> { statusCode, data }
 * 其中 request 的 data 会尝试 JSON 解析（对齐 uni.request），upload 的 data 为响应原文。
 *
 * 网络请求在独立线程执行，回传统一经 JsChannel 切回主线程。
 */
class HttpManager(private val channel: JsChannel) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val executor = Executors.newCachedThreadPool()

    fun handle(method: String, params: JSONObject, callbackId: String) {
        when (method) {
            "http.request" -> executor.execute { doRequest(params, callbackId) }
            "http.upload" -> executor.execute { doUpload(params, callbackId) }
            else -> channel.resolveErr(callbackId, "unknown http method: $method")
        }
    }

    // ==================== http.request ====================

    private fun doRequest(params: JSONObject, callbackId: String) {
        try {
            val rawUrl = params.optString("url")
            if (rawUrl.isEmpty()) {
                channel.resolveErr(callbackId, "empty url")
                return
            }
            val method = params.optString("method", "GET").uppercase()
            val headerObj = params.optJSONObject("header")
            val data = params.opt("data")
            val needsBody = method != "GET" && method != "HEAD"

            val builder = Request.Builder().url(buildUrl(rawUrl, method, data))
            addHeaders(builder, headerObj)

            if (needsBody) {
                val bodyText = when {
                    data is JSONObject || data is JSONArray -> data.toString()
                    data == null || data == JSONObject.NULL -> ""
                    else -> data.toString()
                }
                val contentType = headerObj?.optString("Content-Type")?.takeIf { it.isNotEmpty() }
                    ?: "application/json;charset=utf-8"
                builder.method(method, bodyText.toRequestBody(contentType.toMediaTypeOrNull()))
            } else {
                builder.method(method, null)
            }

            client.newCall(builder.build()).execute().use { response ->
                val body = response.body?.string() ?: ""
                val result = JSONObject()
                result.put("statusCode", response.code)
                result.put("data", parseBody(body))
                channel.resolveOk(callbackId, result)
            }
        } catch (t: Throwable) {
            channel.resolveErr(callbackId, "http error: ${t.message}")
        }
    }

    // ==================== http.upload ====================

    private fun doUpload(params: JSONObject, callbackId: String) {
        try {
            val url = params.optString("url")
            if (url.isEmpty()) {
                channel.resolveErr(callbackId, "empty url")
                return
            }
            val name = params.optString("name", "file")
            val fileName = params.optString("fileName", "upload_${System.currentTimeMillis()}")
            val mime = params.optString("mimeType", "application/octet-stream")
            val fileBase64 = params.optString("fileBase64")
            val formData = params.optJSONObject("formData")
            val headerObj = params.optJSONObject("header")

            val bytes = if (fileBase64.isEmpty()) ByteArray(0)
            else Base64.decode(fileBase64, Base64.DEFAULT)

            val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
            formData?.keys()?.forEach { key ->
                val v = formData.opt(key)
                multipart.addFormDataPart(key, if (v == null || v == JSONObject.NULL) "" else v.toString())
            }
            multipart.addFormDataPart(name, fileName, bytes.toRequestBody(mime.toMediaTypeOrNull()))

            val builder = Request.Builder().url(url).post(multipart.build())
            addHeaders(builder, headerObj)

            client.newCall(builder.build()).execute().use { response ->
                val body = response.body?.string() ?: ""
                val result = JSONObject()
                result.put("statusCode", response.code)
                result.put("data", body)
                channel.resolveOk(callbackId, result)
            }
        } catch (t: Throwable) {
            channel.resolveErr(callbackId, "upload error: ${t.message}")
        }
    }

    // ==================== 工具 ====================

    private fun addHeaders(builder: Request.Builder, headerObj: JSONObject?) {
        headerObj ?: return
        val keys = headerObj.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val v = headerObj.opt(key)
            if (v != null && v != JSONObject.NULL && v.toString().isNotEmpty()) {
                // Content-Type 交由 RequestBody 决定，避免与 multipart 冲突
                if (key.equals("Content-Type", ignoreCase = true)) continue
                builder.addHeader(key, v.toString())
            }
        }
    }

    /** GET/HEAD 时把 data（JSONObject）拼成 query string */
    private fun buildUrl(url: String, method: String, data: Any?): String {
        if (method != "GET" && method != "HEAD") return url
        if (data !is JSONObject) return url
        val keys = data.keys()
        if (!keys.hasNext()) return url
        val sb = StringBuilder(url)
        sb.append(if (url.contains('?')) '&' else '?')
        var first = true
        while (keys.hasNext()) {
            val key = keys.next()
            val v = data.opt(key)
            if (!first) sb.append('&')
            first = false
            sb.append(URLEncoder.encode(key, "UTF-8"))
            sb.append('=')
            sb.append(URLEncoder.encode(if (v == null || v == JSONObject.NULL) "" else v.toString(), "UTF-8"))
        }
        return sb.toString()
    }

    /** 尝试把响应体解析为 JSON（对齐 uni.request），失败则原样返回字符串 */
    private fun parseBody(body: String): Any {
        val t = body.trim()
        if (t.isEmpty()) return ""
        return try {
            when {
                t.startsWith("{") -> JSONObject(t)
                t.startsWith("[") -> JSONArray(t)
                else -> t
            }
        } catch (e: Exception) {
            t
        }
    }
}
