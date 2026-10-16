from flask import make_response, request, g
from flask.views import MethodView
from flask_restful import Api as BaseApi, reqparse
from werkzeug.wrappers import Response as ResponseBase
from flask_restful.utils import unpack
from flask_login import current_user
from decimal import Decimal
from datetime import datetime, date
from flask_sqlalchemy.pagination import Pagination
from sqlalchemy.engine.result import Result, Row
from flask_sqlalchemy.query import Query
from flask_sqlalchemy.model import Model
from .utils import db_util
from . import app, error
import traceback
import inspect
import importlib
import functools
import json
import enum


api_struct = {}


def _get_module_cfg(func):
    global api_struct
    module = inspect.getmodule(func)
    default_module_name = module.__name__.lower()
    default_prefix = default_module_name.replace('.', '_')

    if hasattr(module, 'API_MODULE_NAME'):
        module_name = getattr(module, 'API_MODULE_NAME').strip()
        prefix = getattr(module, 'API_URL_PREFIX', default_prefix).strip()
    else:
        module = importlib.import_module(module.__package__)
        module_name = getattr(module, 'API_MODULE_NAME',default_module_name).strip()
        prefix = getattr(module, 'API_URL_PREFIX', default_prefix).strip()

    if prefix and (not prefix.startswith('/')):
        prefix = '/' + prefix

    if module_name not in api_struct:
        api_struct[module_name] = {}
        api_struct[module_name]['doc'] = module.__doc__ or ''
        api_struct[module_name]['apis'] = {}
        api_struct[module_name]['url_prefix'] = prefix
        api_struct[module_name]['api_obj'] = _Api(app, prefix=prefix)

        module_auth = getattr(module, 'API_MODULE_AUTH', None)
        if module_auth:
            api_struct[module_name]['auth'] = module_auth

    return api_struct[module_name]


class _ResourceProxy(MethodView):
    representations = None
    method_decorators = []

    def dispatch_request(self, *args, **kwargs):
        resp = self.meth(*args, **kwargs)

        if isinstance(resp, ResponseBase):  # There may be a better way to test
            return resp

        representations = self.representations or {}

        # noinspection PyUnresolvedReferences
        mediatype = request.accept_mimetypes.best_match(representations, default=None)
        if mediatype in representations:
            data, code, headers = unpack(resp)
            resp = representations[mediatype](data, code, headers)
            resp.headers['Content-Type'] = mediatype
            return resp

        return resp


def _func_key(func):
    return '%s.%s' % (func.__module__, func.__name__)


def route(rule, **options):
    """设置路由"""
    def inner_func(func):

        @functools.wraps(func)
        def call(*args, **kwargs):
            g_auth_exempt = getattr(g, 'auth_exempt', False)
            _auth_exempt = getattr(func, '__auth_exempt', False)
            if not (g_auth_exempt or _auth_exempt):
                authed = False
                if custom_auth_func:
                    try:
                        authed = custom_auth_func()
                    except Exception as e:
                        raise Exception(error.AUTH, '认证失败，错误：%s' % e)

                if (not authed) and (not current_user.is_authenticated):
                    if current_user.is_anonymous:
                        raise Exception(error.AUTH, '用户认证失败，请先登录！')
                    else:
                        raise Exception(error.AUTH, '用户认证失败，账号已禁用！')

            parser = getattr(func, '__args_parser', None)
            if parser:
                # 解决微信小程序以json方式get请求出错的问题
                request._json = request.get_json(silent=True) if request.is_json else None
                try:
                    args = parser.parse_args()
                except Exception as e:
                    # 不知道为什么现在在自定义参数类型里报的错，会变成http 400错误，而不会像原来一样直接报出来
                    # 不过在这里raise一下又出来原来的错误。。。
                    print(f'参数解析错误：{e}')
                    raise

            return func(args)

        f = inspect.signature(func)
        if len(f.parameters) == 0:
            msg = 'api函数%s必须有一个args参数!(模块：%s)' % (func.__name__, func.__module__)
            print(msg)
            raise Exception(msg)

        module_cfg = _get_module_cfg(func)
        api = module_cfg['api_obj']
        key = _func_key(func)
        resource = type(key, (_ResourceProxy,), {'meth': call})
        api.add_resource(resource, rule, **options)

        apis = module_cfg['apis']
        prefix = module_cfg['url_prefix']
        full_url = prefix + rule if prefix else rule
        methods = ','.join(options.get('methods', ['GET']))

        apis[_func_key(func)] = {
            'full_url': full_url,
            'methods': methods,
            'doc': func.__doc__ or '',
            'args': []
        }
        # 加载自定义用户认证
        custom_auth_func = getattr(func, '__custom_auth', None)
        if not custom_auth_func:  # 取模块认证
            custom_auth_func = module_cfg.get('auth')

        return func
    return inner_func


def arg(name, alias='', type=None, required=False, default=None, **kwargs):
    """定义参数"""
    def inner_func(func):
        if hasattr(func, '__args_parser'):
            parser = getattr(func, '__args_parser')
        else:
            parser = reqparse.RequestParser()
            setattr(func, '__args_parser', parser)

        mcfg = _get_module_cfg(func)
        apis = mcfg['apis']
        if apis:
            apis[_func_key(func)]['args'].insert(0, {
                'name': name,
                'alias': alias,
                'type': str(type) if type else '字符串',
                'required': required,
                'default': default
            })

        #if kwargs.get('required',False) and 'help' not in kwargs:
        #    kwargs['help']='参数%s是必须的！' % name

        if type:
            kwargs['type'] = type

        kwargs['required'] = required
        kwargs['default'] = default
        # kwargs['action'] = 'append'
        kwargs['help'] = f'{alias or name}：{{error_msg}}'  # 错误信息
        if 'location' not in kwargs:  # 默认参数来源为values(args和form)+json
            kwargs['location'] = ('values', '_json')

        parser.add_argument(name,  **kwargs)
        return func
    return inner_func


def auth_exempt(func):
    """免除用户认证"""
    setattr(func, '__auth_exempt', True)
    return func


def custom_auth(auth_func):
    """
    自定义用户认证。传一个无参数的认证函数，返回是否认证成功(布尔值)
    """
    if not callable(auth_func):
        msg = '自定义用户认证(custom_auth)需要一个callable对象！'
        print(msg)
        raise Exception(msg)

    def inner_func(func):
        setattr(func, '__custom_auth', auth_func)

        return func

    return inner_func


def _json_default_converter(obj):
    if isinstance(obj, datetime):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    elif isinstance(obj, date):
        return obj.strftime('%Y-%m-%d')
    elif isinstance(obj, Decimal):
        return str(obj)
    elif isinstance(obj, (Query, Result)):  # 数据库结果集
        return db_util.query_result_to_list(obj)
    elif isinstance(obj, (Model, Row)):  # 数据库结果集行对象
        return db_util.row_to_dict(obj)
    elif isinstance(obj, Pagination):  # 分页
        return db_util.pager_to_dict(obj)
    else:
        raise Exception(f'无法系列化json数据，类型：{type(obj)} 值：{obj!r}')


def _output_json(data, code, headers=None):
    """包装接口结果成json"""
    result = {}
    if code == 200:
        result['result'] = '' if data is None else data
    elif code == 500:
        result = data
    elif isinstance(data, dict):  # flask-resful缺少参数时会到这(code=404)
        mobj = data.pop('message')
        if isinstance(mobj, str):
            msg = mobj
        elif isinstance(mobj, dict):
            # mobj是错误信息字典，比如：{参数1: 'xxx'}，因为在help拼上中文字段名了，这里就不用拼名称了
            #ls = [ '%s: %s' % (k, v) for k, v in mobj.items()]
            ls = mobj.values()
            msg = '\n'.join(ls)
        else:
            msg = repr(mobj)

        result['message'] = msg
    else:
        result['message'] = data

    if code in (200, 400, 500):
        http_code = 200
    else:
        http_code = code

    result['is_success'] = code == 200
    resp = make_response(json.dumps(result, default=_json_default_converter), http_code)
    resp.headers.extend(headers or {})
    return resp


class _Api(BaseApi):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        reg_api = self.representation('application/json')
        reg_api(_output_json)

    def handle_error(self, e):
        code = getattr(e, 'code', 500)
        if code == 500:
            data = {}
            if len(e.args) > 1:  # 如何Exception有多个参数，认为第一个为code
                data['code'] = e.args[0]
                data['message'] = e.args[1]
            else:
                data['message'] = str(e)
            if app.debug:  # debug模式打印错误信息
                traceback.print_exc()
            return self.make_response(data, 500)
        return super().handle_error(e)


##########################参数类型定义##########################################

class BaseType(object):
    pass


class Integer(BaseType):
    def __init__(self, gt=None, gte=None, lt=None, lte=None, force_abs=False):
        self.gt = gt
        self.gte = gte
        self.lt = lt
        self.lte = lte
        self.force_abs = force_abs

    def __str__(self):
        note = ['整数']
        if self.gt is not None:
            note.append(f'大于{self.gt}')
        elif self.gte is not None:
            note.append(f'大于等于{self.gte}')

        if self.lt is not None:
            note.append(f'小于{self.lt}')
        elif self.lte is not None:
            note.append(f'小于等于{self.lte}')

        return ','.join(note)

    def __call__(self, value):
        try:
            if isinstance(value, int):
                v = value
            elif isinstance(value, str):
                value = value.strip()
                if value:
                    v = int(value)
                else:
                    v = 0
            else:
                v = int(value)
        except:
            raise Exception(f"无法将'{value}'转成整型(int)!")

        if self.force_abs:
            v = abs(v)

        if self.gt is not None:
            if v <= self.gt:
                raise Exception(f'参数值必须大于{self.gt}(当前值={v})!')
        elif self.gte is not None:
            if v < self.gte:
                raise Exception(f'参数值必须大于等于{self.gte}(当前值={v})!')

        if self.lt is not None:
            if v >= self.lt:
                raise Exception(f'参数值必须小于{self.lt}(当前值={v})!')
        elif self.lte is not None:
            if v > self.lte:
                raise Exception(f'参数值必须小于等于{self.lte}(当前值={v})!')

        return v


class Numeric(BaseType):
    def __init__(self, gt=None, gte=None, lt=None, lte=None, scale=None):
        self.gt = Decimal(str(gt)) if gt is not None else None
        self.gte = Decimal(str(gte)) if gte is not None else None
        self.lt = Decimal(str(lt)) if lt is not None else None
        self.lte = Decimal(str(lte)) if lte is not None else None
        self.scale = scale

    def __str__(self):
        note = ['数值']
        if self.gt is not None:
            note.append(f'大于{self.gt}')
        elif self.gte is not None:
            note.append(f'大于等于{self.gte}')

        if self.lt is not None:
            note.append(f'小于{self.lt}')
        elif self.lte is not None:
            note.append(f'小于等于{self.lte}')

        if self.scale is not None:
            note.append(f'小数点后面{self.scale}位')

        return ','.join(note)

    def __call__(self, value):
        try:
            if isinstance(value, Decimal):
                v = value
            elif isinstance(value, str):
                value = value.strip()
                if value:
                    v = Decimal(value)
                else:
                    v = Decimal('0')
            else:
                v = Decimal(str(value))
        except Exception:
            raise Exception(f"无法将'{value}'转成数值类型!")

        if self.gt is not None:
            if v <= self.gt:
                raise Exception(f'参数值必须大于{self.gt}(当前值={v})!')
        elif self.gte is not None:
            if v < self.gte:
                raise Exception(f'参数值必须大于等于{self.gte}(当前值={v})!')

        if self.lt is not None:
            if v >= self.lt:
                raise Exception(f'参数值必须小于{self.lt}(当前值={v})!')
        elif self.lte is not None:
            if v > self.lte:
                raise Exception(f'参数值必须小于等于{self.lte}(当前值={v})!')

        if self.scale is not None:
            _scale = abs(int(v.as_tuple().exponent))  # 取小数位数
            if _scale > self.scale:
                raise Exception(f'数值类型小数后不超过{self.scale}位！')

        return v


class Money(Numeric):
    def __init__(self, gt=None, gte=0, lt=None, lte=None, scale=2):
        super().__init__(gt, gte, lt, lte, scale)


class IntMoney(Integer):
    """
    单位为分的整型的金额
    """
    def __str__(self):
        note = ['整型金额(分)']
        if self.min is not None:
            note.append(f'最小值{self.min}')

        if self.max is not None:
            note.append(f'最大值{self.max}')

        return ','.join(note)

    def __call__(self, value):
        r = super().__call__(value)
        return Decimal(f'{r/100:.2f}')


class String(BaseType):
    def __init__(self, strip=True, allow_empty=True):
        self.strip = strip
        self.allow_empty = allow_empty

    def __str__(self):
        note = ['字符串']
        if not self.allow_empty:
            note.append('不允许为空')

        return ','.join(note)

    def __call__(self, value):
        if isinstance(value, str):
            v = value
        else:
            v = str(value)

        if self.strip:
            v = v.strip()

        if not self.allow_empty:
            if v == '':
                raise Exception('不能为空！')

        return v


class Boolean(BaseType):

    def __str__(self):
        return '布尔型'

    def __call__(self, value):
        if isinstance(value, bool):
            v = value
        elif isinstance(value, str):
            if value.isdigit():
                v = bool(int(value))
            else:
                lv = value.strip().lower()
                if lv in ('true', 'yes', 't', '是', '1', 1):
                    v = True
                elif lv in ('false', 'no', 'f', '否', '0', 0):
                    v = False
                else:
                    raise Exception(f"无法将{value!r}转成布尔型！")
        elif isinstance(value, int):
            v = bool(value)
        else:
            raise Exception(f"无法将{value!r}转成布尔型！")

        return v


class IntBoolean(BaseType):
    def __str__(self):
        return '0或1'

    def __call__(self, value):
        if value in ('1', 1):
            return 1
        elif value in ('0', 0):
            return 0
        else:
            raise Exception(f"无效的取值: {value!r},只能0或1!")


class Date(BaseType):
    def __init__(self, fmt='%Y-%m-%d'):
        self.fmt = fmt

    def __str__(self):
        return f'日期，格式{self.fmt}'

    def __call__(self, value):
        if isinstance(value, datetime):
            return value.date()
        elif isinstance(value, date):
            return value

        v = value.strip()
        if v:
            try:
                d = datetime.strptime(v, self.fmt).date()
            except Exception as e:
                raise Exception(f"无法将{value!r}转成日期(date)。正确格式：{self.fmt}")

            return d


class Time(BaseType):
    def __init__(self, fmt='%H:%M'):
        self.fmt = fmt

    def __str__(self):
        return f'时间，格式{self.fmt}'

    def __call__(self, value):
        if isinstance(value, datetime):
            return value.time()

        v = value.strip()
        if v:
            try:
                t = datetime.strptime(v, self.fmt).time()
            except Exception as e:
                raise Exception(f"无法将{value!r}转成时间(time)。正确格式：{self.fmt}")

            return t


class DateTime(BaseType):
    def __init__(self, fmt='%Y-%m-%d %H:%M:%S'):
        self.fmt = fmt

    def __str__(self):
        return f'日期时间，格式{self.fmt}'

    def __call__(self, value):
        if isinstance(value, date):  # datetime也属于date
            return value

        v = value.strip()
        if v:
            try:
                dt = datetime.strptime(v, self.fmt)
            except Exception as e:
                raise Exception(f"无法将{value!r}转成日期时间(datetime)。正确格式：{self.fmt}")

            return dt


class List(BaseType):
    def __init__(self, sep=','):
        self.sep = sep or ','

    def __str__(self):
        return f"多个请传以{self.sep!r}分隔的字符串"

    def __call__(self, value):
        if isinstance(value, list):
            return value

        value = str(value)
        if value:
            return value.split(self.sep)
        else:
            return []


class Json(BaseType):
    def __init__(self):
        pass

    def __str__(self):
        return 'json字符串'

    def __call__(self, value):
        if isinstance(value, dict):
            return value

        if not isinstance(value, str):
            raise Exception('请传入json字符串！')

        try:
            result = json.loads(value)
        except Exception as e:
            raise Exception(f'json解析出错：{e}')

        return result


class Enum(BaseType):
    def __init__(self, enumType, use_name=False):
        """
        枚举型
        :param enumType:
        :param use_name: 使用枚举型的名称(name)作为值，默认为:False
        """
        if not issubclass(enumType, enum.Enum):
            raise Exception(f'{enumType!r}不是枚举类型！')

        self._use_name = use_name
        self._etype = enumType

    def __str__(self):
        vlist = []
        for it in self._etype:
            if self._use_name:
                vlist.append('%s:%s' % (it.name, getattr(it, 'label', '')))
            else:
                vlist.append('%s:%s' % (it.value, getattr(it, 'label', '')))

        return '枚举型，取值: %s' % ' '.join(vlist)

    def __call__(self, value):
        if value == '':
            return

        try:
            if self._use_name:
                value = self._etype[value]
            else:
                value = self._etype(int(value))
        except Exception as e:
            raise Exception(f'枚举型({self._etype.__name__})取值错误:{value}')

        return value


class Select(BaseType):
    def __init__(self, items, multi=False, value_type=int):
        """
        选择型
        @param items: 是一个字典，key为选择的值，value为名称
        @param multi: 是否可以多选，默认为False
        @param value_type: 选中值的类型，默认int
        """
        if not isinstance(items, dict):
            raise Exception(f'{items!r}不是字典(dict)类型！')

        self._items = items
        self._multi = multi
        self._value_type = value_type

    def _validate(self, value):
        try:
            v = self._value_type(value)
        except:
            raise Exception(f'值必须是{self._value_type.__name__}型，{value!r}不是有效值')

        if v in self._items:
            return v
        else:
            raise Exception(f"{v!r}不是有效的值")

    def __str__(self):
        vlist = []
        for k, v in self._items.items():
            vlist.append(f'{k}:{v}')

        t = "多选，请传数组[]或以','分隔的串" if self._multi else '单选'
        return f"选择型({t})，取值: {' '.join(vlist)}"

    def __call__(self, value):
        if self._multi:  # 多选
            if not value:
                return []
            if isinstance(value, list):
                vlist = value
            elif isinstance(value, str):
                vlist = value.split(',')
            else:
                raise Exception(f"取值错误{value!r}")

            # 检查
            return [self._validate(v) for v in vlist]
        else:  # 单选
            return self._validate(value)


class JsObject(BaseType):
    """
    用于接收以json方式提交的对象
    """
    def __init__(self, name=None):
        if name:
            self._name = name
        else:
            self._name = 'js对象'

    def __str__(self):
        return self._name

    def __call__(self, value, name):
        if request.is_json:
            return request.json.get(name, '')


class FakeType(BaseType):
    """
    假类型，只为生成文档用
    """
    def __init__(self, name):
        self._name = name

    def __str__(self):
        return self._name

    def __call__(self, value, name):
        return value