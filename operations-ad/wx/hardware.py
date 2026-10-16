"""硬件设备(voip)相关接口"""
from corks import cache
from corks.utils import log
from . import api
import requests

_logger = log.get_logger('wx_hardware', __name__)


_getsnticket_url = 'https://api.weixin.qq.com/wxa/getsnticket?access_token={access_token}'


@log.log_exception(_logger)
def get_sn_ticket(access_token, sn, model_id):
    """获取小程序端设备授权用的sn_ticket"""
    url = _getsnticket_url.format(access_token=access_token)
    params = {
        'sn': sn,
        'model_id': model_id
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'获取设备sn_ticket出错:{e}')
