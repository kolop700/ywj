<?php
/**
 * 校验苹果 IAP 收据并完成订单入账（VIP 苹果内购）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/verifyIapOrder/index.php
 * 请求：POST JSON {"user_id":"123","order_no":"VIP20250101120000123456",
 *                 "receipt":"base64...","transaction_id":"可选","product_id":"可选"}
 * 返回：{"code":"0","data":[{"status":"paid","vip_expire_date":"2026-01-31 23:59:59"}]}
 *
 * 流程：
 *   1. 校验订单（存在 / 归属用户 / 未关闭 / pay_type=iap）；
 *   2. 调苹果 verifyReceipt（生产 → status=21007 自动重试沙箱；bundle_id 归属校验）；
 *   3. 从收据中挑出与订单商品（vip_products.ios_iap_id）匹配的交易凭证，
 *      校验 transaction_id 未被其他已支付订单占用（防同一凭证重复入账）；
 *   4. 幂等入账：置 paid（status 0→1 原子更新）+ 会员顺延；
 *      顺延幂等键为 t_vip_user.last_order_no（同单重复请求不重复加时长）。
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$user_id = (string)vip_param($in, 'user_id');
$order_no = (string)vip_param($in, 'order_no');
$receipt = (string)vip_param($in, 'receipt');
$txId = (string)vip_param($in, 'transaction_id');

if ($user_id === '') vip_out_error('user_id 不能为空');
if ($order_no === '') vip_out_error('order_no 不能为空');
if (strlen($receipt) < 100) vip_out_error('receipt 无效');

$order = vip_get_order($order_no);
if (!$order) vip_out_error('订单不存在');
if ((string)$order['user_id'] !== $user_id) vip_out_error('订单不属于当前用户');
if ((string)$order['pay_type'] !== 'iap') vip_out_error('订单支付方式不是 iap');
if ($order['status'] == 2) vip_out_error('订单已关闭');

/**
 * 确保会员入账（幂等）：
 *   t_vip_user.last_order_no 已为本单 → 视作已入账，直接返回当前到期时间；
 *   否则执行顺延。用于补偿「置 paid 成功但顺延失败」的中间态（重试本接口可自愈）。
 * @return string vip_expire_date
 */
function vip_iap_ensure_grant($order)
{
    $user_id = (string)$order['user_id'];
    $order_no = (string)$order['out_trade_no'];
    $member = vip_get_member($user_id);
    if ($member && (string)$member['last_order_no'] === $order_no) {
        return (string)$member['vip_expire_date'];
    }
    $newExpire = vip_grant_months($user_id, $order['months'], 'iap', $order_no);
    if ($newExpire === false) {
        vip_out_error('会员入账失败，请稍后重试');
    }
    return $newExpire;
}

// ---------- 已支付：幂等返回（并补偿「置 paid 成功但顺延失败」的中间态） ----------
if ($order['status'] == 1) {
    $expire = vip_iap_ensure_grant($order);
    vip_out(array(array('status' => 'paid', 'vip_expire_date' => $expire)));
}

// ---------- 商品配置（ios_iap_id 映射） ----------
$product = vip_products((string)$order['product_id']);
if (!$product || empty($product['ios_iap_id'])) {
    vip_out_error('商品未配置 ios_iap_id（vip_products.php）');
}
$iapProductId = (string)$product['ios_iap_id'];

// ---------- 苹果验票（生产/沙箱双验） ----------
$verify = vip_iap_verify_receipt($receipt);
if (!$verify['ok']) {
    log_r('vip verifyIapOrder receipt fail order=' . $order_no . ' err=' . $verify['error']);
    vip_out_error($verify['error']);
}

$tx = vip_iap_pick_transaction($verify['data'], $iapProductId, $txId);
if (!$tx && $txId !== '') {
    // StoreKit 上报的 transactionId 与收据内编号格式不一致时兜底：按商品取最新一条
    // （凭证防重用校验兜底，不会重复入账）
    $tx = vip_iap_pick_transaction($verify['data'], $iapProductId, '');
}
if (!$tx) {
    vip_out_error('收据中未找到与订单匹配的商品交易' . ($txId !== '' ? '(transaction_id=' . $txId . ')' : ''));
}

// ---------- 凭证防重用（紧邻置 paid 前置校验，缩小并发窗口） ----------
if (vip_iap_transaction_used($tx['transaction_id'], $order_no)) {
    vip_out_error('该交易凭证已用于其他订单入账');
}

// ---------- 幂等置 paid ----------
if (vip_mark_order_paid($order_no, $tx['transaction_id'])) {
    log_r('vip verifyIapOrder paid order=' . $order_no . ' tx=' . $tx['transaction_id'] . ' env=' . $verify['env']);
} else {
    // 并发/重复请求未抢到首次置 paid：复查最终状态，已 paid 则继续（入账幂等）
    $latest = vip_get_order($order_no);
    if (!$latest || $latest['status'] != 1) {
        vip_out_error('订单入账冲突，请重试');
    }
}

// ---------- 会员顺延（幂等） ----------
$expire = vip_iap_ensure_grant($order);
vip_out(array(array('status' => 'paid', 'vip_expire_date' => $expire)));
