<script>
import config from "common/config.js"
	
export default {
	globalData: {
		cur_user_info: null,
		brand: 0  // 当前品牌：0=星云 1=云卫家（由登录账号自动决定，api_call统一携带）
	},
	onLaunch: function() {
		// 恢复上次登录账号的品牌（取到用户信息后会再按账号刷新）
		let b = uni.getStorageSync('brand');
		this.globalData.brand = (b === 1 || b === '1') ? 1 : 0;
	},
	onShow: function() {

	},
	onHide: function() {

	},
	methods: {
		set_brand(brand){
			// 品牌由后端按登录账号树归属返回，前端不再手动切换
			this.globalData.brand = brand ? 1 : 0;
			uni.setStorageSync('brand', this.globalData.brand);
		},
		api_call(obj){
            if (!obj?.url) {
                console.log('api_call失败, url为空!')
                return
            }
			// 统一携带当前品牌（后端未声明brand接口的会自动忽略）
			obj.data = Object.assign({brand: this.globalData.brand}, obj.data || {});
			let token = this.globalData.cur_user_info? this.globalData.cur_user_info.token: '';
			let silent = obj.silent || false;
			// url拼上token
			let url = obj.url + (obj.url.indexOf('?') == -1 ? '?token=' : '&token=') + token;
            
			if (obj.loading){
				uni.showLoading({
					title: obj.loading
				});
			}
			uni.request({
				url: url,
				method: obj.method,
				data: obj.data,
				success: (res) => {
					if (res.data.is_success) {
						typeof obj.success == 'function' && obj.success(res.data.result);
					} else {
                        if (res.data.code == 100){  // 未登录或token已过期
                            uni.showToast({
                                icon: 'none',
                                title: res.data.message,
                                duration: 3000
                            });
                            uni.redirectTo({url: '/pages/login/login'});
                        } else {
                            if (!silent){
                                uni.showModal({
                                    title: '错误',
                                    content: res.data.message || '请求出错，请稍后重试！',
                                    showCancel: false,
                                    success: (res) => {

                                    }
                                });
                            }
                            typeof obj.fail == 'function' && obj.fail(res.data.message, res.data.code);
                        }
					}
				},
				fail: (res) => {
					let errMsg = res.errMsg || '请求出错，请稍后重试！';
					if (!silent){
						setTimeout(() => { // 加setTimeout解决showToast和hideLoading冲突
							uni.showToast({
								icon: 'none',
								title: errMsg,
								duration: 3000
							});
						}, 0);
					}
					typeof obj.fail == 'function' && obj.fail(errMsg);
				},
				complete: () => {
					if (obj.loading){
						uni.hideLoading();
					}
					typeof obj.complete == 'function' && obj.complete();
			    }
			});
		}
	}
};
</script>

<style>
    /* #ifndef APP-PLUS-NVUE */
    /* uni.css - 通用组件、模板样式库，可以当作一套ui库应用 */
    @import './common/uni.css';
	
    page {
        background-color: #F4F5F6;
        height: 100%;
        font-size: 28rpx;
        line-height: 1.8;
		color: #6D6D72;
    }
	
	.link {
		text-decoration: underline;
		color: #007AFF;
	}
	
	.tap_hover {
		background-color: #D9D9D9;
	}
    
	.down_img{
		margin-left: 10rpx;
		width: 20rpx;
		height: 20rpx;
	}
    
    .row {
        display: flex;
        flex-direction: row;
        align-items: center;
    }
    
	.row1{
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
    
	.row2{
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
	}
	/* #endif*/
</style>
