"""小程序和公众号公共接口"""
from corks import cache
from corks.utils import log
from . import api
import requests


_logger = log.get_logger('wx_common', __name__)

# 取得access_token的接口地址
_token_url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={appid}&secret={secret}'
_stable_token = 'https://api.weixin.qq.com/cgi-bin/stable_token'

# 素材管理相关接口
# 文档:https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1444738726
_get_material_url = 'https://api.weixin.qq.com/cgi-bin/material/get_material?access_token={access_token}'
_add_material_url = 'https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={access_token}&type={type}'
_del_material_url = 'https://api.weixin.qq.com/cgi-bin/material/del_material?access_token={access_token}'

_add_temp_material_url = 'https://api.weixin.qq.com/cgi-bin/media/upload?access_token={access_token}&type={type}'
_get_temp_material_url = 'https://api.weixin.qq.com/cgi-bin/media/get?access_token={access_token}&media_id={media_id}'


@log.log_exception(_logger)
def get_access_token(appid, secret):
    """
    取得access_token
    :param appid:
    :param secret:
    :return:
    """
    cache_key = f'access_token:{appid}'
    access_token = cache.get(cache_key)
    if access_token:
        return access_token

    url = _token_url.format(appid=appid, secret=secret)
    try:
        res = api.call(url, method='GET')

        access_token = res['access_token']
        expires_in = res['expires_in']

        # 缓存
        cache.set(cache_key, access_token, timeout=int(expires_in))

        return access_token
    except Exception as e:
        raise Exception(f'获取微信access_token出错:{e}')


@log.log_exception(_logger)
def get_stable_access_token(appid, secret, force_refresh=False):
    """
    取得固定access_token
    :param appid:
    :param secret:
    :param force_refresh: 是否强制刷新
    :return:
    """
    cache_key = f'access_token:{appid}'
    access_token = cache.get(cache_key)
    if access_token:
        return access_token

    url = _stable_token.format(appid=appid, secret=secret)
    params = {
        'grant_type': 'client_credential',
        'appid': appid,
        'secret': secret,
        'force_refresh': force_refresh
    }
    try:
        res = api.call(url, params)
        access_token = res['access_token']
        expires_in = res['expires_in']
        # 缓存
        cache.set(cache_key, access_token, timeout=900)  # int(expires_in)

        return access_token
    except Exception as e:
        raise Exception(f'获取微信固定access_token出错:{e}')


@log.log_exception(_logger)
def get_material(access_token, media_id):
    """
    获取永久素材
    :param access_token:
    :param media_id:
    :return:
    """
    url = _get_material_url.format(access_token=access_token)
    params = {
        'media_id': media_id
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'获取永久素材出错:{e}')


@log.log_exception(_logger)
def add_material(access_token, mtype, fp):
    """
    新增永久媒体素材
    :param access_token:
    :param mtype: image:图片 voice:语音 video:视频 thumb:缩略图
    :param fp: file-like object 注意：如果是BytesIO这样的对象，应该指定文件名，传一个tuple=('xxx.png', fp)
    :return:
        {}
    """
    url = _add_material_url.format(access_token=access_token, type=mtype)
    files = {'media': fp}
    rsp = requests.post(url, files=files)
    rs = rsp.json()

    errcode = rs.get('errcode')
    if errcode:
        errmsg = rs['errmsg']
        raise Exception(f'上传永久媒体素材错误：{errcode} {errmsg}')

    return rs


@log.log_exception(_logger)
def del_material(access_token, media_id):
    """
    删除永久素材
    :param access_token:
    :param media_id:
    :return:
    """
    url = _del_material_url.format(access_token=access_token)
    params = {
        'media_id': media_id
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'删除永久素材出错:{e}')


def add_temp_material(access_token, type, fp):
    """
    新增临时素材
    :param access_token:
    :param type:
    :param fp: file-like object 注意：如果是BytesIO这样的对象，应该指定文件名，传一个tuple=('xxx.png', fp)
    :return:
    """
    url = _add_temp_material_url.format(access_token=access_token, type=type)
    files = {'media': fp}
    rsp = requests.post(url, files=files)
    rs = rsp.json()

    errcode = rs.get('errcode')
    if errcode:
        errmsg = rs['errmsg']
        raise Exception(f'上传临时媒体素材错误：{errcode} {errmsg}')

    return rs


def get_temp_material(access_token, media_id):
    """
    获取临时素材
    :param access_token:
    :param media_id:
    :return:
    """
    url = _get_temp_material_url.format(access_token=access_token, media_id=media_id)
    params = {
        'media_id': media_id
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'获取临时素材出错:{e}')