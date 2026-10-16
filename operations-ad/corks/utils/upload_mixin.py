from .. import app
from pathlib import Path
from urllib import parse
import uuid
import os


class UploadMixin(object):

    def __init__(self, *args, **kwargs):
        pass

    def _get_file(self):
        """
        取文件路径，从static开始
        :return:
        """
        if not hasattr(self, 'file_name'):
            raise Exception('%s需要有个file_name成员' % self.__class__.__name__)

        if not hasattr(self, 'get_upload_dir'):
            raise Exception('%s类没有实现get_upload_dir' % self.__class__.__name__)

        if not self.file_name:
            raise Exception('文件名(file_name)为空！')

        path = Path('static/upload') / self.get_upload_dir()
        local_path = Path(app.config['ROOT_DIR']) / path

        if not local_path.exists():
            local_path.mkdir(parents=True)

        return path / self.file_name

    def unique_filename(self, filename):
        """生成一个新的唯一文件名，后缀一样"""
        _, ext = os.path.splitext(filename)
        self.file_name = uuid.uuid4().hex + ext
        return self.file_name

    def get_local_file(self):
        """
        返回本地文件全路径
        :return:
        """
        if not self.file_name:
            return ''

        return str(Path(app.config['ROOT_DIR']) / self._get_file())

    def get_url(self, full_url=False, base_url=''):
        """
        返回图片url地址
        :return:
        """
        if not self.file_name:
            return ''

        raw_file_path = str(self._get_file())
        file_path = '/' + raw_file_path.replace('\\', '/')
        if full_url:  # 测试环境加上wx_img nginx才知道转过来
            if base_url:
                _base_url = base_url
            else:
                _base_url = app.config['BASE_URL']
            return parse.urljoin(_base_url, file_path)
        else:
            return file_path

    def del_file(self):  # 删除文件
        if not self.file_name:
            return

        local_file = self.get_local_file()
        if os.path.isfile(local_file):
            os.remove(local_file)
