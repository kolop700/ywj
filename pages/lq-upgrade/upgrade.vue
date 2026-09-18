<template>
	<view class="upgrade-popup">
		<image class="header-bg" src="./upgrade_bg.png" mode="widthFix"></image>
		<view class="main">
			<view class="version">发现新版本{{versionName}}</view>
			<view class="content">
				<text class="title">更新内容</text>
				<view class="desc" v-html="versionDesc"></view>
			</view>
			<!--下载状态-进度条显示 -->
			<view class="footer" v-if="isStartDownload">
				<view class="progress-view" :class="{'active':!hasProgress}" @click="handleInstallApp">
					<!-- 进度条 -->
					<view v-if="hasProgress" style="height: 100%;">
						<view class="txt">{{percentText}}</view>
						<view class="progress" :style="setProStyle"></view>
					</view>
					<view v-else>
						<view class="btn upgrade force">{{ isDownloadFinish  ? '立即安装' :'下载中...'}}</view>
					</view>
				</view>
			</view>
			<!-- 强制更新 -->
			<view class="footer" v-else-if="isForceUpdate">
				<view class="btn upgrade force" @click="handleUpgrade">立即更新</view>
			</view>
			<!-- 可选择更新 -->
			<view class="footer" v-else>
				<view class="btn close" @click="handleClose">以后再说</view>
				<view class="btn upgrade" @click="handleUpgrade">立即更新</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		downloadApp,
		installApp
	} from './upgrade.js'
	export default {
		data() {
			return {
				isForceUpdate: false, //是否强制更新
				versionName: '', //版本名称
				versionDesc: '', //更新说明
				downloadUrl: '', //APP下载链接
				isDownloadFinish: false, //是否下载完成
				hasProgress: false, //是否能显示进度条
				currentPercent: 0, //当前下载百分比
				isStartDownload: false, //是否开始下载
				fileName: '', //下载后app本地路径名称
			}
		},
		computed: {
			//设置进度条样式，实时更新进度位置
			setProStyle() {
				return {
					width: (510 * this.currentPercent / 100) + 'rpx' //510：按钮进度条宽度
				}
			},
			//百分比文字
			percentText() {
				let percent = this.currentPercent;
				if (typeof percent !== 'number' || isNaN(percent)) return '下载中...'
				if (percent < 100) return `下载中${percent}%`
				return '立即安装'

			}
		},

		onBackPress(options) {
			// 禁用返回
			if (options.from == 'backbutton') {
				return true;
			}

		},
		created() {
			uni.$on('upgrade-app',this.bindEmit)
		},
		beforeDestroy() {
			uni.$off('upgrade-app',this.bindEmit)
		},
		methods: {
			bindEmit(e){
				let {name,content,url,forceUpdate}=e
				this.isForceUpdate=forceUpdate
				this.versionName=name
				this.versionDesc=content
				this.downloadUrl=url	
			},
			//更新
			handleUpgrade() {
				if (this.downloadUrl) {
					this.isStartDownload = true
					//开始下载App
					downloadApp(this.downloadUrl, current => {
						//下载进度监听
						this.hasProgress = true
						this.currentPercent = current

					}).then(fileName => {
						//下载完成
						this.isDownloadFinish = true
						this.fileName = fileName
						if (fileName) {
							//自动安装App
							this.handleInstallApp()
						}
					}).catch(e => {
						console.log(e, 'e')
					})
				} else {
					uni.showToast({
						title: '下载链接不存在',
						icon: 'none'
					})
				}

			},
			//安装app
			handleInstallApp() {
				//下载完成才能安装，防止下载过程中点击
				if (this.isDownloadFinish && this.fileName) {
					installApp(this.fileName, () => {
						//安装成功,关闭升级弹窗
						uni.navigateBack()
					})
				}
			},
			//关闭返回
			handleClose() {
				uni.navigateBack()
			},
		}
	}
</script>

<style>
	page {
		background: rgba(18, 26, 51, 0.55);/**设置窗口背景半透明*/
	}
</style>
<style lang="scss" scoped>
	.upgrade-popup {
		width: 580rpx;
		height: auto;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		border-radius: 28rpx;
		box-sizing: border-box;
		border: none;
		box-shadow: 0 24rpx 80rpx rgba(23, 35, 92, 0.35);
		overflow: hidden;
	}

	.header-bg {
		width: 100%;
		margin-top: -112rpx;
	}

	.main {
		padding: 10rpx 30rpx 30rpx;
		box-sizing: border-box;
		.version {
			font-size: 36rpx;
			color: var(--brand);
			font-weight: 700;
			width: 100%;
			text-align: center;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			letter-spacing: 1px;
		}

		.content {
			margin-top: 60rpx;

			.title {
				font-size: 28rpx;
				font-weight: 700;
				color: #1f2435;
			}

			.desc {
				box-sizing: border-box;
				margin-top: 20rpx;
				font-size: 28rpx;
				color: #6A6A6A;
				max-height: 40vh;
				overflow-y: auto;
			}
		}

		.footer {
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			position: relative;
			flex-shrink: 0;
			margin-top: 100rpx;

			.btn {
				width: 246rpx;
				display: flex;
				justify-content: center;
				align-items: center;
				position: relative;
				z-index: 999;
				height: 96rpx;
				box-sizing: border-box;
				font-size: 32rpx;
				border-radius: 48rpx;
				letter-spacing: 2rpx;

				&.force {
					width: 500rpx;
				}

				&.close {
					border: 1rpx solid #ccd4fb;
					background: #ffffff;
					margin-right: 25rpx;
					color: var(--brand);
				}

				&.upgrade {
					background-color: #4a6cf7;
					background-image: var(--brand-grad);
					color: white;
					box-shadow: 0 12rpx 28rpx rgba(74, 108, 247, 0.28);
				}
			}

			.progress-view {
				width: 510rpx;
				height: 90rpx;
				display: flex;
				position: relative;
				align-items: center;
				border-radius: 45rpx;
				background-color: #eef0f6;
				display: flex;
				justify-content: flex-start;
				padding: 0px;
				box-sizing: border-box;
				border: none;
				overflow: hidden;

				&.active {
					background-color: #4a6cf7;
					background-image: var(--brand-grad);
				}

				.progress {
					height: 100%;
					background-color: #4a6cf7;
					background-image: var(--brand-grad);
					padding: 0px;
					box-sizing: border-box;
					border: none;
				}

				.txt {
					font-size: 28rpx;
					position: absolute;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					color: #fff;
					z-index: 1;
				}
			}
		}
	}
</style>
