<script>
import { getCurrentInstance } from 'vue'

export default {
	onLaunch: function() {
		console.log('App Launch')
		const { proxy } = getCurrentInstance()
		const userStore = proxy.$store.user.useUserStore()
		
		// 将登录请求放在后台执行，不阻塞界面加载
		setTimeout(async () => {
			try {
				await userStore.login({ showLoading: false })
				console.log('自动登录成功')
			} catch (error) {
				console.log('自动登录失败', error)
			}
		}, 0)
	},
	onShow: function() {
		console.log('App Show')
	},
	onHide: function() {
		console.log('App Hide')
	}
}
</script>

<style lang="scss">
	/* 注意要写在第一行，注意不能引入至uni.scss，同时给style标签加入lang="scss"属性 */
	@import "@/uni_modules/uview-plus/index.scss";
	@import 'static/css/common.css';
</style>
