"""广告费结算表结构定义"""
from db import db
from sqlalchemy_utils import PasswordType, ChoiceType
from db.enums import *


# 停车订单
# class ParkingOrder(db.Model):
#     __tablename__ = 't_parking_order'
#
#     id = db.Column(db.Integer, primary_key=True)
#     no = db.Column(db.String(40), nullable=False, index=True, unique=True)
#     status = db.Column(ChoiceType(ParkingOrderStatus, impl=db.SmallInteger()),
#                        nullable=False, default=ParkingOrderStatus.UNPAID.value)
#     park_id = db.Column(db.String(40), nullable=False, index=True)  # 车场id
#     park_name = db.Column(db.String(40), nullable=False, default='')  # 车场名称
#     plate_number = db.Column(db.String(40), nullable=False, index=True)  # 车牌号
#     merchant_id = db.Column(db.String(32), index=True)  # 平台商家id
#     openid = db.Column(db.String(60), index=True)  # openid
#     discount_fee = db.Column(db.Numeric(12, 2), nullable=False)  # 折扣金额
#     total_fee = db.Column(db.Numeric(12, 2), nullable=False)  # 总金额
#     in_time = db.Column(db.DateTime)  # 进场时间
#     entrancegate_id = db.Column(db.String(40), nullable=False, default='')  # 进场通道id
#     exitgate_id = db.Column(db.String(40), nullable=False, default='')   # 出道通道id
#     car_size = db.Column(db.String(40), nullable=False, default='')   # 车型
#     exit_time = db.Column(db.DateTime)  # 出场时间
#     paid_time = db.Column(db.DateTime)  # 支付时间
#     notified = db.Column(db.Boolean, nullable=False, default=False)  # 是否已通知停车场平台
#     notified_time = db.Column(db.DateTime)  # 通知订车平台时间
#     create_time = db.Column(db.DateTime, default=db.func.now())  # 创建时间


# 机构(用户)信息表
class AgencyProfile(db.Model):
    __tablename__ = 't_agency_profile'

    id = db.Column(db.Integer, primary_key=True)
    age_id = db.Column(db.Integer, index=True, unique=True)
    age_ids = db.Column(db.String(2000), nullable=False)  # 以.分隔的上级用户id串
    status = db.Column(ChoiceType(AgencyStatus, impl=db.SmallInteger()),
                       nullable=False, default=AgencyStatus.ACTIVE)
    password = db.Column(db.String(64), nullable=False, default='')  # 运营账户密码，和原来用户那边一样直接明文了
    name = db.Column(db.String(30), nullable=False, default='')  # 户名
    bank = db.Column(db.String(30), nullable=False, default='')  # 开户行
    bankcard = db.Column(db.String(30), nullable=False, default='')  # 银行卡号
    remark = db.Column(db.String(500), nullable=False, default='')
    type = db.Column(ChoiceType(AgencyType, impl=db.SmallInteger()),
                     nullable=False, default=AgencyType.SUB)  # 先分润给下级，剩余的再和合作伙伴分
    last_seen = db.Column(db.DateTime)

    @property
    def is_authenticated(self):
        return self.status == AgencyStatus.ACTIVE

    @property
    def is_active(self):
        return self.is_authenticated

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)


# 机构(用户)提成比率配置表
class AgencyCommissionRatio(db.Model):
    __tablename__ = 't_agency_comm_ratio'
    __table_args__ = (db.UniqueConstraint('age_id', 'type'),)

    id = db.Column(db.Integer, primary_key=True)
    age_id = db.Column(db.Integer, index=True, nullable=False)
    type = db.Column(ChoiceType(CommissionType, impl=db.SmallInteger()), nullable=False)  # 提成类型
    ratio = db.Column(db.Numeric(5, 4), nullable=False, default=0)  # 返点比率


# 小区日开门汇总表
class OpenDoorSum(db.Model):
    __tablename__ = 't_opendoor_sum'
    __table_args__ = (db.UniqueConstraint('community_id', 'date', 'brand'),)

    id = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, nullable=False)  # 小区id
    date = db.Column(db.Date, nullable=False, index=True)
    brand = db.Column(db.SmallInteger, nullable=False, default=0)  # 品牌：0=星云 1=云卫家（与t_doorphone.appid对齐）
    age_ids = db.Column(db.String(1000), nullable=False, index=True)  # 由各级机构(用户)id以.分隔拼成的串，用于like检索
    count = db.Column(db.Integer, nullable=False, default=0)  # 开门次数
    wx_count = db.Column(db.Integer, nullable=False, default=0)  # 微信开门次数
    app_count = db.Column(db.Integer, nullable=False, default=0)  # app开门次数
    doorphone_count = db.Column(db.Integer, nullable=False, default=0)  # 设备数
    online_count = db.Column(db.Integer, nullable=False, default=0)  # 在线数
    create_time = db.Column(db.DateTime, default=db.func.now())  # 创建时间


# 提成录入表
class Commission(db.Model):
    __tablename__ = 't_commission'
    __table_args__ = (db.UniqueConstraint('date', 'type', 'brand'),)

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)  # 提成日期
    type = db.Column(ChoiceType(CommissionType, impl=db.SmallInteger()), nullable=False)  # 提成类型
    brand = db.Column(db.SmallInteger, nullable=False, default=0)  # 品牌：0=星云 1=云卫家
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    remark = db.Column(db.String(500), nullable=False, default='')
    input_age_id = db.Column(db.Integer)  # 录入人id
    input_age_name = db.Column(db.String(64), nullable=False, default='')  # 录入人姓名
    create_time = db.Column(db.DateTime, default=db.func.now())


# 用户提成记录表
class AgencyCommission(db.Model):
    __tablename__ = 't_agency_commission'
    __table_args__ = (db.UniqueConstraint('age_id', 'community_id', 'date', 'comm_type', 'type', 'brand'),)

    id = db.Column(db.Integer, primary_key=True)
    age_id = db.Column(db.Integer, nullable=False, index=True)
    parent_age_id = db.Column(db.Integer, index=True)  # 分配提成的上级用户id
    community_id = db.Column(db.Integer, nullable=False)  # 小区id
    date = db.Column(db.Date, nullable=False, index=True)
    brand = db.Column(db.SmallInteger, nullable=False, default=0)  # 品牌：0=星云 1=云卫家
    comm_type = db.Column(ChoiceType(AgencyCommissionType, impl=db.SmallInteger()), nullable=False)  # 用户角色
    type = db.Column(ChoiceType(CommissionType, impl=db.SmallInteger()), nullable=False)  # 提成类型
    src_amount = db.Column(db.Numeric(12, 2), nullable=False)  # 原金额
    ratio = db.Column(db.Numeric(5, 4), nullable=False, default=0)  # 提成比率
    amount = db.Column(db.Numeric(12, 2), nullable=False)  # 提成金额
    settle_order_id = db.Column(db.Integer, index=True)  # 结算单id
    create_time = db.Column(db.DateTime, default=db.func.now())


# 结算单
class AgencySettleOrder(db.Model):
    __tablename__ = 't_agency_settle_order'

    id = db.Column(db.Integer, primary_key=True)
    age_id = db.Column(db.Integer, index=True)
    no = db.Column(db.String(40), nullable=False, index=True, unique=True)
    date = db.Column(db.Date, nullable=False)  # 截止日期
    amount = db.Column(db.Numeric(12, 2), nullable=False)  # 金额
    status = db.Column(ChoiceType(SettleStatus, impl=db.SmallInteger()), nullable=False,
                       default=SettleStatus.PENDING)  # 结算状态
    settle_time = db.Column(db.DateTime)  # 结算时间
    remark = db.Column(db.String(500), nullable=False, default='')
    settle_age_id = db.Column(db.Integer)  # 结算人id
    settle_age_name = db.Column(db.String(64), nullable=False, default='')  # 结算人姓名
    create_time = db.Column(db.DateTime, default=db.func.now(), index=True)


# 结算记录
class AgencySettleRecord(db.Model):
    __tablename__ = 't_agency_settle_record'

    id = db.Column(db.Integer, primary_key=True)
    settle_order_id = db.Column(db.Integer, index=True)  # 结算单id
    age_id = db.Column(db.Integer, index=True)
    age_name = db.Column(db.String(64), nullable=False, default='')
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    name = db.Column(db.String(30), nullable=False, default='')  # 姓名
    bank = db.Column(db.String(30), nullable=False, default='')  # 开户行
    bankcard = db.Column(db.String(30), nullable=False, default='')  # 银行卡号


# Taku广告展示收益明细（S2S回调累计）
class TakuAdIncome(db.Model):
    __tablename__ = 't_taku_ad_income'
    __table_args__ = (db.UniqueConstraint('req_id', 'adsource_id'),)

    id = db.Column(db.Integer, primary_key=True)
    req_id = db.Column(db.String(64), nullable=False)  # Taku回调唯一id（与adsource_id联合去重）
    adsource_id = db.Column(db.Integer, nullable=False)  # 广告源id
    brand = db.Column(db.SmallInteger, nullable=False, default=1)  # 品牌：Taku目前仅云卫家App接入，默认1
    user_id = db.Column(db.String(64), nullable=False, default='')  # 回调携带的开发者用户标识
    adformat = db.Column(db.SmallInteger(), nullable=False, default=0)  # 0Native/1激励/2Banner/3插屏/4开屏
    placement_id = db.Column(db.String(64), nullable=False, default='')  # Taku广告位id
    nw_firm_id = db.Column(db.Integer, nullable=False, default=0)  # 三方广告平台id
    adsource_price = db.Column(db.Numeric(12, 4), nullable=False, default=0)  # ECPM（美元），单次展示ecpm
    currency = db.Column(db.String(8), nullable=False, default='USD')  # 货币单位
    geo_short = db.Column(db.String(8), nullable=False, default='')  # 国家短码
    package_name = db.Column(db.String(64), nullable=False, default='', index=True)  # 应用包名
    client_ip = db.Column(db.String(46), nullable=False, default='')  # 用户ip
    show_custom_ext = db.Column(db.String(500), nullable=False, default='')  # 展示自定义扩展参数
    show_time = db.Column(db.DateTime)  # 展示时间（北京时间）
    income_date = db.Column(db.Date, nullable=False, index=True)  # 归属日期（北京时间，按天汇总用）
    raw_data = db.Column(db.String(1000), nullable=False, default='')  # 原始回调参数留档
    create_time = db.Column(db.DateTime, default=db.func.now())  # 创建时间


# 微信小程序流量主收益（接口拉取，按广告位类型日汇总）
class WxAdIncome(db.Model):
    __tablename__ = 't_wxad_income'
    __table_args__ = (db.UniqueConstraint('income_date', 'ad_slot', 'brand'),)

    id = db.Column(db.Integer, primary_key=True)
    income_date = db.Column(db.Date, nullable=False, index=True)  # 数据日期
    brand = db.Column(db.SmallInteger, nullable=False, default=0)  # 品牌：0=星云小程序 1=云卫家小程序
    ad_slot = db.Column(db.String(64), nullable=False, default='')  # 广告位类型（如SLOT_ID_WEAPP_BANNER）
    req_succ_count = db.Column(db.BigInteger, nullable=False, default=0)  # 拉取量
    exposure_count = db.Column(db.BigInteger, nullable=False, default=0)  # 曝光量
    click_count = db.Column(db.BigInteger, nullable=False, default=0)  # 点击量
    income_fen = db.Column(db.BigInteger, nullable=False, default=0)  # 收入（分）
    ecpm_fen = db.Column(db.Numeric(16, 4), nullable=False, default=0)  # 千次曝光收益（分）
    create_time = db.Column(db.DateTime, default=db.func.now())  # 创建时间
    update_time = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())  # 更新时间
