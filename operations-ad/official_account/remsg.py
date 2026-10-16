"""定义返回消息的格式"""
import time


def get_text_msg(from_user, to_user, content):
    """文本消息"""
    timestamp = int(time.time())
    return f'''
        <xml> 
            <ToUserName><![CDATA[{to_user}]]></ToUserName> 
            <FromUserName><![CDATA[{from_user}]]></FromUserName> 
            <CreateTime>{timestamp}</CreateTime> 
            <MsgType><![CDATA[text]]></MsgType> 
            <Content><![CDATA[{content}]]></Content> 
        </xml>
    '''