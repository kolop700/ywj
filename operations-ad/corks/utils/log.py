# -*- coding: UTF-8 -*-
#-------------------------------------------------------------------------------
# Name:        log
# Purpose:
#
# Author:      wei
#
# Created:     05/07/2012
# Copyright:   (c) wei 2012
# Licence:     <your licence>
#-------------------------------------------------------------------------------
import logging
import logging.handlers
from pathlib import Path
import functools


LOGGING_MSG_FORMAT  = '%(name)s> %(levelname)s [%(asctime)s]: %(message)s\r\n'
LOGGING_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

def get_logger(logname, module_name):
    root_logger = logging.getLogger(logname)
    if len(root_logger.handlers)==0:
        path = Path.cwd() / 'logs' / f'{logname}.log'
        if not path.parent.is_dir():
            path.parent.mkdir()

        logFile = str(path)
        handler = logging.handlers.RotatingFileHandler(logFile, mode='a',
            maxBytes=1024*1024*10, backupCount=10)#,encoding="utf-8"
        #handler=logging.handlers.TimedRotatingFileHandler("D:\\logs\l.txt",'midnight',1)
        #handler.suffix = "%Y-%m-%d"
        #handler.setLevel(logging.INFO)
        fmter = logging.Formatter(LOGGING_MSG_FORMAT, LOGGING_DATE_FORMAT)
        handler.setFormatter(fmter)
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.DEBUG)

    s = logname + '.' + module_name
    return logging.getLogger(s)


def log_exception(logger, reraise=True):

    def wrap_func(func):

        @functools.wraps(func)
        def inner_func(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.error('调用%s出错：' % func.__name__)
                logger.error('参数：%s %s' % (repr(args),repr(kwargs)))
                logger.error(str(e))
                if reraise:
                    raise

        return inner_func
    return wrap_func

#logger = get_logger('log', __name__)

#@log_exception(logger)
#def test():
#    raise Exception('测试错误abc')

#if __name__ == '__main__':
#    test()
