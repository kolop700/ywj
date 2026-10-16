from flask import g, request, session, url_for, redirect, abort, render_template
from flask_login import LoginManager, current_user
from flask_sqlalchemy import SQLAlchemy
from corks import app, cache
# from utils.obj_dict import ObjDict
import redis

rds = redis.StrictRedis.from_url(app.config['REDIS_URL'])

db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = '请先登录系统！'


@login_manager.user_loader
def load_user(user_id):
    if g.login_type == 'wx':  # 公众号登录
        from db.ad_models import AgencyProfile

        return AgencyProfile.query.get(int(user_id))


@login_manager.request_loader
def load_customer_from_request(req):
    """
    用户未登录时，会调到这里，否则会调用load_user
    """
    pass
    # from db.models.platform import WxUser
    #
    # if hasattr(g, 'session'):  # 小程序登录
    #     wx_user_id = g.session.wx_user_id
    #     return WxUser.query.get(wx_user_id)


@app.before_request
def before_request():
    g.login_type = session.get('login_type')

    full_path = request.full_path
    # session_id = request.values.get('_sid')
    if full_path.startswith('/wx'):  # 是公众号
        g.profile = current_user
        # 开发环境自动登录
        if app.debug and not g.profile.is_authenticated:
            dev_profile_id = app.config.get('DEV_PROFILE_ID')
            if dev_profile_id:
                from db.ad_models import AgencyProfile
                g.profile = AgencyProfile.query.get(dev_profile_id)
    elif g.login_type == 'admin':
        g.user = current_user
        g.INDEX_NAVS = app.config['ADMIN_NAVS']
