"""公众号网页相关接口"""
from corks import cache
from wx import common
from . import api
import urllib.parse
import hashlib
import uuid
import time


# 第三方网页授权uri
_url_oauth2 = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid={appid}&redirect_uri={redirect_uri}' \
              '&response_type=code&scope={scope}&state={state}#wechat_redirec'

# 取access_token
_url_access_token = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid={appid}&secret={secret}' \
                    '&code={code}&grant_type=authorization_code'

# 刷新access_token
_url_refresh_token = 'https://api.weixin.qq.com/sns/oauth2/refresh_token?appid={appid}' \
                     '&grant_type=refresh_token&refresh_token={refresh_token}'

# 取用户信息
_url_get_userinfo = 'https://api.weixin.qq.com/sns/userinfo?access_token={access_token}' \
                    '&openid={openid}&lang=zh_CN'


# 取ticket
_url_get_jsticket = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token={access_token}&type=jsapi'


def make_oauth2_uri(appid, redirect_uri, scope='snsapi_base', state=''):
    """
    生成授权url地址
    @param appid:
    @param redirect_uri: 授权后跳转的地址
    @param scope: 授权类型 snsapi_base: 只取openid snsapi_userinfo:取用户信息
    @param state: 重定向后会带上state参数，开发者可以填写a-zA-Z0-9的参数值，最多128字节
    """
    return _url_oauth2.format(
        appid=appid,
        redirect_uri=urllib.parse.quote(redirect_uri),
        scope=scope,
        state=state
    )


def get_access_token(appid, secret, code):
    """
    取网页access_token
    @param appid:
    @param secret:
    @param code: 授权跳转带回来的
    @return:
        {
            access_token: xxx,
            expires_in: xx,
            refresh_token: xx,
            openid: xxx,
            unionid: xx,
            scope: xxx
        }
    """
    url = _url_access_token.format(appid=appid, secret=secret, code=code)
    try:
        res = api.call(url, method='GET')
        # 这里不要缓存refresh_token和access_token，因为这个给每个用户返回openid，每个用户返回的都不一样
        return res
    except Exception as e:
        raise Exception(f'获取微信web access_token出错:{e}')


def refresh_token(appid, refresh_token):
    """
    刷新access_token
    @param appid:
    @param refresh_token:
    @return:
    """
    url = _url_refresh_token.format(appid=appid, refresh_token=refresh_token)
    return api.call(url, method='GET')


def get_userinfo(access_token, openid):
    """
    取用户信息
    @param access_token:
    @param openid:
    @return:
    """
    url = _url_get_userinfo.format(access_token=access_token, openid=openid)
    return api.call(url, method='GET', json_encoding='utf-8')  # 指定json编码，解决乱码问题
                                                                # (接口返回的是ISO-8859-1编码，实际是utf-8导致乱码)


def get_jsticket(access_token):
    """
    取jsticket。注意，access_token是common.get_access_token取得的token!
    @param access_token:
    @return:
    """
    cache_key = f'jsticket:{access_token}'
    ticket = cache.get(cache_key)
    if ticket:
        return ticket

    url = _url_get_jsticket.format(access_token=access_token)
    try:
        res = api.call(url, method='GET')
        ticket = res['ticket']
        expires_in = res['expires_in']

        # 缓存
        cache.set(cache_key, ticket, timeout=int(expires_in))
        return ticket
    except Exception as e:
        raise Exception(f'取jsticket出错：{e}')


def get_wx_config(appid, secret, url):
    """
    生成页面wx.config需要的参数
    @param appid:
    @param secret:
    @param url: 当前页面的url地址，不包含#后面的内容
    @return:
        {
            'appId': xx,
            'timestamp': xx,
            'nonceStr': xx,
            'signature': xx
        }
    """
    access_token = common.get_access_token(appid, secret)
    # 取jsticket
    ticket = get_jsticket(access_token)
    # 生成签名
    noncestr = uuid.uuid4().hex
    timestamp = int(time.time())
    raw = f'jsapi_ticket={ticket}&noncestr={noncestr}&timestamp={timestamp}&url={url}'
    sign = hashlib.sha1(raw.encode()).hexdigest()

    return {
        'appId': appid,
        'timestamp': timestamp,
        'nonceStr': noncestr,
        'signature': sign
    }
