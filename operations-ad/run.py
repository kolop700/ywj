from corks import app, load_modules

load_modules(
    'db',
    'api',
    'official_account'
)

#db.engine.echo=True#输出ＳＱＬ
# 端口 8097：线上 8098 已被星云生产 gunicorn 占用(supervisor op 程序)
app.run(host='0.0.0.0', port=8097)