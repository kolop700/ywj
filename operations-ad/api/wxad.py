"""微信小程序流量主收益相关接口"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import g, request
from corks import app, api, error
from corks.utils import log
from utils import trans
from common import business
from db.old_models import *
from db.ad_models import *
from db.enums import *
from wx.common import get_access_token
from wx.api import call as wx_call
from . import auth
from db import db

API_MODULE_NAME = '微信流量主'
API_URL_PREFIX = 'wx/wxad'
API_MODULE_AUTH = auth

_logger = log.get_logger('wxad', __name__)

_BJ_TZ = timedelta(hours=8)  # 北京时间与UTC的时差

# 微信流量主数据接口（广告汇总数据，按广告位类型×日期）
# 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/ad-data-interface.html
_PUBLISHER_STAT_URL = 'https://api.weixin.qq.com/publisher/stat'
_PAGE_SIZE = 90  # 微信接口单页最大条数

_DEFAULT_SYNC_DAYS = 7  # 默认同步最近天数（微信数据T+1生成且有修正，多拉几天覆盖更新）


def _bj_today():
    """当前北京日期"""
    return (datetime.now(timezone.utc).replace(tzinfo=None) + _BJ_TZ).date()


def _check_input_auth():
    """校验录入权限：与收入录入一致，仅根用户可操作"""
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
    return user


def _fetch_and_save(start_date, end_date, brand=0):
    """
    拉取微信流量主广告汇总数据入库（日期×广告位类型×品牌，已存在则覆盖更新）
    :param start_date: 开始日期(date)
    :param end_date: 结束日期(date)
    :param brand: 品牌（0=星云小程序 1=云卫家小程序）
    :return: 入库条数
    """
    appid = app.config.get('WXAD_APPID') or ''
    secret = app.config.get('WXAD_APPSECRET') or ''
    if not appid or not secret:
        raise Exception('未配置小程序参数(WXAD_APPID/WXAD_APPSECRET)，请先在config_.py中填写')

    access_token = get_access_token(appid, secret)

    fetched = 0
    page = 1
    while True:
        url = (
            f'{_PUBLISHER_STAT_URL}?action=publisher_adpos_general'
            f'&access_token={access_token}&page={page}&page_size={_PAGE_SIZE}'
            f'&start_date={start_date:%Y-%m-%d}&end_date={end_date:%Y-%m-%d}'
        )
        res = wx_call(url, method='GET')

        base_resp = res.get('base_resp') or {}
        if base_resp.get('ret') != 0:
            raise Exception(f"微信流量主接口出错：{base_resp.get('ret')} {base_resp.get('err_msg')}")

        rows = res.get('list') or []
        for it in rows:
            try:
                d = datetime.strptime(it.get('date') or '', '%Y-%m-%d').date()
                ad_slot = (it.get('ad_slot') or '').strip()[:64]
                income_fen = int(it.get('income') or 0)
                ecpm_fen = Decimal(str(it.get('ecpm') or 0))
            except Exception as e:
                _logger.warning(f'微信流量主数据解析跳过：{it}，{e}')
                continue
            if not ad_slot:
                continue

            rec = WxAdIncome.query.filter_by(income_date=d, ad_slot=ad_slot, brand=brand).first()
            if not rec:  # 不存在则新增
                rec = WxAdIncome(income_date=d, ad_slot=ad_slot, brand=brand)
                db.session.add(rec)
            # 存在则覆盖更新（微信数据会修正）
            rec.req_succ_count = int(it.get('req_succ_count') or 0)
            rec.exposure_count = int(it.get('exposure_count') or 0)
            rec.click_count = int(it.get('click_count') or 0)
            rec.income_fen = income_fen
            rec.ecpm_fen = ecpm_fen
            fetched += 1

        total = int(res.get('total_num') or 0)
        if page * _PAGE_SIZE >= total or not rows or page > 50:  # 翻页结束（page>50保险防死循环）
            break
        page += 1

    db.session.commit()
    return fetched


@api.route('/fetch')
@api.auth_exempt
def fetch(args):
    """
    拉取微信流量主数据入库（免认证，定时任务用，URL需带key密钥）
    示例：/wx/wxad/fetch?key=xxx  默认同步最近7天，可crontab每天定时调用
    品牌由配置WXAD_BRAND决定（小程序凭据与品牌一一对应），不接受前端传参
    """
    key = app.config.get('WXAD_FETCH_KEY') or ''
    if not key or request.values.get('key') != key:  # 密钥不匹配
        _logger.warning(f'微信流量主同步密钥不匹配已拒绝。ip={request.remote_addr}')
        raise Exception(error.AUTH, '请先登录')

    brand = int(app.config.get('WXAD_BRAND', 0))
    today = _bj_today()
    fetched = _fetch_and_save(today - timedelta(days=_DEFAULT_SYNC_DAYS - 1), today, brand=brand)
    _logger.info(f'微信流量主数据同步完成：{fetched}条')
    return {'fetched': fetched}


@api.route('/sync', methods=['POST'])
@trans.auto
def sync(args):
    """
    同步微信流量主数据（管理页面按钮用，默认同步最近7天）
    品牌由配置WXAD_BRAND决定（当前凭据只对应星云小程序），不接受前端传参
    """
    _check_input_auth()

    brand = int(app.config.get('WXAD_BRAND', 0))
    today = _bj_today()
    fetched = _fetch_and_save(today - timedelta(days=_DEFAULT_SYNC_DAYS - 1), today, brand=brand)
    return {'fetched': fetched}


@api.arg('start_date', '开始日期', required=True, type=api.Date())
@api.arg('end_date', '结束日期', required=True, type=api.Date())
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=0)
@api.route('/daily_summary')
def daily_summary(args):
    """
    按天汇总微信流量主收益（拉取累计值），并对照已生成的收入
    """
    rows = db.session.query(
        WxAdIncome.income_date.label('income_date'),
        db.func.sum(WxAdIncome.income_fen).label('fen_sum'),
        db.func.sum(WxAdIncome.exposure_count).label('exposure_sum')
    ).filter(
        WxAdIncome.brand == args.brand,
        WxAdIncome.income_date >= args.start_date,
        WxAdIncome.income_date <= args.end_date
    ).group_by(
        WxAdIncome.income_date
    ).order_by(
        db.desc(WxAdIncome.income_date)
    ).all()

    dates = [row.income_date for row in rows]
    comm_dict = {}
    if dates:
        qry_comm = db.session.query(
            Commission.date,
            Commission.amount
        ).filter(
            Commission.type == CommissionType.AD,
            Commission.brand == args.brand,
            Commission.date.in_(dates)
        )
        comm_dict = {row.date: row.amount for row in qry_comm}

    items = []
    for row in rows:
        cny = Decimal(str(row.fen_sum or 0)) / 100  # 分→元
        amount = comm_dict.get(row.income_date)
        items.append({
            'date': row.income_date.strftime('%Y-%m-%d'),
            'cny': f'{cny:.2f}',
            'exposure': int(row.exposure_sum or 0),
            'amount': f'{amount:.2f}' if amount is not None else '',
            'generated': amount is not None
        })

    return {'items': items}


@api.arg('date', '日期', required=True, type=api.Date())
@api.arg('amount', '金额(元)。不传则按微信数据自动计算', type=api.Money(gt=0))
@api.arg('remark', '备注', type=api.String())
@api.arg('brand', '品牌', type=api.Select({0: '星云', 1: '云卫家'}), default=0)
@api.route('/gen_commission', methods=['POST'])
@trans.auto
def gen_commission(args):
    """
    把微信流量主数据汇总生成[小程序日活收入]，并触发分润
    """
    # 权限校验：与收入录入一致，仅根用户可操作
    user = _check_input_auth()

    # 汇总微信流量主数据（分→元，按品牌）
    fen_sum = db.session.query(
        db.func.sum(WxAdIncome.income_fen)
    ).filter(
        WxAdIncome.income_date == args.date,
        WxAdIncome.brand == args.brand
    ).scalar()
    if not fen_sum:
        raise Exception(f'{args.date}没有微信流量主数据，请先同步')

    auto_amount = (Decimal(str(fen_sum)) / 100).quantize(Decimal('0.01'))
    if args.amount:  # 页面人工确认的金额优先
        amount = args.amount
        amount_note = f'人工确认，微信参考￥{auto_amount:.2f}'
    else:
        amount = auto_amount
        amount_note = f'微信流量主数据合计￥{auto_amount:.2f}'
    if amount <= 0:
        raise Exception('生成金额必须大于0')

    # 防重：该日期该品牌已生成（或人工录入）过[小程序日活收入]则拒绝
    old = Commission.query.filter(
        Commission.date == args.date,
        Commission.type == CommissionType.AD,
        Commission.brand == args.brand
    ).first()
    if old:
        raise Exception(f'该日期已录入[{CommissionType.AD.label}]金额￥{old.amount}，不能重复生成')

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
        type=CommissionType.AD,
        brand=args.brand,
        amount=amount,
        remark=(args.remark or f'微信流量主收益汇总({amount_note})')[:500],
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
