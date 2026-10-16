"""账号登录、注册相关"""
from flask import g, session
from corks import app, api, cache
from flask_login import logout_user, current_user
from corks.utils import db_util, log
from common import business
from utils import trans
# from sqlalchemy.exc import IntegrityError
from db.old_models import *
from db.ad_models import *
from db.enums import *
from db import db
from . import auth, make_token


API_MODULE_NAME = '用户账号'
API_URL_PREFIX = 'wx/user'
API_MODULE_AUTH = auth


_logger = log.get_logger('user', __name__)


def _get_userinfo(age_id):
    """
    返回用户信息
    :param age_id:
    :return:
    """
    row = db.session.query(
        Agency.age_id,
        Agency.age_name,
        Agency.parent_age_id,
        AgencyProfile.type
    ).outerjoin(
        AgencyProfile,
        AgencyProfile.age_id == Agency.age_id
    ).filter(
        Agency.age_id == age_id
    ).first()
    if not row:
        raise Exception(f'获取用户信息失败!(id={age_id})')

    result = db_util.row_to_dict(row)
    result['is_admin'] = row.age_id in app.config['ROOT_AGE_IDS']
    return result


@api.arg('token', '登录令牌')
@api.route('/cur_userinfo')
def cur_userinfo(args):
    """
    取当前登录的用户信息。公众号访问时，如果用户注册过，本接口将直接返回用户信息
    :return:
        // 已登录返回
        {
            "age_id": xx,
            "age_name": xx,
            "is_admin": xx, // 是否是管理员
            "token":xxx // 登录令牌。微信公众号自动通过openid登录，不用调用login接口登录，也可通过本接口取得token
            "expires_in": xx // token过期时间(秒)
        }
        // 未登录将报错
    """
    userinfo = _get_userinfo(g.age_id)
    if args.token:
        token = args.token
        expires_in = 0
    elif g.age_id:  # 如果已微信授权登录，生成一个token
        token_info = make_token(
            age_id=g.age_id,
            is_admin=g.is_admin,
            type=g.type
        )
        token = token_info['token']
        expires_in = token_info['expires_in']

    userinfo['token'] = token
    userinfo['expires_in'] = expires_in
    return userinfo


@api.arg('user_name', '用户名', required=True, type=api.String(allow_empty=False))
@api.arg('password', '密码')
@api.route('/login', methods=['POST'])
@api.auth_exempt
def user_login(args):
    """
    用户登录
    :return:
        // 登录成功返回(和cur_userinfo接口返回一样)
        {
            "age_id": xx,
            "age_name": xx,
            "is_admin": xx, // 是否是管理员
            "token":xxx, // 登录令牌
            "expires_in": xx // token过期时间(秒)
        }
    """
    agency = db.session.query(
        Agency.age_id,
        Agency.parent_age_id,
        Agency.age_name,
        Agency.age_password
    ).filter(
        Agency.age_name == args.user_name
    ).first()
    if not agency:
        raise Exception('账号不存在')

    if agency.age_password != args.password:
        raise Exception('密码错误')

    userinfo = _get_userinfo(agency.age_id)
    # 创建profile
    profile = AgencyProfile.query.filter_by(age_id=agency.age_id).first()
    if profile:
        if profile.status != AgencyStatus.ACTIVE:
            raise Exception(f'用户状态为[{profile.status.label}]，不能登录')

        # if profile.password != args.password:
        #     raise Exception('密码错误')
    else:
        profile = AgencyProfile(
            age_id=agency.age_id,
            status=AgencyStatus.ACTIVE  # if userinfo['is_admin'] else AgencyStatus.DISABLE  # 第一次登录，只有管理员可登录
        )
    # 更新
    profile.password = args.password
    profile.age_ids = business.get_parent_age_ids(agency.age_id)
    profile.last_seen = db.func.now()
    db.session.add(profile)
    db.session.commit()

    if profile.status != AgencyStatus.ACTIVE:
        raise Exception(f'您的账号状态为[{profile.status.label}]，不能登录！')

    if g.login_type == 'wx':  # 微信公众号登录
        openid = session.get('openid')
        if openid:
            login_session_key = f'login:{openid}'
            cache.set(login_session_key, profile.id, timeout=15552000)  # 半年有效期

    # 登录成功
    token_info = make_token(
        age_id=userinfo['age_id'],
        is_admin=userinfo['is_admin'],
        type=userinfo['type']
    )
    userinfo['token'] = token_info['token']
    userinfo['expires_in'] = token_info['expires_in']
    return userinfo


@api.arg('token', '登录令牌', required=True)
@api.route('/logout')
def logout(args):
    """
    退出登录
    :return:
    """
    if args.token:
        cache.delete(args.token)

    if g.login_type == 'wx':  # 微信公众号登录
        openid = session.get('openid')
        if openid:
            login_session_key = f'login:{openid}'
            cache.delete(login_session_key)

    logout_user()


@api.arg('token', '登录令牌', required=True)
@api.arg('age_name', '账号', required=True)
@api.arg('old_password', '旧密码')
@api.arg('new_password', '新密码', required=True, type=api.String(strip=False, allow_empty=False))
@api.arg('confirm_password', '确认密码', required=True, type=api.String(strip=False, allow_empty=False))
@api.route('/update_password', methods=['POST'])
def update_password(args):
    """
    修改密码。可以按手机验证码或旧密码来修改，两者必烦传一个
    :return:
    """
    if args.new_password != args.confirm_password:
        raise Exception('密码前后不一致')

    user = Agency.query.filter_by(age_name=args.age_name).first()
    if not user:
        raise Exception('账号不存在')

    # 验证旧密码
    if not args.old_password:
        raise Exception('旧密码和手机验证码必须传一个！')

    if user.age_password != args.old_password:
        raise Exception('旧密码错误')

    # 修改密码
    user.age_password = args.new_password
    db.session.add(user)
    db.session.commit()


@api.route('/get_profile')
def get_profile(args):
    """
    取用户资料
    """
    profile = db.session.query(
        AgencyProfile.id,
        AgencyProfile.bank,
        AgencyProfile.name,
        AgencyProfile.bankcard
    ).filter(
        AgencyProfile.age_id == g.age_id
    ).first()
    if not profile:
        raise Exception(f'用户资料不存在(id={args.age_id})')

    return profile


@api.arg('bank', '开户行', required=True, type=api.String())
@api.arg('name', '银行账户', required=True, type=api.String())
@api.arg('bankcard', '银行卡号', required=True, type=api.String())
@api.route('/set_profile', methods=['POST'])
@trans.auto
def set_profile(args):
    """
    保存用户资料
    """
    AgencyProfile.query.filter_by(age_id=g.age_id).update({
        'bank': args.bank,
        'name': args.name,
        'bankcard': args.bankcard
    }, synchronize_session=False)
