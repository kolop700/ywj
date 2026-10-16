#coding=utf-8
from flask import Flask
from celery import Celery
from flask_caching import Cache
from werkzeug.utils import find_modules, import_string
import config
import traceback

app = Flask(__name__, static_folder=config.STATIC_FOLDER)
app.config.from_object(config)

cache = Cache(app)


def make_celery():
    celery = Celery(app.import_name, broker=app.config['CELERY_BROKER_URL'])
    celery.conf.update(app.config)
    TaskBase = celery.Task
    class ContextTask(TaskBase):
        abstract = True
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return TaskBase.__call__(self, *args, **kwargs)
    celery.Task = ContextTask
    return celery


if 'CELERY_BROKER_URL' in app.config:
    celery = make_celery()#celery -A app.celery worker -l info


def load_modules(*paths):
    for path in paths:
        for name in find_modules(path, include_packages=True, recursive=True):
            try:
                import_string(name, False)
            except Exception as e:
                print(f'模块[{name}]加载出错:')
                #traceback.print_exc()
                raise


from . import docs
