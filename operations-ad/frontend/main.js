import Vue from 'vue'
import App from './App'
import config from "common/config.js"

Vue.config.productionTip = false

App.mpType = 'app'

Vue.prototype.check_login = function(obj){	
	let userinfo = getApp().globalData.cur_user_info;
	let reload_userinfo = obj.reload_userinfo || false; // 是否重新加载用户信息
	
	if (userinfo && !reload_userinfo){
		typeof obj.success == 'function' && obj.success(userinfo);
	} else {
		getApp().api_call({
			url: config.curUserInfoUrl,
			method: 'GET',
			data: {},
			loading: obj.loading || '',
			success: (res) => {
				let userinfo = res;
				getApp().globalData.cur_user_info = userinfo;
				if (typeof userinfo.brand !== 'undefined') {
					getApp().set_brand(userinfo.brand); // 品牌跟随登录账号
				}
				typeof obj.success == 'function' && obj.success(userinfo);
			},
			fail: (msg, code) => {
				// code==100表示未登录认证
				console.log('取用户信息错误：' + msg);
                // 组装当前页面参数和地址，用于登录时跳转回来
				// let params = [];
				// for (let [key, value] of Object.entries(this.$mp.page.options)) {
				// 	params.push(key + '=' + value);
				// }
				
				// let backpage = '/' + this.$mp.page.route 
				// 	+ (params.length?'?'+params.join('&'):'');
				// uni.redirectTo({url: '/pages/login/login?backtype='+(obj.backtype||'')+'&backpage=' + encodeURIComponent(backpage)});
			}
		});
	}
}

const app = new Vue({
	...App
})
app.$mount()
