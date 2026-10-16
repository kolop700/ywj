<?php
/**
 * 设备品牌归属打标（t_doorphone.appid）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/setDoorAppid/index.php
 * 请求：POST JSON {"door_mac":"设备MAC","appid":1,"key":"***"}
 * 返回：{"code":"0","data":[{"door_mac":"...","appid":1,"affected":1}]}
 * 约定：appid 0=星云小卫（存量默认） 1=云卫家；新设备出货云卫家渠道后调本接口打标
 * 用法：curl -X POST https://xy.yefiot.com/yefiot/v1/setDoorAppid/ \
 *         -H 'Content-Type: application/json' \
 *         -d '{"door_mac":"AABBCCDDEEFF","appid":1,"key":"***"}'
 * =====================================================================
 */
require_once __DIR__ . '/../vip/_lib.php';

$SET_DOOR_APPID_KEY = 'SdA7Km3Qx9Wz2Lp8'; // 打标操作密钥（独立于其他回调 key）

$in = vip_read_input();
$key = (string)vip_param($in, 'key');
$mac = (string)vip_param($in, 'door_mac');
$appid = isset($in['appid']) ? intval($in['appid']) : -1;

if ($key !== $SET_DOOR_APPID_KEY) {
    log_r('setDoorAppid key fail mac=' . $mac);
    vip_out_error('key error');
}
if ($mac === '' || strlen($mac) > 36) {
    vip_out_error('door_mac invalid');
}
if ($appid < 0 || $appid > 9) {
    vip_out_error('appid invalid (0-9)');
}

$db = vip_db();
$stmt = $db->prepare('UPDATE t_doorphone SET appid=? WHERE door_mac=?');
if (!$stmt) {
    log_r('setDoorAppid prepare fail: ' . $db->error);
    vip_out_error('db error');
}
$stmt->bind_param('is', $appid, $mac);
$ok = $stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
if (!$ok) {
    log_r('setDoorAppid execute fail mac=' . $mac);
    vip_out_error('update fail');
}
log_r('setDoorAppid mac=' . $mac . ' appid=' . $appid . ' affected=' . $affected);
vip_out(array(array('door_mac' => $mac, 'appid' => $appid, 'affected' => $affected)));
