# 包装些常用的缓存操作
from .. import app, cache as cacheobj
from . import log
import functools

# _logger = log.get_logger('cachelib',__name__)


def cache(key, timeout, result_hook=None, ignore_not_result=False):
    """
    缓存装饰器
    :param key: 如果是字符串，直接当key，如果是函数，会调用函数取得结果作为key
    :param timeout: 超时时间
    :param result_hook 结果回调。传入def xx(cached, result)回调函数，cached为是否缓存返回，result是返回结果。
        可用于判断是否从缓存读取，替换返回结果
    :param ignore_not_result 函数没结果时(not result)是否忽略不缓存。默认为False,无论返回什么都缓存
    :return:
    """
    if (not isinstance(key, str)) and (not callable(key)):
        raise Exception('缓存key参数值错误(%s %s)，要么是str要么是个callable!' %
                        (repr(key), type(key)))

    if not isinstance(timeout, int):
        raise Exception('缓存timeout参数只能是int类型！')

    def wrap1(func):
        @functools.wraps(func)
        def wrap2(*args, **kwargs):
            if callable(key):
                cache_key = key(*args, **kwargs)
            else:
                cache_key = key

            if not isinstance(cache_key, str):
                msg = '函数%s缓存失败，%s(type:%s)不能作为缓存key!' % \
                      (func.__name__, repr(cache_key), type(cache_key))
                raise Exception(msg)

            # debug模试不缓存
            if app.config['DEBUG']:
                return func(*args, **kwargs)

            cached = True
            result = cacheobj.get(cache_key)
            if result is None:  # 没缓存
                cached = False
                result = func(*args, **kwargs)

                cache = True
                if ignore_not_result:
                    cache = not result

                if cache:
                    cacheobj.set(cache_key, result, timeout=timeout)

            if result_hook:
                result = result_hook(cached, result)

            return result

        return wrap2

    return wrap1