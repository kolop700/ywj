<template>
	<view style="padding: 0 20rpx;">
		<view class="head">
			<button type="primary" size="mini" @click="on_add">新建</button>
		</view>
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
			<view class="order_list" v-if="orders.length">
				<view class="order_item" v-for="order in orders" :key="order.id">
					<view class="row1">
						<view class="title">单号：{{order.no}}</view>
						<view :class="{ title: order.status == 0, title1: order.status == 1, title2: order.status == 2}">{{order.status_label}}</view>
					</view>
					<view class="row1">
                        <view>截止：{{order.date}}</view>
						<view>金额：<text class="price1">￥{{order.amount}}</text></view>
					</view>
					<view v-if="order.remark">{{order.remark}}</view>
					<view class="row1" v-if="order.settle_time">
						<view></view>
                        <view>结算时间：{{order.settle_time}}</view>
					</view> 
                    <view style="margin-top: 20rpx;">
                        <button type="default" size="mini" @click="on_comms(order.id)">查看明细</button>
                        <button type="default" size="mini" style="margin-left: 20rpx;" @click="on_export(order.id)">导出明细</button>
                        <button type="default" size="mini" style="margin-left: 20rpx;" @click="on_detail(order.id)">{{order.status == 0?'立即结算':'结算记录'}}</button>
                        <button v-if="order.status == 0" style="margin-left: 20rpx;" type="warn" size="mini" @click="on_del(order.id)">删除订单</button>
                    </view>
				</view>
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
				orders: []
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
                        flag: 0,  // 查下级结算单
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
            on_add(){
                uni.navigateTo({
                    url: '/pages/order/new'
                })
            },
            on_comms(order_id) {
                uni.navigateTo({
                    url: `/pages/comms/comms?order_id=${order_id}`
                })
            },
            on_export(order_id) {
                window.location.href = `${config.exportAgencyCommUrl}?order_id=${order_id}`
            },
            on_detail(order_id) {
                uni.navigateTo({
                    url: `/pages/order/detail?order_id=${order_id}`
                })
            },
            on_del(order_id) {
				uni.showModal({
					title: '提示',
					content: '确定删除订单吗？',
					success: (res) => {
						if (res.confirm) {
							getApp().api_call({
								url: config.delOrderUrl,
								method: 'POST',
								data: {
                                    order_id: order_id
                                },
								success: (res) => {
									this.load_data({});
								}
							});
						}
					}
				});
            }
		}
	}
</script>

<style>
	.head {
		width: 100%;
		background-color: #F4F5F6;
        padding: 10rpx;
        box-sizing: border-box;
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
</style>
