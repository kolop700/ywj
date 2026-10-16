# -*- coding: utf-8 -*-

from importlib import import_module
from pkgutil import iter_modules

#从scarpy拿过来用的几个函数


def load_object(path):
    """Load an object given its absolute object path, and return it.

    object can be a class, function, variable o instance.
    path ie: 'scrapy.downloadermiddlewares.redirect.RedirectMiddleware'
    """

    try:
        dot = path.rindex('.')
    except ValueError:
        raise ValueError("Error loading object '%s': not a full path" % path)

    module, name = path[:dot], path[dot+1:]
    mod = import_module(module)

    try:
        obj = getattr(mod, name)
    except AttributeError:
        raise NameError("Module '%s' doesn't define any object named '%s'" % (module, name))

    return obj


def walk_modules(path):
    """Loads a module and all its submodules from a the given module path and
    returns them. If *any* module throws an exception while importing, that
    exception is thrown back.

    For example: walk_modules('scrapy.utils')
    """

    mods = []
    mod = import_module(path)
    mods.append(mod)
    if hasattr(mod, '__path__'):
        for _, subpath, ispkg in iter_modules(mod.__path__):
            fullpath = path + '.' + subpath
            if ispkg:
                mods += walk_modules(fullpath)
            else:
                submod = import_module(fullpath)
                mods.append(submod)
    return mods


def populate_obj(src_obj, target_obj, fields=[], allow_value_none=True):
    """
    把源对象的属性赋值给目标对象的对应属性
    @param src_obj: 源对象
    @param target_obj: 目标对象
    @param fields: 字段列表
    @param allow_value_none: 来源字段值为none时是否允许赋值，默认允许
    @return:
    """
    for field in fields:
        if not hasattr(target_obj, field):
            continue

        value = getattr(src_obj, field)
        if (value is None) and (not allow_value_none):
            continue

        setattr(target_obj, field, value)

