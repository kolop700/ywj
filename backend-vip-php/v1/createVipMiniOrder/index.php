<?php
/**
 * 创建 VIP 订单（小程序 JSAPI 下单）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/createVipMiniOrder/index.php
 * 请求：POST JSON {"user_id":"123","product_id":"vip_month_1","openid":"oXxx...","timestamp":"1760000000000","sign":"MD5..."}
 * 返回：{"code":"0","data":[{"order_no","pay_type":"wechat_mini","pay_params":{appId,timeStamp,nonceStr,package,signType,paySign}}]}
 * 说明：
 *   - 供 ywjxcx 小程序 appvip 页调用（App 点会员 → 拉起小程序 → 本接口 JSAPI 下单 → wx.requestPayment）
 *   - sign = MD5(user_id + openid + timestamp + sign_secret)（大写），防脚本乱刷单；时间戳 5 分钟有效
 *   - 入账复用现有 vipWxNotify 回调（同商户号 v2，幂等 grant），与 App 支付一套账
 *   - iOS 不再走 IAP，会员开通统一走本通道（苹果合规风险自担，App 内不显示价格）
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$user_id = (string)vip_param($in, 'user_id');
$product_id = (string)vip_param($in, 'product_id');
$openid = (string)vip_param($in, 'openid');
$timestamp = (string)vip_param($in, 'timestamp');
$sign = strtoupper((string)vip_param($in, 'sign'));

if ($user_id === '') vip_out_error('user_id 不能为空');
if ($openid === '') vip_out_error('openid 不能为空');
if ($product_id === '') vip_out_error('product_id 不能为空');

// ---------- 签名校验（防伪造/防重放窗口 5 分钟） ----------
$config = vip_pay_config('wechat');
if (empty($config['mini_app_id']) || empty($config['mch_id']) || empty($config['api_key'])) {
    vip_out_error('小程序支付未配置');
}
$secret = isset($config['sign_secret']) ? (string)$config['sign_secret'] : '';
if ($secret === '') vip_out_error('签名密钥未配置');
if (!ctype_digit($timestamp) || abs(time() - intval($timestamp) / 1000) > 300) {
    vip_out_error('请求已过期，请重试');
}
$expect = strtoupper(md5($user_id . $openid . $timestamp . $secret));
if (!hash_equals($expect, $sign)) vip_out_error('签名校验失败', '403');

// ---------- 商品与用户校验 ----------
$product = vip_products($product_id);
if (!$product) vip_out_error('商品不存在或已下架');
if (intval(isset($product['price']) ? $product['price'] : 0) <= 0) vip_out_error('商品价格异常');
$member = vip_get_member($user_id);
if (!$member) vip_out_error('用户不存在');

// ---------- 建单 + JSAPI 统一下单 ----------
$orderNo = vip_create_order($user_id, $product, 'wechat_mini', 'miniapp');
if (!$orderNo) vip_out_error('订单创建失败，请重试');

$order = array(
    'out_trade_no' => $orderNo,
    'title' => isset($product['title']) ? (string)$product['title'] : 'VIP 会员',
    'amount' => intval($product['price'])
);
$prepayId = vip_wechat_unifiedorder_jsapi($order, $config, $openid);
if (!$prepayId) {
    vip_mark_order_closed($orderNo);
    log_r('vip createVipMiniOrder jsapi fail order=' . $orderNo . ' user=' . $user_id);
    vip_out_error('微信下单失败，请稍后重试');
}
log_r('vip createVipMiniOrder ok order=' . $orderNo . ' user=' . $user_id . ' product=' . $product_id);
vip_out(array(
    array(
        'order_no' => $orderNo,
        'pay_type' => 'wechat_mini',
        'pay_params' => vip_wechat_jsapi_params($prepayId, $config)
    )
));
