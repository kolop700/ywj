"""公众号网页入口"""
from flask import request, render_template, g, abort
from corks import app
from corks.utils import log
from db import db
from db.enums import *
from flask_login import current_user, logout_user
from wx import official_account_web
from common import wx
from . import make_bp

bp = make_bp('official_account_main', __name__)
_logger = log.get_logger('oa_main', __name__)


@bp.route('/logout')
def logout():
    logout_user()
    return '已退出登录'


@bp.route('/agreement')
def agreement():  # 用户协议
    return render_template('agreement.html')


@bp.route('/test', methods=['GET', 'POST'])
#@wx.oauth2()
def test():
    #appid = app.config['OA_APPID']
    #secret = app.config['OA_APPSECRET']
    #url = urllib.parse.urljoin(app.config['BASE_URL'], request.full_path)

    return render_template('test.html')

    #return 'test <br/><a href="http://wx.hznyfzjt.com/wx/logout">退出登录</a>'


@bp.route('/test_pay', methods=['GET', 'POST'])
@wx.oauth2()
def test_pay():
    return render_template('test_js-sdk.html')


@bp.route('/')
@bp.route('/pages/<path:p>')  # 兼容前端history路由模式
@wx.oauth2(scope='snsapi_userinfo')
def index(p=''):  # 公众号首页
    return render_template('index.html')


app.register_blueprint(bp)
