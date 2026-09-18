import Foundation
import StoreKit

/// 支付桥接（pay.* / iOS，StoreKit 1，兼容 iOS 14）。
///
/// 链路：JS 调 pay.iap → SKProductsRequest 拉商品 → SKMutablePayment
///      （applicationUsername = orderNo，用于对账）→ 系统购买弹窗 → 用户操作
///      → SKPaymentQueue 观察者回调 → pay.onEvent 回传 receipt/transactionId
///      → JS 调后端 verifyIapOrder 校验入账（订单终态以后端 queryVipOrder 为准）。
///
/// 事件载荷： { channel: 'iap', event: 'pay.success'|'pay.cancel'|'pay.fail', code, msg,
///             orderNo, productId?, transactionId?, receipt? }
///   - orderNo：back 端订单号（applicationUsername）；JS 据此区分「本次订单」与
///     「历史未入账订单（续费/恢复）」，后者走补验入账。
///   - receipt：App Store 收据 base64（仅 pay.success 携带），后端 verifyReceipt 校验。
///
/// 交易投递规则：
///   - 观察者在首次 pay.iap 时才挂载：避免启动即投递历史交易而 JS 尚未进入购买流程；
///   - 无进行中购买（currentOrderNo 为空）时不回调、不结束交易 —— 交易保留在队列中，
///     下次购买随队列更新重新投递，用于恢复「支付成功但未入账」的订单；
///   - pay.cancel/pay.fail 仅针对当前订单回调；历史订单的失败/取消静默清理，不干扰流程；
///   - 收到 pay.success 并回传 JS 后结束交易（finishTransaction）。
final class PayBridge: NSObject {

    private let channel: JsChannel

    private var observing = false
    private var purchaseInFlight = false
    private var currentOrderNo = ""
    private var currentProductId = ""
    /// receipt 未落盘时暂存的交易（刷新收据后回调）
    private var pendingReceiptTransaction: SKPaymentTransaction?

    init(channel: JsChannel) {
        self.channel = channel
        super.init()
    }

    // MARK: - 方法路由

    func handle(method: String, params: [String: Any], callbackId: String) {
        switch method {
        case "pay.iap":
            iapPay(params: params, callbackId: callbackId)
        case "pay.wechat", "pay.alipay":
            channel.resolveErr(callbackId, "\(method) not supported on iOS (use iap)")
        default:
            channel.resolveErr(callbackId, "unknown pay method: \(method)")
        }
    }

    /// 页面销毁：移除队列观察者（由 BridgeRouter.dispose 调用）
    func dispose() {
        if observing {
            SKPaymentQueue.default().remove(self)
            observing = false
        }
    }

    // MARK: - 调起内购

    private func iapPay(params: [String: Any], callbackId: String?) {
        let productId = params["productId"] as? String ?? ""
        let orderNo = params["orderNo"] as? String ?? ""
        if productId.isEmpty {
            channel.resolveErr(callbackId, "missing productId")
            return
        }
        if purchaseInFlight {
            channel.resolveErr(callbackId, "purchase in progress")
            return
        }
        guard SKPaymentQueue.canMakePayments() else {
            channel.resolveErr(callbackId, "iap not available (canMakePayments=false)")
            return
        }
        currentProductId = productId
        currentOrderNo = orderNo
        purchaseInFlight = true
        // 挂载队列观察者（幂等）：挂载时 StoreKit 会投递未完成的旧交易，
        // 此刻 JS 已进入购买流程（currentOrderNo 已就绪），可接收并补验历史订单。
        attachObserver()
        // 立即释放调用；结果经 pay.onEvent 异步下发
        channel.resolveOk(callbackId)

        let request = SKProductsRequest(productIdentifiers: [productId])
        request.delegate = self
        request.start()
    }

    private func attachObserver() {
        if observing { return }
        SKPaymentQueue.default().add(self)
        observing = true
    }

    // MARK: - 内部工具

    /// 交易是否属于当前购买流程（applicationUsername 为空视为兼容放行）
    private func isCurrentOrder(_ transaction: SKPaymentTransaction) -> Bool {
        guard !currentOrderNo.isEmpty else { return false }
        let orderNo = transaction.payment.applicationUsername ?? ""
        return orderNo.isEmpty || orderNo == currentOrderNo
    }

    /// 读取 App Store 收据（base64）；不存在返回空串
    private func latestReceiptBase64() -> String {
        guard let url = Bundle.main.appStoreReceiptURL,
              let data = try? Data(contentsOf: url) else { return "" }
        return data.base64EncodedString()
    }

    /// 交易到达终态：结束交易 → 经 pay.onEvent 回传 JS
    private func complete(transaction: SKPaymentTransaction, event: String, code: Int, msg: String, receipt: String) {
        let orderNo = transaction.payment.applicationUsername ?? ""
        let productId = transaction.payment.productIdentifier
        let transactionId = transaction.transactionIdentifier
        SKPaymentQueue.default().finishTransaction(transaction)
        if purchaseInFlight && (orderNo.isEmpty || orderNo == currentOrderNo) {
            purchaseInFlight = false
        }
        emitEvent(event: event,
                  code: code,
                  msg: msg,
                  orderNo: orderNo,
                  productId: productId,
                  transactionId: transactionId,
                  receipt: event == "pay.success" ? receipt : nil)
    }

    private func emitEvent(event: String,
                           code: Int,
                           msg: String,
                           orderNo: String = "",
                           productId: String = "",
                           transactionId: String? = nil,
                           receipt: String? = nil) {
        var payload: [String: Any] = [
            "channel": "iap",
            "event": event,
            "code": code,
            "msg": msg,
            "orderNo": orderNo
        ]
        if !productId.isEmpty { payload["productId"] = productId }
        if let transactionId = transactionId, !transactionId.isEmpty { payload["transactionId"] = transactionId }
        if let receipt = receipt, !receipt.isEmpty { payload["receipt"] = receipt }
        channel.emit("pay.onEvent", payload)
    }

    // MARK: - 队列回调处理（统一切主线程）

    private func processTransactions(_ transactions: [SKPaymentTransaction]) {
        for transaction in transactions {
            switch transaction.transactionState {
            case .purchased, .restored:
                handlePurchased(transaction)
            case .failed:
                handleFailed(transaction)
            case .deferred:
                // 等待外部操作（如家长批准）：不下发终态；释放本地进行中标记允许重试
                if isCurrentOrder(transaction) { purchaseInFlight = false }
            case .purchasing:
                break
            @unknown default:
                break
            }
        }
    }

    private func handlePurchased(_ transaction: SKPaymentTransaction) {
        // 无进行中购买流程：保留交易（不回调、不结束），下次购买时随队列更新重新投递
        guard !currentOrderNo.isEmpty else { return }
        let receipt = latestReceiptBase64()
        if receipt.isEmpty {
            // 新设备首购等场景 receipt 尚未落盘：先刷新收据，完成后回调（避免流程卡死）
            pendingReceiptTransaction = transaction
            let request = SKReceiptRefreshRequest()
            request.delegate = self
            request.start()
            return
        }
        complete(transaction: transaction, event: "pay.success", code: 0, msg: "", receipt: receipt)
    }

    private func handleFailed(_ transaction: SKPaymentTransaction) {
        let cancelled = (transaction.error as? SKError)?.code == .paymentCancelled
        let error = transaction.error as NSError?
        let event = cancelled ? "pay.cancel" : "pay.fail"
        let code = error?.code ?? -1
        let msg = cancelled ? "" : (transaction.error?.localizedDescription ?? "")
        SKPaymentQueue.default().finishTransaction(transaction)
        if isCurrentOrder(transaction) {
            purchaseInFlight = false
            emitEvent(event: event, code: code, msg: msg, orderNo: transaction.payment.applicationUsername ?? "")
        }
        // 历史订单的失败/取消：仅清理，不回调（避免干扰进行中的购买流程）
    }
}

// MARK: - SKPaymentTransactionObserver

extension PayBridge: SKPaymentTransactionObserver {

    func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        DispatchQueue.main.async { [weak self] in
            self?.processTransactions(transactions)
        }
    }
}

// MARK: - SKProductsRequestDelegate / SKRequestDelegate

extension PayBridge: SKProductsRequestDelegate {

    func productsRequest(_ request: SKProductsRequest, didReceive response: SKProductsResponse) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let product = response.products.first(where: { $0.productIdentifier == self.currentProductId })
                    ?? response.products.first else {
                self.purchaseInFlight = false
                self.emitEvent(event: "pay.fail",
                               code: -1,
                               msg: "product not found: \(self.currentProductId)",
                               orderNo: self.currentOrderNo,
                               productId: self.currentProductId)
                return
            }
            let payment = SKMutablePayment(product: product)
            // 对账：orderNo 随交易下发，成功回调原样带回（后端 verifyIapOrder 使用）
            payment.applicationUsername = self.currentOrderNo
            payment.quantity = 1
            SKPaymentQueue.default().add(payment)
        }
    }

    func request(_ request: SKRequest, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if request is SKReceiptRefreshRequest, let transaction = self.pendingReceiptTransaction {
                // 收据刷新失败：带现有（可能为空）receipt 继续回调；前端有查询轮询兜底
                self.pendingReceiptTransaction = nil
                self.complete(transaction: transaction,
                              event: "pay.success",
                              code: 0,
                              msg: "receipt refresh failed",
                              receipt: self.latestReceiptBase64())
                return
            }
            self.purchaseInFlight = false
            self.emitEvent(event: "pay.fail",
                           code: (error as NSError).code,
                           msg: error.localizedDescription,
                           orderNo: self.currentOrderNo,
                           productId: self.currentProductId)
        }
    }

    func requestDidFinish(_ request: SKRequest) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  request is SKReceiptRefreshRequest,
                  let transaction = self.pendingReceiptTransaction else { return }
            self.pendingReceiptTransaction = nil
            self.complete(transaction: transaction,
                          event: "pay.success",
                          code: 0,
                          msg: "",
                          receipt: self.latestReceiptBase64())
        }
    }
}
