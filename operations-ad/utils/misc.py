"""一些常用函数"""
from datetime import date
import calendar


def fmt_day(d, today=None):
    if not today:
        today = date.today()

    t =  d.date() - today
    if t.days == 0:
        return '今天'
    elif t.days == 1:
        return '明天'
    elif t.days == 2:
        return '后天'
    elif t.days == -1:
        return '昨天'
    elif t.days == -2:
        return '前天'
    else:
        return d.strftime('%m-%d')


def get_pinyin(s):
    """取汉字拼音首字母"""
    py_list = []
    for c in s:
        gb = c.encode('gbk')
        if len(gb)>1:
            #v = (gb[0] << 8) | gb[1]
            v = int.from_bytes(gb, byteorder='big')
        else:
            py_list.append(c)
            continue

        if   0xB0A1<=v<=0xB0C4 : py = 'A'
        elif 0xB0C5<=v<=0xB2C0 : py = 'B'
        elif 0xB2C1<=v<=0xB4ED : py = 'C'
        elif 0xB4EE<=v<=0xB6E9 : py = 'D'
        elif 0xB6EA<=v<=0xB7A1 : py = 'E'
        elif 0xB7A2<=v<=0xB8C0 : py = 'F'
        elif 0xB8C1<=v<=0xB9FD : py = 'G'
        elif 0xB9FE<=v<=0xBBF6 : py = 'H'
        elif 0xBBF7<=v<=0xBFA5 : py = 'J'
        elif 0xBFA6<=v<=0xC0AB : py = 'K'
        elif 0xC0AC<=v<=0xC2E7 : py = 'L'
        elif 0xC2E8<=v<=0xC4C2 : py = 'M'
        elif 0xC4C3<=v<=0xC5B5 : py = 'N'
        elif 0xC5B6<=v<=0xC5BD : py = 'O'
        elif 0xC5BE<=v<=0xC6D9 : py = 'P'
        elif 0xC6DA<=v<=0xC8BA : py = 'Q'
        elif 0xC8BB<=v<=0xC8F5 : py = 'R'
        elif 0xC8F6<=v<=0xCBF9 : py = 'S'
        elif 0xCBFA<=v<=0xCDD9 : py = 'T'
        elif 0xCDDA<=v<=0xCEF3 : py = 'W'
        elif 0xCEF4<=v<=0xD1B8 : py = 'X'
        elif 0xD1B9<=v<=0xD4D0 : py = 'Y'
        elif 0xD4D1<=v<=0xD7F9 : py = 'Z'
        else: py = c

        py_list.append(py)

    return ''.join(py_list)


def add_months(sourcedate, months):  # 月份增加
    month = sourcedate.month - 1 + months
    year = sourcedate.year + month // 12
    month = month % 12 + 1
    day = min(sourcedate.day, calendar.monthrange(year,month)[1])
    return date(year, month, day)


_cn_no1 = ('零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十')
_cn_no2 = ('', '一', '二', '三', '四', '五', '六', '七', '八', '九', '一十')
_digit = {
    10000: '万',
    1000: '千',
    100: '百',
    10: '十'
}


def no_to_cn(no):
    """
    数字编号转中文
    @param no:
    @return:
    """
    if no < 0:
        raise Exception('编号不能小于0')

    if 0 <= no <= 10:
        return _cn_no1[no]
    result = []
    for n, char in _digit.items():
        if no >= n:
            d = no // n
            if d > 10:
                raise Exception(f'数字不能超过10{char}')
            result.append(_cn_no2[d] + char)
            no -= d * n
            if n >= 100 and 0 < no < (n / 10):
                result.append('零')

        if no <= 10:
            result.append(_cn_no2[no])
            break

    return ''.join(result)
