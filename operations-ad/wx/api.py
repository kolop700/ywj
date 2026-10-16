"""包装一些常用的api调用方法"""
import requests
import json

#  忽略https警告
requests.packages.urllib3.disable_warnings()


def post_json(url, data):
    """
    以json方式提交post
    :param url:
    :param data: 字典结构的参数
    :return:
    """
    js_data = json.dumps(data, ensure_ascii=False).encode()
    headers = {'Content-type': 'application/json'}
    rsp = requests.post(url, data=js_data, headers=headers)

    return rsp


def post_xml(url, xml_data, **kwargs):
    """
    以xml提交post
    :param url:
    :param xml_data:
    :param **kwargs
    :return:
    """
    rsp = requests.post(url, data=xml_data.encode('u8'),
                        headers={'Content-Type': 'text/xml; charset=UTF-8'},
                        **kwargs)

    return rsp


def call(url, data=None, method='POST', check_errcode=True, json_encoding=''):
    """
    以json方式提交
    @param url:
    @param data: 字典结构的参数
    @param method: 请求方式，POST,GET
    @param check_errcode 是否检查errcode，检查时errcode!=0会报出错误，默认为True
    @param json_encoding: 自定义返回json的编码
    @return:
    """
    if method == 'POST':
        rsp = post_json(url, data or {})
    elif method == 'GET':
        rsp = requests.get(url, data)
    else:
        raise Exception(f'无效的method: {method}')

    if json_encoding:
        rsp.encoding = json_encoding

    res = rsp.json()
    errcode = res.get('errcode', 0)
    if check_errcode and errcode != 0:
        errmsg = res['errmsg']
        raise Exception(f'{errcode} {errmsg}')

    return res
