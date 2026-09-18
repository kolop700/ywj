package com.yefiot.cloudguard

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.yefiot.cloudguard.bridge.BridgeRouter
import com.yefiot.cloudguard.bridge.JsChannel
import com.yefiot.cloudguard.bridge.NativeBridge
import com.yefiot.cloudguard.scan.ScanActivity
import org.json.JSONObject

/**
 * 壳主容器：WebView 加载 H5 产物（assets/www）+ JS 桥接。
 *
 * 本地资源通过 WebViewAssetLoader 以 https://appassets.androidplatform.net/assets/www/ 暴露，
 * 使其具备「安全上下文」，从而可用 Blob / DOM Storage / 现代 Web API。
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val START_URL = "https://appassets.androidplatform.net/assets/www/index.html"
    }

    private lateinit var webView: WebView
    private lateinit var channel: JsChannel
    private lateinit var router: BridgeRouter

    /** 根容器：webView 在下层，bannerLayer 在上层专门承载广告悬浮视图 */
    private lateinit var rootLayout: FrameLayout
    private lateinit var bannerLayer: FrameLayout
    /** 开屏广告层：最顶层全屏容器，默认隐藏；展示期间由广告模块注入视图并拦截触摸 */
    private lateinit var splashLayer: FrameLayout

    private var pendingScanCallback: String? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // 权限请求队列：ActivityResultLauncher 不支持并发 launch，
    // 用队列串行化，避免蓝牙/相机/存储等多方同时申请时回调互相覆盖。
    private data class PermissionRequest(
        val perms: Array<String>,
        val callback: (Map<String, Boolean>) -> Unit
    )
    private val permissionQueue = ArrayDeque<PermissionRequest>()
    private var permissionInFlight = false
    private var pendingPermissionCallback: ((Map<String, Boolean>) -> Unit)? = null

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    /** 从 assets/www 读取本地资源（供 WebViewAssetLoader 兜底处理 /static/ 等绝对路径） */
    private fun openWwwAsset(path: String): WebResourceResponse? {
        return try {
            if (path.contains("..")) return null
            val clean = path.trimStart('/')
            if (clean.isEmpty()) return null
            val ext = clean.substringAfterLast('.', "").lowercase()
            val mime = when (ext) {
                "html", "htm" -> "text/html"
                "js", "mjs" -> "application/javascript"
                "css" -> "text/css"
                "json", "map" -> "application/json"
                "png" -> "image/png"
                "jpg", "jpeg" -> "image/jpeg"
                "gif" -> "image/gif"
                "svg" -> "image/svg+xml"
                "webp" -> "image/webp"
                "bmp" -> "image/bmp"
                "woff" -> "font/woff"
                "woff2" -> "font/woff2"
                "ttf" -> "font/ttf"
                "otf" -> "font/otf"
                "ico" -> "image/x-icon"
                "mp4" -> "video/mp4"
                "mp3" -> "audio/mpeg"
                else -> "application/octet-stream"
            }
            WebResourceResponse(mime, "utf-8", assets.open("www/$clean"))
        } catch (e: Exception) {
            null
        }
    }

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val cb = pendingScanCallback
        pendingScanCallback = null
        if (cb == null) return@registerForActivityResult
        if (result.contents != null) {
            val data = JSONObject().apply {
                put("result", result.contents)
                put("scanType", "qrCode")
            }
            channel.resolveOk(cb, data)
        } else {
            channel.resolveErr(cb, "scan cancelled")
        }
    }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val cb = pendingPermissionCallback
            pendingPermissionCallback = null
            permissionInFlight = false
            cb?.invoke(result)
            drainPermissionQueue()
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = filePathCallback
            filePathCallback = null
            if (cb == null) return@registerForActivityResult
            var results: Array<Uri>? = null
            if (result.resultCode == RESULT_OK) {
                val data = result.data
                if (data != null) {
                    val clip = data.clipData
                    results = if (clip != null) {
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri ?: Uri.EMPTY }
                    } else {
                        data.data?.let { arrayOf(it) }
                    }
                }
            }
            if (results.isNullOrEmpty()) results = null
            cb.onReceiveValue(results)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 仅调试包开启 WebView 远程调试（chrome://inspect）；正式包关闭，
        // 避免通过 USB 审查/篡改 H5 产物与 JS 桥接。
        val debuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        WebView.setWebContentsDebuggingEnabled(debuggable)

        webView = WebView(this)
        // 悬浮广告层方案：root( FrameLayout ) 之下 [ webView, bannerLayer ]
        // bannerLayer 自身不可点击、不消费触摸事件，空白区域触摸会穿透到下层 WebView。
        rootLayout = FrameLayout(this)
        rootLayout.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        bannerLayer = FrameLayout(this)
        bannerLayer.isClickable = false
        bannerLayer.isFocusable = false
        rootLayout.addView(
            bannerLayer,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        // 开屏层（最顶层）：默认隐藏不可点击；展示时由 AdManager 置为可见并注入开屏视图，
        // 可见期间消费触摸事件，防止用户误触下层 WebView（关闭后恢复隐藏）。
        splashLayer = FrameLayout(this)
        splashLayer.visibility = View.GONE
        splashLayer.isClickable = true
        rootLayout.addView(
            splashLayer,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        setContentView(rootLayout)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
        }

        channel = JsChannel(webView)
        router = BridgeRouter(this, channel)
        webView.addJavascriptInterface(NativeBridge(router), "NativeBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                // 仅接管本地壳域名；后端接口 / 广告素材等外部请求保持原样放行。
                if (url.host != "appassets.androidplatform.net") return null
                val loaded = assetLoader.shouldInterceptRequest(url)
                if (loaded != null && loaded.statusCode != 404) return loaded
                // WebViewAssetLoader 没有 fallback API（仅有 addPathHandler/setDomain/setHttpAllowed），
                // 因此对域名内未命中 /assets/ 的绝对路径（如 /static/xxx）手动兜底到 assets/www，避免 404。
                return openWwwAsset(url.path ?: return loaded)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                return try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }

            override fun onConsoleMessage(cm: ConsoleMessage): Boolean {
                Log.d(TAG, "console: ${cm.message()} (${cm.sourceId()}:${cm.lineNumber()})")
                return true
            }
        }

        webView.loadUrl(START_URL)
    }

    /**
     * 附着横幅悬浮视图（由 AdBridge 的 ad.banner.show 调用）。
     * 坐标为相对 WebView 内容区的物理像素（JS 侧 rect(CSS px) × dpr）。
     * 高度采用 WRAP_CONTENT，由 ATBannerView 按素材自适应。
     */
    fun attachBannerView(view: View, left: Int, top: Int, width: Int) {
        val parent = view.parent
        if (parent is ViewGroup) parent.removeView(view)
        if (view.parent == null) bannerLayer.addView(view)
        val lp = FrameLayout.LayoutParams(
            if (width > 0) width else ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        lp.leftMargin = left.coerceAtLeast(0)
        lp.topMargin = top.coerceAtLeast(0)
        view.layoutParams = lp
        view.visibility = View.VISIBLE
        view.bringToFront()
    }

    /** 移除横幅悬浮视图（由 AdBridge 的 ad.banner.hide 调用；原生实例保留复用） */
    fun detachBannerView(view: View) {
        val parent = view.parent
        if (parent is ViewGroup) parent.removeView(view)
    }

    /**
     * 获取开屏广告容器（由 AdBridge 的 ad.splash.show 调用）。
     * 视图注入与显隐切换（VISIBLE/GONE）由 AdManager 在展示/关闭时负责。
     */
    fun getSplashLayer(): FrameLayout = splashLayer

    /**
     * 发起扫码（由 scan.qrcode 桥接调用）。
     * 必须先确保相机权限：Manifest 已声明 CAMERA，未授权时 ZXing 打开相机会失败。
     */
    fun requestScan(callbackId: String?) {
        if (hasPermission(Manifest.permission.CAMERA)) {
            launchScan(callbackId)
            return
        }
        requestPermissions(arrayOf(Manifest.permission.CAMERA)) { result ->
            if (result[Manifest.permission.CAMERA] == true) {
                launchScan(callbackId)
            } else {
                channel.resolveErr(callbackId, "缺少相机权限")
            }
        }
    }

    private fun launchScan(callbackId: String?) {
        pendingScanCallback = callbackId
        val options = ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            setPrompt(getString(R.string.scan_hint))
            setBeepEnabled(false)
            setOrientationLocked(true)
            setBarcodeImageEnabled(false)
            setCaptureActivity(ScanActivity::class.java)
        }
        scanLauncher.launch(options)
    }

    /** 请求运行时权限（由 permission.request 桥接调用）；多次请求自动排队串行执行 */
    fun requestPermissions(perms: Array<String>, cb: (Map<String, Boolean>) -> Unit) {
        if (perms.isEmpty()) {
            cb(emptyMap())
            return
        }
        permissionQueue.addLast(PermissionRequest(perms, cb))
        drainPermissionQueue()
    }

    /** 单权限便捷申请；已授权时同步回调，不占用请求队列 */
    fun ensurePermission(perm: String, cb: (Boolean) -> Unit) {
        if (hasPermission(perm)) {
            cb(true)
            return
        }
        requestPermissions(arrayOf(perm)) { result -> cb(result[perm] == true) }
    }

    private fun hasPermission(perm: String): Boolean =
        ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED

    private fun drainPermissionQueue() {
        if (permissionInFlight) return
        val next = permissionQueue.removeFirstOrNull() ?: return
        permissionInFlight = true
        pendingPermissionCallback = next.callback
        permissionLauncher.launch(next.perms)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        // 释放桥接资源（清 PayBridge 静态引用，避免泄漏 WebView）
        if (::router.isInitialized) {
            router.dispose()
        }
        if (::webView.isInitialized) {
            webView.loadUrl("about:blank")
            webView.destroy()
        }
        super.onDestroy()
    }
}
