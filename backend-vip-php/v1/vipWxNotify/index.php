<?php
/**
 * 微信 App 支付结果通知（回调）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/vipWxNotify/index.php
 * 配置点：微信商户平台 → 产品中心 → APP支付 → 支付回调 URL：
 *        https://xy.yefiot.com/yefiot/v1/vipWxNotify/
 * 处理流程：XML 解析 → 验签（v2 API key）→ appid/mch_id 校验 → 金额校验
 *          → 幂等置 paid → 确保入账 vip_grant_order_member（granted_at 原子标记）→ 响应 SUCCESS
 * 幂等性：重复通知不会重复加时长（置 paid + 入账标记双层原子判断）；顺延失败应答
 *         FAIL，微信重试时自动补偿入账
 * 应答：SUCCESS = 微信停止重试；FAIL = 微信按策略重试（如临时故障）
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

/** 微信回调应答（XML） */
function vip_wx_notify_reply($ok, $msg = '')
{
    header('Content-Type: application/xml; charset=utf-8');
    $code = $ok ? 'SUCCESS' : 'FAIL';
    if ($msg === '') $msg = $ok ? 'OK' : 'FAIL';
    echo '<xml><return_code><![CDATA[' . $code . ']]></return_code><return_msg><![CDATA[' . $msg . ']]></return_msg></xml>';
    exit;
}

$raw = @file_get_contents('php://input');
$data = vip_wechat_xml_to_array($raw);
if (empty($data['out_trade_no'])) {
    log_r('vipWxNotify bad xml: ' . substr((string)$raw, 0, 500));
    vip_wx_notify_reply(false, 'bad request');
}

$config = vip_pay_config('wechat');
if (empty($config['api_key']) || empty($config['app_id']) || empty($config['mch_id'])) {
    log_r('vipWxNotify wechat not configured');
    vip_wx_notify_reply(false, 'not configured');
}

// 验签
if (!vip_wechat_verify_sign($data, $config['api_key'])) {
    log_r('vipWxNotify sign fail order=' . $data['out_trade_no']);
    vip_wx_notify_reply(false, 'sign error');
}

// 校验 appid / mch_id 与本商户一致
if ((string)$data['appid'] !== (string)$config['app_id'] || (string)$data['mch_id'] !== (string)$config['mch_id']) {
    log_r('vipWxNotify appid/mchid mismatch order=' . $data['out_trade_no']);
    vip_wx_notify_reply(false, 'config mismatch');
}

// 仅处理成功通知
if ((string)$data['return_code'] !== 'SUCCESS' || (string)$data['result_code'] !== 'SUCCESS') {
    log_r('vipWxNotify not success order=' . $data['out_trade_no'] . ' result=' . (isset($data['result_code']) ? $data['result_code'] : ''));
    vip_wx_notify_reply(false, 'not success');
}

$order_no = (string)$data['out_trade_no'];
$order = vip_get_order($order_no);
if (!$order) {
    // 可能建单事务尚未可见/数据异常，返回 FAIL 让微信重试
    log_r('vipWxNotify order not found: ' . $order_no);
    vip_wx_notify_reply(false, 'order not found');
}

// 金额校验（单位：分），防止被篡改
if (isset($data['total_fee']) && intval($data['total_fee']) !== intval($order['amount'])) {
    log_r('vipWxNotify amount mismatch order=' . $order_no . ' fee=' . $data['total_fee'] . ' expect=' . $order['amount']);
    vip_wx_notify_reply(false, 'amount mismatch');
}

$txId = isset($data['transaction_id']) ? (string)$data['transaction_id'] : '';
// 置 paid（幂等）：重复通知时返回 false，仅用于日志区分
if (vip_mark_order_paid($order_no, $txId)) {
    log_r('vipWxNotify paid ok order=' . $order_no . ' tx=' . $txId);
} else {
    log_r('vipWxNotify duplicate order=' . $order_no);
}
// 确保会员入账（granted_at 原子幂等；顺延失败应答 FAIL，让微信重试补偿）
$expire = vip_grant_order_member($order_no);
if ($expire === false) {
    vip_wx_notify_reply(false, 'grant fail');
}

vip_wx_notify_reply(true);
