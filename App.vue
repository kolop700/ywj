<script>
import TakuAds, { TAKU_CONFIG } from '@/common/taku-sdk'
import { useAgreementStore } from '@/store/modules/agreement'
import { useAdStore } from '@/store/modules/ad'
import { isVip } from '@/utils/vipUtils' // 【VIP 免广告】开屏跳过（VIP 状态由登录流程 syncVipStatus 同步）

import { getCurrentInstance } from 'vue'

// 启动时刻与开屏展示窗口：加载成功但已超出窗口（用户可能已在操作）则放弃展示
const launchAt = Date.now()
const SPLASH_SHOW_WINDOW_MS = 10000

// 开屏广告：广告 SDK 初始化成功后调用（冷启动单次；不受房间级 adType 约束，详见 store/modules/ad.js）
const loadSplashAd = () => {
	// 【VIP 免广告】VIP 用户直接跳过开屏（H5 侧兜底：adType=NONE 管不到开屏；
	// 原生侧由 Taku 后台流量分组 user_type=vip 拦截，见 utils/vipUtils.js）
	if (isVip()) {
		console.log('[TakuAds] VIP 用户跳过开屏广告')
		return
	}
	const splashId = useAdStore().getSplashAdId()
	if (!splashId) {
		console.log('[TakuAds] 未配置开屏广告位，跳过开屏')
		return
	}
	let shown = false
	TakuAds.loadSplashAd({ placementId: splashId }, {
		onAdLoaded: () => {
			if (shown || Date.now() - launchAt > SPLASH_SHOW_WINDOW_MS) {
				console.log('[TakuAds] 开屏加载成功但已超出启动窗口，放弃展示')
				return
			}
			shown = true
			TakuAds.showSplashAd({ placementId: splashId })
		},
		onAdFailed: (res) => {
			console.log('[TakuAds] 开屏广告加载失败', res)
		},
		onAdShow: () => {
			console.log('[TakuAds] 开屏广告展示')
		},
		onAdClosed: () => {
			console.log('[TakuAds] 开屏广告关闭')
		}
	})
}

export default {
	onLaunch: function() {
		console.log('App Launch')
		// Taku 广告 SDK 初始化（隐私合规时序）：
		// - Android：系统隐私弹窗（androidPrivacy.json）同意后才进入 onLaunch，可直接初始化；
		// - iOS：需应用内同意《隐私政策》（首页首次弹窗 handleAgree / 登录页勾选写入 agreement store）后才初始化
		// #ifdef APP-PLUS
		const sys = uni.getSystemInfoSync()
		const agreed = sys.platform === 'ios' ? useAgreementStore().checkAgreement() : true
		if (agreed) {
			TakuAds.init(TAKU_CONFIG, (res) => {
				console.log('[TakuAds] 初始化结果', res)
				if (res && res.code === 0) loadSplashAd()
			})
		}
		// #endif
		// #ifdef H5
		// H5 原生壳：Android 系统隐私弹窗同意后可直接初始化；
		// iOS（壳）需应用内同意《隐私政策》，由首页 handleAgree 再触发（重复调用幂等）
		const sysH5 = uni.getSystemInfoSync()
		const agreedH5 = sysH5.platform === 'ios' ? useAgreementStore().checkAgreement() : true
		if (agreedH5) {
			TakuAds.init(TAKU_CONFIG, (res) => {
				console.log('[TakuAds] 初始化结果', res)
				if (res && res.code === 0) loadSplashAd()
			})
		}
		// #endif
		// const { proxy } = getCurrentInstance()
		// const userStore = proxy.$store.user.useUserStore()
		
		// // 将登录请求放在后台执行，不阻塞界面加载
		// setTimeout(async () => {
		// 	try {
		// 		await userStore.login({ showLoading: false })
		// 		console.log('自动登录成功')
		// 	} catch (error) {
		// 		console.log('自动登录失败', error)
		// 	}
		// }, 0)
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
