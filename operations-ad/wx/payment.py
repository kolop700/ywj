"""微信支付接口包装 2017-02-14 by wei"""
from corks import app
from corks.utils import log
from xml.etree import ElementTree as ET
from pathlib import Path
from . import api
import uuid
import json
import hashlib
import socket
import hmac

_logger = log.get_logger('wx_payment', __name__)
_call_timeout = 10  # 调用接口超时时间

# 统一下单接口地址
_unifiedorder_url = 'https://api.mch.weixin.qq.com/pay/unifiedorder'

# 查询订单接口地址
_orderquery_url = 'https://api.mch.weixin.qq.com/pay/orderquery'

# 退款接口地址
_refund_url = 'https://api.mch.weixin.qq.com/secapi/pay/refund'

#发红包接口地址
_sendredpack_url = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack'

# 添加分账接收方地址
_profitsharingaddreceiver_url = 'https://api.mch.weixin.qq.com/pay/profitsharingaddreceiver'

# 删除分账接收方地址
_profitsharingremovereceiver_url = 'https://api.mch.weixin.qq.com/pay/profitsharingremovereceiver'

# 单次分账
_profitsharing_url = 'https://api.mch.weixin.qq.com/secapi/pay/profitsharing'

# 查询子商户最大分账比率
_profitsharingmerchantratioquery_url = 'https://api.mch.weixin.qq.com/pay/profitsharingmerchantratioquery'

# 分账完结(解冻分账剩余金额)
_profitsharingfinish_url = 'https://api.mch.weixin.qq.com/secapi/pay/profitsharingfinish'

# 支付通知返回结构
_notify_result_success = '''
<xml>
  <return_code><![CDATA[{return_code}]]></return_code>
  <return_msg><![CDATA[{return_msg}]]></return_msg>
</xml>
'''


def get_notify_result(success, msg=''):
    """
    取得通知结果xml
    :param success:是否成功，布尔型
    :param msg: 消息
    :return:
        xml
    """
    return_code = 'SUCCESS' if success else 'FAIL'
    return_msg = 'OK' if success else msg

    return _notify_result_success.format(return_code=return_code, return_msg=return_msg)


def parse_notify_xml(xml_data, wx_api_key):
    """
    解析通知xml数据
    :param xml_data:  通知回来的xml数据
    :param wx_api_key:  商户号API_KEY
    :return:
        成功返回xml(etree)对象
    """
    xml = ET.fromstring(xml_data)
    return_code = xml.findtext('return_code')
    if return_code == 'SUCCESS':  # 接口成功
        result_code = xml.findtext('result_code')
        out_trade_no = xml.findtext('out_trade_no')
        err_code = xml.findtext('err_code')
        err_code_des = xml.findtext('err_code_des')
        if result_code == 'SUCCESS':  # 支付成功
            # 验证签名
            sign1 = xml.findtext('sign')
            d = {}
            for it in xml:
                if it.tag != 'sign':
                    d[it.tag] = it.text

            sign2 = get_sign(wx_api_key, **d)
            if sign1 != sign2:
                raise Exception('验证签名失败！')

            return xml
        else:
            raise Exception(f'单号：{out_trade_no} 支付出错：{err_code} {err_code_des}')
    else:
        return_msg = xml.findtext('return_msg')
        raise Exception(f'支付通知返回错误：{return_msg}')


def get_sign(api_key, **kwargs):
    """
    计算签名
    @param api_key:
    @param kwargs: 签名的参数
    @return:
    """
    sign_type = kwargs.get('sign_type', 'MD5')
    ks = list(kwargs.keys())
    ks.sort()

    pl = []
    for k in ks:
        v = str(kwargs[k])
        if v:
            pl.append(f'{k}={v}')

    # 最后拼上key
    pl.append(f'key={api_key}')
    sign_str = '&'.join(pl)

    if sign_type == 'MD5':
        sign = hashlib.md5(sign_str.encode()).hexdigest()
    elif sign_type == 'HMAC-SHA256':
        sign = hmac.new(api_key.encode(), sign_str.encode(), digestmod=hashlib.sha256).hexdigest()
    else:
        raise Exception(f'无效的签名方式：{sign_type}')

    return sign.upper()


def dict_to_xml(obj):
    """
    把字典直接转成xml，不用每次都先定义xml结构了
    :param obj: 字典对像
    :return:
    """
    item_list = []
    for k, v in obj.items():
        if isinstance(v, str):
            s = f'<{k}><![CDATA[{v}]]></{k}>'
        else:
            s = f'<{k}>{v}</{k}>'

        item_list.append(s)

    return '<xml>%s</xml>' % ''.join(item_list)


def _get_local_ip():  # 取本机ip
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))  # connect() for UDP doesn't send packets
        ip = s.getsockname()[0]
    except:
        ip = '127.0.0.1'
    finally:
        s.close()

    return ip


def _call(url, xml_data, api_name, cert=None):
    try:
        rsp = api.post_xml(url, xml_data, timeout=_call_timeout, cert=cert)
    except Exception as e:
        _logger.error(f'调用微信接口({api_name})出错：{e}')
        raise Exception('调用微信接口出错，请稍后重试！')

    if not rsp.ok:
        _logger.error(f'调用微信接口({api_name})出错：{rsp.text}')
        raise Exception('调用微信接口出错，请稍后重试！')

    rsp_text = rsp.content.decode()
    xml = ET.fromstring(rsp_text)
    return_code = xml.findtext('return_code')

    if return_code != 'SUCCESS':#失败
        _logger.error(f'微信接口{api_name}返回错误：{rsp_text}')

        msg = xml.findtext('return_msg')
        raise Exception(msg)

    result_code = xml.findtext('result_code')
    if result_code != 'SUCCESS':
        _logger.error(f'微信接口{api_name}返回错误：{rsp_text}')

        err_code = xml.findtext('err_code')
        err_code_des = xml.findtext('err_code_des')
        raise Exception(err_code, err_code_des)

    return xml


class WxspPayment(object):
    """微信服务商支付包装类"""

    def __init__(self, merchant_id):
        merchant_cfg = app.config['MERCHANTS'].get(merchant_id)
        if not merchant_cfg:
            raise Exception(f'取不到商家配置(id={merchant_id})')

        sp_appid = app.config['SP_APPID']  # 服务商公众号appid
        sp_much_id = app.config['SP_MUCH_ID']  # 服务商商户号
        sp_api_key = app.config['SP_API_KEY']  # 服务商商户号api_key
        sub_appid = merchant_cfg['appid']  # 应用appid
        sub_mch_id = merchant_cfg['mch_id']  # 子商户号

        cert_file = Path(app.config['ROOT_DIR']) / f'cert/{sp_much_id}/apiclient_cert.pem'
        cert_key_file = Path(app.config['ROOT_DIR']) / f'cert/{sp_much_id}/apiclient_key.pem'

        self.wx = {
            'appid': sp_appid,  # 服务商公众号appid
            'mch_id': sp_much_id,  # 服务商商户号
            'api_key': sp_api_key,  # 服务商商户号api_key
            'sub_appid': sub_appid,  # 应用appid
            'sub_mch_id': sub_mch_id,  # 子商户号
            'cert_file': str(cert_file) if cert_file.exists() else None,  # apiclient_cert.pem 文件地址
            'cert_key_file': str(cert_key_file) if cert_key_file.exists() else None  # apiclient_key.pem 文件地址
        }

    def unified_order(self, openid, body, goods_detail, out_trade_no, total_fee, attach,
                      notify_url, spbill_create_ip, profit_sharing='N'):
        """
        微信统一下单接口
        @param openid: 当前小程序的openid
        @param body:描述
        @param goods_detail:商品列表，必须为list,list结构如下：
                    [
                      {
                        goods_id:"商品编号",
                        goods_name:"商品名称",
                        quantity:int 数量,
                        price:int 价格，单位为分,
                        body:"商品描述" 可选
                      },
                    ]
        @param out_trade_no:商户订单号
        @param total_fee:总额（单位为分)
        @param attach:附加参数，回调时传回
        @param notify_url:回调url地址
        @param spbill_create_ip: 请求ip
        @param profit_sharing: 分账标识(Y-分账, N-不分账),默认N
        @return prepay_id 预支付交易会话标识
        """
        if not isinstance(goods_detail, list):
            raise Exception('参数goods_detail必须为list!')

        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'sub_openid': openid,
            'attach': attach,
            'body': body,
            'detail': json.dumps({'goods_detail': goods_detail}, ensure_ascii=False),
            'nonce_str': nonce_str,
            'notify_url': notify_url,
            'out_trade_no': out_trade_no,
            'spbill_create_ip': spbill_create_ip,
            'total_fee': total_fee,
            'trade_type': 'JSAPI',
            'profit_sharing': profit_sharing  # 分账标识
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)
        xml = _call(_unifiedorder_url, params_xml, 'unifiedorder')
        return xml.findtext('prepay_id')  # 成功返回prepay_id

    def order_query(self, out_trade_no):
        """
        查询订单状态接口
        @param out_trade_no: 外部订单号
        @return:
            SUCCESS—支付成功
            REFUND—转入退款
            NOTPAY—未支付
            CLOSED—已关闭
            REVOKED—已撤销（刷卡支付）
            USERPAYING-用户支付中
            PAYERROR-支付失败(其他原因，如银行返回失败)
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'nonce_str': nonce_str,
            'out_trade_no': out_trade_no
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        xml = _call(_orderquery_url, params_xml, 'orderquery')
        #返回支付状态
        return xml.findtext('trade_state')

    def refund(self, out_refund_no, transaction_id, out_trade_no, total_fee, refund_fee):
        """
        退款接口(transaction_id和out_trade_no必须有一个)
        @param out_refund_no: 退款单号
        @param transaction_id: 微信订单号(支付通知中返回)
        @param out_trade_no: 原商户订单号
        @param total_fee: 原订单金额(分)
        @param refund_fee: 退款金额(分)
        @return:
            无
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            #'op_user_id': self.wx['mch_id'],
            'nonce_str': nonce_str,
            'out_refund_no': out_refund_no,
            'transaction_id': transaction_id,
            'out_trade_no': out_trade_no,
            'refund_fee': refund_fee,
            'total_fee': total_fee
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        cert = (self.wx['cert_file'], self.wx['cert_key_file'])
        #print(cert)
        _call(_refund_url, params_xml, 'refund', cert=cert)

    def send_red_pack(self, mch_billno, re_openid, total_amount, send_name, wishing, act_name,
                      remark, total_num=1, scene_id='PRODUCT_1'):
        """
        发红包
        @param mch_billno: 商户订单号，不能重复
        @param re_openid: 接收红包的用户openid
        @param total_amount: 红包金额(单位'分')
        @param send_name: 商户名称(发送者名称)
        @param wishing: 祝福语
        @param act_name: 活动名称
        @param remark: 备注
        @param total_num: 红包发放总人数 默认为1
        @param scene_id: 场景id 默认 PRODUCT_1
            发放红包使用场景，红包金额大于200时必传
            PRODUCT_1: 商品促销
            PRODUCT_2: 抽奖
            PRODUCT_3: 虚拟物品兑奖
            PRODUCT_4: 企业内部福利
            PRODUCT_5: 渠道分润
            PRODUCT_6: 保险回馈
            PRODUCT_7: 彩票派奖
            PRODUCT_8: 税务刮奖
        @return:
            无
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'mch_billno': mch_billno,
            'mch_id': self.wx['mch_id'],
            'wxappid': self.wx['appid'],
            'send_name': send_name,
            're_openid': re_openid,
            'total_amount': str(total_amount),
            'total_num': str(total_num),
            'wishing': wishing,
            'client_ip': _get_local_ip(),
            'act_name': act_name,
            'remark': remark,
            'scene_id': scene_id,
            'nonce_str': nonce_str
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        cert = (self.wx['cert_file'], self.wx['cert_key_file'])
        _call(_sendredpack_url, params_xml, 'sendredpack', cert=cert)

    def profit_sharing_add_receiver(self, receiver):
        """
        添加分账接收方
        文档：https://pay.weixin.qq.com/wiki/doc/api/allocation_sl.php?chapter=25_3&index=4
        @param receiver:分账接收方
            {
                type：xx, // 账类类型.
                account: xx, // 接收方账号.
                name: xx, // 分账账号名称.
                relation_type: xx, // 与分账方的关系类型.
                custom_relation: xx // 自定义的分账关系.
            }
        @return:
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'nonce_str': nonce_str,
            'sign_type': 'HMAC-SHA256',
            'receiver': json.dumps(receiver, ensure_ascii=False)
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        return _call(_profitsharingaddreceiver_url, params_xml, 'profitsharingaddreceiver')

    def profit_sharing_remove_receiver(self, receiver):
        """
        删除分账接收方
        文档：https://pay.weixin.qq.com/wiki/doc/api/allocation_sl.php?chapter=25_4&index=5
        @param receiver:
            {
                type：xx, // 账类类型.
                account: xx // 接收方账号.
            }
        @return:
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'nonce_str': nonce_str,
            'sign_type': 'HMAC-SHA256',
            'receiver': json.dumps(receiver, ensure_ascii=False)
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        return _call(_profitsharingremovereceiver_url, params_xml, 'profitsharingremovereceiver')

    def profit_sharing(self, transaction_id, out_order_no, receivers):
        """
        单次分账。文档：https://pay.weixin.qq.com/wiki/doc/api/allocation_sl.php?chapter=25_1&index=1
        @param transaction_id: 微信订单号(支付通知中返回)
        @param out_order_no: 商户分账单号
        @param receivers: 分账接收列表
            [
                {
                    type: xx,  // 分账接收方类型
                    account: xx,  // 分账接收账号
                    amount: xx,  // 分账金额
                    description: xx // 分账描述
                },
                ...
            ]
        @return:
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'nonce_str': nonce_str,
            'sign_type': 'HMAC-SHA256',
            'transaction_id': transaction_id,
            'out_order_no': out_order_no,
            'receivers': json.dumps(receivers, ensure_ascii=False)
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        return _call(_profitsharing_url, params_xml, 'profitsharing')

    def profit_sharing_merchant_ratio_query(self):
        """
        查询子商户最大分账比率
        文档：https://pay.weixin.qq.com/wiki/doc/api/allocation_sl.php?chapter=25_11&index=8
        @return:
        """
        nonce_str = uuid.uuid4().hex

        d = {
            'mch_id': self.wx['mch_id'],
            'sub_appid': self.wx['sub_appid'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'nonce_str': nonce_str,
            'sign_type': 'HMAC-SHA256'
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        return _call(_profitsharingmerchantratioquery_url, params_xml, 'profitsharingmerchantratioquery')

    def profit_sharing_finish(self, transaction_id, out_order_no, description):
        """
        完结分账(解冻分账剩余金额)
        @param transaction_id:
        @param out_order_no:
        @param description:
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'mch_id': self.wx['mch_id'],
            'sub_mch_id': self.wx['sub_mch_id'],
            'appid': self.wx['appid'],
            'transaction_id': transaction_id,
            'out_order_no': out_order_no,
            'description': description,
            'nonce_str': nonce_str,
            'sign_type': 'HMAC-SHA256'
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        _call(_profitsharingfinish_url, params_xml, 'profitsharingfinish')


class WxPayment(object):
    """微信支付包装类"""

    def __init__(self):
        self.wx = {
            'appid': app.config['WX_APPID'],
            'mch_id': app.config['WX_MUCH_ID'],
            'api_key': app.config['WX_API_KEY'],
            'cert_file': Path(app.config['ROOT_DIR']) / 'cert/apiclient_cert.pem',  # apiclient_cert.pem 文件地址
            'cert_key_file': Path(app.config['ROOT_DIR']) / 'cert/apiclient_key.pem'  # apiclient_key.pem 文件地址
        }

    def unified_order(self, openid, body, goods_detail, out_trade_no, total_fee, attach, notify_url, spbill_create_ip):
        """
        微信统一下单接口
        :param body:描述
        :param goods_detail:商品列表，必须为list,list结构如下：
                    [
                      {
                        goods_id:"商品编号",
                        goods_name:"商品名称",
                        quantity:int 数量,
                        price:int 价格，单位为分,
                        body:"商品描述" 可选
                      },
                    ]
        :param out_trade_no:商户订单号
        :param total_fee:总额（单位为分)
        :param attach:附加参数，回调时传回
        :param notify_url:回调url地址
        :param spbill_create_ip: 请求ip
        :return prepay_id 预支付交易会话标识
        """
        if not isinstance(goods_detail, list):
            raise Exception('参数goods_detail必须为list!')

        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'openid': openid,
            'attach': attach,
            'body': body,
            'detail': json.dumps({'goods_detail': goods_detail}, ensure_ascii=False),
            'nonce_str': nonce_str,
            'notify_url': notify_url,
            'out_trade_no': out_trade_no,
            'spbill_create_ip': spbill_create_ip,
            'total_fee': total_fee,
            'trade_type': 'JSAPI'
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)
        xml = _call(_unifiedorder_url, params_xml, 'unifiedorder')

        return xml.findtext('prepay_id')  # 成功返回prepay_id

    def order_query(self, out_trade_no):
        """
        查询订单状态接口
        :param out_trade_no: 外部订单号
        :return:
            SUCCESS—支付成功
            REFUND—转入退款
            NOTPAY—未支付
            CLOSED—已关闭
            REVOKED—已撤销（刷卡支付）
            USERPAYING -用户支付中
            PAYERROR -支付失败(其他原因，如银行返回失败)
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'nonce_str': nonce_str,
            'out_trade_no': out_trade_no
        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        xml = _call(_orderquery_url, params_xml, 'orderquery')
        #返回支付状态
        return xml.findtext('trade_state')

    def refund(self, out_refund_no, out_trade_no, total_fee, refund_fee):
        """
        退款接口
        :param out_refund_no: 退款单号
        :param out_trade_no: 原商户订单号
        :param total_fee: 原订单金额(分)
        :param refund_fee: 退款金额(分)
        :return:
            无
        """
        nonce_str = uuid.uuid4().hex

        d = {
            'appid': self.wx['appid'],
            'mch_id': self.wx['mch_id'],
            'nonce_str': nonce_str,
            'out_refund_no': out_refund_no,
            'out_trade_no': out_trade_no,
            'refund_fee': refund_fee,
            'total_fee': total_fee

        }
        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        cert = (self.wx['cert_file'], self.wx['cert_key_file'])
        _call(_refund_url, params_xml, 'refund', cert=cert)

    def send_red_pack(self, mch_billno, re_openid, total_amount, send_name, wishing, act_name,
                      remark, total_num=1, scene_id='PRODUCT_1'):
        """
        发红包
        :param mch_billno: 商户订单号，不能重复
        :param re_openid: 接收红包的用户openid
        :param total_amount: 红包金额(单位'分')
        :param send_name: 商户名称(发送者名称)
        :param wishing: 祝福语
        :param act_name: 活动名称
        :param remark: 备注
        :param total_num:红包发放总人数 默认为1
        :param scene_id:场景id 默认 PRODUCT_1
            发放红包使用场景，红包金额大于200时必传
            PRODUCT_1:商品促销
            PRODUCT_2:抽奖
            PRODUCT_3:虚拟物品兑奖
            PRODUCT_4:企业内部福利
            PRODUCT_5:渠道分润
            PRODUCT_6:保险回馈
            PRODUCT_7:彩票派奖
            PRODUCT_8:税务刮奖
        :return:
            无
        """
        nonce_str = uuid.uuid4().hex
        d = {
            'mch_billno': mch_billno,
            'mch_id': self.wx['mch_id'],
            'wxappid': self.wx['appid'],
            'send_name': send_name,
            're_openid': re_openid,
            'total_amount': str(total_amount),
            'total_num': str(total_num),
            'wishing': wishing,
            'client_ip': _get_local_ip(),
            'act_name': act_name,
            'remark': remark,
            'scene_id': scene_id,
            'nonce_str': nonce_str
        }

        d['sign'] = get_sign(self.wx['api_key'], **d)
        params_xml = dict_to_xml(d)

        cert = (self.wx['cert_file'], self.wx['cert_key_file'])
        _call(_sendredpack_url, params_xml, 'sendredpack', cert=cert)