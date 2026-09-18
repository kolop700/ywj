<?php
/**
 * 支付宝 App 支付异步通知（回调）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/vipAliNotify/index.php
 * 配置点：无需在支付宝后台单独配置——notify_url 已在下单接口（orderStr）中携带，
 *        值为 https://xy.yefiot.com/yefiot/v1/vipAliNotify/
 * 处理流程：form-urlencoded 解析 → 验签（支付宝公钥 RSA2）→ app_id 校验
 *          → trade_status 校验 → 金额校验 → 幂等置 paid（affected_rows=1 才顺延会员）
 * 幂等性：同一订单重复通知不会重复加时长（vip_mark_order_paid 原子判断）
 * 应答：纯文本 'success' = 支付宝停止重试；'fail' = 触发重试
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$data = $_POST;
if (empty($data['out_trade_no'])) {
    log_r('vipAliNotify bad request');
    echo 'fail';
    exit;
}

$config = vip_pay_config('alipay');
if (empty($config['app_id']) || empty($config['alipay_public_key'])) {
    log_r('vipAliNotify alipay not configured');
    echo 'fail';
    exit;
}

// 验签（支付宝公钥，RSA2）
if (!vip_alipay_verify($data, vip_key_read($config['alipay_public_key'], false))) {
    log_r('vipAliNotify sign fail order=' . $data['out_trade_no']);
    echo 'fail';
    exit;
}

// app_id 校验
if (isset($data['app_id']) && (string)$data['app_id'] !== (string)$config['app_id']) {
    log_r('vipAliNotify appid mismatch order=' . $data['out_trade_no']);
    echo 'fail';
    exit;
}

// 仅处理支付成功状态；其它状态（如 TRADE_CLOSED）应答 success 避免无意义重试
$tradeStatus = isset($data['trade_status']) ? strtoupper((string)$data['trade_status']) : '';
if (!in_array($tradeStatus, array('TRADE_SUCCESS', 'TRADE_FINISHED'), true)) {
    log_r('vipAliNotify trade_status=' . $tradeStatus . ' order=' . $data['out_trade_no']);
    echo 'success';
    exit;
}

$order_no = (string)$data['out_trade_no'];
$order = vip_get_order($order_no);
if (!$order) {
    // 可能建单事务尚未可见/数据异常，返回 fail 让支付宝重试
    log_r('vipAliNotify order not found: ' . $order_no);
    echo 'fail';
    exit;
}

// 金额校验（元，浮点容差），防止被篡改
if (isset($data['total_amount']) && abs(floatval($data['total_amount']) - intval($order['amount']) / 100) > 0.001) {
    log_r('vipAliNotify amount mismatch order=' . $order_no . ' amount=' . $data['total_amount'] . ' expect=' . vip_amount_yuan($order['amount']));
    echo 'fail';
    exit;
}

$txId = isset($data['trade_no']) ? (string)$data['trade_no'] : '';
// 幂等：仅首次置 paid 成功者执行会员顺延；重复通知直接应答 success
if (vip_mark_order_paid($order_no, $txId)) {
    vip_grant_months($order['user_id'], $order['months'], 'alipay', $order_no);
    log_r('vipAliNotify paid ok order=' . $order_no . ' tx=' . $txId);
} else {
    log_r('vipAliNotify duplicate order=' . $order_no);
}

echo 'success';
