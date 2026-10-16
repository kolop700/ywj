<template>
	<view>
		<uni-popup ref="popup" type="bottom">底部弹出 Popup</uni-popup>
		<uni-popup id="dialogInput" ref="dialogInput" type="dialog">
			<uni-popup-dialog mode="input" title="输入内容" value="aaaa" placeholder="请输入内容" @confirm="dialogInputConfirm"></uni-popup-dialog>
		</uni-popup>
		<uni-list>
			<uni-list-item thumb="/static/imgs/charge.png" title="开启点击反馈" clickable  @click="onClick" ></uni-list-item>
			<uni-list-item title="默认 navigateTo 方式跳转页面" link to="/pages/vue/index/index" @click="onClick($event,1)" ></uni-list-item>
			<uni-list-item title="reLaunch 方式跳转页面" link="reLaunch" to="/pages/vue/index/index" @click="onClick($event,1)" ></uni-list-item>
		</uni-list>
	</view>
</template>

<script>
	import config from "common/config.js"
	import uniPopupDialog from '@/components/uni-popup/uni-popup-dialog.vue'
	 
	export default {
		components: {
		// 	uniPopupMessage,
		 	uniPopupDialog
		// 	uniPopupShare
		},
		data() {
			return {

			}
		},
		onLoad(options) {
			console.log(options);
		},
		onShow() {
			//this.check_login(()=>{
			//	consle.log('已登录');
			//});
		},
		methods: {
			onClick(){
				//this.$refs.popup.open();
				//this.$refs.dialogInput.open();
				
				uni.showToast({
					title: '注册成功',
					duration: 2000,
					success:(res)=>{
					setTimeout(function() {  
						alert('ok');
					}, 2000);
					}
				});
			},
			dialogInputConfirm(done, val) {
				alert(val)
				uni.hideLoading()
					// 关闭窗口后，恢复默认内容
				done()
			}
		}
	}
</script>

<style>

</style>
