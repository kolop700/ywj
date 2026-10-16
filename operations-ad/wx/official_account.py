"""公众号接口包装"""
from corks.utils import log
from . import api
import requests


_logger = log.get_logger('wx_official_account', __name__)

# 取用户信息接口地址
_get_user_info_url = 'https://api.weixin.qq.com/cgi-bin/user/info?access_token={access_token}&openid={openid}&lang=zh_CN'
# 发送客户消息接口地址
_send_custom_msg_url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token={access_token}'
# 删除菜单
_delete_menu_url = 'https://api.weixin.qq.com/cgi-bin/menu/delete?access_token={access_token}'
# 创建菜单
_create_menu_url = ' https://api.weixin.qq.com/cgi-bin/menu/create?access_token={access_token}'
# 获取用户列表
_get_users_url = 'https://api.weixin.qq.com/cgi-bin/user/get?access_token={access_token}&next_openid={next_openid}'
# 根据openid群发接口
_message_send_url = 'https://api.weixin.qq.com/cgi-bin/message/mass/send?access_token={access_token}'
# 根据分组或全部群发接口
_message_send_all_url = 'https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token={access_token}'
# 推送模板消息
_message_send_template = 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={access_token}'


@log.log_exception(_logger)
def get_user_info(access_token, openid):
    """
    取用户信息
    :param access_token:
    :param openid:
    :return:
    """
    url = _get_user_info_url.format(access_token=access_token, openid=openid)

    rsp = requests.get(url)
    res = rsp.json()

    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'取用户信息错误：{errcode} {errmsg}' )

    return res


@log.log_exception(_logger)
def delete_menu(access_token):
    """
    删除菜单
    :param access_token:
    :return:
    """
    url = _delete_menu_url.format(access_token=access_token)

    rsp = requests.get(url)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'删除菜单错误：{errcode} {errmsg}')

    return res


@log.log_exception(_logger)
def create_menu(access_token, menu):
    """
    创建菜单
    :param access_token:
    :param menu: 字典结构的菜单定义
    :return:
    """

    url = _create_menu_url.format(access_token=access_token)
    rsp = api.post_json(url, menu)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'创建菜单错误：{errcode} {errmsg}')

    return res


@log.log_exception(_logger)
def get_users(access_token, next_openid=''):
    """
    获取用户列表
    :param access_token:
    :param next_openid:
    :return:
    """
    url = _get_users_url.format(access_token=access_token, next_openid=next_openid)

    rsp = requests.get(url)
    return rsp.json()


@log.log_exception(_logger)
def send_custom_msg(access_token, data):
    """
    发客报消息
    :param access_token:
    :param data: 消息结构字典。结构请看微信消息格式
    :return:
    """
    url = _send_custom_msg_url.format(access_token=access_token)
    rsp = api.post_json(url, data)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'发送客户消息错误：{errcode} {errmsg}' )

    return res


@log.log_exception(_logger)
def message_send(access_token, data):
    """
    根据openid群发消息
    :param access_token:
    :param data:  消息结构，请见文档https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1481187827_i0l21
    :return:
    """
    url = _message_send_url.format(access_token=access_token)

    rsp = api.post_json(url, data)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'根据openid群发错误：{errcode} {errmsg}')

    return res


@log.log_exception(_logger)
def message_send_all(access_token, data):
    """
    根据分组或全部群发消息
    :param access_token:
    :param data:  消息结构，请见文档https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1481187827_i0l21
    :return:
    """
    url = _message_send_all_url.format(access_token=access_token)

    rsp = api.post_json(url, data)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'消息群发错误：{errcode} {errmsg}')

    return res


@log.log_exception(_logger)
def message_send_template(access_token, data):
    """
    推送模板消息
    @param access_token:
    @param data: 消息结构，见文档：https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Template_Message_Interface.html#5
    @return:
    """
    url = _message_send_template.format(access_token=access_token)

    rsp = api.post_json(url, data)
    res = rsp.json()
    errcode = res.get('errcode', 0)
    if errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'推送模板消息错误：{errcode} {errmsg}')

    return res
