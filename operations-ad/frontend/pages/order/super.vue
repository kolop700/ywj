<template>
	<view style="padding: 0 20rpx;">
		<view class="head">
			<picker mode="date" :value="start_date" @change="start_date_change">
				<view class="uni-input">
					开始日期: {{start_date}}
					<image class="down_img" src="/static/imgs/down.png"></image>
				</view>
			</picker>
			<picker mode="date" :value="end_date" @change="end_date_change">
				<view class="uni-input" >
					结束日期: {{end_date}}
					<image class="down_img" src="/static/imgs/down.png"></image>
				</view>
			</picker>
		</view>
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
			<view class="order_list" v-if="orders.length">
				<navigator class="order_item" v-for="order in orders" :key="order.id"
                    :url="`/pages/comms/comms?order_id=${order.id}&flag=1`">
					<view class="row1">
						<view class="title">单号：{{order.no}}</view>
						<view :class="{ title: order.status == 0, title1: order.status == 1, title2: order.status == 2}">{{order.status_label}}</view>
					</view>
					<view class="row1">
                        <view>截止：{{order.date}}</view>
						<view>金额：<text class="price1">￥{{order.amount}}</text></view>
					</view>
					<view class="row1" v-if="order.settle_time">
						<view>结算人：{{order.settle_age_name}}</view>
                        <view>时间：{{order.settle_time}}</view>
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
	import utils from '@/lib/utils.js'
    
	export default {
		data() {
			return {
				loading: true,
				cur_page: 1,
				page_count: 1,
				orders: [],
				start_date: utils.getDate('start'),
				end_date: utils.getDate('end')
			}
		},
		onLoad(options){

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
					url: config.qryOrderUrl,
					method: 'GET',
					data: {
                        flag: 1,  // 查上级结算单
                        start_date: this.start_date,
                        end_date: this.end_date,
						page: page
					},
					loading: '加载中',
					success: (res) => {
						this.cur_page = res.page;
						this.page_count = res.pages;
						if (next_page) {
							this.orders = this.orders.concat(res.items);
						} else {
							this.orders = res.items;
						}
					},
					complete: () => {
						this.loading = false;
						typeof obj.complete == 'function' && obj.complete();
					}
				});
			},
			start_date_change: function(e) {
				this.start_date = e.target.value;
				this.load_data({});
			},
			end_date_change: function(e) {
				this.end_date = e.target.value;
				this.load_data({});
			}
		}
	}
</script>

<style>
	.uni-input {
		background-color: #F4F5F6;
	}
	.head {
		width: 100%;
		display: flex;
		flex-direction: row;
		justify-content:space-between;
		background-color: #F4F5F6
	}
	
	.order_item {
		padding: 20rpx;
		background-color: #FFFFFF;
		border-bottom: 1rpx solid #F2F2F2;
        box-sizing: border-box;
	}
	
	.title {
		font-size: 1rem;
		font-weight: bold;
	}
	.title1 {
		font-size: 1rem;
		font-weight: bold;
		color: #1AAD19;
	}
	.title2 {
		font-size: 1rem;
		font-weight: bold;
		color: #F76260;
	}
	.price1 {
		font-size: 1rem;
		font-weight: bold;
		color: #FFB400;
	}
	.price2 {
		font-size: 1rem;
		font-weight: bold;
		color: #1AAD19;
	}
	
	.apply_box{
		border-radius: 5px;
		background-color: #FFFFFF;
		padding: 20rpx;
		width: 100%;
	}
    
    .remark {
        border: 1rpx solid #D9D9D9 ;
        width: 300rpx;
        height: 100rpx;
    }
</style>
