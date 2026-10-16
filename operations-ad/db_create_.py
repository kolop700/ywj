"""创建云卫家运营分润库(YunWeijia)的表。

说明：
- 只创建本库(YunWeijia)的运营/广告表；门禁流水表(t_record/t_wx_record/t_doorphone/
  t_community)属于同实例的 Yefiot 源库，模型上带 schema='Yefiot'，此处按 schema 过滤排除，
  绝不对生产 Yefiot 库发任何 DDL。
- 建表前先 CREATE DATABASE IF NOT EXISTS YunWeijia（连接串指向的库不存在时无法连接）。
- 执行前请确认目标实例(192.168.1.252:3307)可连且授权。
"""
from urllib.parse import urlsplit, urlunsplit
from sqlalchemy import create_engine, text
from corks import app
from db import db
from db import old_models, ad_models  # 注册全部模型到 metadata


def _ensure_database():
    """连接服务器(不指定库)并创建 YunWeijia 数据库（幂等）"""
    uri = app.config['SQLALCHEMY_DATABASE_URI']
    parts = urlsplit(uri)
    dbname = parts.path.lstrip('/')
    if not dbname:
        raise RuntimeError('SQLALCHEMY_DATABASE_URI 未指定数据库名')
    server_url = urlunsplit((parts.scheme, parts.netloc, '', '', ''))
    eng = create_engine(server_url)
    with eng.begin() as conn:
        conn.execute(text(
            f'CREATE DATABASE IF NOT EXISTS `{dbname}` '
            'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci'
        ))
    eng.dispose()


if __name__ == '__main__':
    _ensure_database()

    with app.app_context():
        # 排除跨库只读的流水表（带 schema 的，无论 Yefiot/yefiot），只建本库无 schema 表
        tables = [t for t in db.metadata.sorted_tables if not t.schema]
        with db.engine.begin() as conn:
            db.metadata.create_all(bind=conn, tables=tables)
        print(f'已在 {app.config["SQLALCHEMY_DATABASE_URI"]} 创建 {len(tables)} 张表：')
        for t in tables:
            print('  -', t.name)

    print('数据库表创建完成！')
