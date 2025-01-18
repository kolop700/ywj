<template>
	<view>
		<qf-image-cropper :width="300" :height="300" :fileType="'jpg'" :show-angle="false" :rotatable="false" :quality="0.8" @crop="handleCrop"></qf-image-cropper>
	</view>
</template>

<script>
	import QfImageCropper from '@/uni_modules/qf-image-cropper/components/qf-image-cropper/qf-image-cropper.vue';
	export default {
		components: {
			QfImageCropper
		},
		methods: {
			handleCrop(e) {
				uni.previewImage({
					urls: [e.tempFilePath],
					current: 0
				});
				console.log('图片');
				console.log('e', e);
				console.log('e.tempFilePath', e.tempFilePath);
			}
 		}
	}
</script>

<style>

</style>
