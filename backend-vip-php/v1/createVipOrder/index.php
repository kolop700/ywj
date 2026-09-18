<?php
/**
 * 创建 VIP 订单（统一下单）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/createVipOrder/index.php
 * 请求：POST JSON {"user_id":"123","product_id":"vip_month_1","pay_type":"wechat|alipay|iap","platform":"android|ios"}
 * 返回：
 *   wechat → {"code":"0","data":[{"order_no","pay_type":"wechat","pay_params":{appid,partnerid,prepayid,package,noncestr,timestamp,sign}}]}
 *   alipay → {"code":"0","data":[{"order_no","pay_type":"alipay","order_str":"..."}]}
 *   iap    → {"code":"0","data":[{"order_no","pay_type":"iap","ios_iap_id":"..."}]}
 * 说明：
 *   - 微信/支付宝在服务端完成统一下单，前端只负责调起 SDK
 *   - iap 仅建单，前端支付成功后携 receipt 调 verifyIapOrder 校验
 *   - 渠道参数生成失败时订单直接关闭，避免垃圾待支付单
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$user_id = (string)vip_param($in, 'user_id');
$product_id = (string)vip_param($in, 'product_id');
$pay_type = strtolower((string)vip_param($in, 'pay_type'));
$platform = strtolower((string)vip_param($in, 'platform'));

if ($user_id === '') vip_out_error('user_id 不能为空');
if (!in_array($pay_type, array('wechat', 'alipay', 'iap'), true)) vip_out_error('pay_type 不支持');
if ($platform === '') $platform = ($pay_type === 'iap') ? 'ios' : 'android';
if ($pay_type === 'iap' && $platform !== 'ios') vip_out_error('IAP 仅支持 iOS');
if ($pay_type !== 'iap' && $platform === 'ios') vip_out_error('iOS 请使用苹果内购');

$product = vip_products($product_id);
if (!$product) vip_out_error('商品不存在或已下架');
if (intval(isset($product['price']) ? $product['price'] : 0) <= 0) vip_out_error('商品价格异常');

// ---------- IAP：仅建单，App 支付成功后走 verifyIapOrder ----------
if ($pay_type === 'iap') {
    $iapId = isset($product['ios_iap_id']) ? (string)$product['ios_iap_id'] : '';
    if ($iapId === '') vip_out_error('该商品未配置苹果内购商品 ID');
    $orderNo = vip_create_order($user_id, $product, 'iap', 'ios');
    if (!$orderNo) vip_out_error('订单创建失败，请重试');
    vip_out(array(
        array(
            'order_no' => $orderNo,
            'pay_type' => 'iap',
            'ios_iap_id' => $iapId
        )
    ));
}

// ---------- 微信 / 支付宝：建单 + 服务端统一下单 ----------
$orderNo = vip_create_order($user_id, $product, $pay_type, $platform);
if (!$orderNo) vip_out_error('订单创建失败，请重试');

$order = array(
    'out_trade_no' => $orderNo,
    'title' => isset($product['title']) ? (string)$product['title'] : 'VIP 会员',
    'amount' => intval($product['price'])
);

if ($pay_type === 'wechat') {
    $config = vip_pay_config('wechat');
    if (empty($config['app_id']) || empty($config['mch_id']) || empty($config['api_key'])) {
        vip_mark_order_closed($orderNo);
        log_r('vip createVipOrder wechat not configured order=' . $orderNo);
        vip_out_error('微信支付暂未开通');
    }
    $prepayId = vip_wechat_unifiedorder($order, $config);
    if (!$prepayId) {
        vip_mark_order_closed($orderNo);
        vip_out_error('微信下单失败，请稍后重试');
    }
    vip_out(array(
        array(
            'order_no' => $orderNo,
            'pay_type' => 'wechat',
            'pay_params' => vip_wechat_app_params($prepayId, $config)
        )
    ));
}

// alipay
$config = vip_pay_config('alipay');
if (empty($config['app_id']) || empty($config['private_key'])) {
    vip_mark_order_closed($orderNo);
    log_r('vip createVipOrder alipay not configured order=' . $orderNo);
    vip_out_error('支付宝支付暂未开通');
}
$orderStr = vip_alipay_order_str($order, $config);
if (!$orderStr) {
    vip_mark_order_closed($orderNo);
    vip_out_error('支付宝下单失败，请稍后重试');
}
vip_out(array(
    array(
        'order_no' => $orderNo,
        'pay_type' => 'alipay',
        'order_str' => $orderStr
    )
));
