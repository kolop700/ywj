package com.yefiot.cloudguard.share

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.core.content.FileProvider
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/**
 * 分享原生实现（share.wechat）。
 *
 * 采用「系统分享 Intent 定向微信（com.tencent.mm）」的方案：
 *  - 无需强制依赖微信 OpenSDK 即可编译运行；
 *  - 已安装微信时直接唤起微信分享（好友/朋友圈由微信内部处理）；
 *  - 未安装微信时回退到系统分享面板。
 *
 * 若后续需要 OpenSDK 的精细化分享（自定义缩略图/朋友圈直达/深链回跳），
 * 可集成微信 OpenSDK（参考 build.gradle 中 libs/wechat-sdk-android.aar 说明）并替换本实现。
 */
class ShareManager(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "share.wechat" -> share(params, callbackId)
            else -> return false
        }
        return true
    }

    private fun share(params: JSONObject, callbackId: String?) {
        val imageBase64 = params.optString("imageBase64")
        val title = params.optString("title")
        val summary = params.optString("summary")
        val href = params.optString("href")

        if (imageBase64.isEmpty()) {
            dispatchShare(null, title, summary, href, callbackId)
            return
        }
        executor.execute {
            val file = try {
                val dir = File(activity.cacheDir, "share").apply { mkdirs() }
                val f = File(dir, "share_${System.currentTimeMillis()}.jpg")
                f.writeBytes(Base64.decode(imageBase64, Base64.DEFAULT))
                f
            } catch (_: Exception) {
                null
            }
            mainHandler.post { dispatchShare(file, title, summary, href, callbackId) }
        }
    }

    private fun dispatchShare(imageFile: File?, title: String, summary: String, href: String, callbackId: String?) {
        try {
            val intent = Intent(Intent.ACTION_SEND)
            if (href.isNotEmpty()) {
                intent.type = "text/plain"
                intent.putExtra(Intent.EXTRA_SUBJECT, title)
                intent.putExtra(Intent.EXTRA_TEXT, if (title.isNotEmpty()) "$title\n$href" else href)
            } else if (imageFile != null && imageFile.exists()) {
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", imageFile)
                intent.type = "image/*"
                intent.putExtra(Intent.EXTRA_STREAM, uri)
                if (title.isNotEmpty()) intent.putExtra(Intent.EXTRA_SUBJECT, title)
                if (summary.isNotEmpty()) intent.putExtra(Intent.EXTRA_TEXT, summary)
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
                intent.type = "text/plain"
                intent.putExtra(Intent.EXTRA_SUBJECT, title)
                intent.putExtra(Intent.EXTRA_TEXT, if (summary.isNotEmpty()) summary else title)
            }

            if (isWeChatInstalled()) {
                intent.setPackage("com.tencent.mm")
                activity.startActivity(intent)
            } else {
                activity.startActivity(Intent.createChooser(intent, "分享到"))
            }
            channel.resolveOk(callbackId, JSONObject().put("errMsg", "share:ok"))
        } catch (e: Exception) {
            channel.resolveErr(callbackId, "分享失败: ${e.message}")
        }
    }

    private fun isWeChatInstalled(): Boolean = try {
        activity.packageManager.getPackageInfo("com.tencent.mm", 0)
        true
    } catch (_: Exception) {
        false
    }
}
