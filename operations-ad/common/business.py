"""一些业务处理"""
from datetime import datetime, timedelta
from corks import cache
from common import func
from db.old_models import *
from db.ad_models import *
from db.enums import *
from decimal import Decimal
import math


def get_parent_age_ids(age_id):
    """查某个用户的parent_id，并拼成串"""
    parent_id = db.session.query(
        Agency.parent_age_id
    ).filter(
        Agency.age_id == age_id
    ).scalar()
    if parent_id:
        return get_parent_age_ids(parent_id) + f'{age_id}.'
    else:
        return f'{age_id}.'


def _settle_platform(age_id, sub_age_id, comm_type, date, community_id, src_amount, brand=0):
    """
        :param age_id: 当前结算的用户id
        :param sub_age_id: 下级用户id
        :param comm_type: 收入类型
        :param date: 日期
        :param community_id: 小区id
        :param src_amount: 原金额
        :param brand: 品牌（0=星云 1=云卫家）
        给平台分佣，成功返回余额
    """
    platform_comm_amount = 0
    # 查平台分佣点数
    ratio = db.session.query(AgencyCommissionRatio.ratio).filter(
        AgencyCommissionRatio.age_id == sub_age_id,
        AgencyCommissionRatio.type == CommissionType.PLATFORM.value
    ).scalar() or 0
    if ratio > 0:
        platform_comm_amount = round(src_amount * ratio, 2)
        comm = AgencyCommission(
            age_id=age_id,
            parent_age_id=None,
            community_id=community_id,
            date=date,
            brand=brand,
            comm_type=AgencyCommissionType.PLATFORM,  # 平台分佣
            type=CommissionType.PLATFORM,  # 平台分佣
            src_amount=src_amount,
            ratio=ratio,
            amount=platform_comm_amount
        )
        db.session.add(comm)

    return src_amount - platform_comm_amount


def _get_count_field(comm_type):
    """
    根据提成类型获取统计字段
    :param comm_type: 提成类型
    :return: 统计字段表达式
    """
    return db.case(
        (
            db.and_(
                db.literal(comm_type) == CommissionType.AD.value,
                db.or_(
                    OpenDoorSum.wx_count > 0,
                    OpenDoorSum.app_count > 0
                )
            ),
            OpenDoorSum.wx_count
        ),
        (db.literal(comm_type) == CommissionType.APP_AD.value, OpenDoorSum.app_count),
        else_=OpenDoorSum.count
    )


def ad_commission_sharing(date, comm_type, age_id, amount, community_id=None, settle_platform=False, brand=0):
    """
    广告分佣处理，根据用户小区日活占比，从上级用户往下分佣
    :param date: 日期
    :param comm_type: 提成类型
    :param age_id: 用户id
    :param amount: 佣金金额
    :param community_id: 小区id
    :param settle_platform: 是否给平台分佣
    :param brand: 品牌（0=星云 1=云卫家），日活与分佣记录均按品牌隔离
    """
    if amount <= 0:
        return

    # 汇总访问数量，计算单次提成金额
    agency = db.session.query(
        Agency.parent_age_id,
        AgencyProfile.age_ids
    ).join(
        AgencyProfile,
        AgencyProfile.age_id == Agency.age_id
    ).filter(
        AgencyProfile.age_id == age_id
    ).first()
    if not agency:
        raise Exception(f'用户不存在(id={age_id})')

    avg_comm = 0
    if not community_id:  # 没有小区才汇总算平均，再分摊给小区
        count_field = _get_count_field(comm_type)
        total_open_count = db.session.query(
            db.func.sum(count_field)
        ).filter(
            OpenDoorSum.date == date,
            OpenDoorSum.brand == brand,
            OpenDoorSum.age_ids.like(f'{agency.age_ids}%')
        ).scalar() or 0
        
        if total_open_count == 0:
            raise Exception(f'日期{date}没有日活数据')

        avg_comm = amount / total_open_count  # 每次点击的广告费

    # 查下级用户及提成点数
    count_field = _get_count_field(comm_type)
    qry_sub_ages = db.session.query(
        Agency.age_id,
        AgencyCommissionRatio.ratio,
        OpenDoorSum.community_id,
        count_field.label('count')
    ).join(
        AgencyProfile,
        AgencyProfile.age_id == Agency.age_id
    ).join(
        AgencyCommissionRatio,
        db.and_(
            AgencyCommissionRatio.age_id == Agency.age_id,
            AgencyCommissionRatio.type == comm_type
        )
    ).join(
        OpenDoorSum,
        db.and_(
            OpenDoorSum.date == date,
            OpenDoorSum.brand == brand,
            OpenDoorSum.age_ids.like(db.func.concat(AgencyProfile.age_ids, '%'))
        )
    ).filter(
        Agency.parent_age_id == age_id,
        AgencyProfile.status == AgencyStatus.ACTIVE.value,  # 已启用
        AgencyProfile.type == AgencyType.SUB.value  # 下级
    )
    if community_id:
        qry_sub_ages = qry_sub_ages.filter(OpenDoorSum.community_id == community_id)

    # 查询同级伙伴
    partner_ages = db.session.query(
        Agency.age_id,
        AgencyCommissionRatio.ratio
    ).join(
        AgencyProfile,
        AgencyProfile.age_id == Agency.age_id
    ).join(
        AgencyCommissionRatio,
        db.and_(
            AgencyCommissionRatio.age_id == Agency.age_id,
            AgencyCommissionRatio.type == comm_type
        )
    ).filter(
        Agency.parent_age_id == age_id,
        AgencyProfile.status == AgencyStatus.ACTIVE.value,  # 已启用
        AgencyProfile.type == AgencyType.PARTNER.value,  # 伙伴
        AgencyCommissionRatio.ratio > 0
    ).all()

    params_list = []  # 用于保存后面递归相关参数
    for row in qry_sub_ages:
        if row.count == 0:
            continue

        if community_id:  # 有小区
            src_amount = amount
        else:  # 没有小区id，按总的给小区分配
            # 用户根据日活算出的总金额(小区)，还未按比率分
            src_amount = Decimal(math.floor(row.count * avg_comm * 100)) / 100  # 这里不能用round,因为用round舍入时，这样乘上去会大于原值

        if src_amount <= 0:
            continue

        if settle_platform:  # 给平台分佣
            src_amount = _settle_platform(
                age_id=age_id,
                sub_age_id=row.age_id,
                comm_type=comm_type,
                date=date,
                community_id=row.community_id,
                src_amount=src_amount,
                brand=brand
            )
        comm_amount = round(src_amount * row.ratio, 2) if row.ratio > 0 else 0  # 用户按比率算得到的佣金金额(小区)
        remainder_comm_amount = src_amount - comm_amount  # 余下的小区提成
        # 递归参数
        if comm_amount > 0:
            params_list.append({
                'date': date,
                'comm_type': comm_type,
                'age_id': row.age_id,
                'community_id': row.community_id,
                'amount': comm_amount,
                'brand': brand
            })
            # 子用户提成记录
            age_comm = AgencyCommission(
                age_id=row.age_id,
                parent_age_id=age_id,
                community_id=row.community_id,
                date=date,
                brand=brand,
                comm_type=AgencyCommissionType.SUB,  # 作为下级的提成
                type=comm_type,
                src_amount=src_amount,
                ratio=row.ratio,
                amount=comm_amount
            )
            db.session.add(age_comm)
        # 处理伙伴提成
        total_partner_comm_amount = 0  # 伙伴总提成
        for prow in partner_ages:
            if remainder_comm_amount < 0:
                age_name = db.session.query(Agency.age_name).filter_by(age_id=age_id).scalar()
                raise Exception(f'没有余额给伙伴分佣。请检查用户[{age_name}](id={age_id})的下级用户的提成比率')

            partner_comm_amount = round(remainder_comm_amount * prow.ratio, 2)  # 伙伴得到的提成
            total_partner_comm_amount += partner_comm_amount
            # 伙伴提成记录
            partner_comm = AgencyCommission(
                age_id=prow.age_id,
                parent_age_id=age_id,
                community_id=row.community_id,
                date=date,
                brand=brand,
                comm_type=AgencyCommissionType.PARTNER,  # 作为伙伴的提成
                type=comm_type,
                src_amount=remainder_comm_amount,
                ratio=prow.ratio,
                amount=partner_comm_amount
            )
            db.session.add(partner_comm)

    # 递归
    for p in params_list:
        ad_commission_sharing(**p)