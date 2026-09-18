<?php
/**
 * VIP 商品档位列表
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/getVipProducts/index.php
 * 请求：POST JSON {"platform":"android|ios"}   （platform 可为空）
 * 返回：{"code":"0","data":[{"product_id","title","months","price","original_price","recommend","ios_iap_id"}]}
 *   price/original_price 单位：分
 *   ios 平台仅返回配置了 ios_iap_id 的商品
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$platform = (string)vip_param($in, 'platform');

$list = vip_products(); // 读 vip_products.php 配置
$out = array();
foreach ($list as $p) {
    if (!is_array($p) || empty($p['product_id'])) continue;
    $iapId = isset($p['ios_iap_id']) ? (string)$p['ios_iap_id'] : '';
    // iOS 端只能卖已配置 App Store 商品 ID 的档位
    if ($platform === 'ios' && $iapId === '') continue;
    $out[] = array(
        'product_id' => (string)$p['product_id'],
        'title' => isset($p['title']) ? (string)$p['title'] : '',
        'months' => isset($p['months']) ? intval($p['months']) : 1,
        'price' => isset($p['price']) ? intval($p['price']) : 0,
        'original_price' => isset($p['original_price']) ? intval($p['original_price']) : 0,
        'recommend' => (isset($p['recommend']) && $p['recommend']) ? 1 : 0,
        'ios_iap_id' => $iapId
    );
}

vip_out($out);
