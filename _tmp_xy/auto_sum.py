from corks import app
from db.old_models import *
from db.ad_models import *
from db import db
from common import business
from datetime import date, timedelta

# 品牌设备隔离：星云侧排除云卫家渠道设备（t_doorphone.appid==1，由 setDoorAppid 接口打标）
YJS_APP_ID = 1


def sum_open_door(start_time):
    """汇总小区每日开门次数"""
    # 正常用户开门记录
    qry1 = db.session.query(
        Community.comm_id.label('comm_id'),
        Community.age_id.label('age_id'),
        AgencyProfile.age_ids.label('age_ids'),
        Record.user_id.label('user_id'),
        db.func.date(Record.record_time).label('date'),
        db.case(
            (Record.acess_type.in_([1, 6]), 1),
            else_=0
        ).label('wx_count'),
        db.case(
            (Record.acess_type == 11, 1),
            else_=0
        ).label('app_count')
    ).join(
        DoorPhone,
        db.and_(
            DoorPhone.community_id == Community.comm_id,
            DoorPhone.appid != YJS_APP_ID
        )
    ).join(
        Agency,
        Agency.age_id == Community.age_id
    ).join(
        Record,
        db.and_(
            Record.door_mac == DoorPhone.door_mac,
            Record.acess_type.in_([1, 6, 11]),
            Record.record_time >= start_time,
            Record.record_time < db.func.curdate()
        )
    ).outerjoin(
        AgencyProfile,
        Community.age_id == AgencyProfile.age_id
    ).filter(
        Agency.parent_age_id != 114  # 父id为114是用户自己注册进来的，不参与计算
    ).distinct()

    # 免授权用户开门数据
    qry2 = db.session.query(
        Community.comm_id.label('comm_id'),
        Community.age_id.label('age_id'),
        AgencyProfile.age_ids.label('age_ids'),
        WxRecord.wxu_id.label('user_id'),
        db.func.date(WxRecord.record_time).label('date'),
        db.literal(0).label('wx_count'),
        db.literal(0).label('app_count')
    ).join(
        DoorPhone,
        db.and_(
            Community.comm_id == DoorPhone.community_id,
            DoorPhone.appid != YJS_APP_ID
        )
    ).join(
        WxRecord,
        db.and_(
            WxRecord.door_mac == DoorPhone.door_mac,
            WxRecord.record_time >= start_time,
            WxRecord.record_time < db.func.curdate()
        )
    ).outerjoin(
        AgencyProfile,
        Community.age_id == AgencyProfile.age_id
    ).distinct()

    sub_qry = qry2.union_all(qry1).subquery()  # 不能qry1.union_all(qry2)，不知道为什么distinct会出现内层，不对
    # print('####', sub_qry)
    qry = db.session.query(
        sub_qry.c.comm_id,
        sub_qry.c.age_id,
        sub_qry.c.age_ids,
        sub_qry.c.date,
        db.func.count().label('count'),
        db.func.sum(sub_qry.c.wx_count).label('wx_count'),
        db.func.sum(sub_qry.c.app_count).label('app_count')
    ).select_from(sub_qry).group_by(
        sub_qry.c.comm_id,
        sub_qry.c.age_id,
        sub_qry.c.age_ids,
        sub_qry.c.date
    )
    # 查询小区并汇总设备数量
    qry_comm = db.session.query(
        Community.comm_id,
        Community.age_id,
        AgencyProfile.age_ids,
        db.session.query(
            db.func.count()
        ).filter(
            DoorPhone.community_id == Community.comm_id,
            DoorPhone.appid != YJS_APP_ID
        ).label('doorphone_count'),
        db.session.query(
            db.func.count(DoorPhone.door_id)
        ).where(
            DoorPhone.community_id == Community.comm_id,
            DoorPhone.appid != YJS_APP_ID,
            db.session.query(Record.record_id).filter(
                Record.door_mac == DoorPhone.door_mac,
                Record.record_time >= start_time,
                Record.record_time < db.func.curdate()
            ).exists()
        ).label('online_count')
    ).outerjoin(
        AgencyProfile,
        Community.age_id == AgencyProfile.age_id
    ).filter(
        Community.age_id > 0
    )
    comm_struct = {row.comm_id: row for row in qry_comm}

    for row in qry:
        # 汇总小区设备数量
        doorphone_count = 0
        online_count = 0
        comm = comm_struct.get(row.comm_id)
        if comm:
            doorphone_count = comm.doorphone_count
            online_count = comm.online_count

        rec = OpenDoorSum(
            date=row.date,
            community_id=row.comm_id,
            age_ids=row.age_ids if row.age_ids else business.get_parent_age_ids(row.age_id),
            count=row.count ,
            wx_count=row.wx_count ,
            app_count=row.app_count ,
            doorphone_count=doorphone_count,
            online_count=online_count
        )
        db.session.add(rec)
        try:
            db.session.commit()
        except:
            db.session.rollback()

    # 把没有日活，但有设备的小区也加上
    for row in comm_struct.values():
        if row.doorphone_count == 0:
            continue

        rec = OpenDoorSum(
            date=db.func.curdate() - db.text('interval 1 day'),
            community_id=row.comm_id,
            age_ids=row.age_ids if row.age_ids else business.get_parent_age_ids(row.age_id),
            count=0,
            doorphone_count=row.doorphone_count
        )
        db.session.add(rec)
        try:
            db.session.commit()
        except:
            db.session.rollback()


def init_profile():
    """初始化profile"""
    qry = db.session.query(
        Agency.age_id,
        Agency.age_password
    ).outerjoin(
        AgencyProfile,
        Agency.age_id == AgencyProfile.age_id
    ).filter(
        AgencyProfile.age_id.is_(None)
    )
    for row in qry:
        profile = AgencyProfile(
            age_id=row.age_id,
            password=row.age_password,
            age_ids=business.get_parent_age_ids(row.age_id)
        )
        db.session.add(profile)
        db.session.commit()


def run():
    init_profile()
    # 汇总开门次数
    start_time = date.today() - timedelta(days=1)
    sum_open_door(start_time)


if __name__ == '__main__':
    with app.app_context():
        run()
