// 检测设备类型和微信环境
function checkPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const isWechat = ua.indexOf('micromessenger') !== -1;
    const isAndroid = ua.indexOf('android') !== -1;
    const isIOS = /iphone|ipad|ipod/.test(ua);
    
    // 显示对应的下载按钮
    if (isWechat) {
        document.querySelector('.wechat-tip').style.display = 'block';
        document.querySelector('#downloadButtons').style.display = 'none';
    } else {
        if (isAndroid) {
            document.querySelector('.android-btn').style.display = 'inline-block';
        } else if (isIOS) {
            document.querySelector('.ios-btn').style.display = 'inline-block';
        } else {
            // 如果无法识别设备，显示所有下载按钮
            document.querySelector('.android-btn').style.display = 'inline-block';
            document.querySelector('.ios-btn').style.display = 'inline-block';
        }
    }
}

// 页面加载完成后执行检测
window.onload = checkPlatform; 