"""自动提交事务"""
import functools
from contextlib import contextmanager
from sqlalchemy.exc import IntegrityError
from db import db


def auto(func):
    """自动提交事务装饰器"""
    @functools.wraps(func)
    def inner_func(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            db.session.commit()
            return result
        except IntegrityError as e:
            db.session.rollback()
            print(e)
            raise Exception('唯一键重复或外键关联错误')
        except Exception as e:
            db.session.rollback()
            raise

    return inner_func


@contextmanager
def block(raise_exception=True):
    """with事务块"""
    try:
        yield
        db.session.commit()
    except:
        db.session.rollback()
        if raise_exception:
            raise
    finally:
        #session.close()
        pass