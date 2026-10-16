#coding=utf-8
from flask import render_template, abort
from . import app
from .api import api_struct


@app.route('/docs/')
@app.route('/docs/<path:module>')
def docs(module=''):
    if not app.config.get('ENABLE_API_DOCS'):  #  启用api文档
        abort(404)

    if not module:
        temp = app.config.get('API_DOCS_INDEX_TEMP', 'docs/module_list.html')
        return render_template(temp, modules=api_struct)
    else:
        temp = app.config.get('API_DOCS_DETAIL_TEMP', 'docs/api_list.html')
        return render_template(temp, apis=api_struct[module]['apis'])