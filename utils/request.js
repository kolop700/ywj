// 根据环境设置baseURL
const BASE_URL = process.env.NODE_ENV === 'development' && process.env.UNI_PLATFORM === 'h5' 
  ? '' // 开发环境下H5使用代理
  : 'https://xy.yefiot.com'; // 其他环境使用完整URL

const request = ({
    url, // 请求url
    method, // 请求方式：get/post/put/delete
    params, // get请求提交参数
    data, // post/put请求提交参数
    headers, // 请求头
}) => {
    return new Promise((resolve, reject) => {
        // 显示加载框
        uni.showLoading({
            title: '加载中',
            mask: true
        });

        if (!headers) {
            const token = uni.getStorageSync('token');
            headers = {
                'Content-Type': 'application/json;charset=utf-8',
                Authorization: token,
                TENANT_ID: 1,
            };
        }
        uni.request({
            url: BASE_URL + url,
            data: method === 'get' ? params : data,
            method: method,
            header: headers,
            // 收到开发者服务器成功返回的回调函数
            success: (res) => {
                console.log(res)
                const { code, Code, msg, Message } = res.data;
                console.log(res.data)
                if (code === "0" || Code === "OK") {
                    return resolve(res.data);
                }
                uni.showToast({
                    icon: 'none',
                    duration: 3000,
                    title: msg || Message || '请求失败',
                });
                return reject(res.data);
            },
            // 接口调用失败的回调函数
            fail(error) {
                console.log('请求错误：', error);
                uni.showToast({
                    icon: 'none',
                    duration: 3000,
                    title: '网络异常，请稍后重试！',
                });
                return reject(error);
            },
            // 接口调用结束的回调函数（调用成功、失败都会执行）
            complete() {
                // 隐藏加载框
                uni.hideLoading();
            },
        });
    });
};

// 向外暴露request
export default request;