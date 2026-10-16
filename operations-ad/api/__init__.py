"""接口定义"""
from flask import request, g
from corks import app, cache, error
# from flask_login import current_user
from db.old_models import *
from db import db
import nanoid

# token过期时间
TOKEN_TIMEOUT = 60 * 60 * 2


def get_token_info(token):
    """
    取token信息
    @param token:
    @return:
        {
            'age_id': xx
        }
    """
    if token:  # 接口登录
        token_info = cache.get(token)
        if token_info:  # 如token已存在，延长过期时间
            cache.set(token, token_info, timeout=TOKEN_TIMEOUT)
            return token_info

    # 微信授权登录
    if hasattr(g, 'profile') and g.profile.is_authenticated and g.profile.age_id:
        # agency = db.session.query(
        #     Agency.age_name,
        #     Agency.parent_age_id
        # ).filter_by(age_id=g.profile.age_id).first()
        # if not agency:
        #     raise Exception(f'用户不存在(id={g.profile.age_id})')

        return {
            'age_id': g.profile.age_id,
            'is_admin': g.profile.age_id in app.config['ROOT_AGE_IDS'],  # agency.parent_age_id == 0
            'type': g.profile.type
        }
    elif g.login_type == 'admin' and g.user.is_authenticated:  # 后台登录
        return {}


def make_token(**kwargs):
    """
    生成token
    @param kwargs:
    @return:
        {
            'token': xxx,  # token
            'expires_in': xx  # 过期时间
        }
    """
    token = nanoid.generate()
    cache.set(token, kwargs, timeout=TOKEN_TIMEOUT)
    return {
        'token': token,
        'expires_in': TOKEN_TIMEOUT
    }


def auth():
    """接口用户认证"""
    # 原有的验证逻辑
    token = request.values.get('token')
    if not token and request.is_json:
        js = request.get_json(silent=True)
        if js:
            token = js.get('token')

    token_info = get_token_info(token)
    if token_info is None:
        raise Exception(error.AUTH, '请先登录')

    for key, value in token_info.items():
        setattr(g, key, value)
    return True
