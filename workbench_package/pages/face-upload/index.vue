<template>
	<view>
		<qf-image-cropper :width="300" :height="300" :fileType="'jpg'" :show-angle="false" :rotatable="false" :quality="0.8" @crop="handleCrop"></qf-image-cropper>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import QfImageCropper from '@/uni_modules/qf-image-cropper/components/qf-image-cropper/qf-image-cropper.vue'
import userApi from '@/api/user/user.js'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const handleCrop = async (e) => {
	try {
		// 显示上传中
		uni.showLoading({
			title: '上传中...',
			mask: true
		})
		// 获取用户账号
		const userAcct = userStore.userAcct

		// 调用上传接口
		const result = await userApi.uploadUserFacePic(
			e.tempFilePath,
			userAcct
		)

		if (result.code === "0") {
			// 重新登录刷新用户信息
			await userStore.login(null, { showLoading: false })
			
			uni.showToast({
				title: '图片上传成功!',
				icon: 'none',
				duration: 2000
			})
			
			// 返回上一页
			setTimeout(() => {
				uni.navigateBack()
			}, 1500)
		} else {
			uni.showToast({
				title: result.msg || '上传失败',
				icon: 'none'
			})
		}
	} catch (error) {
		console.error('上传失败:', error)
		uni.showToast({
			title: '上传失败，请重试',
			icon: 'none'
		})
	} finally {
		uni.hideLoading()
	}
}
</script>

<style>

</style>
