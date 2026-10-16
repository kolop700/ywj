"""第三方平台api包装"""
from corks import cache
from db import db
from corks.utils import log, cache_result
from . import api
import hashlib
import json
import urllib
import requests


_logger = log.get_logger('wx_third_party', __name__)


_get_component_access_token_url = 'https://api.weixin.qq.com/cgi-bin/component/api_component_token'

_api_create_preauthcode_url = 'https://api.weixin.qq.com/cgi-bin/component/api_create_preauthcode?' \
                              'component_access_token={component_access_token}'

_api_get_authorizer_info_url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_info?' \
                               'component_access_token={component_access_token}'

_api_query_auth_url = 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth?' \
                      'component_access_token={component_access_token}'

_api_authorizer_token_url = 'https://api.weixin.qq.com/cgi-bin/component/api_authorizer_token?' \
                            'component_access_token={component_access_token}'

_fastregisterweapp_url = 'https://api.weixin.qq.com/cgi-bin/component/fastregisterweapp?' \
                         'action={action}&component_access_token={component_access_token}'

_gettemplatelist_url = 'https://api.weixin.qq.com/wxa/gettemplatelist?access_token={component_access_token}'


_modify_domain_url = 'https://api.weixin.qq.com/wxa/modify_domain?access_token={authorizer_access_token}'

_setwebviewdomain_url = 'https://api.weixin.qq.com/wxa/setwebviewdomain?access_token={authorizer_access_token}'

_getaccountbasicinfo_url = 'https://api.weixin.qq.com/cgi-bin/account/getaccountbasicinfo?' \
                           'access_token={authorizer_access_token}'

_getallcategories_url = 'https://api.weixin.qq.com/cgi-bin/wxopen/getallcategories?' \
                        'access_token={authorizer_access_token}'

_getcategory_url = 'https://api.weixin.qq.com/cgi-bin/wxopen/getcategory?access_token={authorizer_access_token}'

_addcategory_url = 'https://api.weixin.qq.com/cgi-bin/wxopen/addcategory?access_token={authorizer_access_token}'

_deletecategory_url = 'https://api.weixin.qq.com/cgi-bin/wxopen/deletecategory?access_token={authorizer_access_token}'

_commit_url = 'https://api.weixin.qq.com/wxa/commit?access_token={authorizer_access_token}'

_get_qrcode_url = 'https://api.weixin.qq.com/wxa/get_qrcode?access_token={authorizer_access_token}&path={path}'

_get_category_url = 'https://api.weixin.qq.com/wxa/get_category?access_token={authorizer_access_token}'

_get_page_url = 'https://api.weixin.qq.com/wxa/get_page?access_token={authorizer_access_token}'

_submit_audit_url = 'https://api.weixin.qq.com/wxa/submit_audit?access_token={authorizer_access_token}'

_get_auditstatus_url = 'https://api.weixin.qq.com/wxa/get_auditstatus?access_token={authorizer_access_token}'

_get_latest_auditstatus_url = 'https://api.weixin.qq.com/wxa/get_latest_auditstatus?access_token={authorizer_access_token}'

_undocodeaudit_url = 'https://api.weixin.qq.com/wxa/undocodeaudit?access_token={authorizer_access_token}'

_release_url = 'https://api.weixin.qq.com/wxa/release?access_token={authorizer_access_token}'

_modifyheadimage_url = 'https://api.weixin.qq.com/cgi-bin/account/modifyheadimage?access_token={authorizer_access_token}'

_setnickname_url = 'https://api.weixin.qq.com/wxa/setnickname?access_token={authorizer_access_token}'

_api_wxa_querynickname_url = 'https://api.weixin.qq.com/wxa/api_wxa_querynickname?access_token={authorizer_access_token}'

_modifysignature_url = 'https://api.weixin.qq.com/cgi-bin/account/modifysignature?access_token={authorizer_access_token}'

_bind_tester_url = 'https://api.weixin.qq.com/wxa/bind_tester?access_token={authorizer_access_token}'

_unbind_tester_url = 'https://api.weixin.qq.com/wxa/unbind_tester?access_token={authorizer_access_token}'

_memberauth_url = 'https://api.weixin.qq.com/wxa/memberauth?access_token={authorizer_access_token}'


@log.log_exception(_logger)
def get_component_access_token(component_appid, component_appsecret):
    token_cache_key = f'component_access_token:{component_appid}'
    access_token = cache.get(token_cache_key)
    if access_token:
        return access_token

    # 从缓存里取出component_verify_ticket
    ticket_cache_key = f'component_verify_ticket:{component_appid}'
    component_verfy_ticket = cache.get(ticket_cache_key)
    if not component_verfy_ticket:
        msg = '取不到component_verify_ticket!'
        raise Exception(msg)

    params = {
        'component_appid': component_appid,
        'component_appsecret': component_appsecret,
        'component_verify_ticket': component_verfy_ticket
    }

    try:
        res = api.call(_get_component_access_token_url, params)
        access_token = res['component_access_token']
        expires_in = res['expires_in']

        # 缓存
        cache.set(token_cache_key, access_token, timeout=int(expires_in)-600)

        return access_token
    except Exception as e:
        raise Exception(f'获取三方平台access_token出错:{e}')


@log.log_exception(_logger)
def api_create_preauthcode(component_access_token, component_appid):
    url = _api_create_preauthcode_url.format(component_access_token=component_access_token)
    params = {
        'component_appid': component_appid
    }

    try:
        res = api.call(url, params)
        access_token = res['pre_auth_code']
        #expires_in = res['expires_in']

        return access_token
    except Exception as e:
        raise Exception(f'获取三方平台pre_auth_code出错:{e}')


@log.log_exception(_logger)
def api_get_authorizer_info(component_access_token, component_appid, authorizer_appid):
    """
    获取授权方基本信息
    :param component_access_token:
    :param component_appid:
    :param authorizer_appid:
    :return:
    """
    url = _api_get_authorizer_info_url.format(component_access_token=component_access_token)
    params = {
        'component_appid': component_appid,
        'authorizer_appid': authorizer_appid
    }

    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'获取授权方账号基本信息出错:{e}')


@log.log_exception(_logger)
def api_query_auth(component_access_token, component_appid, authorization_code):
    """
    查询授权信息
    :param component_access_token:
    :param component_appid:
    :param authorization_code:
    :return:
    """
    # 从缓存读取
    cache_key = 'qry_auth:%s' % hashlib.md5(authorization_code.encode()).hexdigest()
    data = cache.get(cache_key)
    if data:
        return data

    url = _api_query_auth_url.format(component_access_token=component_access_token)
    params = {
        'component_appid': component_appid,
        'authorization_code': authorization_code
    }

    try:
        res = api.call(url, params)
        # 缓存
        cache.set(cache_key, res, 300)

        return res
    except Exception as e:
        raise Exception(f'使用授权码换取公众号或小程序的接口调用凭据和授权信息出错:{e}')


@log.log_exception(_logger)
def get_authorizer_token(component_access_token, component_appid, authorizer_appid, authorizer_refresh_token):
    """
    获取(刷新)调用凭据(authorizer_access_token)
    :param component_access_token:
    :param component_appid:
    :param authorizer_appid:
    :param authorizer_refresh_token:
    :return:
    """
    cache_key = f'authorizer_access_token:{authorizer_appid}'
    token = cache.get(cache_key)
    if token:
        return token

    url = _api_authorizer_token_url.format(component_access_token=component_access_token)
    params = {
        'component_appid': component_appid,
        'authorizer_appid': authorizer_appid,
        'authorizer_refresh_token': authorizer_refresh_token
    }

    try:
        res = api.call(url, params)
        token = res['authorizer_access_token']
        expires_in = res['expires_in']
        refresh_token = res['authorizer_refresh_token']
        # 缓存
        cache.set(cache_key, token, int(expires_in) - 600)

        # 更新refresh_token回数据库表
        Authorizer.query.filter_by(appid=authorizer_appid).update({
            'refresh_token': refresh_token,
            'retoken_update_time': db.func.now()
        }, synchronize_session=False)
        db.session.commit()

        return token
    except Exception as e:
        raise Exception(f'获取(刷新)授权方调用凭据出错:{e}')


@log.log_exception(_logger)
def fastregisterweapp(component_access_token, company_name, company_code, company_code_type,
                      legal_persona_wechat, legal_persona_name, component_phone, action='create'):
    """
    快速注册小程序
    :param component_access_token:
    :param company_name:
    :param company_code:
    :param company_code_type:
    :param legal_persona_wechat:
    :param legal_persona_name:
    :param component_phone:
    :param action: 执行操作 create: 注册 search:查询
        查询时只需要company_name,legal_persona_wechat, legal_persona_name三个参数即可
    :return:
    """
    url = _fastregisterweapp_url.format(component_access_token=component_access_token, action=action)
    params = {
        'name': company_name,
        'code': company_code,
        'code_type': company_code_type,
        'legal_persona_wechat': legal_persona_wechat,
        'legal_persona_name': legal_persona_name,
        'component_phone': component_phone
    }

    check_errcode = action == 'create'
    try:
        res = api.call(url, params, check_errcode=check_errcode)
        return res
    except Exception as e:
        if action == 'create':
            raise Exception(f'快速注册小程序出错：{e}')
        else:
            raise Exception(f'查询小程序创建状态出错：{e}')


@log.log_exception(_logger)
@cache_result.cache(
    key=lambda token: f'template_list_%s' % hashlib.md5(token.encode()).hexdigest(),
    timeout=120
)
def gettemplatelist(component_access_token):
    """
    获取代码模版库中的所有小程序代码模版
    :param component_access_token:
    :return:
    """
    url = _gettemplatelist_url.format(component_access_token=component_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取账号已设置类目出错：{e}')


@log.log_exception(_logger)
def modify_domain(authorizer_access_token, action, requestdomain, wsrequestdomain, uploaddomain,
                  downloaddomain, udpdomain, tcpdomain):
    """
    管理小程序服务器域名
    @param authorizer_access_token:
    @param action: add添加, delete删除, set覆盖, get获取。当参数是get时不需要填四个域名字段
    @param requestdomain:  request合法域名，当action参数是get时不需要此字段
    @param wsrequestdomain:  socket合法域名，当action参数是get时不需要此字段
    @param uploaddomain:  uploadFile合法域名，当action参数是get时不需要此字段
    @param downloaddomain:  downloadFile合法域名，当action参数是get时不需要此字段
    @param udpdomain: udp 合法域名；当 action 是 get 时不需要此字段
    @param tcpdomain:  tcp 合法域名；当 action 是 get 时不需要此字段
    @return:
        {}
    """
    url = _modify_domain_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'action': action,
        'requestdomain': requestdomain,
        'wsrequestdomain': wsrequestdomain,
        'uploaddomain': uploaddomain,
        'downloaddomain': downloaddomain,
        'udpdomain': udpdomain,
        'tcpdomain': tcpdomain
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'设置小程序服务器域名出错：{e}')


@log.log_exception(_logger)
def setwebviewdomain(authorizer_access_token, action, webviewdomain):
    """
    管理小程序业务域名
    :param authorizer_access_token:
    :param action:  add添加, delete删除, set覆盖, get获取.当action是get时不需要填webviewdomain字段
    :param webviewdomain:
    :return:
    """
    url = _setwebviewdomain_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'action': action,
        'webviewdomain': webviewdomain
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'设置小程序业务域名出错：{e}')


@log.log_exception(_logger)
def getaccountbasicinfo(authorizer_access_token):
    """
    获取帐号基本信息
    :param authorizer_access_token:
    :return:
    """
    url = _getaccountbasicinfo_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取帐号基本信息出错：{e}')


@log.log_exception(_logger)
def getallcategories(authorizer_access_token):
    """
    获取账号可以设置的所有类目
    :param authorizer_access_token:
    :return:
    """
    cache_key = f'all_categories:{authorizer_access_token}'
    data = cache.get(cache_key)
    if data:
        return data

    url = _getallcategories_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')

        # 缓存
        cache.set(cache_key, res, timeout=300)

        return res
    except Exception as e:
        raise Exception(f'获取账号可设置类目出错：{e}')


@log.log_exception(_logger)
def getcategory(authorizer_access_token):
    """
    获取账号已经设置的所有类目
    :param authorizer_access_token:
    :return:
    """
    url = _getcategory_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取账号已设置类目出错：{e}')


@log.log_exception(_logger)
def addcategory(authorizer_access_token, categories):
    """
    添加类目
    :param authorizer_access_token:
    :param categories: 类目列表，结构如下：
        [
            {
                “first”: 8,
                “second”: 39,
                “certicates”: [
                    {
                        “key”: ”《因私出入境中介机构经营许可证》”,
                        “value”: ”xxx”
                    }
                ]
            },
            xxx
        ]
    :return:
    """
    url = _addcategory_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'categories': categories
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'添加类目出错：{e}')


@log.log_exception(_logger)
def deletecategory(authorizer_access_token, first, second):
    """
    删除类目
    :param authorizer_access_token:
    :param first: 一级类目ID
    :param second: 二级类目ID
    :return:
    """
    url = _deletecategory_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'first': first,
        'second': second  # 注意文档中参数的第一个字母是大写!!
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'删除类目出错：{e}')


@log.log_exception(_logger)
def commit(authorizer_access_token, template_id, ext_json, user_version, user_desc):
    """
    提交小程序代码
    :param authorizer_access_token:
    :param template_id:  模板id
    :param ext_json: ext_json设置，是个dict
    :param user_version: 版本号
    :param user_desc: 说明
    :return:
    """
    url = _commit_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'template_id': template_id,
        'ext_json': json.dumps(ext_json),
        'user_version': user_version,
        'user_desc': user_desc
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'设置小程序业务域名出错：{e}')


@log.log_exception(_logger)
def get_qrcode(authorizer_access_token, path):
    """
    获取小程序体验码
    :param authorizer_access_token: 
    :param path: 页面路径.比如page/index?action=1
    :return:
        成功返回图片数据，否则返回None
    """
    url = _get_qrcode_url.format(authorizer_access_token=authorizer_access_token,
                                 path=urllib.parse.quote(path))

    rsp = requests.get(url)
    try:
        res = rsp.json()  # 能转成json说明出错了
        _logger.error(f"get_qrcode err：{res['errcode']} {res['errmsg']}")
        return
    except:  # 返回图片数据
        return rsp.content


@log.log_exception(_logger)
def get_category(authorizer_access_token):
    """
    获取授权小程序帐号已设置的类目
    :param authorizer_access_token:
    :return:
    """
    url = _get_category_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取小程序已设置类目出错：{e}')


@log.log_exception(_logger)
def get_page(authorizer_access_token):
    """
    获取小程序的第三方提交代码的页面配置
    :param authorizer_access_token:
    :return:
    """
    url = _get_page_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取小程序页面配置出错：{e}')


@log.log_exception(_logger)
def submit_audit(authorizer_access_token, params):
    """
    小程序代码提交审核.
    :param authorizer_access_token:
    :param params:
    具体文档：
    https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1489140610_Uavc4&token=&lang=zh_CN
    :return:
    """
    url = _submit_audit_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'小程序代码提交审核出错：{e}')


@log.log_exception(_logger)
def get_auditstatus(authorizer_access_token, auditid):
    """
    获取小程序代码提交审核状态
    :param authorizer_access_token:
    :param auditid: 提交审核返回的审核id
    :return:
    """
    url = _get_auditstatus_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'auditid': auditid
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'获取小程序代码审核状态出错：{e}')


@log.log_exception(_logger)
def get_latest_auditstatus(authorizer_access_token):
    """
    获取最近一次代码提交审核状态
    :param authorizer_access_token:
    :return:
    """
    url = _get_latest_auditstatus_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'获取最近一次小程序代码审核状态出错：{e}')


@log.log_exception(_logger)
def undocodeaudit(authorizer_access_token):
    """
    小程序审核撤回
    :param authorizer_access_token:
    :return:
    """
    url = _undocodeaudit_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url, method='GET')
        return res
    except Exception as e:
        raise Exception(f'小程序审核撤回出错：{e}')


@log.log_exception(_logger)
def release(authorizer_access_token):
    """
    发布已通过审核的小程序
    :param authorizer_access_token:
    :return:
    """
    url = _release_url.format(authorizer_access_token=authorizer_access_token)
    try:
        res = api.call(url)
        return res
    except Exception as e:
        raise Exception(f'发布小程序出错：{e}')


@log.log_exception(_logger)
def modifyheadimage(authorizer_access_token, head_img_media_id, x1, y1, x2, y2):
    """
    修改头像
    :param authorizer_access_token:
    :param head_img_media_id: 头像素材media_id
    :param x1: 裁剪框左上角x坐标（取值范围：[0, 1]）
    :param y1: 裁剪框左上角y坐标（取值范围：[0, 1]）
    :param x2: 裁剪框右下角x坐标（取值范围：[0, 1]）
    :param y2: 裁剪框右下角y坐标（取值范围：[0, 1]）
    :return:
    """
    url = _modifyheadimage_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'head_img_media_id': head_img_media_id,
        'x1': x1,
        'y1': y1,
        'x2': x2,
        'y2': y2
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'设置头像出错：{e}')


def setnickname(authorizer_access_token, nickname, id_card, license, naming_other_stuff_1='', naming_other_stuff_2=''):
    """
    小程序名称修改
    :param authorizer_access_token:
    :param nickname: 昵称(名称)
    :param id_card: 身份证照片临时素材id
    :param license: 组织机构代码证或营业执照照片临时素材id
    :param naming_other_stuff_1: 其他证明材料临时素材id
    :param naming_other_stuff_2: 其他证明材料临时素材id
    :return:
    """
    url = _setnickname_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'nick_name': nickname,
        'id_card': id_card,
        'license': license,
        'naming_other_stuff_1': naming_other_stuff_1,
        'naming_other_stuff_2': naming_other_stuff_2
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'修改小程序名称出错：{e}')


def api_wxa_querynickname(authorizer_access_token, audit_id):
    """
    查询小程序改名审核状态
    :param authorizer_access_token:
    :param audit_id:
    :return:
    """
    url = _api_wxa_querynickname_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'audit_id': audit_id
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'查询小程序改名审核状态出错：{e}')


def modifysignature(authorizer_access_token, signature):
    '''
    修改小程序功能介绍
    :param authorizer_access_token:
    :param signature:  功能介绍
    :return:
    '''
    url = _modifysignature_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'signature': signature
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'修改小程序功能介绍出错：{e}')


@log.log_exception(_logger)
def bind_tester(authorizer_access_token, wechatid):
    """
    绑定体验者
    :param authorizer_access_token:
    :param wechatid:
    :return:
    """
    url = _bind_tester_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'wechatid': wechatid
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'绑定体验者出错：{e}')


@log.log_exception(_logger)
def unbind_tester(authorizer_access_token, userstr, wechatid=''):
    """
    解除体验者绑定
    :param authorizer_access_token:
    :param userstr:
    :param wechatid:
    :return:
    """
    url = _unbind_tester_url.format(authorizer_access_token=authorizer_access_token)
    params = {}
    if userstr:
        params['userstr'] = userstr
    elif wechatid:
        params['wechatid'] = wechatid
    else:
        raise Exception('unbind_tester必须参数wechatid和userstr之一！')

    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'解除绑定体验者出错：{e}')


@log.log_exception(_logger)
def memberauth(authorizer_access_token):
    """
    获取体验者列表
    :param authorizer_access_token:
    :return:
    """
    url = _memberauth_url.format(authorizer_access_token=authorizer_access_token)
    params = {
        'action': 'get_experiencer'
    }
    try:
        res = api.call(url, params)
        return res
    except Exception as e:
        raise Exception(f'以体验者列表错误：{e}')
