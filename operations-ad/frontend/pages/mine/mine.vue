<template>
	<view class="container">
		<view class="x_divide"/>
		<view class="head">
            <view class="row">
                <image class="img" src="/static/imgs/avatar.png"/>
                <view>账号: {{nickname}}</view>
            </view>
            <view @click="on_quit">退出登录</view>
		</view>
		<view class="x_divide"/>
		<uni-list>
            <uni-list-item thumb="/static/imgs/profile.png" title="银行卡信息" clickable  @click="on_profile" ></uni-list-item>
			<uni-list-item thumb="/static/imgs/order.png" title="我的返佣记录" clickable  @click="on_comms(1)" ></uni-list-item>
            <uni-list-item thumb="/static/imgs/order.png" title="下级返佣记录" clickable  @click="on_comms(0)" ></uni-list-item>
            <uni-list-item thumb="/static/imgs/order.png" title="上级结算单" clickable  @click="on_super_order" ></uni-list-item>
		</uni-list>
	</view>
</template>

<script>
    import config from "common/config.js"
    
	export default {
		data() {
			return {
				avatar_url: "",
				nickname: "",
			}
		},
		onShow() {
			this.check_login({
				backtype: 'switch',
				success: (userinfo)=>{
					this.avatar_url = userinfo.avatar_url;
					this.nickname = userinfo.age_name;
				}
			});
		},
		methods: {
            on_quit() {
				uni.showModal({
					title: '提示',
					content: '确定退出登录吗？',
					success: (res) => {
						if (res.confirm) {
							getApp().api_call({
								url: config.logoutUrl,
								method: 'GET',
								data: {},
								success: (res) => {
									uni.redirectTo({url: '/pages/login/login'});
								}
							});
						}
					}
				});
            },
			on_comms(flag){
				uni.navigateTo({
					url: `/pages/comms/comms?flag=${flag}`
				});
			},
            on_profile() {
				uni.navigateTo({
					url: '/pages/profile/profile'
				});
            },
            on_super_order() {
				uni.navigateTo({
					url: '/pages/order/super'
				});
            }
		}
	}
</script>

<style>
	
.head{
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: 1.2rem;
  background-color:#fff;
  padding: 20rpx;
  box-sizing: border-box;
}

.head .img{
  width: 120rpx;
  height: 120rpx;
}

.x_line{
    height: 2rpx;
}

.x_divide{
    height: 40rpx;
}

.tap_hover {
	background-color: #D9D9D9;
}
</style>
