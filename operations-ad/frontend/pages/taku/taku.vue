<template>
	<view class="container">
		<view class="head">
			<picker mode="date" :value="start_date" @change="start_date_change">
				<view class="uni-input">
					开始日期: {{start_date}}
					<image class="down_img" src="/static/imgs/down.png"></image>
				</view>
			</picker>
			<picker mode="date" :value="end_date" @change="end_date_change">
				<view class="uni-input">
					结束日期: {{end_date}}
					<image class="down_img" src="/static/imgs/down.png"></image>
				</view>
			</picker>
		</view>
		<view class="tips">金额为Taku服务端回调累计值(ECPM)，参考汇率{{rate}}。请与Taku后台核对无误后再生成收入，生成后立即按当天日活分润。</view>
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
			<view class="order_list" v-if="items.length">
				<view class="order_item" v-for="item in items" :key="item.date">
					<view class="row1">
						<view class="title">{{item.date}}</view>
						<view v-if="item.generated" class="title1">已生成 ￥{{item.amount}}</view>
						<view v-else class="title2">未生成</view>
					</view>
					<view class="row1">
						<view>展示次数：{{item.cnt}}</view>
						<view>USD：${{item.usd}}</view>
					</view>
					<view class="row1">
						<view>参考金额：<text class="price1">￥{{item.cny}}</text></view>
						<button v-if="!item.generated && is_admin" type="primary" size="mini" @click="on_gen(item)">生成收入</button>
					</view>
				</view>
			</view>
			<view style="text-align: center;" v-else>
				列表为空
			</view>
		</view>
		<uni-popup ref="dialogGen" type="dialog">
			<view class="dlg-content">
				<view class="dlg_title">{{gen_date}} 生成收入</view>
				<view class="uni-input">
					<view class="row">
						<view style="margin-right: 10rpx;">金额(元):</view>
						<input class="amount" type="digit" v-model="gen_amount"/>
					</view>
				</view>
				<view class="uni-input">
					<textarea class="comm_remark" placeholder="请输入备注(可空)" v-model="gen_remark"/>
				</view>
				<view class="row" style="margin-top: 60rpx;">
					<button type="primary" size="mini" @click="on_gen_ok">确定</button>
					<button type="default" size="mini" @click="on_gen_cancel">取消</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
    import config from "common/config.js"
    import utils from '@/lib/utils.js'

    export default {
        data() {
            return {
				loading: true,
                items: [],
				rate: '',
				is_admin: false,
				start_date: utils.getDate('start'),
				end_date: utils.getDate('end'),
				gen_date: '',
				gen_amount: '',
				gen_remark: ''
            }
        },
        onLoad(query) {
            uni.setNavigationBarTitle({
                title: 'Taku广告收益'
            })
        },
		onShow(){
			this.check_login({
				success: (userinfo) => {
					this.is_admin = userinfo.is_admin
					this.load_data({});
				}
			});
		},
		onPullDownRefresh() {
			// 下拉刷新
			this.load_data({
				complete: () => {
					uni.stopPullDownRefresh();
				}
			});
		},
        methods: {
			load_data(_obj){
				let obj = _obj || {};
				getApp().api_call({
					url: config.takuDailySummaryUrl,
					method: 'GET',
					data: {
						start_date: this.start_date,
						end_date: this.end_date
					},
					loading: '加载中',
					success: (res) => {
						this.rate = res.rate;
						this.items = res.items;
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
			},
			on_gen(item) {
				this.gen_date = item.date;
				this.gen_amount = item.cny;  // 预填换算金额，核对后可修改
				this.gen_remark = '';
				this.$refs.dialogGen.open();
			},
			on_gen_ok() {
				if (!this.gen_amount || this.gen_amount <= 0) {
					uni.showToast({
						title: '请输入正确的金额',
						icon: 'none'
					});
					return;
				}
				let data = {
					date: this.gen_date,
					amount: this.gen_amount
				};
				if (this.gen_remark) {
					data.remark = this.gen_remark;
				}
				getApp().api_call({
					url: config.takuGenCommissionUrl,
					method: 'POST',
					data: data,
					loading: '提交中',
					success: (res) => {
						this.$refs.dialogGen.close();
						uni.showToast({
							title: '生成成功，已分润',
							icon: 'none'
						});
						this.load_data({});
					}
				});
			},
			on_gen_cancel() {
				this.$refs.dialogGen.close();
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
	.tips {
		font-size: 24rpx;
		color: #909399;
		padding: 16rpx 10rpx;
		background-color: #FDF6EC;
		margin: 10rpx 0;
	}
	.order_item {
		padding: 20rpx;
		background-color: #FFFFFF;
		border-bottom: 1rpx solid #F2F2F2;
        box-sizing: border-box;
	}
	.row1 {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		padding: 6rpx 0;
	}

	.title {
		font-size: 1rem;
		font-weight: bold;
	}
	.title1 {
		font-size: 0.9rem;
		font-weight: bold;
		color: #1AAD19;
	}
	.title2 {
		font-size: 0.9rem;
		font-weight: bold;
		color: #F76260;
	}
	.price1 {
		font-size: 1rem;
		font-weight: bold;
		color: #FFB400;
	}
	.dlg-content {
		background-color: white;
		padding: 20rpx;
		box-sizing: border-box;
		border-radius: 5px;
	}
	.dlg_title {
		text-align: center;
		font-weight: bold;
		padding-bottom: 20rpx;
	}
	.amount {
		border: 1rpx solid #D9D9D9 ;
		width: 200rpx;
		text-align: center;
	}
	.comm_remark {
		border: 1rpx solid #D9D9D9 ;
		width: 300rpx;
		height: 100rpx;
		margin-top: 16rpx;
	}
</style>
