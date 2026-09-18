import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = WebViewController()
        self.window = window
        window.makeKeyAndVisible()
    }

    /// 拉起小程序后微信回跳（wx{appId}://）：交由微信 SDK 处理（未集成 SDK 时内部静默返回 false）
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        MiniProgramBridge.handleOpenURL(url)
    }
}
