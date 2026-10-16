"""可通过属性访访问的字典"""


class ObjDict(dict):

    def __getattr__(self, name):
        try:
            return self[name]
        except:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        self[name]=value
