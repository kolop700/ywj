"""公众号相关"""
from flask import request, Blueprint
from corks import app
from corks.utils import log
from xml.etree import ElementTree as ET
from wx.msgcrypt import WXBizMsgCrypt
import hashlib
import os

template_folder = os.path.join(app.config['ROOT_DIR'], 'official_account', 'templates')
static_folder = os.path.join(app.config['ROOT_DIR'], 'official_account', 'static')


def make_bp(name, import_name, url_prefix='/wx'):
    return Blueprint(name, import_name, url_prefix=url_prefix, static_folder=static_folder,
               template_folder=template_folder)


bp = make_bp('official_account', __name__)
_logger = log.get_logger('official_account', __name__)
_msg_handler = {}


def wx_msg(msg_type, event=''):  # 处理微信消息装饰器
    def decorater(func):
        key = f'{msg_type}.{event}'.lower()
        if key in _msg_handler:
            raise Exception(f"消息类型'{key}'处理器已经存在！")

        _msg_handler[key] = func

        return func
    return decorater


@bp.route('/official_account', methods=['GET', 'POST'])
def official_account():
    encrypt_type = request.args.get('encrypt_type')
    signature = request.args.get('signature')
    msg_signature = request.args.get('msg_signature')
    timestamp = request.args.get('timestamp')
    nonce = request.args.get('nonce')
    echostr = request.args.get('echostr', '')
    if not all([signature, timestamp, nonce]):
        return 'err'

    token = app.config['OA_TOKEN']
    appid = app.config['OA_APPID']
    aes_key = app.config['OA_AESKEY']
    # 验证sign
    ls = [token, timestamp, nonce]
    ls.sort()
    s = ''.join(ls)
    hashcode = hashlib.sha1(s.encode()).hexdigest()

    if hashcode != signature:
        _logger.error(f"签名验证错误! token={token} timestamp={timestamp} nonce={nonce} signature={signature}")

        return 'verify signature error!'

    if request.method == 'POST':  # 接口调用
        data = request.data.decode('u8')
        if encrypt_type == 'aes':  # 安全模式，需要解密
            decrypt_obj = WXBizMsgCrypt(token, aes_key, appid)
            ret, data_xml = decrypt_obj.DecryptMsg(data, msg_signature, timestamp, nonce)
            if ret != 0:
                _logger.error(f"消息解密错误: {ret}")
                _logger.info(f"token={token} timestamp={timestamp} nonce={nonce} "\
                             f"signature={signature} aes_key={aes_key} appid={appid}")
                _logger.info(data)

                return 'decrypt error!'
        else:
            data_xml = data

        if app.debug:
            print(data_xml)

        xml = ET.fromstring(data_xml)
        msg_type = xml.findtext('MsgType')
        event = xml.findtext('Event', '')
        key = f'{msg_type}.{event}'.lower()
        if key in _msg_handler:
            try:
                result = _msg_handler[key](xml)
                if result is not None:
                    if encrypt_type == 'aes':  # 安全模试，需要加密
                        encrypt_obj = WXBizMsgCrypt(token, aes_key, appid)
                        ret, encrypt_data = encrypt_obj.EncryptMsg(result, nonce)
                        if ret == 0:
                            return encrypt_data
                        else:
                            err = f"消息加密错误：{ret}"
                            if app.debug:
                                print(err)
                            else:
                                _logger.error(err)

                    return result
            except Exception as e:
                err = f"消息类型'{key}'处理错误：{e}"
                if app.debug:
                    print(err)
                else:
                    _logger.error(err)

        return 'success'

    return echostr


@bp.route('/msg')
def msg():
    return '<h2>亲，你的微信版本不支持跳转到微信小程序！</h2>'


app.register_blueprint(bp)
