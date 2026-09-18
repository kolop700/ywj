<?php
/**
 * 查询会员状态
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/getVipStatus/index.php
 * 请求：POST JSON  {"user_id":"123"}
 * 返回：{"code":"0","data":[{"user_id":"123","is_vip":1,"vip_expire_date":"2026-12-31 23:59:59"}]}
 *   is_vip: 1=有效会员 0=非会员（或已过期）
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$in = vip_read_input();
$user_id = (string)vip_param($in, 'user_id');
if ($user_id === '') {
    vip_out_error('user_id 不能为空');
}

$row = vip_get_member($user_id);
$expire = ($row && !empty($row['vip_expire_date'])) ? (string)$row['vip_expire_date'] : '';
$isVip = vip_is_active($row) ? 1 : 0;

vip_out(array(
    array(
        'user_id' => $user_id,
        'is_vip' => $isVip,
        'vip_expire_date' => $expire
    )
));
