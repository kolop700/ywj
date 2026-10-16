<template>
    <view>
        <uni-section type="line">
            <uni-notice-bar text="请完善以下银行卡信息,将用于佣金结算" />
        </uni-section>
		<view class="uni-padding-wrap uni-common-mt" style="margin-top: 20rpx;">
			<form @submit="form_submit">
				<view class="uni-form-item ">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">开户行</view>
						<input class="uni-input" name="bank" :value="info.bank"/>
					</view>
				</view>
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">户名</view>
						<input class="uni-input" name="name" :value="info.name"/>
					</view>
				</view>
				<view class="uni-form-item ">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">银行卡号</view>
						<input class="uni-input" name="bankcard" :value="info.bankcard"/>
					</view>
				</view>
				<view class="uni-form-item uni-column">
					<view class="uni-btn-v">
						<button type="primary" formType="submit">保存</button>
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
                info: {}
            }
        },
        onShow() {
            getApp().api_call({
                url: config.getProfileUrl,
                method: 'GET',
                data: {},
                loading: '加载中',
                success: (res) => {
                    this.info = res
                }
            });
        },
        methods: {
			form_submit(e){
				let formdata = e.detail.value;
                getApp().api_call({
                    url: config.setProfileUrl,
                    method: 'POST',
                    data: formdata,
                    success: (res) => {
                        uni.showToast({
                            icon: 'none',
                            title: '保存成功！'
                        })
                    }
                });
            }
        }
    }
</script>

<style>
    .uni-title {
        width: 200rpx;
    }
</style>
