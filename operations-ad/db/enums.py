"""关枚举型"""
# 不用corks.utils.types里的LabelEnum是因为那样config.py会依赖corks包，
# 一些独立项目如websocket服务端引用config.py，但不需要corks包
from corks.utils.types import LabelEnum


# 停车订单状态
class ParkingOrderStatus(LabelEnum):
    UNPAID = 0, '待支付'
    PAID = 1, '已支付'


# 收入/分佣类型
class CommissionType(LabelEnum):
    PLATFORM = 0, '平台'  # 平台分佣，只用于分佣，不作收入
    AD = 1, '小程序日活收入'  # 广告收入
    # PARKING_FEE = 2, '停车费收入'
    APP_AD = 3, 'APP日活收入'


# 结算状态
class SettleStatus(LabelEnum):
    PENDING = 0, '未结算'
    SETTLED = 1, '已结算'


# 用户类型
class AgencyType(LabelEnum):
    SUB = 0, '下级'
    PARTNER = 1, '伙伴'


# 用户状态
class AgencyStatus(LabelEnum):
    DISABLE = 0, '未启用'
    ACTIVE = 1, '已启用'


# 用户提成类型
class AgencyCommissionType(LabelEnum):
    SUB = 0, '作为下级提成'
    PARTNER = 1, '作为合作伙伴提成'
    SELF = 2, '自己得到的下级小区分成'
    PLATFORM = 3, '平台分佣'


# 小程序类型
class MiniprogramType(LabelEnum):
    ACCESS = 0, '门禁版'
    COMMUNITY = 1, '社区版'


# 授权状态
class AuthStatus(LabelEnum):
    UNAUTH = 0, '未授权'
    AUTHED = 1, '已授权'


# 分配状态
class AssignStatus(LabelEnum):
    UNASSIGN = 0, '未分配'
    ASSIGNED = 1, '已分配'


# 呼叫模式
class CallMode(LabelEnum):
    CALL_BY_NO = 0, '呼叫房号'
    CALL_ADMIN = 1, '一键直呼'
