// #ifdef H5
// H5 原生壳：本机版本号需经桥接读取（H5 环境 uni.getSystemInfoSync() 无 appVersionCode 字段）
import { isNativeShell, NativeApp } from '@/utils/h5-native-bridge'
// #endif

/**
 * 检查app版本是否需要升级
 */
const checkVersion = async ({
	name, //最新版本名称
	code, //最新版本号
	content, //更新内容
	url, //下载链接
	forceUpdate //是否强制升级
}) => {
	const sysInfo = await getVersionInfo()
	//取不到版本号/平台时跳过（避免把 NaN 误判为需要升级）
	if (!sysInfo || !sysInfo.versionCode || !sysInfo.platform) {
		console.warn('[checkVersion] 未获取到本机版本信息，跳过版本检查', sysInfo)
		return
	}
	const selfVersionCode = sysInfo.versionCode //当前App版本号
	console.log('版本比较:', '服务器版本号:', code, '当前版本号:', selfVersionCode)
	//线上版本号高于当前，进行在线升级
	if (code > selfVersionCode) {
		const platform = sysInfo.platform //手机平台
		console.log('platform', platform)
		//安卓手机弹窗升级
		if (platform === 'android') {
                //当前页面不是升级页面跳转防止多次打开
			if (getCurrentPageRoute() !== 'pages/lq-upgrade/upgrade') {
				console.log('getCurrentPageRoute', getCurrentPageRoute())
				uni.navigateTo({
					url: '/pages/lq-upgrade/upgrade',
					success() {
						uni.$emit('upgrade-app', {
							name,
							content,
							url,
							forceUpdate
						})
					}
				})
			}

		}
		//IOS无法在线升级提示到商店下载
		else {
			uni.showModal({
				title: '发现新版本 ' + name,
				content: '请到App store进行升级',
				showCancel: false,
				success: () => {
					// #ifdef H5
					//H5 原生壳：确认后跳转 App Store（后台配置了商店链接则直达，否则打开商店）
					if (isNativeShell) {
						const isStoreLink = typeof url === 'string' && /itunes\.apple\.com|apps\.apple\.com/.test(url)
						NativeApp.openStore(isStoreLink ? url : '').catch(() => {})
					}
					// #endif
				}
			})
		}
	}
}

//获取本机版本信息 { platform, versionCode }
const getVersionInfo = async () => {
	// #ifdef H5
	//H5 原生壳：uni.getSystemInfoSync() 无 appVersionCode，经桥接读原生版本号（buildNumber）
	if (isNativeShell) {
		try {
			const info = await NativeApp.getInfo()
			return {
				platform: info && info.platform, // 'android' / 'ios'
				versionCode: Number(info && info.buildNumber) || 0
			}
		} catch (e) {
			console.warn('[checkVersion] 读取原生版本信息失败', e)
		}
	}
	return null
	// #endif
	// #ifndef H5
	const info = uni.getSystemInfoSync()
	return {
		platform: info.platform,
		versionCode: Number(info.appVersionCode) || 0
	}
	// #endif
}

//获取当前页面url
const getCurrentPageRoute = () => {
	let currentRoute;
	let pages = getCurrentPages() // 获取栈实例
	if (pages&&pages.length) {
		currentRoute = pages[pages.length - 1].route;

	}
	return currentRoute
}

export default checkVersion