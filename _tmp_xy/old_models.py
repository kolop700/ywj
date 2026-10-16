"""原数据库有的表"""
from db import db
from sqlalchemy_utils import PasswordType, ChoiceType
from db.enums import *


# 开门记录(旧)
class Record(db.Model):
    __tablename__ = 't_record'

    record_id = db.Column(db.Integer, primary_key=True)
    door_mac = db.Column(db.String(36), nullable=False, default='')
    user_id = db.Column(db.Integer, nullable=False)
    user_card = db.Column(db.String(8), nullable=False, default='')
    acess_type = db.Column(db.SmallInteger(), nullable=False)  # 0.刷卡;1.远程;2.刷脸;3.密码;4.临时密码;5.二维码;6.微信扫码;7.后台;
    record_time = db.Column(db.DateTime, nullable=False)


# 免授权开门记录
class WxRecord(db.Model):
    __tablename__ = 't_wx_record'

    record_id = db.Column(db.Integer, primary_key=True)
    door_mac = db.Column(db.String(36), nullable=False, default='')
    wxu_id = db.Column(db.Integer, nullable=False)
    record_time = db.Column(db.DateTime, nullable=False)


# 机构(用户)表(旧)
class Agency(db.Model):
    __tablename__ = 't_sys_agency'

    age_id = db.Column(db.Integer, primary_key=True)
    parent_age_id = db.Column(db.Integer)  # 为114时为自注册用户，不用管
    age_name = db.Column(db.String(64), nullable=False, default='')
    age_type = db.Column(db.SmallInteger(), nullable=False, default=1)
    age_password = db.Column(db.String(64), nullable=False, default='')
    remark = db.Column(db.String(255), nullable=False, default='')


# 小区表(旧)
class Community(db.Model):
    __tablename__ = 't_community'

    comm_id = db.Column(db.Integer, primary_key=True)
    comm_name = db.Column(db.String(64), nullable=False, default='')
    age_id = db.Column(db.Integer, nullable=False)


# 设备表(旧)
class DoorPhone(db.Model):
    __tablename__ = 't_doorphone'

    door_id = db.Column(db.Integer, primary_key=True)
    door_type = db.Column(db.SmallInteger(), nullable=False)
    door_mac = db.Column(db.String(36), nullable=False, default='')
    door_name = db.Column(db.String(64), nullable=False, default='')
    community_id = db.Column(db.Integer, nullable=False)  # 小区id
    sim_ccid = db.Column(db.String(50))  # 流量卡iccid
    appid = db.Column(db.SmallInteger, nullable=False, default=0)  # 品牌归属：0=星云小卫(存量默认) 1=云卫家，auto_sum 排除此值
    # age_id = db.Column(db.Integer, nullable=False)  # 不用这个，通过小区那个


# 短信模板信息(旧)
class SignSMS(db.Model):
    __tablename__ = 't_sign_sms'

    door_id = db.Column(db.Integer, primary_key=True)
    sign_template_code = db.Column(db.String(255), nullable=False, default='')
    sign_name = db.Column(db.String(255), nullable=False, default='')
    sign_appid = db.Column(db.String(255), nullable=False, default='')
    sign_secret = db.Column(db.String(255), nullable=False, default='')
    ali_accessKeyId = db.Column(db.String(255), nullable=False, default='')
    ali_accessKeySecret = db.Column(db.String(255), nullable=False, default='')
    remark = db.Column(db.String(255), nullable=False, default='')
