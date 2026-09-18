package com.yefiot.cloudguard.media

import android.Manifest
import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import com.yefiot.cloudguard.MainActivity
import com.yefiot.cloudguard.bridge.JsChannel
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/**
 * 相机 / 相册 / 保存相册 原生实现。
 *
 * 与 JS 契约：
 *   image.choose / image.chooseMedia  -> { images: [{base64, mimeType, name, size}] }
 *       （Shim 层把 base64 还原为 File + blob URL，模拟 H5 uni.chooseImage 返回结构）
 *   image.saveToAlbum                 <- { filePath, base64?, mimeType? }
 */
class MediaManager(
    private val activity: MainActivity,
    private val channel: JsChannel
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var pendingChooseCallback: String? = null
    private var pendingCount = 1
    private var cameraFile: File? = null

    private val galleryLauncher =
        activity.registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            handlePickedUris(uris)
        }

    private val cameraLauncher =
        activity.registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            handleCameraResult(success)
        }

    fun handle(method: String, params: JSONObject, callbackId: String): Boolean {
        when (method) {
            "image.choose", "image.chooseMedia" -> choose(params, callbackId)
            "image.saveToAlbum" -> saveToAlbum(params, callbackId)
            else -> return false
        }
        return true
    }

    // ==================== 选择图片 ====================

    private fun choose(params: JSONObject, callbackId: String?) {
        pendingChooseCallback = callbackId
        pendingCount = params.optInt("count", 1).coerceAtLeast(1)
        val sourceType = params.optJSONArray("sourceType")?.let { arr ->
            (0 until arr.length()).map { arr.optString(it) }
        } ?: listOf("camera", "album")
        val hasCamera = sourceType.contains("camera")
        val hasAlbum = sourceType.contains("album")
        when {
            hasCamera && hasAlbum && pendingCount == 1 -> showSourceChooser()
            hasCamera && !hasAlbum -> launchCamera()
            else -> launchGallery()
        }
    }

    private fun showSourceChooser() {
        AlertDialog.Builder(activity)
            .setTitle("选择图片来源")
            .setItems(arrayOf("拍照", "从相册选择")) { _, which ->
                if (which == 0) launchCamera() else launchGallery()
            }
            .setOnCancelListener { finishChooseErr("已取消") }
            .show()
    }

    /**
     * 打开相机前必须先确保 CAMERA 权限：
     * Android 规定只要 Manifest 声明了 CAMERA，未授权时调用拍照 Intent 会被系统拒绝。
     */
    private fun launchCamera() {
        activity.ensurePermission(Manifest.permission.CAMERA) { granted ->
            if (!granted) {
                finishChooseErr("缺少相机权限")
                return@ensurePermission
            }
            launchCameraInternal()
        }
    }

    private fun launchCameraInternal() {
        try {
            val dir = File(activity.cacheDir, "images").apply { mkdirs() }
            val file = File(dir, "cap_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            cameraFile = file
            cameraLauncher.launch(uri)
        } catch (e: Exception) {
            finishChooseErr("相机不可用: ${e.message}")
        }
    }

    private fun launchGallery() {
        try {
            galleryLauncher.launch("image/*")
        } catch (e: Exception) {
            finishChooseErr("相册不可用: ${e.message}")
        }
    }

    private fun handlePickedUris(uris: List<Uri>) {
        val cb = pendingChooseCallback ?: return
        if (uris.isEmpty()) {
            finishChooseErr("未选择图片")
            return
        }
        val selected = uris.take(pendingCount)
        executor.execute {
            val images = JSONArray()
            for (u in selected) {
                readImage(u)?.let { images.put(it) }
            }
            mainHandler.post {
                pendingChooseCallback = null
                if (images.length() == 0) {
                    channel.resolveErr(cb, "读取图片失败")
                } else {
                    channel.resolveOk(cb, JSONObject().put("images", images))
                }
            }
        }
    }

    private fun handleCameraResult(success: Boolean) {
        val cb = pendingChooseCallback
        val file = cameraFile
        if (!success || cb == null || file == null || !file.exists()) {
            finishChooseErr("已取消拍照")
            return
        }
        executor.execute {
            val bytes = file.readBytes()
            val img = JSONObject().apply {
                put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                put("mimeType", "image/jpeg")
                put("name", file.name)
                put("size", bytes.size)
            }
            mainHandler.post {
                pendingChooseCallback = null
                channel.resolveOk(cb, JSONObject().put("images", JSONArray().put(img)))
            }
        }
    }

    private fun readImage(uri: Uri): JSONObject? {
        return try {
            val mime = activity.contentResolver.getType(uri) ?: "image/jpeg"
            val bytes = activity.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
            val name = queryName(uri) ?: "image_${System.currentTimeMillis()}${extOf(mime)}"
            JSONObject().apply {
                put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                put("mimeType", mime)
                put("name", name)
                put("size", bytes.size)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun queryName(uri: Uri): String? = try {
        activity.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        }
    } catch (_: Exception) {
        null
    }

    private fun finishChooseErr(msg: String) {
        val cb = pendingChooseCallback
        pendingChooseCallback = null
        channel.resolveErr(cb, msg)
    }

    // ==================== 保存到相册 ====================

    private fun saveToAlbum(params: JSONObject, callbackId: String?) {
        // Android 9 (API 28) 及以下写入 MediaStore 需要 WRITE_EXTERNAL_STORAGE 运行时权限
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            activity.ensurePermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) { granted ->
                if (!granted) {
                    channel.resolveErr(callbackId, "缺少存储权限")
                    return@ensurePermission
                }
                doSaveToAlbum(params, callbackId)
            }
            return
        }
        doSaveToAlbum(params, callbackId)
    }

    private fun doSaveToAlbum(params: JSONObject, callbackId: String?) {
        val b64 = params.optString("base64")
        val filePath = params.optString("filePath")
        val mime = params.optString("mimeType").ifEmpty { "image/jpeg" }
        executor.execute {
            try {
                val bytes: ByteArray = when {
                    b64.isNotEmpty() -> Base64.decode(b64, Base64.DEFAULT)
                    filePath.startsWith("file:") -> File(Uri.parse(filePath).path ?: "").readBytes()
                    filePath.isNotEmpty() -> File(filePath).readBytes()
                    else -> throw IllegalArgumentException("empty image")
                }
                val name = "CG_${System.currentTimeMillis()}${extOf(mime)}"
                val ok = saveToMediaStore(bytes, name, mime)
                mainHandler.post {
                    if (ok) channel.resolveOk(callbackId) else channel.resolveErr(callbackId, "保存失败")
                }
            } catch (e: Exception) {
                mainHandler.post { channel.resolveErr(callbackId, "保存失败: ${e.message}") }
            }
        }
    }

    private fun saveToMediaStore(bytes: ByteArray, name: String, mime: String): Boolean {
        val resolver = activity.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, mime)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/CloudGuard")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val uri = resolver.insert(collection, values) ?: return false
        return try {
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val done = ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }
                resolver.update(uri, done, null, null)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun extOf(mime: String): String = when {
        mime.contains("png") -> ".png"
        mime.contains("webp") -> ".webp"
        mime.contains("gif") -> ".gif"
        else -> ".jpg"
    }
}
