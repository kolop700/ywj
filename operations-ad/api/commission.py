"""佣金分润相关接口"""
from flask import g, request, Response
from corks import app, api
from corks.utils import log, db_util
from sqlalchemy.exc import IntegrityError
from datetime import date, timedelta
from utils import trans
from common import business, func
# from decimal import Decimal
from db.old_models import *
from db.ad_models import *
from db.enums import *
from . import auth
from db import db

API_MODULE_NAME = '佣金'
API_URL_PREFIX = 'wx/comm'
API_MODULE_AUTH = auth

_logger = log.get_logger('commission', __name__)


def _qry_agency_commission(start_date, end_date, brand=0):
    """查询用户提成，返回以类型+日期为key的字典（按品牌隔离）"""
    if g.is_admin:  # 是管理员
        qry = db.session.query(
            Commission.type,
            Commission.date,
            db.func.sum(Commission.amount).label('amount')
        ).filter(
            Commission.date >= start_date,
            Commission.date <= end_date,
            Commission.brand == brand,
            Commission.input_age_id == g.age_id
        ).group_by(
            Commission.type,
            Commission.date
        )
    else:  # 普通用户
        qry = db.session.query(
            AgencyCommission.type,
            AgencyCommission.date,
            db.func.sum(AgencyCommission.amount).label('amount')
        ).filter(
            AgencyCommission.date >= start_date,
            AgencyCommission.date <= end_date,
            AgencyCommission.brand == brand,
            AgencyCommission.age_id == g.age_id
        ).group_by(
            AgencyCommission.type,
            AgencyCommission.date
        )

    result = {}
    for row in qry:
        d = row.date.strftime('%Y%m%d')
        key = f'{row.type.value}_{d}'
        result[key] = row.amount

    return result


def _qry_open_door_count(age_id, start_date, end_date, brand=0):
    """查用户下面的小区的每天总日活（按品牌隔离）"""
    # 取age_ids
    age_ids = db.session.query(AgencyProfile.age_ids).filter_by(age_id=age_id).scalar()
    qry = db.session.query(
        OpenDoorSum.date,
        db.func.sum(OpenDoorSum.count).label('count')
    ).filter(
        OpenDoorSum.age_ids.like(f'{age_ids}%'),
        OpenDoorSum.brand == brand,
        OpenDoorSum.date >= start_date,
        OpenDoorSum.date <= end_date
    ).group_by(
        OpenDoorSum.date
    )
    result = {}
    for row in qry:
        result[row.date] = row.count

    return result


@api.arg('token', '登录令牌', required=True)
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=0)
@api.route('/index_info')
def index_info(args):
    """
    取首页信息
    """
    brand = args.brand
    yesterday = date.today() - timedelta(days=1)
    # 上级待结金额
    if g.is_admin:  # 管理员没有上级
        unsettled_amount = 0
    else:
        unsettled_amount = db.session.query(
            db.func.sum(AgencyCommission.amount)
        ).outerjoin(
            AgencySettleOrder,
            AgencySettleOrder.id == AgencyCommission.settle_order_id
        ).filter(
            AgencyCommission.age_id == g.age_id,
            AgencyCommission.brand == brand,
            db.func.ifnull(AgencySettleOrder.status, SettleStatus.PENDING.value) != SettleStatus.SETTLED.value
        ).scalar() or 0
    # 昨日收入
    if g.is_admin:
        qry_yesterday_amount = db.session.query(
            db.func.sum(Commission.amount)
        ).filter(
            Commission.date == yesterday,
            Commission.brand == brand
        )
    else:
        qry_yesterday_amount = db.session.query(
            db.func.sum(AgencyCommission.amount)
        ).filter(
            AgencyCommission.date == yesterday,
            AgencyCommission.brand == brand,
            AgencyCommission.age_id == g.age_id
        )

    yesterday_amount = qry_yesterday_amount.scalar() or 0
    # 本年累计
    if g.is_admin:
        qry_this_year_total = db.session.query(
            db.func.sum(Commission.amount)
        ).filter(
            Commission.date >= date(yesterday.year, 1, 1),
            Commission.brand == brand
        )
    else:
        qry_this_year_total = db.session.query(
            db.func.sum(AgencyCommission.amount)
        ).filter(
            AgencyCommission.age_id == g.age_id,
            AgencyCommission.brand == brand,
            AgencyCommission.date >= date(yesterday.year, 1, 1)
        )

    this_year_total = qry_this_year_total.scalar() or 0

    # 待下级待分金额
    unallocated_amount = db.session.query(
        db.func.sum(AgencyCommission.amount)
    ).outerjoin(
        AgencySettleOrder,
        AgencySettleOrder.id == AgencyCommission.settle_order_id
    ).filter(
        AgencyCommission.parent_age_id == g.age_id,
        AgencyCommission.brand == brand,
        db.func.ifnull(AgencySettleOrder.status, SettleStatus.PENDING.value) != SettleStatus.SETTLED.value
    ).scalar() or 0

    days = 9  # 显示近几天数据
    start_date = yesterday - timedelta(days=days)
    # 取用户日活
    if g.type == AgencyType.PARTNER:  # 是合伙人的话，日活数据取上级的
        age_id = db.session.query(Agency.parent_age_id).filter(
            Agency.age_id == g.age_id
        ).scalar()
    else:
        age_id = g.age_id
    open_door_dict = _qry_open_door_count(age_id=age_id, start_date=start_date, end_date=yesterday, brand=brand)
    # 取用收入曲线数据
    agency_comm_dict = _qry_agency_commission(start_date=start_date, end_date=yesterday, brand=brand)

    # print('****', agency_comm_dict)
    # 取日期串
    dates = []
    sdate = start_date
    series_data = {}
    open_door_data = []
    while sdate <= yesterday:
        dates.append(sdate.strftime('%m-%d'))
        # 日活数据
        open_door_data.append(open_door_dict.get(sdate, 0))
        # 组装
        for it in CommissionType:
            if it.value <= 0 and not g.is_admin:  # 小于等于0的项目属于平台项目，只有管理员才有
                continue
            # 收入数据
            d = sdate.strftime('%Y%m%d')
            key = f'{it.value}_{d}'
            value = agency_comm_dict.get(key, 0)
            if it not in series_data:
                series_data[it] = []

            series_data[it].append(value)

        sdate = sdate + timedelta(days=1)

    # 生成
    series = []
    legend_data = ['日活']  # 图例
    # 加入日活数据
    series.append({
        'name': '日活',
        'data': open_door_data,
        'type': 'bar',
        'smooth': True,
        'emphasis': {
            'focus': 'series'
        },
        'yAxisIndex': 0,
    })
    # 加入收入数据
    for k, v in series_data.items():
        legend_data.append(k.label)
        series.append({
            'name': k.label,
            'data': v,
            'type': 'line',  # bar
            'smooth': True,
            'emphasis': {
                'focus': 'series'
            },
            'yAxisIndex': 1,
        })

    charts = {
        'grid': {
            'left': '2%',
            'right': '2%',
            'bottom': '7%',
            'top': '20%',
            'containLabel': True
        },
        # 'title': {
        #     'text': f'近{days}天收入情况  {{label|总收入: 100.00元}}',
        #     'left': 'center',
        #     'textStyle': {
        #         'rich': {
        #             'label': {
        #                 'color': '#fff',
        #                 'borderRadius': 2,
        #                 'backgroundColor': '#469688',
        #                 'padding': [5, 10]
        #             }
        #         }
        #     }
        # },
        'tooltip': {
            'show': True
        },
        'legend': {  # 图例
            'top': 0,
            'data': legend_data
        },
        'xAxis': {
            'type': 'category',
            'boundaryGap': False,
            'data': dates
        },
        'yAxis': [
            {
                'name': '日活(次)',
                'type': 'value'
            },
            {
                'name': '金额(元)',
                'type': 'value'
            },
        ],
        'series': series
    }
    return {
        'info': {
            'yesterday_amount': yesterday_amount,  # 昨日收入
            'this_year_total': this_year_total,  # 本年累计
            'unsettled_amount': unsettled_amount,  # 待结算金额
            'unallocated_amount': unallocated_amount  # 待分润金额
        },
        'charts': charts
    }


@api.route('/get_comm_types')
def get_comm_types(args):
    """
    取提成类型
    """
    return [{'id': it.value, 'label': it.label} for it in CommissionType]


@api.arg('date', '提成日期', required=True, type=api.Date())
@api.arg('type', '提成类型', required=True, type=api.Enum(CommissionType))
@api.arg('amount', '提成金额', required=True, type=api.Money(gt=0))
@api.arg('remark', '备注', type=api.String())
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=0)
@api.route('/add', methods=['POST'])
def add(args):
    """
    提成录入
    """
    # 查当前用户信息
    user = db.session.query(
        Agency.age_id,
        Agency.parent_age_id,
        Agency.age_name
    ).filter(
        Agency.age_id == g.age_id
    ).first()
    if not user:
        raise Exception(f'用户不存在(id={g.age_id})')

    if user.parent_age_id:
        raise Exception('对不起，你没有录入权限')

    comm = Commission(
        date=args.date,
        type=args.type,
        brand=args.brand,
        amount=args.amount,
        remark=args.remark,
        input_age_id=user.age_id,
        input_age_name=user.age_name
    )
    db.session.add(comm)
    try:
        # 分佣处理
        if comm.type in [CommissionType.AD, CommissionType.APP_AD]:  # 广告分佣和APP广告分佣
            # 检查当前日期该品牌开门数据是否已汇总
            qry = OpenDoorSum.query.filter(
                OpenDoorSum.date == args.date,
                OpenDoorSum.brand == args.brand
            )
            if not db.session.query(qry.exists()).scalar():
                raise Exception(f'该日期({args.date})品牌[{args.brand}]没有日活数据，不能录入收入')

            business.ad_commission_sharing(
                date=comm.date,
                comm_type=comm.type.value,
                age_id=g.age_id,
                amount=comm.amount,
                settle_platform=g.is_admin,
                brand=args.brand
            )
        else:
            raise Exception(f'系统还未实现[{comm.type.label}]的分佣处理')

        db.session.commit()
    except IntegrityError:
        # import traceback
        # traceback.print_exc()
        db.session.rollback()
        raise Exception('提成录入重复，请检查日期和提成类型')
    except Exception as e:
        db.session.rollback()
        raise Exception(f'提成录入失败：{e}')


@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/qry_agency')
def qry_agency(args):
    """
    查询用户
    """
    qry = db.session.query(
        Agency.age_id,
        Agency.age_name,
        Agency.remark,
        db.func.ifnull(AgencyProfile.type, AgencyType.SUB.value).label('type'),
        db.func.ifnull(AgencyProfile.status, AgencyStatus.ACTIVE.value).label('status'),
        AgencyProfile.last_seen
    ).outerjoin(
        AgencyProfile,
        Agency.age_id == AgencyProfile.age_id
    ).filter(
        Agency.parent_age_id == g.age_id
    ).order_by(db.desc(Agency.age_id))
    pager = db_util.get_pager(qry, args.page, args.limit)
    return pager.as_dict(
        type=lambda v: AgencyType(v),
        status=lambda v: AgencyStatus(v)
    )


@api.arg('age_id', '用户id', required=True, type=api.Integer())
@api.route('/get_agency')
def get_agency(args):
    """
    取用户详细信息
    """
    agency = db.session.query(
        Agency.age_id,
        Agency.age_name,
        Agency.remark,
        db.func.ifnull(AgencyProfile.type, AgencyType.SUB.value).label('type'),
        db.func.ifnull(AgencyProfile.status, AgencyStatus.ACTIVE.value).label('status')
    ).outerjoin(
        AgencyProfile,
        Agency.age_id == AgencyProfile.age_id
    ).filter(
        Agency.age_id == args.age_id
    ).first()
    if not agency:
        raise Exception(f'用户不存在(id={args.age_id})')

    # 查用户提成点数
    qry_ratio = db.session.query(
        AgencyCommissionRatio.id,
        AgencyCommissionRatio.type,
        AgencyCommissionRatio.ratio
    ).filter(
        AgencyCommissionRatio.age_id == args.age_id
    ).order_by(
        db.asc(AgencyCommissionRatio.id)
    )
    ratio_dict = {}
    for row in qry_ratio:
        ratio_dict[row.type] = row.ratio

    ratios = []
    for it in CommissionType:
        ratios.append({
            'id': it.value,
            'label': it.label,
            'ratio': ratio_dict.get(it, '')
        })

    result = db_util.row_to_dict(
        agency,
        type=lambda v: AgencyType(v),
        status=lambda v: AgencyStatus(v)
    )
    result['ratios'] = ratios
    return result


@api.arg('age_id', '用户id，有则修改，无则新增', type=api.Integer())
@api.arg('age_name', '用户账号, 只能新增', type=api.String())
@api.arg('age_password', '管理账号密码', type=api.String())
@api.arg('comm_password', '运营账号密码', type=api.String())
@api.arg('type', '用户类型', type=api.Enum(AgencyType))
@api.arg('status', '状态', type=api.Enum(AgencyStatus))
@api.arg('remark', '备注', type=api.String())
@api.arg('ratios', '提成比率对象', type=api.JsObject('{提成类型id: 提成比率}'))
@api.route('/save_agency', methods=['POST'])
@trans.auto
def save_agency(args):
    """
    保存用户信息
    """
    if args.age_id:
        agency = Agency.query.filter_by(age_id=args.age_id).first()
        if not agency:
            raise Exception(f'用户不存在(id={args.age_id})')

        if args.age_password:
            agency.age_password = args.age_password
    else:  # 新增
        if not args.age_name:
            raise Exception('用户账号不能为空')

        if not args.age_password:
            raise Exception('用户密码不能为空')

        agency = Agency(
            parent_age_id=g.age_id,
            age_name=args.age_name,
            age_password=args.age_password
        )

    if args.remark is not None:
        agency.remark = args.remark

    db.session.add(agency)
    db.session.flush()
    # 更新profile
    profile = AgencyProfile.query.filter_by(age_id=agency.age_id).first()
    if not profile:
        profile = AgencyProfile(
            age_id=agency.age_id,
            password=agency.age_password,
            age_ids=business.get_parent_age_ids(agency.age_id)
        )
    if args.status is not None:
        profile.status = args.status
    if args.type is not None:
        profile.type = args.type
    if args.comm_password:
        profile.password = args.comm_password

    db.session.add(profile)
    # 保存提比率
    if args.ratios:
        if not isinstance(args.ratios, dict):
            raise Exception('ratios参数应该是一个对象')

        numeric = api.Numeric(gte=0, lte=1, scale=4)
        for k, v in args.ratios.items():
            try:
                comm_type = CommissionType(int(k))
            except Exception:
                raise Exception(f'ratios参数解析出错：{k}不是合法的CommissionType类型')

            try:
                ratio = numeric(v)
            except Exception as e:
                raise Exception(f'[{comm_type.label}]分佣点数设置错误，{e}')

            comm_ratio = AgencyCommissionRatio.query.filter(
                AgencyCommissionRatio.age_id == agency.age_id,
                AgencyCommissionRatio.type == comm_type
            ).first()
            if not comm_ratio:
                comm_ratio = AgencyCommissionRatio(
                    age_id=agency.age_id,
                    type=comm_type
                )
            # 更新
            comm_ratio.ratio = ratio
            db.session.add(comm_ratio)

        # 检查提成比率(好像不用检查提成比率了，因为是按小区分的，而不是按总数分的)
        # qry_ratio = db.session.query(
        #     AgencyProfile.type.label('agency_type'),
        #     AgencyCommissionRatio.type,
        #     db.func.sum(AgencyCommissionRatio.ratio).label('total_ratio')
        # ).join(
        #     AgencyProfile,
        #     AgencyProfile.age_id == AgencyCommissionRatio.age_id
        # ).join(
        #     Agency,
        #     Agency.age_id == AgencyCommissionRatio.age_id
        # ).filter(
        #     Agency.parent_age_id == g.age_id
        # ).group_by(
        #     AgencyProfile.type,
        #     AgencyCommissionRatio.type
        # )
        # ratio_dict = {}
        # for row in qry_ratio:
        #     if row.total_ratio > 1:
        #         raise Exception(f'{row.agency_type.label}用户的[{row.type.label}]佣金比率合计起来已超过1，请调整佣金比率')
        #
        #     if row.type not in ratio_dict:
        #         ratio_dict[row.type] = {}
        #
        #     ratio_dict[row.type][row.agency_type] = row.total_ratio
        # # 检查是否还有余额给伙伴
        # for k, d in ratio_dict.items():
        #     if d.get(AgencyType.PARTNER, 0) > 0:
        #         if d.get(AgencyType.SUB, 0) == 1:
        #             raise Exception(f'{k.label}已没有比率分给伙伴，请修改下级用户的佣金比率，使合计起来不能等于1')

    return {
        'age_id': agency.age_id
    }


@api.arg('date', '截止日期', required=True, type=api.Date())
@api.route('/sum_unsettle_comm')
def sum_unsettle_comm(args):
    """
    根据截止日期汇总下级用户待结算金额(未创建结算单的)
    """
    qry = db.session.query(
        AgencyCommission.age_id,
        Agency.age_name,
        db.func.sum(AgencyCommission.amount).label('amount')
    ).join(
        Agency,
        Agency.age_id == AgencyCommission.age_id
    ).filter(
        AgencyCommission.parent_age_id == g.age_id,
        AgencyCommission.settle_order_id.is_(None),
        AgencyCommission.date <= args.date
    ).group_by(
        AgencyCommission.age_id,
        Agency.age_name
    ).having(
        db.literal_column('amount') > 0
    )
    return qry


@api.arg('flag', '标记', required=True, type=api.Select({0: '下级结算单', 1: '上级结算单'}))
@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结算日期', type=api.Date())
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/qry_order')
def qry_order(args):
    """
    查询结算单
    """
    if args.flag == 0:  # 下级结算单
        qry = db.session.query(
            AgencySettleOrder.id,
            AgencySettleOrder.no,
            AgencySettleOrder.date,
            AgencySettleOrder.amount,
            AgencySettleOrder.status,
            AgencySettleOrder.remark,
            AgencySettleOrder.create_time,
            AgencySettleOrder.settle_time,
            AgencySettleOrder.settle_age_name
        ).filter(
            AgencySettleOrder.age_id == g.age_id
        ).order_by(
            db.desc(AgencySettleOrder.id)
        )
    elif args.flag == 1:  # 上级结算单
        qry_comm = db.session.query(
            AgencyCommission.settle_order_id
        ).filter(
            AgencyCommission.age_id == g.age_id
        )
        if args.start_date:
            qry_comm = qry_comm.filter(AgencyCommission.create_time >= args.start_date)

        if args.end_date:
            qry_comm = qry_comm.filter(AgencyCommission.create_time < db.func.adddate(args.end_date, 1))

        qry = db.session.query(
            AgencySettleOrder.id,
            AgencySettleOrder.no,
            AgencySettleOrder.date,
            AgencySettleOrder.status,
            AgencySettleOrder.remark,
            AgencySettleOrder.create_time,
            AgencySettleOrder.settle_time,
            AgencySettleOrder.settle_age_name,
            db.session.query(db.func.sum(AgencyCommission.amount)).filter(
                AgencyCommission.age_id == g.age_id,
                AgencyCommission.settle_order_id == AgencySettleOrder.id
            ).label('amount')
        ).filter(
            AgencySettleOrder.id.in_(qry_comm)
        ).order_by(
            db.desc(AgencySettleOrder.id)
        )
    else:
        raise Exception(f'未处理的flag: {args.flag}')

    if args.start_date:
        qry = qry.filter(AgencySettleOrder.create_time >= args.start_date)

    if args.end_date:
        qry = qry.filter(AgencySettleOrder.create_time < db.func.adddate(args.end_date, 1))

    return db_util.get_pager(qry, args.page, args.limit)


@api.arg('date', '截止日期', required=True, type=api.Date())
@api.arg('age_ids', '结算的下级用户id列表', required=True, type=api.JsObject('js数组'))
@api.arg('remark', '备注', type=api.String())
@api.route('/create_order', methods=['POST'])
@trans.auto
def create_order(args):
    """
    创建下级结算单
    """
    if not isinstance(args.age_ids, list):
        raise Exception('参数age_ids必须是js数组')

    # 汇总待结金额
    amount = db.session.query(
        db.func.sum(AgencyCommission.amount)
    ).filter(
        AgencyCommission.parent_age_id == g.age_id,
        AgencyCommission.settle_order_id.is_(None),
        AgencyCommission.date <= args.date,
        AgencyCommission.age_id.in_(args.age_ids)
    ).scalar()
    if not amount:
        raise Exception('待结算金额为0')

    # 创建结算单
    order = AgencySettleOrder(
        age_id=g.age_id,
        no=func.gen_order_no(order_type='SETTLE_ORDER', prefix='A'),
        amount=amount,
        date=args.date,
        remark=args.remark
    )
    db.session.add(order)
    db.session.flush()
    # 更新明细
    AgencyCommission.query.filter(
        AgencyCommission.age_id.in_(args.age_ids),
        AgencyCommission.parent_age_id == g.age_id,
        AgencyCommission.settle_order_id.is_(None),
        AgencyCommission.date <= args.date
    ).update({
        'settle_order_id': order.id
    }, synchronize_session=False)

    return {
        'order_id': order.id
    }


@api.arg('order_id', '结算单id', required=True, type=api.Integer())
@api.route('/del_order', methods=['POST'])
@trans.auto
def del_order(args):
    """删除结算单"""
    order = db.session.query(
        AgencySettleOrder.status
    ).filter(
        AgencySettleOrder.id == args.order_id
    ).first()
    if not order:
        raise Exception(f'订单不存在(id={args.order_id})')
    if order.status != SettleStatus.PENDING:
        raise Exception(f'订单状态为[{order.status.label}]，不能删除')
    # 更新订单明细
    AgencyCommission.query.filter_by(settle_order_id=args.order_id).update({
        'settle_order_id': None
    }, synchronize_session=False)
    # 删除
    AgencySettleOrder.query.filter_by(id=args.order_id).delete(synchronize_session=False)


@api.arg('order_id', '结算单id', required=True, type=api.Integer())
@api.route('/get_order')
def get_order(args):
    """
    取得结算单信息
    """
    order = db.session.query(
        AgencySettleOrder.id,
        AgencySettleOrder.no,
        AgencySettleOrder.amount,
        AgencySettleOrder.status,
        AgencySettleOrder.remark,
        AgencySettleOrder.settle_time,
        AgencySettleOrder.settle_age_name,
        AgencySettleOrder.create_time
    ).filter(
        AgencySettleOrder.id == args.order_id
    ).first()
    if not order:
        raise Exception(f'订单不存在(id={args.order_id})')

    return order


def _sum_order_agency_comm(order_id):  # 汇总订单下用户提成
    qry = db.session.query(
        AgencyCommission.age_id,
        Agency.age_name,
        AgencyProfile.name,
        AgencyProfile.bank,
        AgencyProfile.bankcard,
        db.func.sum(AgencyCommission.amount).label('amount')
    ).join(
        Agency,
        Agency.age_id == AgencyCommission.age_id
    ).outerjoin(
        AgencyProfile,
        AgencyProfile.age_id == AgencyCommission.age_id
    ).filter(
        AgencyCommission.settle_order_id == order_id
    ).group_by(
        AgencyCommission.age_id,
        Agency.age_name,
        AgencyProfile.name,
        AgencyProfile.bank,
        AgencyProfile.bankcard
    )
    return qry


@api.arg('order_id', '结算单id', required=True, type=api.Integer())
@api.route('/get_settle_record')
def get_settle_record(args):
    """
    查订单结算记录
    """
    order = db.session.query(
        AgencySettleOrder.status
    ).filter(
        AgencySettleOrder.id == args.order_id
    ).first()
    if not order:
        raise Exception(f'订单不存在(id={args.order_id})')

    if order.status == SettleStatus.PENDING:  # 待结算，则从提成明细里汇总
        qry = _sum_order_agency_comm(args.order_id)
    elif order.status == SettleStatus.SETTLED:  # 已结算，说明已经固定下来，从结算记录里查
        qry = db.session.query(
            AgencySettleRecord.age_id,
            AgencySettleRecord.age_name,
            AgencySettleRecord.amount,
            AgencySettleRecord.name,
            AgencySettleRecord.bank,
            AgencySettleRecord.bankcard
        ).filter(
            AgencySettleRecord.settle_order_id == args.order_id
        ).order_by(
            db.asc(AgencySettleRecord.id)
        )
    else:
        raise Exception(f'未处理的订单类型[{order.status.label}]')

    return {
        'status': order.status,
        'items': qry
    }


@api.arg('order_id', '结算单id', required=True, type=api.Integer())
@api.route('/settle_order', methods=['POST'])
@trans.auto
def settle_order(args):
    """
    结算单结算
    """
    order = db.session.query(
        AgencySettleOrder.status
    ).filter(
        AgencySettleOrder.id == args.order_id
    ).first()
    if not order:
        raise Exception(f'订单不存在(id={args.order_id})')

    if order.status != SettleStatus.PENDING:
        raise Exception(f'订单状态为[{order.status.label}]，不能结算')

    # 取当前用户名
    age_name = db.session.query(Agency.age_name).filter_by(age_id=g.age_id).scalar()
    # 更新订单状态
    AgencySettleOrder.query.filter_by(id=args.order_id).update({
        'status': SettleStatus.SETTLED.value,  # 已结算
        'settle_age_id': g.age_id,
        'settle_age_name': age_name,
        'settle_time': db.func.now()
    }, synchronize_session=False)
    # 把转账信息固定到结算记录
    records = _sum_order_agency_comm(args.order_id)
    for row in records:
        rec = AgencySettleRecord(
            settle_order_id=args.order_id,
            age_id=row.age_id,
            age_name=row.age_name,
            amount=row.amount,
            name=row.name,
            bank=row.bank,
            bankcard=row.bankcard
        )
        db.session.add(rec)

