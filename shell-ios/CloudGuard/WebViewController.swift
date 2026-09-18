import AVFoundation
import UIKit
import WebKit

/// 壳主容器：WKWebView 加载 H5 产物（WebApp）+ JS 桥接。
///
/// 本地资源通过自定义 scheme（cloudguard://app/）由 AppSchemeHandler 提供，
/// 获得稳定 origin；注入脚本在 documentStart 暴露 window.NativeBridge。
final class WebViewController: UIViewController {

    private var webView: WKWebView!
    private var channel: JsChannel!
    private var router: BridgeRouter!
    private let messageHandler = NativeMessageHandler()

    private static let startURL = "\(AppSchemeHandler.scheme)://\(AppSchemeHandler.host)/index.html"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupWebView()
        router = BridgeRouter(host: self, channel: channel)
        messageHandler.router = router
        loadStartPage()
    }

    deinit {
        router?.dispose()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "nativeBridge")
    }

    // MARK: - 搭建 WebView

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        }
        config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: AppSchemeHandler.scheme)

        let controller = WKUserContentController()
        let bridgeJS = """
        (function(){
          window.NativeBridge = {
            call: function(method, paramsJson, callbackId){
              try {
                window.webkit.messageHandlers.nativeBridge.postMessage({
                  method: String(method || ''),
                  params: paramsJson || '{}',
                  callbackId: callbackId || ''
                });
              } catch (e) { /* 非壳环境忽略 */ }
            }
          };
        })();
        """
        controller.addUserScript(WKUserScript(source: bridgeJS,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
        // 注意：WKWebView 初始化时会「复制」configuration，因此消息处理器必须在创建 WebView 前注册
        controller.add(messageHandler, name: "nativeBridge")
        config.userContentController = controller

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        view.addSubview(webView)

        channel = JsChannel(webView: webView)
    }

    private func loadStartPage() {
        guard let url = URL(string: WebViewController.startURL) else { return }
        webView.load(URLRequest(url: url))
    }

    // MARK: - 供 Router 调用

    /// 发起扫码（由 scan.qrcode 桥接调用）。
    /// 先确保相机授权：未授权时 AVCaptureDeviceInput 创建会抛错，导致首次及后续扫码均失败。
    func requestScan(callbackId: String?) {
        let presentScanner: () -> Void = { [weak self] in
            guard let self = self else { return }
            let scanner = ScanViewController()
            scanner.onResult = { [weak self] result in
                guard let self = self else { return }
                if let text = result, !text.isEmpty {
                    self.channel.resolveOk(callbackId, ["result": text, "scanType": "qrCode"])
                } else {
                    self.channel.resolveErr(callbackId, "scan cancelled")
                }
            }
            scanner.modalPresentationStyle = .fullScreen
            self.topViewController().present(scanner, animated: true)
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presentScanner()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        presentScanner()
                    } else {
                        self?.channel.resolveErr(callbackId, "缺少相机权限")
                    }
                }
            }
        default:
            channel.resolveErr(callbackId, "缺少相机权限")
        }
    }

    /// 取得当前最顶层控制器，供各能力模块弹出界面使用
    func topViewController() -> UIViewController {
        var top: UIViewController = self
        while let presented = top.presentedViewController {
            top = presented
        }
        if let nav = top as? UINavigationController, let visible = nav.visibleViewController {
            return visible
        }
        if let tab = top as? UITabBarController, let visible = tab.selectedViewController {
            return visible
        }
        return top
    }

    // MARK: - 返回键处理

    override var prefersStatusBarHidden: Bool { false }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
    }
}

// MARK: - WKNavigationDelegate

extension WebViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // 本地资源 scheme 一律放行
        if url.scheme == AppSchemeHandler.scheme {
            decisionHandler(.allow)
            return
        }
        // 外部 http(s)：在 WebView 内部继续加载（业务请求）
        if url.scheme == "http" || url.scheme == "https" || url.scheme == "about" ||
            url.scheme == "data" || url.scheme == "blob" {
            decisionHandler(.allow)
            return
        }
        // 其它 scheme（tel/mailto/itms-apps 等）交给系统
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        decisionHandler(.cancel)
    }
}

// MARK: - WKUIDelegate

extension WebViewController: WKUIDelegate {

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        // target=_blank：在当前 WebView 内打开
        if let request = navigationAction.request.url {
            webView.load(URLRequest(url: request))
        }
        return nil
    }
}
