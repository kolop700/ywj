<?php
/**
 * VIP 会员模块共用库（php-yefiot 后端）
 * =====================================================================
 * 部署位置：服务器 /var/www/html/yefiot/v1/vip/_lib.php（即 v1/vip/ 目录）
 * 模式说明：参照 v1/adCallback/index.php——mysqli 直连数据库 + prepared statements，
 *          不走存储过程 proinfNoLog（存储过程改动风险高、不可见于代码仓库）。
 * 依赖：v1/config.php（部署机 DB 常量：DB_HOST/DB_USERNAME/DB_PASSWORD/DB_NAME）
 *      v1/log.php（log_r 日志，写 /var/log/yefiot/）
 *
 * 数据表：t_vip_user（会员表）、t_vip_order（订单表），建表脚本见 install.sql
 * =====================================================================
 */

require_once __DIR__ . '/../config.php'; // DB_HOST / DB_USERNAME / DB_PASSWORD / DB_NAME（部署机配置）
require_once __DIR__ . '/../log.php';    // log_r()

// ==================== 基础 IO ====================

/** 读取 JSON 请求体（application/json），返回关联数组 */
function vip_read_input()
{
    $body = @file_get_contents('php://input');
    $obj = json_decode($body, true);
    return is_array($obj) ? $obj : array();
}

/** 取参数（字符串自动 trim；不存在返回默认值） */
function vip_param($in, $key, $default = '')
{
    if (!isset($in[$key])) return $default;
    $v = $in[$key];
    return is_string($v) ? trim($v) : $v;
}

/** 成功输出：{"code":"0","data":...}（与现有接口风格一致） */
function vip_out($data)
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('code' => '0', 'data' => $data), JSON_UNESCAPED_UNICODE);
    exit;
}

/** 失败输出：{"code":"1","msg":"...","data":[]} */
function vip_out_error($msg, $code = '1')
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('code' => $code, 'msg' => $msg, 'data' => array()), JSON_UNESCAPED_UNICODE);
    exit;
}

/** 建立数据库连接（失败直接输出错误并退出） */
function vip_db()
{
    $db = new mysqli(DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME);
    if ($db->connect_error) {
        log_r('vip_db connect error: ' . $db->connect_error);
        vip_out_error('数据库连接失败');
    }
    $db->set_charset('utf8');
    return $db;
}

// ==================== 会员（t_vip_user） ====================

/** 查询会员记录，返回 array|null */
function vip_get_member($user_id)
{
    $db = vip_db();
    $stmt = $db->prepare('SELECT user_id, vip_expire_date, source, last_order_no FROM t_vip_user WHERE user_id = ? LIMIT 1');
    if (!$stmt) { $db->close(); return null; }
    $stmt->bind_param('s', $user_id);
    if (!$stmt->execute()) { $stmt->close(); $db->close(); return null; }
    $stmt->store_result();
    $stmt->bind_result($uid, $expire, $source, $lastOrder);
    $row = null;
    if ($stmt->fetch()) {
        $row = array(
            'user_id' => $uid,
            'vip_expire_date' => $expire,
            'source' => $source,
            'last_order_no' => $lastOrder
        );
    }
    $stmt->close();
    $db->close();
    return $row;
}

/** 会员是否在有效期内 */
function vip_is_active($row)
{
    if (!$row || empty($row['vip_expire_date'])) return false;
    return strtotime($row['vip_expire_date']) > time();
}

/**
 * 会员时长顺延（未过期从原到期时间顺延，已过期从当前时间起算）。
 * 幂等由调用方保证（订单先原子置 paid 成功后才允许调用本函数）。
 * @return string|false 新到期时间 'Y-m-d H:i:s'，失败 false
 */
function vip_grant_months($user_id, $months, $source, $order_no)
{
    $months = intval($months);
    if ($months <= 0) return false;
    $db = vip_db();
    $ok = false;
    $newExpire = '';
    if ($db->begin_transaction()) {
        $stmt = $db->prepare('SELECT vip_expire_date FROM t_vip_user WHERE user_id = ? FOR UPDATE');
        if ($stmt) {
            $stmt->bind_param('s', $user_id);
            if ($stmt->execute()) {
                $stmt->store_result();
                $stmt->bind_result($curExpire);
                $base = time();
                if ($stmt->fetch() && !empty($curExpire)) {
                    $cur = strtotime($curExpire);
                    if ($cur > $base) $base = $cur; // 未过期：从原到期时间顺延
                }
                $stmt->close();
                $newExpire = date('Y-m-d H:i:s', strtotime('+' . $months . ' months', $base));
                // INSERT ... ON DUPLICATE KEY UPDATE：无记录则新建，有记录则更新
                $stmt = $db->prepare(
                    'INSERT INTO t_vip_user (user_id, vip_expire_date, source, last_order_no) VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE vip_expire_date = VALUES(vip_expire_date), source = VALUES(source), last_order_no = VALUES(last_order_no)'
                );
                if ($stmt) {
                    $stmt->bind_param('ssss', $user_id, $newExpire, $source, $order_no);
                    $ok = $stmt->execute();
                    $stmt->close();
                }
            } else {
                $stmt->close();
            }
        }
        if ($ok) {
            $db->commit();
        } else {
            $db->rollback();
            $newExpire = '';
        }
    }
    $db->close();
    if ($ok) {
        log_r("vip_grant ok user=$user_id months=$months expire=$newExpire order=$order_no");
    } else {
        log_r("vip_grant fail user=$user_id months=$months order=$order_no");
    }
    return $ok ? $newExpire : false;
}

// ==================== 订单（t_vip_order） ====================

/** 生成订单号：VIP + 年月日时分秒 + 6位随机（全局唯一由 out_trade_no 唯一索引兜底） */
function vip_gen_order_no()
{
    return 'VIP' . date('YmdHis') . mt_rand(100000, 999999);
}

/** 商品档位（读 vip_products.php 配置）；$product_id 为空返回全部 */
function vip_products($product_id = '')
{
    $list = include __DIR__ . '/../vip_products.php';
    if (!is_array($list)) $list = array();
    if ($product_id === '') return $list;
    foreach ($list as $p) {
        if (isset($p['product_id']) && (string)$p['product_id'] === (string)$product_id) return $p;
    }
    return null;
}

/** 创建订单（status=0 待支付），返回订单号字符串 或 false */
function vip_create_order($user_id, $product, $pay_type, $platform)
{
    $db = vip_db();
    $orderNo = vip_gen_order_no();
    $title = isset($product['title']) ? $product['title'] : 'VIP 会员';
    $months = intval(isset($product['months']) ? $product['months'] : 1);
    $amount = intval(isset($product['price']) ? $product['price'] : 0);
    $pid = (string)$product['product_id'];
    $ok = false;
    $stmt = $db->prepare(
        'INSERT INTO t_vip_order (out_trade_no, user_id, product_id, title, months, amount, pay_type, platform, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
    );
    if ($stmt) {
        $stmt->bind_param('ssssiiss', $orderNo, $user_id, $pid, $title, $months, $amount, $pay_type, $platform);
        $ok = $stmt->execute();
        $stmt->close();
    }
    $db->close();
    return $ok ? $orderNo : false;
}

/** 查询订单（返回关联数组或 null） */
function vip_get_order($order_no)
{
    $db = vip_db();
    $stmt = $db->prepare(
        'SELECT id, out_trade_no, user_id, product_id, title, months, amount, pay_type, platform, status, transaction_id, paid_at, created_at
         FROM t_vip_order WHERE out_trade_no = ? LIMIT 1'
    );
    if (!$stmt) { $db->close(); return null; }
    $stmt->bind_param('s', $order_no);
    $row = null;
    if ($stmt->execute()) {
        $stmt->store_result();
        $stmt->bind_result($id, $outTradeNo, $userId, $productId, $title, $months, $amount, $payType, $platform, $status, $transactionId, $paidAt, $createdAt);
        if ($stmt->fetch()) {
            $row = array(
                'id' => $id,
                'out_trade_no' => $outTradeNo,
                'user_id' => $userId,
                'product_id' => $productId,
                'title' => $title,
                'months' => $months,
                'amount' => $amount,
                'pay_type' => $payType,
                'platform' => $platform,
                'status' => $status,
                'transaction_id' => $transactionId,
                'paid_at' => $paidAt,
                'created_at' => $createdAt
            );
        }
    }
    $stmt->close();
    $db->close();
    return $row;
}

/**
 * 订单置为已支付（原子 + 幂等）：
 *   仅当 status=0（待支付）时更新为 1（已支付），affected_rows=1 表示本次首次置成功。
 *   重复回调/重复请求时返回 false，调用方据此决定是否执行 vip_grant_months。
 * @return bool true = 本次首次置成功（应执行会员顺延）
 */
function vip_mark_order_paid($order_no, $transaction_id = '')
{
    $db = vip_db();
    $ok = false;
    $stmt = $db->prepare(
        'UPDATE t_vip_order SET status = 1, transaction_id = ?, paid_at = NOW() WHERE out_trade_no = ? AND status = 0'
    );
    if ($stmt) {
        $stmt->bind_param('ss', $transaction_id, $order_no);
        $stmt->execute();
        $ok = ($stmt->affected_rows === 1);
        $stmt->close();
    }
    $db->close();
    return $ok;
}

/** 置订单关闭（超时/失败），仅当仍待支付 */
function vip_mark_order_closed($order_no)
{
    $db = vip_db();
    $stmt = $db->prepare('UPDATE t_vip_order SET status = 2 WHERE out_trade_no = ? AND status = 0');
    if ($stmt) {
        $stmt->execute();
        $stmt->close();
    }
    $db->close();
}

// ==================== 支付配置 ====================

/** 读取支付配置（vip_pay_config.php）；$section 为空返回全部 */
function vip_pay_config($section = '')
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = include __DIR__ . '/../vip_pay_config.php';
        if (!is_array($cfg)) $cfg = array();
    }
    if ($section === '') return $cfg;
    return isset($cfg[$section]) ? $cfg[$section] : array();
}

/** 分 → 元字符串（'6.00'） */
function vip_amount_yuan($cents)
{
    return number_format(intval($cents) / 100, 2, '.', '');
}

/** 通用 HTTP POST（curl），返回响应原文；失败 false */
function vip_http_post($url, $body, $contentType = 'application/json; charset=utf-8')
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: ' . $contentType));
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    $data = curl_exec($ch);
    curl_close($ch);
    return $data;
}

/** 密钥读取：支持 PEM 文件路径或裸密钥内容（自动补 PEM 头尾） */
function vip_key_read($keyOrContent, $isPrivate)
{
    if (strpos($keyOrContent, '-----BEGIN') !== false) {
        return $keyOrContent;
    }
    if (@is_file($keyOrContent)) {
        return file_get_contents($keyOrContent);
    }
    $body = trim($keyOrContent);
    if ($body === '') return '';
    $header = $isPrivate ? "-----BEGIN PRIVATE KEY-----\n" : "-----BEGIN PUBLIC KEY-----\n";
    $footer = $isPrivate ? "\n-----END PRIVATE KEY-----" : "\n-----END PUBLIC KEY-----";
    return $header . wordwrap($body, 64, "\n", true) . $footer;
}

// ==================== 微信 App 支付（v2 API，复用现有商户号） ====================

/** 微信 v2 签名：ksort 后 k=v&...&key=KEY；sign_type=HMAC-SHA256 时用 hash_hmac */
function vip_wechat_sign($params, $apiKey, $signType = 'MD5')
{
    unset($params['sign']);
    ksort($params);
    $pairs = array();
    foreach ($params as $k => $v) {
        if ($v === '' || $v === null) continue;
        $pairs[] = $k . '=' . $v;
    }
    $str = implode('&', $pairs) . '&key=' . $apiKey;
    if (strtoupper($signType) === 'HMAC-SHA256') {
        return strtoupper(hash_hmac('sha256', $str, $apiKey));
    }
    return strtoupper(md5($str));
}

/** 微信回调/响应验签 */
function vip_wechat_verify_sign($params, $apiKey)
{
    if (empty($params['sign'])) return false;
    $signType = isset($params['sign_type']) ? $params['sign_type'] : 'MD5';
    $expect = vip_wechat_sign($params, $apiKey, $signType);
    return hash_equals($expect, strtoupper($params['sign']));
}

/** 数组 → XML（微信 v2 协议） */
function vip_wechat_array_to_xml($arr)
{
    $xml = '<xml>';
    foreach ($arr as $k => $v) {
        if (is_numeric($v)) {
            $xml .= '<' . $k . '>' . $v . '</' . $k . '>';
        } else {
            $xml .= '<' . $k . '><![CDATA[' . $v . ']]></' . $k . '>';
        }
    }
    return $xml . '</xml>';
}

/** XML → 数组（微信 v2 协议） */
function vip_wechat_xml_to_array($xml)
{
    $obj = @simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$obj) return array();
    return json_decode(json_encode($obj), true);
}

/** 微信统一下单（trade_type=APP）→ 成功返回 prepay_id，失败 false */
function vip_wechat_unifiedorder($order, $config)
{
    $params = array(
        'appid' => $config['app_id'],
        'mch_id' => $config['mch_id'],
        'nonce_str' => md5(uniqid('', true)),
        'body' => $order['title'],
        'out_trade_no' => $order['out_trade_no'],
        'total_fee' => intval($order['amount']), // 单位：分
        'spbill_create_ip' => isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '127.0.0.1',
        'notify_url' => rtrim(vip_pay_config('notify_base'), '/') . '/vipWxNotify/',
        'trade_type' => 'APP'
    );
    $params['sign'] = vip_wechat_sign($params, $config['api_key']);
    $resp = vip_http_post('https://api.mch.weixin.qq.com/pay/unifiedorder', vip_wechat_array_to_xml($params), 'application/xml; charset=utf-8');
    if (!$resp) return false;
    $r = vip_wechat_xml_to_array($resp);
    if (empty($r['prepay_id'])) {
        log_r('vip wechat unifiedorder fail: ' . $resp);
        return false;
    }
    return $r['prepay_id'];
}

/** 组装 App 调起微信支付的参数（Android PayReq / iOS PayReq 同字段） */
function vip_wechat_app_params($prepayId, $config)
{
    $params = array(
        'appid' => $config['app_id'],
        'partnerid' => $config['mch_id'],
        'prepayid' => $prepayId,
        'package' => 'Sign=WXPay',
        'noncestr' => md5(uniqid('', true)),
        'timestamp' => (string)time()
    );
    $params['sign'] = vip_wechat_sign($params, $config['api_key']);
    return $params;
}

/** 微信订单主动查询（掉单补偿）→ 数组（含 trade_state/transaction_id）或 false */
function vip_wechat_order_query($orderNo, $config)
{
    $params = array(
        'appid' => $config['app_id'],
        'mch_id' => $config['mch_id'],
        'out_trade_no' => $orderNo,
        'nonce_str' => md5(uniqid('', true))
    );
    $params['sign'] = vip_wechat_sign($params, $config['api_key']);
    $resp = vip_http_post('https://api.mch.weixin.qq.com/pay/orderquery', vip_wechat_array_to_xml($params), 'application/xml; charset=utf-8');
    if (!$resp) return false;
    return vip_wechat_xml_to_array($resp);
}

// ==================== 支付宝 App 支付（alipay.trade.app.pay，RSA2） ====================

/** 支付宝 RSA2 签名（应用私钥） */
function vip_alipay_sign($params, $privateKey)
{
    unset($params['sign']);
    ksort($params);
    $pairs = array();
    foreach ($params as $k => $v) {
        if ($v === '' || $v === null) continue;
        $pairs[] = $k . '=' . $v;
    }
    $str = implode('&', $pairs);
    $sign = '';
    if (!@openssl_sign($str, $sign, $privateKey, OPENSSL_ALGO_SHA256)) {
        log_r('vip alipay sign fail');
        return false;
    }
    return base64_encode($sign);
}

/** 支付宝回调验签（支付宝公钥） */
function vip_alipay_verify($params, $alipayPublicKey)
{
    if (empty($params['sign'])) return false;
    $sign = $params['sign'];
    unset($params['sign'], $params['sign_type']);
    ksort($params);
    $pairs = array();
    foreach ($params as $k => $v) {
        if ($v === '' || $v === null) continue;
        $pairs[] = $k . '=' . $v;
    }
    $str = implode('&', $pairs);
    return (bool)@openssl_verify($str, base64_decode($sign), $alipayPublicKey, OPENSSL_ALGO_SHA256);
}

/** 组装支付宝 App 支付 orderStr（经 urlencode 的参数串，App 直接传 PayTask.payV2） */
function vip_alipay_order_str($order, $config)
{
    $biz = array(
        'subject' => $order['title'],
        'out_trade_no' => $order['out_trade_no'],
        'total_amount' => vip_amount_yuan($order['amount']),
        'product_code' => 'QUICK_MSECURITY_PAY'
    );
    $params = array(
        'app_id' => $config['app_id'],
        'method' => 'alipay.trade.app.pay',
        'charset' => 'utf-8',
        'sign_type' => 'RSA2',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0',
        'notify_url' => rtrim(vip_pay_config('notify_base'), '/') . '/vipAliNotify/',
        'biz_content' => json_encode($biz, JSON_UNESCAPED_UNICODE)
    );
    $sign = vip_alipay_sign($params, vip_key_read($config['private_key'], true));
    if ($sign === false) return false;
    $params['sign'] = $sign;
    return http_build_query($params);
}

/** 支付宝订单主动查询（掉单补偿）→ 解析后的数组（含 trade_status）或 false */
function vip_alipay_query($orderNo, $config)
{
    $params = array(
        'app_id' => $config['app_id'],
        'method' => 'alipay.trade.query',
        'charset' => 'utf-8',
        'sign_type' => 'RSA2',
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0',
        'biz_content' => json_encode(array('out_trade_no' => $orderNo), JSON_UNESCAPED_UNICODE)
    );
    $sign = vip_alipay_sign($params, vip_key_read($config['private_key'], true));
    if ($sign === false) return false;
    $params['sign'] = $sign;
    $gateway = !empty($config['gateway']) ? $config['gateway'] : 'https://openapi.alipay.com/gateway.do';
    $resp = vip_http_post($gateway, http_build_query($params), 'application/x-www-form-urlencoded; charset=utf-8');
    if (!$resp) return false;
    $json = json_decode($resp, true);
    if (!is_array($json)) return false;
    return isset($json['alipay_trade_query_response']) ? $json['alipay_trade_query_response'] : false;
}

// ==================== Apple IAP（verifyReceipt） ====================

/**
 * 苹果 verifyReceipt 校验（生产/沙箱双验）：
 *   优先请求生产环境；status=21007（沙箱收据误送生产）时自动重试沙箱环境。
 * 配置：vip_pay_config('apple') —— shared_secret（App 专用共享密钥，非续期订阅可留空）、
 *       verify_prod_url / verify_sandbox_url、bundle_id（可选，配置后校验收据应用归属）。
 * @return array 失败: array('ok'=>false, 'error'=>string, 'status'=>int)
 *               成功: array('ok'=>true, 'data'=>array 苹果响应原文, 'env'=>'production|sandbox')
 */
function vip_iap_verify_receipt($receipt)
{
    $cfg = vip_pay_config('apple');
    $prodUrl = !empty($cfg['verify_prod_url']) ? $cfg['verify_prod_url'] : 'https://buy.itunes.apple.com/verifyReceipt';
    $sandboxUrl = !empty($cfg['verify_sandbox_url']) ? $cfg['verify_sandbox_url'] : 'https://sandbox.itunes.apple.com/verifyReceipt';
    $secret = isset($cfg['shared_secret']) ? trim($cfg['shared_secret']) : '';
    $bundleId = isset($cfg['bundle_id']) ? trim($cfg['bundle_id']) : '';

    // exclude-old-transactions：排除历史订阅交易，减少响应体量
    $body = array('receipt-data' => $receipt, 'exclude-old-transactions' => true);
    if ($secret !== '') $body['password'] = $secret;
    $payload = json_encode($body);

    $data = vip_iap_request_receipt($prodUrl, $payload);
    if ($data === null) {
        return array('ok' => false, 'error' => '苹果校验服务请求失败', 'status' => -1);
    }
    $status = isset($data['status']) ? intval($data['status']) : -1;

    // 21007：沙箱收据（TestFlight/沙箱测试单）→ 重试沙箱环境
    if ($status === 21007) {
        $data2 = vip_iap_request_receipt($sandboxUrl, $payload);
        if ($data2 === null) {
            return array('ok' => false, 'error' => '苹果沙箱校验服务请求失败', 'status' => -1);
        }
        $status2 = isset($data2['status']) ? intval($data2['status']) : -1;
        if ($status2 === 0) {
            return vip_iap_check_bundle($data2, 'sandbox', $bundleId);
        }
        return array('ok' => false, 'error' => '沙箱收据校验失败(status=' . $status2 . ')', 'status' => $status2);
    }

    if ($status === 0) {
        $env = (isset($data['environment']) && strtolower((string)$data['environment']) === 'sandbox') ? 'sandbox' : 'production';
        return vip_iap_check_bundle($data, $env, $bundleId);
    }

    return array('ok' => false, 'error' => '收据校验失败(status=' . $status . ')', 'status' => $status);
}

/** 请求苹果 verifyReceipt（返回解析后的数组；请求/解析失败返回 null） */
function vip_iap_request_receipt($url, $payload)
{
    $resp = vip_http_post($url, $payload, 'application/json; charset=utf-8');
    if (!is_string($resp) || $resp === '') return null;
    $data = json_decode($resp, true);
    return is_array($data) ? $data : null;
}

/** 校验收据 bundle_id 是否归属本应用（未配置 bundle_id 或收据未携带时跳过） */
function vip_iap_check_bundle($data, $env, $bundleId)
{
    if ($bundleId !== '') {
        $receiptBundle = isset($data['receipt']['bundle_id']) ? (string)$data['receipt']['bundle_id'] : '';
        if ($receiptBundle !== '' && $receiptBundle !== $bundleId) {
            return array('ok' => false, 'error' => '收据应用不匹配(bundle_id=' . $receiptBundle . ')', 'status' => 0);
        }
    }
    return array('ok' => true, 'data' => $data, 'env' => $env);
}

/**
 * 从苹果校验响应中挑选与商品匹配的交易凭证。
 * 数据来源：receipt.in_app（一次性商品/非续期订阅）+ latest_receipt_info（续期订阅）。
 * 选取规则：$preferredTid 非空时仅认该交易；否则取 purchase_date_ms 最新的一条。
 * @return array|null {transaction_id, product_id, purchase_ms, original_transaction_id}
 */
function vip_iap_pick_transaction($data, $iapProductId, $preferredTid = '')
{
    $entries = array();
    if (isset($data['receipt']['in_app']) && is_array($data['receipt']['in_app'])) {
        $entries = $data['receipt']['in_app'];
    }
    if (isset($data['latest_receipt_info'])) {
        if (is_array($data['latest_receipt_info'])) {
            // 续期订阅响应中为数组；个别版本为单对象
            if (isset($data['latest_receipt_info'][0])) {
                $entries = array_merge($entries, $data['latest_receipt_info']);
            } else {
                $entries[] = $data['latest_receipt_info'];
            }
        }
    }

    $best = null;
    foreach ($entries as $e) {
        if (!is_array($e)) continue;
        $pid = isset($e['product_id']) ? (string)$e['product_id'] : '';
        if ($pid !== (string)$iapProductId) continue;
        $tid = isset($e['transaction_id']) ? (string)$e['transaction_id'] : '';
        if ($tid === '') continue;
        if ($preferredTid !== '' && $tid !== $preferredTid) continue;
        $ms = isset($e['purchase_date_ms']) ? (float)$e['purchase_date_ms'] : 0.0;
        if ($best === null || $ms > $best['purchase_ms']) {
            $best = array(
                'transaction_id' => $tid,
                'product_id' => $pid,
                'purchase_ms' => $ms,
                'original_transaction_id' => isset($e['original_transaction_id']) ? (string)$e['original_transaction_id'] : ''
            );
        }
    }
    return $best;
}

/** 交易凭证是否已被其他已支付订单使用（防止同一凭证重复入账）；$exclude_order_no 排除自身订单 */
function vip_iap_transaction_used($transaction_id, $exclude_order_no = '')
{
    if ($transaction_id === '') return false;
    $db = vip_db();
    $used = false;
    $stmt = $db->prepare('SELECT COUNT(*) FROM t_vip_order WHERE transaction_id = ? AND status = 1 AND out_trade_no <> ?');
    if ($stmt) {
        $stmt->bind_param('ss', $transaction_id, $exclude_order_no);
        if ($stmt->execute()) {
            $stmt->store_result();
            $stmt->bind_result($cnt);
            if ($stmt->fetch()) $used = (intval($cnt) > 0);
        }
        $stmt->close();
    }
    $db->close();
    return $used;
}
