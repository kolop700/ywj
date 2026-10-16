"""一些常用类型定义"""
from enum import IntEnum


class LabelEnum(IntEnum):
    """带标签的枚举型"""
    def __new__(cls, value, label):
        obj = int.__new__(cls, value)
        obj._value_ = value
        obj.label = label
        return obj

    def __str__(self):
        return self.label