package com.yefiot.cloudguard.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.URLUtil
import androidx.core.content.FileProvider
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * App 更新与系统能力（app.*）。
 *
 *   app.download {url, taskId}       -> DownloadManager 下载，事件 app.onDownloadProgress
 *   app.installPackage {filePath}    -> FileProvider 安装 APK（未知来源权限引导）
 *   app.openStore {url}              -> 打开应用商店（iOS 端为跳商店，本端亦支持）
 *   app.openSettings {}              -> 打开本应用系统设置
 *   app.quit {}                      -> 退出应用
 */
class UpdateManager(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private data class DownloadTask(
        val taskId: String,
        val downloadId: Long,
        val callbackId: String,
        val file: File
    )

    private val handler = Handler(Looper.getMainLooper())
    private val downloads = ConcurrentHashMap<Long, DownloadTask>()
    private var polling = false

    private val pollRunnable = object : Runnable {
        override fun run() {
            pollDownloads()
            if (downloads.isNotEmpty()) handler.postDelayed(this, 500)
        }
    }

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "app.download" -> download(params, callbackId)
            "app.installPackage" -> installPackage(params, callbackId)
            "app.openStore" -> openStore(params, callbackId)
            "app.openSettings" -> openSettings(callbackId)
            "app.quit" -> quit(callbackId)
            else -> return false
        }
        return true
    }

    private fun download(params: JSONObject, callbackId: String?) {
        val url = params.optString("url")
        val taskId = params.optString("taskId").ifEmpty { "dl_${System.currentTimeMillis()}" }
        if (url.isEmpty()) {
            channel.resolveErr(callbackId, "url 为空")
            return
        }
        try {
            val fileName = URLUtil.guessFileName(url, null, "application/vnd.android.package-archive")
            val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setTitle(fileName)
                setMimeType("application/vnd.android.package-archive")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName)
            }
            val id = dm.enqueue(request)
            val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            val file = File(dir, fileName)
            downloads[id] = DownloadTask(taskId, id, callbackId ?: "", file)
            startPolling()
        } catch (e: Exception) {
            channel.resolveErr(callbackId, "下载失败: ${e.message}")
        }
    }

    private fun startPolling() {
        if (!polling) {
            polling = true
            handler.post(pollRunnable)
        }
    }

    private fun pollDownloads() {
        if (downloads.isEmpty()) {
            polling = false
            return
        }
        val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val iterator = downloads.entries.iterator()
        while (iterator.hasNext()) {
            val task = iterator.next().value
            val query = DownloadManager.Query().setFilterById(task.downloadId)
            dm.query(query)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val downloaded =
                    cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                val percent = if (total > 0) ((downloaded * 100) / total).toInt() else 0
                channel.emit("app.onDownloadProgress", JSONObject().apply {
                    put("taskId", task.taskId)
                    put("percent", percent)
                    put("downloadedSize", downloaded)
                    put("totalSize", total)
                })
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        iterator.remove()
                        channel.resolveOk(task.callbackId, JSONObject().put("filePath", task.file.absolutePath))
                    }
                    DownloadManager.STATUS_FAILED -> {
                        iterator.remove()
                        channel.resolveErr(task.callbackId, "下载失败")
                    }
                }
            }
        }
        if (downloads.isEmpty()) polling = false
    }

    private fun installPackage(params: JSONObject, callbackId: String?) {
        val filePath = params.optString("filePath")
        val file = File(filePath)
        if (!file.exists()) {
            channel.resolveErr(callbackId, "安装包不存在: $filePath")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            try {
                activity.startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:${activity.packageName}")
                    )
                )
            } catch (_: Exception) {
            }
            channel.resolveErr(callbackId, "need install permission")
            return
        }
        try {
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
            channel.resolveOk(callbackId)
        } catch (e: Exception) {
            channel.resolveErr(callbackId, "安装失败: ${e.message}")
        }
    }

    private fun openStore(params: JSONObject, callbackId: String?) {
        val url = params.optString("url")
        try {
            val intent = if (url.isNotEmpty()) {
                Intent(Intent.ACTION_VIEW, Uri.parse(url))
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${activity.packageName}"))
            }
            activity.startActivity(intent)
            channel.resolveOk(callbackId)
        } catch (e: Exception) {
            channel.resolveErr(callbackId, "打开商店失败: ${e.message}")
        }
    }

    private fun openSettings(callbackId: String?) {
        try {
            activity.startActivity(
                Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${activity.packageName}")
                )
            )
            channel.resolveOk(callbackId)
        } catch (e: Exception) {
            channel.resolveErr(callbackId, "打开设置失败: ${e.message}")
        }
    }

    private fun quit(callbackId: String?) {
        channel.resolveOk(callbackId)
        activity.finishAffinity()
    }
}
