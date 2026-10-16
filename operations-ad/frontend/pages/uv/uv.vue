<template>
	<view>
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
			<view class="list" v-if="items.length">
				<navigator class="item" v-for="it in items" :key="it.id" 
                    :url="`/pages/uv/door?comm_id=${it.community_id}&date=${it.date}`">
					<view class="row1">
						<view class="title">{{it.comm_name}}</view>
                        <view>{{it.date}}</view>
					</view>
					<view class="row1">
						<view>设备数量:{{it.doorphone_count}}</view>
						<view>设备活跃:{{it.online_count}}</view>
					</view>
					<view class="row1">
						<view>总日活:<text class="price1">{{it.count}}</text></view>
						<view>小程序:<text class="price1">{{it.wx_count}}</text></view>
						<view>APP:<text class="price1">{{it.app_count}}</text></view>
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
                age_id: '',
				start_date: '',
				end_date: '',
				loading: true,
				cur_page: 1,
				page_count: 1,
				items: []
			}
		},
		onLoad(options){
            this.age_id = options.age_id || ''
            let date = options.date
            if (date) {
                this.start_date = date
                this.end_date = date
            } else {
                this.start_date = utils.getDate('start');
                this.end_date = utils.getDate('end');
            }
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
			formatUVData(item) {
				if (item.app_count === 0) {
					return {
						...item,
						wx_count: item.count
					}
				}
				return item
			},
			start_date_change: function(e) {
				this.start_date = e.target.value;
				this.load_data({});
			},
			end_date_change: function(e) {
				this.end_date = e.target.value;
				this.load_data({});
			},
			load_data(_obj){
				let obj = _obj || {};
				let page = obj.page || 1;
				let next_page = obj.next_page || false;
				getApp().api_call({
					url: config.qryUVUrl,
					method: 'GET',
					data: {
                        age_id: this.age_id,
						start_date: this.start_date,
						end_date: this.end_date,
						page: page
					},
					loading: '加载中',
					success: (res) => {
						this.cur_page = res.page;
						this.page_count = res.pages;
						const formattedItems = res.items.map(item => this.formatUVData(item));
						if (next_page) {
							this.items = this.items.concat(formattedItems);
						} else {
							this.items = formattedItems;
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
