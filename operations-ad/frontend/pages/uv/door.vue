<template>
	<view>
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
			<view class="list" v-if="items.length">
				<navigator class="item" v-for="item in items" :key="item.door_id">
					<view class="row1">
						<view class="title">{{item.door_name}}({{item.door_mac}})</view>
					</view>
					<view class="row1">
						<view>日期：{{item.date}}</view>
						<view>小程序：<text class="price1">{{item.count}}</text></view>
						<view>APP：<text class="price1">{{item.app_count}}</text></view>
					</view>
				</navigator>
			</view>
			<view style="text-align: center;" v-else>
				列表为空
			</view>
		</view>
	</view>
</template>

<script>
	import config from "common/config.js"
	
	export default {
		data() {
			return {
				loading: true,
				cur_page: 1,
				page_count: 1,
				items: [],
                comm_id: '', // 小区id
                date: '', // 日期
			}
		},
		onLoad(options){
            this.comm_id = options.comm_id
            this.date = options.date
		},
		onShow(){
			this.check_login({
				success: (userinfo) => {
					this.load_data({});
				}
			});
		},
		onPullDownRefresh() {
			// 下接刷新
			this.load_data({
				page: 1,
				complete: () => {
					uni.stopPullDownRefresh();
				}
			});
		},
		onReachBottom(){
			// 触底加裁
			if (this.cur_page < this.page_count){
				this.load_data({page: this.cur_page + 1, next_page: true});
			} else {
				uni.showToast({
					icon: 'none',
					title: '别扯了，到底了~',
					duration: 2000
				});
			}
		},
		methods: {
			load_data(_obj){
				let obj = _obj || {};
				let page = obj.page || 1;
				let next_page = obj.next_page || false;
				getApp().api_call({
					url: config.qryDoorUVUrl,
					method: 'GET',
					data: {
						comm_id: this.comm_id,
						date: this.date,
						page: page
					},
					loading: '加载中',
					success: (res) => {
						this.cur_page = res.page;
						this.page_count = res.pages;
						if (next_page) {
							this.items = this.items.concat(res.items);
						} else {
							this.items = res.items;
						}
					},
					complete: () => {
						this.loading = false;
						typeof obj.complete == 'function' && obj.complete();
					}
				});
			}
		}
	}
</script>

<style>
	.item {
		padding: 20rpx;
		background-color: #FFFFFF;
		border-bottom: 1rpx solid #F2F2F2;
	}
	
	.title {
		font-size: 1rem;
		font-weight: bold;
	}
    
	.price1 {
		font-size: 1rem;
		font-weight: bold;
		color: #FFB400;
	}
</style>
