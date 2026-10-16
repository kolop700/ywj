"""小程序接口包装 2018-03-09 by wei"""
from corks.utils import log
from . import api
import requests


_logger = log.get_logger('wx_mini_program', __name__)


#  微信用code取session接口url
_wx_jscode2session_url = 'https://api.weixin.qq.com/sns/jscode2session'
# 三方平台小程序code取session接口url
_wx_component_jscode2session_url = 'https://api.weixin.qq.com/sns/component/jscode2session'
# 取得小程序码接口地址(接口A)
_getwxacode_url = 'https://api.weixin.qq.com/wxa/getwxacode?access_token={access_token}'
# 取得小程序二维码接口地址(接口B)
_getwxacodeunlimit_url = 'https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token={access_token}'
# 取得小程序二维码接口地址(接口C)
_createwxaqrcode_url = 'https://api.weixin.qq.com/cgi-bin/wxaapp/createwxaqrcode?access_token={access_token}'
# 推送模板消息
_send_template_msg_url = 'https://api.weixin.qq.com/cgi-bin/message/wxopen/template/send?access_token={access_token}'
# code换取用户手机号
_getuserphonenumber_url = 'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}'


@log.log_exception(_logger)
def jscode2session(appid, secret, js_code):
    """用jscode换取session_key"""
    params = {
        'appid': appid,
        'secret': secret,
        'js_code': js_code,
        'grant_type': 'authorization_code'
    }
    rsp = requests.get(_wx_jscode2session_url, params)
    if not rsp.ok:
        msg = '取得openid出错：%s' % rsp.content
        raise Exception(msg)

    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        msg = f'取得openid失败：{errcode} {errmsg}'
        raise Exception(msg)

    return res


@log.log_exception(_logger)
def component_jscode2session(appid, js_code, component_appid, component_access_token):
    """三方平台用jscode换取session_key"""
    params = {
        'appid': appid,
        'js_code': js_code,
        'grant_type': 'authorization_code',
        'component_appid': component_appid,
        'component_access_token': component_access_token
    }
    rsp = requests.get(_wx_component_jscode2session_url, params)
    if not rsp.ok:
        msg = '三方平台取得openid出错：%s' % rsp.content
        raise Exception(msg)

    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        msg = f'三方平台取得openid失败：{errcode} {errmsg}'
        raise Exception(msg)

    return res


@log.log_exception(_logger)
def getwxacode(access_token, path, width=None):
    """
    取得小程序码(接口A)
    :param access_token:
    :param path:
    :param width: 不传默认430
    :return:
    """
    url = _getwxacode_url.format(access_token=access_token)
    data = {'path': path, 'auto_color': True}
    if width:
        data['width'] = width

    rsp = api.post_json(url, data)
    msg = None
    try:  # 接口错误时，会返回json
        js = rsp.json()
        msg = f"getwxacode err：{js['errcode']} {js['errmsg']}"
    except:  # 解析json错误说明是接口正常返回二维码数据
        pass

    if msg:
        raise Exception(msg)

    return rsp.content


@log.log_exception(_logger)
def getwxacodeunlimit(access_token, scene, page, width=None):
    """
    取得小程序码(接口B)，每分钟5000个
    :param access_token:
    :param scene: 固定参数，最长32个字符，只能数字字母及部分特殊字符
    :param page:
    :param width:
    :return:
    """
    url = _getwxacodeunlimit_url.format(access_token=access_token)
    data = {'scene': scene, 'page': page}
    if width:
        data['width'] = width

    rsp = api.post_json(url, data)
    if not rsp.ok:
        _logger.error('getwxacodeunlimit err:%s' % repr(rsp.content))
        return

    try:  # 接口错误时，会返回json
        js = rsp.json()
        _logger.error(f"getwxacodeunlimit err：{js['errcode']} {js['errmsg']}")
        return
    except:  # 解析json错误说明是接口正常返回二维码数据
        pass

    return rsp.content


@log.log_exception(_logger)
def createwxaqrcode(access_token, path, width=None):
    """
    取得小程序二维码(接口C)
    :param access_token:
    :param path:
    :param width: 不传默认430
    :return:
    """
    url = _createwxaqrcode_url.format(access_token=access_token)
    data = {'path': path}
    if width:
        data['width'] = width

    rsp = api.post_json(url, data)
    if not rsp.ok:
        raise Exception('取小程序二维码失败!')

    msg = None
    try:  # 接口错误时，会返回json
        js = rsp.json()
        msg = f"createwxaqrcode err：{js['errcode']} {js['errmsg']}"
    except:  # 解析json错误说明是接口正常返回二维码数据
        pass

    if msg:
        raise Exception(msg)

    return rsp.content


def send_template_msg(access_token, touser, template_id, form_id, data, page='', emphasis_keyword=''):
    """
    推送模板消息
    :param access_token:
    :param touser:  接收者（用户）的 openid
    :param template_id:  模板id
    :param form_id:  小程序前端取得的formId或支付的prepay_id
    :param data: 字典对象，结构：{'keyword1':{ 'value': 'xxx'}, 'keyworkd2': { 'value': 'xxx'}, ...}
    :param page:  点击跳转页面
    :param emphasis_keyword:  放大哪个字段的字体。比如:'keyword1.DATA'
    :return:
    """
    url = _send_template_msg_url.format(access_token=access_token, )
    params = {
        'touser': touser,
        'template_id': template_id,
        'form_id': form_id,
        'data': data,
        'page': page,
        'emphasis_keyword': emphasis_keyword
    }
    rsp = api.post_json(url, params)
    res = rsp.json()
    errcode = res['errcode']
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'模板消息推送错误：{errcode} {errmsg}')

    return res


def getuserphonenumber(access_token, code):
    """
    换取用户手机号
    @param access_token:
    @param code:  小程序取手机号授权返回的code
    @return:
    """
    url = _getuserphonenumber_url.format(access_token=access_token)
    params = {
        'code': code
    }
    rsp = api.post_json(url, params)
    res = rsp.json()
    errcode = res['errcode']
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'code换取手机号出错：{errcode} {errmsg}')

    return res['phone_info']