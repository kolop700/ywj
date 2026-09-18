<?php
/**
 * 查询 VIP 订单状态
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/queryVipOrder/index.php
 * 请求：POST JSON {"user_id":"123","order_no":"VIP20250101120000123456"}
 * 返回：{"code":"0","data":[{"status":"paid|pending|failed","vip_expire_date":"..."}]}
 * 说明：
 *   - status=0（待支付）时向微信/支付宝主动查询补偿掉单，确认已支付则幂等置 paid+顺延会员
 *   - 待支付超过 2 小时自动关单（status=2 → failed）
 *   - 已支付时 vip_expire_date 取会员表最新到期时间（保证回调先到/后到都返回正确值）
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$user_id = (string)vip_param($in, 'user_id');
$order_no = (string)vip_param($in, 'order_no');

if ($user_id === '') vip_out_error('user_id 不能为空');
if ($order_no === '') vip_out_error('order_no 不能为空');

$order = vip_get_order($order_no);
if (!$order) vip_out_error('订单不存在');
if ((string)$order['user_id'] !== $user_id) vip_out_error('订单不属于当前用户');

/** 取会员最新到期时间 */
function vip_query_expire($user_id)
{
    $row = vip_get_member($user_id);
    return ($row && !empty($row['vip_expire_date'])) ? (string)$row['vip_expire_date'] : '';
}

// ---------- 已支付 ----------
if ($order['status'] == 1) {
    vip_out(array(array('status' => 'paid', 'vip_expire_date' => vip_query_expire($user_id))));
}

// ---------- 已关闭 ----------
if ($order['status'] == 2) {
    vip_out(array(array('status' => 'failed', 'vip_expire_date' => '')));
}

// ---------- 待支付：主动查询渠道补偿掉单 ----------
$paidTxId = '';
if ($order['pay_type'] === 'wechat') {
    $config = vip_pay_config('wechat');
    if (!empty($config['app_id']) && !empty($config['mch_id']) && !empty($config['api_key'])) {
        $r = vip_wechat_order_query($order_no, $config);
        if (is_array($r) && isset($r['trade_state']) && strtoupper($r['trade_state']) === 'SUCCESS') {
            $paidTxId = isset($r['transaction_id']) ? (string)$r['transaction_id'] : 'channel_query';
        }
    }
} elseif ($order['pay_type'] === 'alipay') {
    $config = vip_pay_config('alipay');
    if (!empty($config['app_id']) && !empty($config['private_key'])) {
        $r = vip_alipay_query($order_no, $config);
        if (is_array($r) && !empty($r['trade_status'])
            && in_array(strtoupper($r['trade_status']), array('TRADE_SUCCESS', 'TRADE_FINISHED'), true)) {
            $paidTxId = isset($r['trade_no']) ? (string)$r['trade_no'] : 'channel_query';
        }
    }
}

if ($paidTxId !== '') {
    // 幂等：仅首次置 paid 成功者执行会员顺延（回调已置过则不再顺延）
    if (vip_mark_order_paid($order_no, $paidTxId)) {
        vip_grant_months($user_id, $order['months'], $order['pay_type'], $order_no);
        log_r('vip queryVipOrder channel-paid order=' . $order_no . ' tx=' . $paidTxId);
    }
    vip_out(array(array('status' => 'paid', 'vip_expire_date' => vip_query_expire($user_id))));
}

// ---------- 未支付：2 小时超时关单 ----------
$created = !empty($order['created_at']) ? strtotime($order['created_at']) : 0;
if ($created > 0 && (time() - $created) > 2 * 3600) {
    vip_mark_order_closed($order_no);
    vip_out(array(array('status' => 'failed', 'vip_expire_date' => '')));
}

vip_out(array(array('status' => 'pending', 'vip_expire_date' => '')));
