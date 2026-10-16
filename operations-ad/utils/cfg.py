"""系统设置相关包装"""
from pathlib import Path
from .obj_dict import ObjDict
import pickle


class FileConfig(object):  # 保存到文件的配置

    def __init__(self, cfg_file, **kwargs):
        self.cfg_file = Path(cfg_file)
        if self.cfg_file.exists():
            with self.cfg_file.open('rb') as f:
                self.data = pickle.load(f)
        else:
            self.data = ObjDict()

        # 设置默认属性
        for k, v in kwargs.items():
            self.data.setdefault(k, v)

    def save(self):
        if not self.cfg_file.parent.exists():
            self.cfg_file.parent.mkdir(parents=True)

        with self.cfg_file.open('wb') as f:
            pickle.dump(self.data, f)

    def get(self, name, default=None):
        if default:
            return self.data.get(name, default)
        else:
            return self.data[name]

    def set(self, name, value):
        self.data[name] = value
