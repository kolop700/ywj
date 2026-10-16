"""Taku广告收益相关接口"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import g, request
from sqlalchemy.exc import IntegrityError
from corks import app, api
from corks.utils import log
from utils import trans
from common import business
from db.old_models import *
from db.ad_models import *
from db.enums import *
from . import auth
from db import db

API_MODULE_NAME = 'Taku广告'
API_URL_PREFIX = 'wx/taku'
API_MODULE_AUTH = auth

_logger = log.get_logger('taku', __name__)

_BJ_TZ = timedelta(hours=8)  # 北京时间与UTC的时差


def _bj_now():
    """当前北京时间"""
    return datetime.now(timezone.utc).replace(tzinfo=None) + _BJ_TZ


def _to_int(value, default=0):
    try:
        return int(str(value).strip())
    except Exception:
        return default


def _to_decimal(value, default=None):
    try:
        return Decimal(str(value).strip())
    except Exception:
        return default


@api.route('/income_notify', methods=['GET'])
@api.auth_exempt
def income_notify(args):
    """
    Taku广告展示收益S2S回调接收（免认证，URL需带key密钥）
    注意：Taku回调失败不会重发，本接口必须始终响应200；重复数据由req_id+adsource_id唯一键去重
    """
    try:
        q = request.values
        key = app.config.get('TAKU_CALLBACK_KEY') or ''
        # Taku 拼接自身参数时用的是「?」而非「&」（因配置的回调 URL 已带 ?key=），
        # 导致 key 值被污染为「key=XXX?adformat=3&...」。截断首个 ? 取纯 key 再比对。
        recv_key = (q.get('key') or '').split('?')[0].strip()
        if not key or recv_key != key:  # 密钥不匹配，静默忽略
            query_str = request.query_string.decode("utf-8", "ignore")[:500]
            _logger.warning(f'Taku回调密钥不匹配已忽略。ip={request.remote_addr} query={query_str}')
            return 'ok'

        req_id = (q.get('req_id') or '').strip()
        adsource_id = _to_int(q.get('adsource_id'))
        price = _to_decimal(q.get('adsource_price'))
        if not req_id or adsource_id <= 0 or price is None:
            query_str = request.query_string.decode("utf-8", "ignore")[:500]
            _logger.warning(f'Taku回调参数不完整已忽略。query={query_str}')
            return 'ok'

        # 广告展示时间：毫秒时间戳 → 北京时间
        ts_ms = _to_int(q.get('timestamp'))
        if ts_ms > 0:
            show_time = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).replace(tzinfo=None) + _BJ_TZ
        else:
            show_time = _bj_now()

        rec = TakuAdIncome(
            req_id=req_id,
            adsource_id=adsource_id,
            brand=1,  # Taku目前仅云卫家App接入
            user_id=(q.get('user_id') or '').strip()[:64],
            adformat=_to_int(q.get('adformat')),
            placement_id=(q.get('placement_id') or '').strip()[:64],
            nw_firm_id=_to_int(q.get('nw_firm_id')),
            adsource_price=price,
            currency=(q.get('currency') or 'USD').strip()[:8],
            geo_short=(q.get('geo_short') or '').strip()[:8],
            package_name=(q.get('package_name') or '').strip()[:64],
            client_ip=((q.get('client_ip') or request.remote_addr) or '')[:46],
            show_custom_ext=(q.get('show_custom_ext') or '')[:500],
            show_time=show_time,
            income_date=show_time.date(),
            raw_data=request.query_string.decode('utf-8', 'ignore')[:1000]
        )
        db.session.add(rec)
        try:
            db.session.commit()
        except IntegrityError:  # req_id+adsource_id重复，忽略即可
            db.session.rollback()
    except Exception as e:
        try:
            db.session.rollback()
        except Exception:
            pass
        _logger.error(f'Taku回调处理异常：{e}')

    return 'ok'  # 必须返回200


@api.arg('start_date', '开始日期', required=True, type=api.Date())
@api.arg('end_date', '结束日期', required=True, type=api.Date())
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=1)
@api.route('/daily_summary')
def daily_summary(args):
    """
    按天汇总Taku收益（回调累计值），并对照已生成的收入
    """
    rows = db.session.query(
        TakuAdIncome.income_date.label('income_date'),
        db.func.count().label('cnt'),
        db.func.sum(TakuAdIncome.adsource_price).label('ecpm_sum')
    ).filter(
        TakuAdIncome.brand == args.brand,
        TakuAdIncome.income_date >= args.start_date,
        TakuAdIncome.income_date <= args.end_date
    ).group_by(
        TakuAdIncome.income_date
    ).order_by(
        db.desc(TakuAdIncome.income_date)
    ).all()

    dates = [row.income_date for row in rows]
    comm_dict = {}
    if dates:
        qry_comm = db.session.query(
            Commission.date,
            Commission.amount
        ).filter(
            Commission.type == CommissionType.APP_AD,
            Commission.brand == args.brand,
            Commission.date.in_(dates)
        )
        comm_dict = {row.date: row.amount for row in qry_comm}

    rate = _to_decimal(app.config.get('TAKU_USD_RATE'), Decimal('0'))
    items = []
    for row in rows:
        usd = row.ecpm_sum / 1000  # ecpm总和/1000 = 当日收益（美元）
        cny = (usd * rate).quantize(Decimal('0.01')) if rate > 0 else None
        amount = comm_dict.get(row.income_date)
        items.append({
            'date': row.income_date.strftime('%Y-%m-%d'),
            'cnt': row.cnt,
            'usd': f'{usd:.4f}',
            'cny': f'{cny:.2f}' if cny is not None else '',
            'amount': f'{amount:.2f}' if amount is not None else '',
            'generated': amount is not None
        })

    return {
        'rate': f'{rate:g}',
        'items': items
    }


@api.arg('date', '日期', required=True, type=api.Date())
@api.arg('amount', '金额(元)。不传则按回调金额×汇率自动计算', type=api.Money(gt=0))
@api.arg('remark', '备注', type=api.String())
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=1)
@api.route('/gen_commission', methods=['POST'])
@trans.auto
def gen_commission(args):
    """
    把Taku回调汇总生成[APP日活收入]，并触发分润
    """
    # 权限校验：与收入录入一致，仅根用户可操作
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

    # 汇总Taku回调（ecpm总和/1000=美元，按品牌）
    ecpm_sum = db.session.query(
        db.func.sum(TakuAdIncome.adsource_price)
    ).filter(
        TakuAdIncome.income_date == args.date,
        TakuAdIncome.brand == args.brand
    ).scalar()
    if not ecpm_sum:
        raise Exception(f'{args.date}没有Taku回调数据，不能生成')

    usd = ecpm_sum / 1000
    rate = _to_decimal(app.config.get('TAKU_USD_RATE'), Decimal('0'))
    if args.amount:  # 页面人工确认的金额优先
        amount = args.amount
        amount_note = f'人工确认，回调参考USD={usd:.4f}'
    else:
        if rate <= 0:
            raise Exception('未配置汇率(TAKU_USD_RATE)，请手动填写金额')
        amount = (usd * rate).quantize(Decimal('0.01'))
        amount_note = f'回调USD={usd:.4f}×汇率{rate}'
    if amount <= 0:
        raise Exception('生成金额必须大于0')

    # 防重：该日期该品牌已生成（或人工录入）过则拒绝
    old = Commission.query.filter(
        Commission.date == args.date,
        Commission.type == CommissionType.APP_AD,
        Commission.brand == args.brand
    ).first()
    if old:
        raise Exception(f'该日期已录入[{CommissionType.APP_AD.label}]金额￥{old.amount}，不能重复生成')

    # 分润依赖当天该品牌日活数据
    has_open_door = db.session.query(
        OpenDoorSum.query.filter(
            OpenDoorSum.date == args.date,
            OpenDoorSum.brand == args.brand
        ).exists()
    ).scalar()
    if not has_open_door:
        raise Exception(f'该日期({args.date})品牌[{args.brand}]没有日活数据，不能生成收入')

    comm = Commission(
        date=args.date,
        type=CommissionType.APP_AD,
        brand=args.brand,
        amount=amount,
        remark=(args.remark or f'Taku广告收益汇总({amount_note})')[:500],
        input_age_id=user.age_id,
        input_age_name=user.age_name
    )
    db.session.add(comm)
    db.session.flush()
    # 分润处理
    business.ad_commission_sharing(
        date=comm.date,
        comm_type=comm.type.value,
        age_id=g.age_id,
        amount=comm.amount,
        settle_platform=g.is_admin,
        brand=args.brand
    )
    return {
        'date': args.date.strftime('%Y-%m-%d'),
        'amount': f'{amount:.2f}'
    }
