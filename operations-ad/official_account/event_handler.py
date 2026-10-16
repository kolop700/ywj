"""事件处理"""
from flask import g
from corks import app
from db import db
from . import wx_msg, remsg
from wx import common, official_account
from db.ad_models import *


@wx_msg('event', 'subscribe')
def subscribe(xml):  # 订阅(关注)
    ToUserName = xml.findtext('ToUserName')  # 公众号openid
    FromUserName = xml.findtext('FromUserName')  # 关注者的openid

    # 取用户信息
    appid = app.config['OA_APPID']
    appsecret = app.config['OA_APPSECRET']
    access_token = common.get_access_token(appid, appsecret)
    res = official_account.get_user_info(access_token, FromUserName)
    # 更新用户信息

    if res['subscribe'] == 1:
        openid = res['openid']
        # unionid = res.get('unionid')
        # profile = AgencyProfile.query.filter_by(openid=openid).first()
        # if profile:
        #     profile.is_follow = True
        #     # 2021-12-27日开始get_user_info接口已经不返回用户信息，只能在网页授权时取
        #     profile.nickname = res['nickname']
        #     profile.gender = res['sex']
        #     profile.city = res['city']
        #     profile.province = res['province']
        #     profile.country = res['country']
        #     profile.avatar_url = res['headimgurl']
        #     db.session.add(profile)
        #     db.session.commit()

    # 查公众号名称
    msg = '欢迎关注！'
    # 自动回复
    return remsg.get_text_msg(ToUserName, FromUserName, msg)


@wx_msg('event', 'unsubscribe')
def unsubscribe(xml):  # 取消订阅(关注)
    FromUserName = xml.findtext('FromUserName')  # 关注者的openid

    # 更新关注状态(AgencyProfile现在已经没有openid了，因为可能多个)
    # AgencyProfile.query.filter_by(openid=FromUserName).update(
    #     {'is_follow': False}, synchronize_session=False)
    # db.session.commit()


@wx_msg('event', 'click')
def menu_click(xml):  # 菜单click事件类型处理
    ToUserName = xml.findtext('ToUserName')  # 公众号openid
    FromUserName = xml.findtext('FromUserName')  # 关注者的openid
    event_key = xml.findtext('EventKey')

    if event_key == 'EV_DEV':  # 开发中
        msg = '正在建设中......'

    return remsg.get_text_msg(ToUserName, FromUserName, msg)


@wx_msg('text')
def text_msg(xml):
    to_user_name = xml.findtext('ToUserName')
    from_user_name = xml.findtext('FromUserName')  # 关注者的openid
    content = xml.findtext('Content')

    return remsg.get_text_msg(to_user_name, from_user_name, '你好!')

    # access_token = g.authorizer.get_authorizer_token()
    # # 测试发客户消息
    # data = {
    #     "touser": FromUserName,
    #     "msgtype": "text",
    #     "text": {
    #         "content": "你好！"
    #     }
    # }
    #
    # official_account.send_custom_msg(access_token, data)
