<?php
/**
 * VIP 商品档位配置（php-yefiot 后端）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/vip_products.php（与各接口同级）
 * 修改价格/新增档位/调整文案只改本文件，接口逻辑无需改动。
 *
 * 字段说明：
 *   product_id      商品档位 ID（前端下单时回传）
 *   title           商品名称（显示 + 订单快照）
 *   desc            权益说明（前端展示，可选）
 *   months          购买月数（支付成功后 vip_expire_date 顺延的月数）
 *   price           现价（单位：分。如 600 = 6.00 元）
 *   original_price  划线价（单位：分，可选，0 = 不显示）
 *   recommend       是否"推荐"角标：0 否 / 1 是
 *   ios_iap_id      App Store Connect 创建的内购商品 ID（iOS 专用；Android 忽略）
 * =====================================================================
 */

return array(
    array(
        'product_id'     => 'vip_month_1',
        'title'          => '月度会员',
        'desc'           => '30 天免广告特权',
        'months'         => 1,
        'price'          => 600,        // 6.00 元
        'original_price' => 800,        // 8.00 元
        'recommend'      => 0,
        'ios_iap_id'     => 'com.yefiot.community.vip.month1'
    ),
    array(
        'product_id'     => 'vip_month_3',
        'title'          => '季度会员',
        'desc'           => '90 天免广告特权',
        'months'         => 3,
        'price'          => 1500,       // 15.00 元
        'original_price' => 2400,       // 24.00 元
        'recommend'      => 1,
        'ios_iap_id'     => 'com.yefiot.community.vip.month3'
    ),
    array(
        'product_id'     => 'vip_month_12',
        'title'          => '年度会员',
        'desc'           => '365 天免广告特权',
        'months'         => 12,
        'price'          => 4800,       // 48.00 元
        'original_price' => 9600,       // 96.00 元
        'recommend'      => 0,
        'ios_iap_id'     => 'com.yefiot.community.vip.month12'
    )
);
