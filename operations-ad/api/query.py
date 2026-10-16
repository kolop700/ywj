"""数据查询相关"""
from flask import g
from corks import api
from corks.utils import db_util
from db.old_models import *
from db.ad_models import *
from db.enums import *
from . import auth
from db import db

API_MODULE_NAME = '查询'
API_URL_PREFIX = 'wx/qry'
API_MODULE_AUTH = auth


@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结束日期', type=api.Date())
@api.arg('brand', '品牌，不传查全部', type=api.Select({0: '星云', 1: '云卫家'}))
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/uv_daily')
def uv_daily(args):
    """
    日话数据
    """
    if g.type == AgencyType.PARTNER:  # 是合伙人的话，日活数据取上级的
        age_id = db.session.query(Agency.parent_age_id).filter(
            Agency.age_id == g.age_id
        ).scalar()
    else:
        age_id = g.age_id

    age_ids = db.session.query(
        AgencyProfile.age_ids
    ).filter_by(age_id=age_id).scalar()

    qry = db.session.query(
        OpenDoorSum.date,
        db.func.sum(OpenDoorSum.count).label('count'),
        db.func.sum(OpenDoorSum.wx_count).label('wx_count'),
        db.func.sum(OpenDoorSum.app_count).label('app_count'),
        db.func.sum(OpenDoorSum.doorphone_count).label('doorphone_count'),
        db.func.sum(OpenDoorSum.online_count).label('online_count'),
    ).filter(
        OpenDoorSum.age_ids.like(f'{age_ids}%')
    ).group_by(
        OpenDoorSum.date
    ).order_by(
        db.desc(OpenDoorSum.date)
    )
    if args.brand is not None:
        qry = qry.filter(OpenDoorSum.brand == args.brand)

    if args.start_date:
        qry = qry.filter(OpenDoorSum.date >= args.start_date)

    if args.end_date:
        qry = qry.filter(OpenDoorSum.date <= args.end_date)

    return db_util.get_pager(qry, args.page, args.limit)


@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结束日期', type=api.Date())
@api.arg('brand', '品牌，不传查全部', type=api.Select({0: '星云', 1: '云卫家'}))
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/agency_uv')
def agency_uv(args):
    """
    下级运营账号日活
    """
    if g.type == AgencyType.PARTNER:  # 是合伙人的话，日活数据取上级的
        age_id = db.session.query(Agency.parent_age_id).filter(
            Agency.age_id == g.age_id
        ).scalar()
    else:
        age_id = g.age_id

    qry = db.session.query(
        Agency.age_id,
        Agency.age_name,
        OpenDoorSum.date,
        db.func.sum(OpenDoorSum.count).label('count'),
        db.func.sum(OpenDoorSum.wx_count).label('wx_count'),
        db.func.sum(OpenDoorSum.app_count).label('app_count'),
        db.func.sum(OpenDoorSum.doorphone_count).label('doorphone_count'),
        db.func.sum(OpenDoorSum.online_count).label('online_count'),
    ).join(
        AgencyProfile,
        Agency.age_id == AgencyProfile.age_id
    ).join(
        OpenDoorSum,
        OpenDoorSum.age_ids.like(db.func.concat(AgencyProfile.age_ids, '%'))
    ).filter(
        Agency.parent_age_id == age_id
    ).group_by(
        Agency.age_id,
        Agency.age_name,
        OpenDoorSum.date
    )
    if args.brand is not None:
        qry = qry.filter(OpenDoorSum.brand == args.brand)
    if args.start_date == args.end_date:  # 只查一天则按日活倒排
        qry = qry.order_by(
            db.desc(db.literal_column('count')),
            db.desc(OpenDoorSum.date)
        )
    else:  # 查多天则先按账号再按日期
        qry = qry.order_by(
            db.asc(Agency.age_id),
            db.desc(OpenDoorSum.date)
        )

    if args.start_date:
        qry = qry.filter(OpenDoorSum.date >= args.start_date)

    if args.end_date:
        qry = qry.filter(OpenDoorSum.date <= args.end_date)

    return db_util.get_pager(qry, args.page, args.limit)


@api.arg('age_id', '运营账号ID', type=api.Integer())
@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结束日期', type=api.Date())
@api.arg('brand', '品牌，不传查全部', type=api.Select({0: '星云', 1: '云卫家'}))
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/uv')
def uv(args):
    """
    查询小区日活数据
    """
    # if g.type == AgencyType.PARTNER:  # 是合伙人的话，日活数据取上级的
    #     age_id = db.session.query(Agency.parent_age_id).filter(
    #         Agency.age_id == g.age_id
    #     ).scalar()
    # else:
    #     age_id = g.age_id
    age_id = args.age_id

    age_ids = db.session.query(
        AgencyProfile.age_ids
    ).filter_by(age_id=age_id).scalar()

    qry = db.session.query(
        OpenDoorSum.id,
        OpenDoorSum.community_id,
        OpenDoorSum.date,
        OpenDoorSum.doorphone_count,
        OpenDoorSum.online_count,
        OpenDoorSum.count,
        OpenDoorSum.wx_count,
        OpenDoorSum.app_count,
        Community.comm_name
    ).join(
        Community,
        Community.comm_id == OpenDoorSum.community_id
    ).filter(
        OpenDoorSum.age_ids.like(f'{age_ids}%')
    )
    if args.brand is not None:
        qry = qry.filter(OpenDoorSum.brand == args.brand)
    if args.start_date == args.end_date:
        qry = qry.order_by(
            db.desc(OpenDoorSum.count),
            db.desc(OpenDoorSum.id)
        )
    else:
        qry = qry.order_by(
            db.asc(OpenDoorSum.community_id),
            db.desc(OpenDoorSum.date)
        )

    if args.start_date:
        qry = qry.filter(OpenDoorSum.date >= args.start_date)

    if args.end_date:
        qry = qry.filter(OpenDoorSum.date <= args.end_date)

    return db_util.get_pager(qry, args.page, args.limit)


@api.arg('comm_id', '小区id', required=True, type=api.Integer())
@api.arg('date', '日期', required=True, type=api.Date())
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=100)
@api.route('/door_uv')
def door_uv(args):
    """
    查询下区下门禁机日活
    """
    # 正常用户开门记录
    qry1 = db.session.query(
        DoorPhone.door_id,
        DoorPhone.door_name,
        DoorPhone.door_mac,
        db.literal(args.date).label('date'),
        db.session.query(db.func.count(db.func.distinct(Record.user_id))).filter(
            Record.door_mac == DoorPhone.door_mac,
            Record.acess_type.in_([1, 6]),  # 只汇总通过小程序开门的
            Record.record_time >= args.date,
            Record.record_time < db.func.adddate(args.date, 1)
        ).label('count'),
        db.session.query(db.func.count(db.func.distinct(Record.user_id))).filter(
            Record.door_mac == DoorPhone.door_mac,
            Record.acess_type == 11,  # 只汇总通过小程序开门的
            Record.record_time >= args.date,
            Record.record_time < db.func.adddate(args.date, 1)
        ).label('app_count')
    ).filter(
        DoorPhone.community_id == args.comm_id,
    )

    # 免授权用户开门数据
    qry2 = db.session.query(
        DoorPhone.door_id.label('door_id'),
        DoorPhone.door_name.label('door_name'),
        DoorPhone.door_mac.label('door_mac'),
        db.literal(args.date).label('date'),
        db.session.query(db.func.count(db.func.distinct(WxRecord.wxu_id))).filter(
            WxRecord.door_mac == DoorPhone.door_mac,
            WxRecord.record_time >= args.date,
            WxRecord.record_time < db.func.adddate(args.date, 1)
        ).label('count'),
        db.literal(0).label('app_count')
    ).filter(
        DoorPhone.community_id == args.comm_id
    )

    sub_qry = qry2.union_all(qry1).subquery()  # 不能qry1.union_all(qry2)，不知道为什么distinct会出现内层，不对
    qry = db.session.query(
        sub_qry.c.door_id,
        sub_qry.c.door_name,
        sub_qry.c.door_mac,
        sub_qry.c.date,
        db.func.sum(sub_qry.c.count).label('count'),
        db.func.sum(sub_qry.c.app_count).label('app_count')
    ).select_from(sub_qry).group_by(
        sub_qry.c.door_id,
        sub_qry.c.door_name,
        sub_qry.c.door_mac,
        sub_qry.c.date,
    ).order_by(
        db.desc(db.literal_column('count')),
        db.desc(sub_qry.c.door_id)
    )
    return db_util.get_pager(qry, args.page, args.limit)


def _qry_agency_comm(args, *fields):
    qry = db.session.query(
        AgencyCommission.id,
        AgencyCommission.date,
        AgencyCommission.brand,
        AgencyCommission.comm_type,
        AgencyCommission.type,
        AgencyCommission.src_amount,
        AgencyCommission.ratio,
        AgencyCommission.amount,
        Agency.age_name,
        Community.comm_name,
        db.func.ifnull(AgencySettleOrder.status, SettleStatus.PENDING.value).label('status'),
        *fields
    ).join(
        Agency,
        Agency.age_id == AgencyCommission.age_id
    ).join(
        Community,
        Community.comm_id == AgencyCommission.community_id
    ).outerjoin(
        AgencySettleOrder,
        AgencySettleOrder.id == AgencyCommission.settle_order_id
    ).order_by(
        db.desc(AgencyCommission.id)
    )

    if args.order_id:
        qry = qry.filter(AgencyCommission.settle_order_id == args.order_id)
    else:  # 如果传订单id过来，就不要再限制日期了（结算单混品牌，order_id查询也不按品牌过滤）
        if args.start_date:
            qry = qry.filter(AgencyCommission.date >= args.start_date)

        if args.end_date:
            qry = qry.filter(AgencyCommission.date <= args.end_date)

        if args.brand is not None:
            qry = qry.filter(AgencyCommission.brand == args.brand)

    if args.flag == 0:  # 下级
        qry = qry.filter(AgencyCommission.parent_age_id == g.age_id)
    elif args.flag == 1:  # 自己
        qry = qry.filter(AgencyCommission.age_id == g.age_id)

    return qry


@api.arg('order_id', '结算单id，有则查结算单的佣金记录', type=api.Integer())
@api.arg('flag', '查询开关', type=api.Select({0: '下级佣金记录', 1: '自己的佣金记录'}))
@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结算日期', type=api.Date())
@api.arg('brand', '品牌，不传查全部', type=api.Select({0: '星云', 1: '云卫家'}))
@api.arg('page', '第几页', type=api.Integer(), default=1)
@api.arg('limit', '每页行数', type=api.Integer(), default=20)
@api.route('/qry_agency_comm')
def qry_agency_comm(args):
    """
    查询用户佣金记录
    """
    if not args.order_id and args.flag is None:
        raise Exception('请致少传入order_id或flag参数')

    qry = _qry_agency_comm(args)
    pager = db_util.get_pager(qry, args.page, args.limit)
    return pager.as_dict(status=lambda v: SettleStatus(v))


@api.arg('order_id', '结算单id，有则查结算单的佣金记录', type=api.Integer())
@api.arg('flag', '查询开关', type=api.Select({0: '下级佣金记录', 1: '自己的佣金记录'}))
@api.arg('start_date', '开始日期', type=api.Date())
@api.arg('end_date', '结算日期', type=api.Date())
@api.arg('brand', '品牌，不传查全部', type=api.Select({0: '星云', 1: '云卫家'}))
@api.route('/export_agency_comm')
@api.auth_exempt
def export_agency_comm(args):
    """
    导出用户佣金记录
    """
    if not args.order_id and args.flag is None:
        raise Exception('请致少传入order_id或flag参数')

    # 创建子查询，按日期和小区分组
    subquery = db.session.query(
        AgencyCommission.date,
        AgencyCommission.community_id,
        AgencyCommission.age_id,
        AgencyCommission.comm_type,
        AgencyCommission.brand,
        db.func.sum(db.case(
            (AgencyCommission.type == CommissionType.AD, AgencyCommission.src_amount),
            else_=0
        )).label('wx_src_amount'),
        db.func.sum(db.case(
            (AgencyCommission.type == CommissionType.APP_AD, AgencyCommission.src_amount),
            else_=0
        )).label('app_src_amount'),
        db.func.max(db.case(
            (AgencyCommission.type == CommissionType.AD, AgencyCommission.ratio),
            else_=None
        )).label('wx_ratio'),
        db.func.max(db.case(
            (AgencyCommission.type == CommissionType.APP_AD, AgencyCommission.ratio),
            else_=None
        )).label('app_ratio'),
        db.func.sum(db.case(
            (AgencyCommission.type == CommissionType.AD, AgencyCommission.amount),
            else_=0
        )).label('wx_amount'),
        db.func.sum(db.case(
            (AgencyCommission.type == CommissionType.APP_AD, AgencyCommission.amount),
            else_=0
        )).label('app_amount'),
        db.func.min(AgencyCommission.settle_order_id).label('settle_order_id')
    ).group_by(
        AgencyCommission.date,
        AgencyCommission.community_id,
        AgencyCommission.age_id,
        AgencyCommission.comm_type,
        AgencyCommission.brand
    ).subquery()

    # 主查询
    qry = db.session.query(
        subquery.c.date,
        Agency.age_name,
        Community.comm_name,
        subquery.c.comm_type,
        OpenDoorSum.count,
        db.case(
            (db.and_(OpenDoorSum.app_count == 0, OpenDoorSum.wx_count == 0),
             OpenDoorSum.count),
            else_=OpenDoorSum.wx_count
        ).label('wx_count'),
        OpenDoorSum.app_count,
        OpenDoorSum.doorphone_count,
        OpenDoorSum.online_count,
        subquery.c.wx_src_amount,
        subquery.c.app_src_amount,
        (subquery.c.wx_src_amount + subquery.c.app_src_amount).label('total_src_amount'),
        subquery.c.wx_ratio,
        subquery.c.app_ratio,
        subquery.c.wx_amount,
        subquery.c.app_amount,
        (subquery.c.wx_amount + subquery.c.app_amount).label('total_amount'),
        db.func.ifnull(AgencySettleOrder.status, SettleStatus.PENDING.value).label('status')
    ).select_from(subquery).join(
        Agency,
        Agency.age_id == subquery.c.age_id
    ).join(
        Community,
        Community.comm_id == subquery.c.community_id
    ).join(
        OpenDoorSum,
        db.and_(
            OpenDoorSum.community_id == subquery.c.community_id,
            OpenDoorSum.date == subquery.c.date,
            OpenDoorSum.brand == subquery.c.brand  # 同品牌日活，避免两品牌行fan-out
        )
    ).outerjoin(
        AgencySettleOrder,
        AgencySettleOrder.id == subquery.c.settle_order_id
    )

    # 添加筛选条件（结算单混品牌，order_id查询不按品牌过滤）
    if args.order_id:
        qry = qry.filter(AgencySettleOrder.id == args.order_id)
    else:
        if args.start_date:
            qry = qry.filter(subquery.c.date >= args.start_date)
        if args.end_date:
            qry = qry.filter(subquery.c.date <= args.end_date)

        if args.brand is not None:
            qry = qry.filter(subquery.c.brand == args.brand)

    if args.flag == 0:  # 下级
        qry = qry.filter(AgencyCommission.parent_age_id == g.age_id)
    elif args.flag == 1:  # 自己
        qry = qry.filter(AgencyCommission.age_id == g.age_id)

    qry = qry.order_by(db.desc(subquery.c.date))

    return db_util.export_excel('用户佣金记录', qry, fields={
        'date': '日期',
        'age_name': '用户名',
        'comm_name': '小区',
        'comm_type': '佣金类型',
        'count': '总日活数量',
        'wx_count': '小程序日活数量',
        'app_count': 'APP日活数量',
        'doorphone_count': '设备数量',
        'online_count': '活跃数',
        'wx_src_amount': '小程序收入',
        'app_src_amount': 'APP收入',
        'total_src_amount': '总收入',
        'wx_ratio': '小程序佣金比例',
        'app_ratio': 'APP佣金比例',
        'wx_amount': '小程序佣金',
        'app_amount': 'APP佣金',
        'total_amount': '佣金总额'
    }, date=lambda v: v.strftime('%Y-%m-%d'), comm_type=lambda v: v.label)