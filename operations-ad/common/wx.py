"""微信公众号的一些包装"""
import db
from flask import request, redirect, session, render_template, make_response
from corks import app, api, cache
from flask_login import current_user, login_user
from wx import official_account_web, common, official_account
from datetime import timedelta
from db.ad_models import *
import urllib.parse
import functools


API_MODULE_NAME = '公众号'
API_URL_PREFIX = 'api/wx'


@api.arg('page_url', '调用页面的完整url地址，不包括#后面的部分', required=True)
@api.route('/get_wx_config')
@api.auth_exempt
def get_wx_config(args):
    """
    生成前端wx.config需要的参数
    :return:
        {
            "appId": xx,
            "timestamp": xx,
            "nonceStr":xx,
            "signature":xx
        }
    """
    appid = app.config['OA_APPID']
    secret = app.config['OA_APPSECRET']
    return official_account_web.get_wx_config(appid, secret, args.page_url)


@api.arg('data', '二维码数据', required=True)
@api.route('/make_qrcode')
@api.auth_exempt
def make_qrcode(args):
    """
    生成二维码图片
    """
    from . import func
    qrdata = func.make_qrcode(args.data)

    response = make_response(qrdata)
    response.headers['Content-Type'] = 'image/png'
    #response.headers['Content-Disposition'] = 'attachment; filename=qrcode.png'
    return response


def oauth2(scope='snsapi_base', state=''):
    """
    微信授权装饰器。成功后会在g对象绑定个account，即微信账户信息
    @param scope: 授权类型 snsapi_base: 只取openid snsapi_userinfo:取用户信息
    @param state: 重定向后会带上state参数，开发者可以填写a-zA-Z0-9的参数值，最多128字节
    """
    def wrap_func(func):

        @functools.wraps(func)
        def inner_func(*args, **kwargs):
            code = request.args.get('code')
            introducer_id = request.args.get('introducer_id')

            if introducer_id:  # 会员转发的用户id
                session['introducer_id'] = introducer_id

            if current_user.is_authenticated:
                return func(*args, **kwargs)

            appid = app.config['OA_APPID']
            secret = app.config['OA_APPSECRET']
            base_url = app.config['BASE_URL']
            if code:
                openid = None
                try:
                    res = official_account_web.get_access_token(appid, secret, code)
                    openid = res['openid']
                except Exception as e:
                    print(e)

                # unionid = res.get('unionid')
                # access_token = res['access_token']
                login_session_key = f'login:{openid}'
                profile_id = cache.get(login_session_key)
                profile = None
                if profile_id:
                    profile = AgencyProfile.query.get(profile_id)

                # if not profile:
                #     oa_name = app.config['OA_NAME']
                #     return render_template('follow.html', msg=f'请先关注[{oa_name}]公众号！如您已经关注了，请取消关注再重新关注一下。')

                # 获取、更新个人信息
                # if scope == 'snsapi_userinfo':
                #     user_info = official_account_web.get_userinfo(access_token, openid)
                #     profile.nickname = user_info['nickname']
                #     profile.gender = user_info['sex']
                #     profile.city = user_info['city']
                #     profile.province = user_info['province']
                #     profile.country = user_info['country']
                #     profile.avatar_url = user_info['headimgurl']

                # 更新last_seen
                # profile.last_seen = db.func.now()
                # db.session.add(profile)
                # db.session.commit()
                # 登录
                if profile:
                    if login_user(profile, duration=timedelta(days=1)):
                        # 延长登录session时间
                        cache.set(login_session_key, profile.id, timeout=15552000)  # 半年有效期
                        # 更新lastseen
                        profile.last_seen = db.func.now()
                        db.session.add(profile)
                        db.session.commit()
                    else:
                        return render_template('msg.html', msg='账号已失效')

                session['login_type'] = 'wx'
                if openid:
                    session['openid'] = openid

                return func(*args, **kwargs)
            else:  # 没有code，说明不是从微信授权转过来，跳转到微信授权页
                redirect_uri = urllib.parse.urljoin(base_url, request.full_path)
                oauth2_uri = official_account_web.make_oauth2_uri(appid, redirect_uri, scope, state)
                return redirect(oauth2_uri)

        return inner_func
    return wrap_func


def push_charching_stop_msg(openid, order_no, amount, start_time, end_time, stop_reason):
    """
    推送充电停止消息
    @param openid:
    @param order_no:
    @param amount:
    @param start_time:
    @param end_time:
    @param stop_reason:
    @return:
    """
    data = {
           "touser": openid,
           "template_id": "c1KIvN9uPrdNRZh377tabpx54LrAIsexaPt_SaHdZcE",
           "url": "http://er.guodian.com.cn/wx/pages/order/order?status=2",
           "data":{
                   "first": {
                       "value": "充电已停止！",
                       "color": "#173177"
                   },
                   "keyword1":{
                       "value": order_no,
                       "color": "#173177"
                   },
                   "keyword2": {
                       "value": f"{amount}元",
                       "color": "#173177"
                   },
                   "keyword3": {
                       "value": f"{start_time}",
                       "color": "#173177"
                   },
                   "keyword4": {
                       "value": f"{end_time}",
                       "color": "#173177"
                   },
                   "remark": {
                       "value": f"停止原因：{stop_reason}",
                       "color": "#173177"
                   }
           }
       }
    access_token = common.get_access_token(app.config['OA_APPID'], app.config['OA_APPSECRET'])
    official_account.message_send_template(access_token, data)