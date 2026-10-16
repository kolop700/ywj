import os

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_FOLDER = os.path.join(ROOT_DIR, 'static')

DEBUG = True  # 是否是debug模式
ENABLE_API_DOCS = True  # 启用api文档
DEV_WX_USER_ID = 1  # 开发时自动登录的账户

SECRET_KEY = '!Wei20240418X@zw#'
# PERMANENT_SESSION_LIFETIME = timedelta(days=1)  # session过期时间.要session.permanent=True启用
SESSION_COOKIE_SECURE = False

WTF_CSRF_ENABLED = True
WTF_CSRF_SECRET_KEY = SECRET_KEY

JSON_SORT_KEYS = False
TEMPLATES_AUTO_RELOAD = True


db_conn = 'mysql+pymysql://root:Yefiot2021@192.168.1.252:3307'  # 开发库(内网)；线上用 config.py 指向阿里云RDS(见服务器 operations-xy/config.py 同实例)
# 单库双品牌：星云/云卫家共用 Yefiot 库，业务数据表用 brand 列区分（0=星云 1=云卫家，与 t_doorphone.appid 对齐）
# 注意：corks 实际加载的是 config.py（本文件 config_.py 仅作模板/开发）
SQLALCHEMY_DATABASE_URI = f'{db_conn}/Yefiot'
SQLALCHEMY_BINDS = {
    'yefiot': SQLALCHEMY_DATABASE_URI,
}
# 门禁流水源库库名（同库内直接引用；保留配置项兼容旧代码路径）：
# 开发库(3307)为大写 Yefiot；线上RDS为小写 yefiot（Linux MySQL 库名大小写敏感，线上 config.py 必须写 'yefiot'）
DOOR_DB_SCHEMA = 'Yefiot'
# 品牌集合：auto_sum 按 t_doorphone.appid 为每个品牌各生成一套日活行（brand与appid同值）
BRANDS = [0, 1]
SQLALCHEMY_TRACK_MODIFICATIONS = True
SQLALCHEMY_POOL_RECYCLE = 600
# SQLALCHEMY_ECHO = True  # 输出sql,用于调试

# 部署的主机
HOST = 'xy.yefiot.com'
#  部署的域名地址
BASE_URL = 'https://%s' % HOST

#redis设置
REDIS_URL = 'redis://127.0.0.1/0'
#缓存设置
CACHE_TYPE = 'redis'  # simple
CACHE_KEY_PREFIX = 'pk:'
CACHE_REDIS_URL = REDIS_URL

# #celery设置
# CELERY_BROKER_URL = REDIS_URL
# CELERY_RESULT_BACKEND = CELERY_BROKER_URL
# CELERY_ACCEPT_CONTENT = ['json']
# CELERY_TASK_SERIALIZER = 'json'
# CELERY_RESULT_SERIALIZER = 'json'

# 微信小程序相关参数
WX_APPID = ''
WX_MUCH_ID = ''
WX_API_KEY = ''


# 公众号相关设置
OA_NAME = '星云智慧'  # 公众号名称
OA_TOKEN = 'WEIZW20JJJJEEEEWWW'
OA_APPID = 'wx5fbc451699ae82b6'
OA_APPSECRET = '9ae4debb5cb9c7fb50ef49d9c6c46ae9'
OA_AESKEY = '5ZOxpA5YMAoArpjlyEWh5sjMvrQIromkJ3BIiAwlqMt'

# 服务商配置
SP_APPID = ''  # 服务商公众号appid
SP_MUCH_ID = ''  # 服务商商户号
SP_API_KEY = ''  # 服务商商户号api_key

# 运营账号根用户id
ROOT_AGE_IDS = {
    1
    # 4  # 越凡物联
}

# 商家配置
MERCHANTS = {
    'JviSv9_kVruKe4jRwYNRF': {
        'name': '商家1',
        'appid': '',
        'mch_id': ''
    }
}

# Taku 广告收益回调（S2S）
# 回调地址格式：https://xy.yefiot.com/ad/wx/taku/income_notify?key=xxx，把带key的完整地址配置到Taku后台
TAKU_CALLBACK_KEY = 'Tk7Xq2Wp9Yz4Lm3R'
# Taku收益美元→人民币参考汇率（仅用于生成收入时预填，可在页面手动调整）
TAKU_USD_RATE = 7.2

# 微信小程序流量主（广告收益同步，拉取式）
# AppID/AppSecret 在小程序管理后台(mp.weixin.qq.com) → 开发管理 → 开发设置 中获取
WXAD_APPID = 'wxcdc46554970d5e77'  # 小程序AppID
WXAD_APPSECRET = 'eef25aad834a93c8b206a881b8f7f2ca'  # 小程序AppSecret（保密，勿外传）
# 数据同步定时任务密钥（crontab示例：30 9 * * * curl -s "https://xy.yefiot.com/ad/wx/wxad/fetch?key=WxAd7Kp2Nm5Qv8Zx" >/dev/null 2>&1）
WXAD_FETCH_KEY = 'WxAd7Kp2Nm5Qv8Zx'
# 该小程序凭据所属品牌（同步入库时的brand；云卫家小程序接入时另配凭据+brand）
WXAD_BRAND = 0