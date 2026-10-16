<template>
	<view>
		<view class="uni-padding-wrap uni-common-mt" style="margin-top: 100rpx;">
			<form @submit="form_submit">
				<view class="uni-form-item uni-column">
					<view class="uni-input-wrapper">
						<input class="uni-input" name="user_name" placeholder="用户名" />
					</view>
				</view>
				<view class="uni-form-item uni-column">
					<view class="uni-input-wrapper">
						<input class="uni-input" type="password" name="password" placeholder="请输入密码"/>
					</view>
				</view>
				<view class="uni-form-item uni-column">
					<view class="uni-btn-v">
						<button type="primary" formType="submit">登录</button>
					</view>
				</view>
			</form>
		</view>
	</view>
</template>

<script>
	import config from "common/config.js"
	
	export default {
		data() {
			return {
				backtype: '',
				backpage: ''
			}
		},
		onLoad(options){
			this.backtype = options.backtype || '';
			this.backpage = options.backpage || '';
		},
		methods: {
			form_submit(e){
				let formdata = e.detail.value;
				if (!formdata.user_name){
					uni.showToast({
						icon: 'none',
						title: '请输入用户名'
					})
					return;
				}
				
				if (!formdata.password){
					uni.showToast({
						icon: 'none',
						title: '请输入密码'
					})
					return;
				}
				
				getApp().api_call({
					url: config.loginUrl,
					method: 'POST',
					data: formdata,
					loading: '登录中',
					success: (res) => {
						getApp().globalData.cur_user_info = res;
						if (typeof res.brand !== 'undefined') {
							getApp().set_brand(res.brand); // 品牌跟随登录账号
						}
						
						if (this.backpage) {
							if (this.backtype == 'switch'){
								uni.switchTab({url: this.backpage});
							} else {
								uni.redirectTo({url: this.backpage});
							}
						} else {
							uni.switchTab({url: '/pages/index/index'});
						}
					}
				});
			}
		}
	}
</script>

<style>
	@import '/common/input-wrapper.css';
	
</style>
