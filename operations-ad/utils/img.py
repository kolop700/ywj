from PIL import Image
from io import BytesIO
import base64


def img_data_to_file(img_data, file_name):
    """
    图片数据保存成图片
    :param img_data: 图片数据(img_upload.html上传取得)
    :param file_name: 文件名
    :return:
    """
    img_type, img_data = img_data.split(',')
    data = base64.standard_b64decode(img_data)
    #img_ext = img_type[img_type.index('/') + 1:img_type.index(';')]  # 取得图片后缀
    with open(file_name, 'wb') as f:
        f.write(data)


def img_data_to_fp(img_data):
    """
    图片数据转成类文件对象
    :param img_data:
    :return:
    """
    img_type, img_data = img_data.split(',')
    data = base64.standard_b64decode(img_data)
    return BytesIO(data)


def auto_crop_qrcode_img(data, border_width=10, format='JPEG'):
    """
    自动裁剪小程序生成的二维码图片,去掉下面的“微信扫一扫，使用小程序”
    :param data: bytes对象
    :param border_width裁剪连框宽度，默认10
    :param format:输出的图片格式，默认JPEG
    :return:
        bytes对象
    """
    image = Image.open(BytesIO(data))
    area = (border_width, border_width, image.width - border_width, image.width - border_width)
    cropped_img = image.crop(area)

    buf = BytesIO()
    cropped_img.save(buf, format)
    return buf.getvalue()
