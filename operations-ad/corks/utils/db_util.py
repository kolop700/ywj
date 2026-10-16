from flask import Response
from sqlalchemy_utils import types
from enum import Enum
from flask_sqlalchemy.pagination import QueryPagination
from sqlalchemy.orm.query import Query
from db import db
from .. import app
from datetime import date, datetime, time as TIME
from decimal import Decimal
from contextlib import contextmanager
from string import Template
import urllib.parse
import inspect
import json
import math
import re


def fmt_enum(enum_type):
    """
    格式化枚举型，返回label
    :param enum_type:
    :return:
    """
    def func(v):
        try:
            item = enum_type(v)
            return getattr(item, 'label', item.name)
        except:
            return ''

    return func


def fmt_datetime(fmt='%Y-%m-%d %H:%M:%S'):
    """
    格式化时间
    :param fmt:
    :return:
    """
    def func(v):
        if v:
            return v.strftime(fmt)
        else:
            return ''

    return func


class _DeltaTemplate(Template):
    delimiter = "%"


def fmt_timedelta(day_fmt='%D天', time_fmt='%H:%M:%S'):
    """
    格式化timedelta
    @param day_fmt: 天格式
    @param time_fmt: 时间格式
    @return:
    """
    def func(v):
        if v:
            if v.days > 0:
                fmt = f'{day_fmt} {time_fmt}'
            else:
                fmt = time_fmt

            d = {"D": v.days}
            hours, rem = divmod(v.seconds, 3600)
            minutes, seconds = divmod(rem, 60)
            d["H"] = '{:02d}'.format(hours)
            d["M"] = '{:02d}'.format(minutes)
            d["S"] = '{:02d}'.format(seconds)
            t = _DeltaTemplate(fmt)
            return t.substitute(**d)
        else:
            return ''

    return func


def fmt_time_since(time=False):
    """
    格式化过去时间成易读格式。比如"1分钟前"
    :param time: datetime类型或时间戳(int)
    :return:
    """
    now = datetime.now()
    if type(time) is int:
        diff = now - datetime.fromtimestamp(time)
    elif isinstance(time, datetime):
        diff = now - time
    elif not time:
        diff = now - now
    second_diff = diff.seconds
    day_diff = diff.days

    if day_diff < 0:
        return ''

    if day_diff == 0:
        if second_diff < 20:
            return "刚刚"
        if second_diff < 60:
            return "%s 秒前" % second_diff
        if second_diff < 120:
            return "1分钟前"
        if second_diff < 3600:
            return "%s 分钟前" % (second_diff // 60)
        if second_diff < 7200:
            return "1小时前"
        if second_diff < 86400:
            return "%s 小时前" % (second_diff // 3600)
    if day_diff == 1:
        return "昨天"
    if day_diff == 2:
        return "前天"
    if day_diff < 7:
        return "%s 天前" % day_diff
    if day_diff < 31:
        return "%s 周前" % (day_diff // 7)
    if day_diff < 365:
        return "%s 月前" % (day_diff // 30)
    return "%s 年前" % (day_diff // 365)


def fmt_round_digits(v):
    return str(v).rstrip('0').rstrip('.')


def fmt_bool(v):
    return '是' if v else '否'


def fmt_phoneNo(v):
    """格式化电话号码，中间用*替代"""
    return v[:3]+'****'+v[-4:]


def row_to_dict(row, field_names=None, raise_field_not_exists=True, on_iter_row=None, **field_formatter):
    """
    把查询结果集的行转成dict
    :param row:
    :param field_names:
    :param raise_field_not_exists:
    :param on_iter_row:  每次迭代的回调，可以用于增加/更新字段，返回一个dict
    :param field_formatter:
    :return:
    """
    result = {}
    if field_names is None:
        if isinstance(row, db.Model):
            field_names = row.__mapper__.c.keys()
        else:
            if hasattr(row, 'keys'):  # sqlalchemy2.0以前有keys
                field_names = row.keys()
            else:  # sqlalchemy2.0以后用_fields
                field_names = row._fields

    for idx, fieldname in enumerate(field_names):
        field_value = None
        field_not_exists = False
        if hasattr(row, fieldname):
            field_value = getattr(row, fieldname)
        else:
            obj = row
            for k in fieldname.split('.'):
                if not hasattr(obj, k):
                    field_not_exists = True
                    break

                field_value = getattr(obj, k)
                if field_value:
                    obj = field_value
                else:
                    field_value = ''
                    break

        if field_not_exists:
            if raise_field_not_exists:
                raise Exception('字段[%s]不存在!' % fieldname)
            else:
                continue

        fmt_func = field_formatter.get(fieldname)
        if fmt_func:
            sig = inspect.signature(fmt_func)
            if len(sig.parameters) == 2:  # 有2个参数，则第2个传当前行对象
                field_value = fmt_func(field_value, row)
            else:
                field_value = fmt_func(field_value)

        if isinstance(field_value, Enum):  # 必须放在int之前，因为枚举型也属于int
            result['%s_label' % fieldname] = getattr(field_value, 'label', field_value.name)
            result[fieldname] = field_value.value
        elif isinstance(field_value, (str, int, float, dict, list)) or field_value is None:
            result[fieldname] = field_value
        elif isinstance(field_value, datetime):
            result[fieldname] = field_value.strftime('%Y-%m-%d %H:%M:%S')
        elif isinstance(field_value, date):
            result[fieldname] = field_value.strftime('%Y-%m-%d')
        elif isinstance(field_value, TIME):
            result[fieldname] = field_value.strftime('%H:%M:%S')
        elif isinstance(field_value, Decimal):
            #scale = abs(field_value.as_tuple().exponent) or 2
            #fmt = '%%0.%df' % scale
            #result[fieldname] = fmt % field_value
            # 像上面直接转成字符串，json系列化后也成了字符串，前端有时处理(layui排序)会有问题，现在转成float处理
            result[fieldname] = float(field_value)
        elif isinstance(field_value, types.choice.Choice):
            result['%s_name' % fieldname] = field_value.value
            result[fieldname] = field_value.code
        elif isinstance(field_value, db.Model):  # 当字段为model对象时递归。db.session.query(Model1,Model2)这种查询字段会是model
            new_field_names = field_names[idx+1:] + field_value.keys()
            _result = row_to_dict(field_value, new_field_names, raise_field_not_exists=False, **field_formatter)

            for k, v in _result.items():
                fk = k
                fk_id = 1
                while fk in result:  # 处理字段重名，如两个表都有id，则第一个叫id，第二个叫id_1，如此类推...
                    fk = '%s_%s' % (k, fk_id)
                    fk_id += 1

                result[fk] = v

            continue
        else:
            raise Exception('字段[%s]:不支持系列化!(type:[%s])' % (field_value, type(field_value)))

    # 处理on_iter_row
    if callable(on_iter_row):
        d = on_iter_row(row)
        if not isinstance(d, dict):
            raise Exception('on_iter_row必须返回字典(dict)类型')

        result.update(d)

    return result


class SerializableMixin(object):
    def keys(self):
        return self.__mapper__.c.keys()

    def as_dict(self, field_names=None, on_iter_row=None, **field_formatter):
        return row_to_dict(
            row=self,
            field_names=field_names,
            on_iter_row=on_iter_row,
            **field_formatter
        )

    def as_json(self, field_names=None, on_iter_row=None, **field_formatter):
        d = self.as_dict(
            field_names=field_names,
            on_iter_row=on_iter_row,
            **field_formatter
        )
        return json.dumps(d)


def get_query_count(q):
    count_q = q.statement.with_only_columns([db.func.count('*')]).order_by(None)#id
    count = q.session.execute(count_q).scalar()
    return count


def pager_to_dict(pager, field_names=None, on_iter_row=None, **field_formatter):
    """
    把分页对象转成字典(用于json系列化)
    :param pager:  分页对象
    :param field_names:
    :param on_iter_row: 每次迭代的回调，可以用于增加字段，返回一个dict
    :param field_formatter:
    :return:
    """
    result = {
        'has_next': pager.has_next,
        'total': pager.total,
        'page': pager.page,
        'pages': pager.pages
    }

    items = []
    for it in pager.items:
        items.append(
            row_to_dict(
                row=it,
                field_names=field_names,
                on_iter_row=on_iter_row,
                **field_formatter
            )
        )

    result['items'] = items

    return result


class __myPagination(QueryPagination):

    def as_dict(self, field_names=None, on_iter_row=None, **field_formatter):
        return pager_to_dict(
            pager=self,
            on_iter_row=on_iter_row,
            field_names=field_names,
            **field_formatter
        )


# 从flask-sqlalchemy抽出来的,为sqlalchemy.orm.query.Query分页函数
def get_pager(query, page, per_page=20):
    """
    分页函数。
    参数：
        query   : sqlalchemy的query
        page    :当前页
        per_page:每页记录数，默认为20
    返回值：
        返回一个Pagination对像。
        Pagination.has_next:是否有下一页
        Pagination.total   :总记录数
        Pagination.page    :当前页
        Pagination.pages   :共几页
        Pagination.items   :当前页数据
    """
    if not isinstance(query, Query):
        raise Exception('query必须为sqlalchemy.orm.query.Query!')

    page = int(page)
    per_page = int(per_page)

    if page < 1:
        page = 1

    return __myPagination(page=page, per_page=per_page, query=query)


def query_pager(sql, page, per_page=0, bind_key='', total_count=None, optimize_count=True):
    """
    分页函数。
    参数：
        page    :当前页
        per_page:每页记录数，默认为20
        bind_key:连接和数据库绑定key
        total_count: 可外部自己查总数录数传进来(优化时用)
        optimize_count:优化count，默认为True，但sql为select a,b,c,(select a from xx) dd from xx这种时会有问题
    返回值：
        返回一个Pagination对像。
        Pagination.has_next:是否有下一页
        Pagination.total   :总记录数
        Pagination.page    :当前页
        Pagination.pages   :共几页
        Pagination.items   :当前页数据
    """
    page = int(page)

    per_page = int(per_page)
    if per_page < 1:
        raise Exception('每页行数(per_page)不能小于1！')

    bind = None
    if bind_key:
        bind = db.get_engine(app, bind=bind_key)

    if total_count is None:
        # 计算总记录数
        if optimize_count:
            count_sql = re.sub('select +[\s\S]+ +from', 'select count(*) from', sql, count=1, flags=re.IGNORECASE)
        else:
            count_sql = 'select count(*) from (%s) xxx' % sql

        total_count = db.session.execute(count_sql, bind=bind).scalar() or 0

    last_page = math.ceil(total_count / per_page)  # 最后一页
    if last_page < 1:
        last_page = 1

    if last_page < page:  # 如果当前页大过最后一页，则取最后一页
        page = last_page
    elif page < 0:  # 小于0取第一页
        page = 1
    elif page == 0:  # 等于0取最后一页
        page = last_page

    offset = (page - 1) * per_page
    if offset >= 0:
        psql = sql + ' limit %d offset %d' % (per_page, offset)
    else:
        psql = sql

    rs = db.session.execute(psql, bind=bind)
    return __myPagination(rs, page, per_page, total_count, rs)


def query_result_to_list(qry, field_names=None, on_iter_row=None, **field_formatter):

    #if not isinstance(qry_result,result.ResultProxy):
    #    raise Exception('参数qry_result必须为db.session.execute的执行结果！')

    result = []
    for row in qry:
        result.append(row_to_dict(row=row, field_names=field_names, on_iter_row=on_iter_row, **field_formatter))

    return result


@contextmanager
def transcation(logger=None, msg='', raise_exception=True):  # 事务处理
    try:
        yield
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        if logger:
            if msg:
                logger.error(msg)

            logger.error(str(e))

        if raise_exception:
            raise
    finally:
        #session.close()
        pass


def export_excel(filename, qry, fields, **kwargs):
    """
    导出数据到excel
    @param filename:
    @param qry: 可迭代的查询结果集
    @param fields: {字段名:字段标题, ...}
    @kwargs: 值处理
    @return:
    返回一个Response
    """
    import xlwt

    if not fields:
        raise Exception('未设置导出字段')

    # 生成excel文档
    workbook = xlwt.Workbook()
    sheet = workbook.add_sheet(filename)  # 创建一个sheet
    header = list(fields.values())

    # 边框样式
    borders = xlwt.Borders()
    borders.left = 1
    borders.right = 1
    borders.top = 1
    borders.bottom = 1
    borders.bottom_colour = 0x3A
    style = xlwt.XFStyle()
    style.borders = borders

    # 起始行
    line = 0
    # 表头
    for i in range(len(header)):
        sheet.write(line, i, header[i], style)

    # 内容
    line += 1
    for row in qry:
        for i, field in enumerate(fields):
            if isinstance(row, dict):
                data = row[field]
            else:
                data = getattr(row, field)

            if field in kwargs:
                func = kwargs[field]
                if callable(func):
                    data = func(data)
            # 写入
            sheet.write(line, i, data, style)

        line += 1

    rsp = Response(mimetype='application/vnd.ms-excel')
    encoded_filename = urllib.parse.quote(filename)
    rsp.headers['Content-Disposition'] = f"attachment; filename*=UTF-8\'\'{encoded_filename}.xls"
    workbook.save(rsp.stream)
    return rsp