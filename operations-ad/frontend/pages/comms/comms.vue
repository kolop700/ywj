<template>
	<view class="container">
		<view class="head" v-if="!order_id">
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
			<view class="order_list" v-if="items.length">
				<view class="order_item" v-for="item in items" :key="item.id">
					<view class="row1">
						<view class="title">{{item.date}}</view>
						<view :class="{ title: item.status == 0, title1: item.status == 1}">{{item.status_label}}</view>
					</view>
                    <view class="row1">
                        <view>用户：{{item.age_name}}</view>
                        <view>小区：{{item.comm_name}}</view>
                    </view>
					<view class="row1">
                        <view>小区收入：<text class="price1">￥{{item.src_amount}}</text></view>
                        <view>返点：{{item.ratio}}</view>
						<view>佣金：<text class="price1">￥{{item.amount}}</text></view>
					</view>
					<view class="row">
						<view>收入类型：{{item.type_label}}({{item.comm_type_label}})</view>
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
                order_id: '',
                flag: '0',  // 0: 下级返佣记录  1:自己的返佣记录
				loading: true,
				cur_page: 1,
				page_count: 1,
                items: [],
				start_date: utils.getDate('start'),
				end_date: utils.getDate('end')
            }
        },
        onLoad(query) {
            this.order_id = query.order_id
            this.flag = query.flag || '0'
            let title = ''
            if (this.order_id) {
                title = '订单返佣记录'
            } else if (this.flag == '0') {
                title = '下级返佣记录'
            } else if (this.flag == '1') {
                title = '我的返佣记录'
            }
            uni.setNavigationBarTitle({
                title: title
            })
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
					url: config.qryAgencyCommUrl,
					method: 'GET',
					data: {
                        order_id: this.order_id,
                        flag: this.flag,
                        start_date: this.start_date,
                        end_date: this.end_date,
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
    .container {
        padding: 0 20rpx;
        box-sizing: border-box;
    }
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
</style>
