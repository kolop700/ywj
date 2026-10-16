"""一些常用函数"""
from corks import cache, app
from corks.utils import db_util
from db import db, rds
from datetime import date
from io import BytesIO
import qrcode
import hashlib


def make_qrcode(data):  # 生成二维码
    """
    生成二维码图片(png)。返回图片数据
    """
    hash = hashlib.md5(data.encode()).hexdigest()
    cache_key = f'qr:{hash}'
    qrdata = cache.get(cache_key)
    if not qrdata:
        # 生成二维码
        qr = qrcode.QRCode()
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image()
        buf = BytesIO()
        img.save(buf)
        qrdata = buf.getvalue()
        # 缓存
        cache.set(cache_key, qrdata, timeout=60 * 5)

    return qrdata


def get_status_count(status_field, status_type, qry_count=True,
                     cache_time_out=0, condition=None, select_from=None):
    """
    按状态汇总
    @param status_field: 状态字段。值Model的字段，比如User.status
    @param status_type: 状态类型
    @param qry_count: 是否查数量
    @param cache_time_out: 缓存时间
    @param condition: 过滤条件
    @param select_from: 表(model),一般可不传
    @return:
    """
    cache_key = f'status_count:{status_field}'
    if qry_count:
        data = cache.get(cache_key)
        if data:
            return data

        if select_from:
            qry = db.session.query(
                status_field.label('status_'),
                db.func.count().label('count_')
            ).select_from(select_from).group_by(
                db.text('status_')
            )
        else:
            qry = db.session.query(
                status_field.label('status_'),
                db.func.count().label('count_')
            ).group_by(
                db.text('status_')
            )

        if isinstance(condition, (tuple, list)):
            qry = qry.filter(*condition)
        elif condition is not None:
            qry = qry.filter(condition)

        status_dict = {row.status_: row.count_ for row in qry}
    else:
        status_dict = {}

    result = [{'id': it.value, 'name': it.label, 'count': status_dict.get(it, 0)} for it in status_type]
    # 设置缓存
    if qry_count and cache_time_out > 0:
        cache.set(cache_key, result, timeout=cache_time_out)

    return result


def gen_order_no(order_type, prefix, fill_part='', inc_part_len=5):  # 生成订单号
    """
    生成单号。订单号结构：{前缀prefix(debug模工自动在前面加_)}{6位日期}{填充fill_part+每日累计数，长度不足前补0}
    @param order_type: 单号类型。字符串
    @param prefix: 单号前缀
    @param fill_part:  填充部分
    @param inc_part_len:  自动累计部分长度(长度不足前面补0)
    @return:
    """
    debug = app.config.get('DEBUG', False)
    if debug:
        prefix = f'_{prefix}'

    ds = date.today().strftime('%y%m%d')
    key = f'{order_type}:{ds}'
    inc_value = rds.incr(key)
    rds.expire(key, time=60*60*24)

    return f'{prefix}{ds}{fill_part}{inc_value:0>{inc_part_len}}'


def qry_total_row(qry, *total_fields, **field_values):
    """
    返回layui数据表格式的汇总数据
    @param qry:  查询
    @param *total_fields:  汇总的字段
    @param **field_values: 字段默认值
    @return:
    """
    myqry = qry.subquery()
    total_qry = db.session.query(
        *[db.func.sum(getattr(myqry.c, field)).label(field) for field in total_fields]
    ).select_from(myqry).first()

    total_row = db_util.row_to_dict(total_qry)
    return {**field_values, **total_row}


def set_lock(key, timeout):
    """
    上锁，防止后面重复操作
    @param key:
    @param timeout:
    @return:
        返回False: 上锁失败(锁已存在)
        返回True: 上锁成功
    """
    lock_key = f'lock:{key}'
    if rds.exists(lock_key):
        return False

    rds.set(lock_key, 1, ex=timeout)
    return True


def get_lock(key):
    """
    判断锁是否存在
    @param key:
    @return:
    """
    lock_key = f'lock:{key}'
    return rds.exists(lock_key)


def del_lock(key):
    """
    释放锁
    @param key:
    @return:
    """
    lock_key = f'lock:{key}'
    rds.delete(lock_key)
