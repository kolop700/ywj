<?php
/**
 * VIP 支付配置（php-yefiot 后端）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/vip_pay_config.php
 * 说明：本文件独立于 v1/config.php（DB 配置），只放支付相关凭据。
 *       createVipOrder / vipWxNotify / vipAliNotify / verifyIapOrder 共用。
 * =====================================================================
 * 上线前必须填写（留空 = 未开通，对应支付方式会直接返回错误）：
 *   wechat.app_id        微信开放平台「移动应用」AppId（注意：不是小程序 appid）
 *                        移动应用需关联商户号 1612795620，且包名/签名与 APK 一致
 *   alipay.app_id        支付宝开放平台移动应用 AppId（已签约 APP 支付）
 *   alipay.private_key   应用私钥 RSA2（PEM 文件路径 或 裸密钥内容均可）
 *   alipay.alipay_public_key  支付宝公钥（用于回调验签，不是应用公钥）
 *   apple.shared_secret  App 专用共享密钥（App Store Connect → App 内购买项目）
 * =====================================================================
 */

return array(

    // 支付回调基础地址（末尾不带 /），回调 URL 自动拼接为：
    //   微信：{notify_base}/vipWxNotify/    支付宝：{notify_base}/vipAliNotify/
    'notify_base' => 'https://xy.yefiot.com/yefiot/v1',

    // ---------- 微信 App 支付（v2 API，复用现有商户号） ----------
    'wechat' => array(
        // 微信开放平台移动应用 AppId（已填：与小程序 appid 不同；须关联商户号并使用同一开放平台账号）
        'app_id' => 'wx4c80533df6184dda',
        // 商户号：复用现有（小程序支付同一商户号）
        'mch_id' => '1612795620',
        // 商户 API v2 密钥：复用现有（wxpay/WeixinPay.php 同款）
        'api_key' => 'Yefiot2021LosdsucitWoloicRoizniH'
    ),

    // ---------- 支付宝 App 支付（RSA2，手写签名不引 SDK） ----------
    'alipay' => array(
        'app_id' => '',
        // 应用私钥：支持 PEM 文件路径（推荐 'alipay_private_key.pem' 放同目录）或裸密钥内容
        'private_key' => '',
        // 支付宝公钥：回调验签用（开放平台「支付宝公钥」页复制）
        'alipay_public_key' => '',
        'gateway' => 'https://openapi.alipay.com/gateway.do'
    ),

    // ---------- Apple IAP（App Store verifyReceipt） ----------
    'apple' => array(
        // App 专用共享密钥（App Store Connect → 订阅/内购 → App 专用共享密钥）
        // 说明：非续期订阅可不填；后续若启用自动续期订阅必须填写
        'shared_secret' => '',
        // 收据归属校验：verifyReceipt 返回的 bundle_id 必须与本应用一致（留空则跳过校验）
        // 与 shell-ios/project.yml、weijia-2.mobileprovision、App Store Connect 保持一致
        'bundle_id' => 'com.yefiot.communityios',
        'verify_prod_url' => 'https://buy.itunes.apple.com/verifyReceipt',
        'verify_sandbox_url' => 'https://sandbox.itunes.apple.com/verifyReceipt'
    )

);
