<template>
	<view>
        <view class="head_box">
            <navigator class="head_item" url="/pages/comms/comms?flag=1">
                <view class="head_item_title">昨日收入</view>
                <view class="head_item_info price1">￥{{info.yesterday_amount}}</view>
            </navigator>
            <navigator class="head_item" url="/pages/comms/comms?flag=1">
                <view class="head_item_title">本年累计</view>
                <view class="head_item_info price1">￥{{info.this_year_total}}</view>
            </navigator>
            <navigator class="head_item" url="/pages/comms/comms?flag=1">
                <view class="head_item_title">上级待结</view>
                <view class="head_item_info price1">￥{{info.unsettled_amount}}</view>
            </navigator>
            <navigator class="head_item" url="/pages/comms/comms?flag=0">
                <view class="head_item_title">下级待分</view>
                <view class="head_item_info price1">￥{{info.unallocated_amount}}</view>
            </navigator>
        </view>
        <view class="chart_box">
            <l-echart ref="chartRef"></l-echart>
        </view>
		<view class="btn_group">
			<view v-if="is_admin" class="btn_wrap" hover-class="tap_hover" @click="on_comm_add" url="/pages/users/users">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/income.png"></image>
				<text class="btn_txt">收入录入</text>


                
			</view>
			<navigator v-if="is_admin" class="btn_wrap" hover-class="tap_hover" url="/pages/taku/taku">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/income.png"></image>
				<text class="btn_txt">广告收益</text>
			</navigator>
			<navigator v-if="is_admin" class="btn_wrap" hover-class="tap_hover" url="/pages/wxad/wxad">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/income.png"></image>
				<text class="btn_txt">流量主收益</text>
			</navigator>
			<navigator class="btn_wrap" hover-class="tap_hover" url="/pages/users/users">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/users.png"></image>
				<text class="btn_txt">用户管理</text>
			</navigator>
			<navigator class="btn_wrap" hover-class="tap_hover" url="/pages/order/order">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/share.png"></image>
				<text class="btn_txt">分佣结算</text>
			</navigator>
			<navigator class="btn_wrap" hover-class="tap_hover" url="/pages/uv/daily">
				<image class="btn_img" mode="aspectFit" src="/static/imgs/chart.png"></image>
				<text class="btn_txt">日活数据</text>
			</navigator>
		</view>
		<uni-popup ref="dialogCommAdd" type="dialog">
            <view class="dlg-content">
                <picker mode="date" :value="date" @change="on_date_change">
                    <view class="uni-input">
                        日期: {{date}}
                        <image class="down_img" src="/static/imgs/down.png"></image>
                    </view>
                </picker>
                <picker mode="selector" :range="comm_types" :value="comm_type_idx"
                    range-key="label" @change="on_comm_type_change">
                    <view class="uni-input">
                        类型: {{ comm_type_idx != -1?comm_types[comm_type_idx].label: '请选择'}}
                        <image class="down_img" src="/static/imgs/down.png"></image>
                    </view>
                </picker>
                <view class="uni-input">
                    <view class="row">
                        <view style="margin-right: 10rpx;">金额:</view>
                        <input class="amount" type="digit" v-model="comm_amount"/>
                    </view>
                </view>
                <view class="uni-input">
                    <textarea class="comm_remark" placeholder="请输入备注" v-model="comm_remark"/>
                </view>
                <view class="row" style="margin-top: 80rpx;">
                    <button type="primary" size="mini" @click="on_dialogCommAdd_ok">确定</button>
                    <button type="default" size="mini" @click="on_dialogCommAdd_cancel">取消</button>
                </view>
            </view>
		</uni-popup>
	</view>
</template>

<script>
	import config from "common/config.js"
	import uniPopupDialog from '@/components/uni-popup/uni-popup-dialog.vue'
    import * as echarts  from '@/uni_modules/lime-echart/static/echarts.min'
    import utils from '@/lib/utils.js'
     
	export default {
		components: {
			
		},
		data() {
			return {
                date: utils.get_current_date(),
                comm_types: [], // 收入(提成)类型
                comm_type_idx: -1, // 选中的收入类型下标
                comm_amount: '',
                comm_remark: '',
                is_admin: false,
                info: {}
			}
		},
		onLoad(options){
		},
		onShow() {
			this.check_login({
				backtype: 'switch',
				success: (userinfo) => {
                    this.is_admin = userinfo.is_admin
                    this.load_data()
				}
			});
		},
		methods: {
            load_data() {
                getApp().api_call({
                    url: config.getIndexInfoUrl,
                    method: 'GET',
                    data: {},
                    silent: true,
                    success:async (res) => {
                        this.info = res.info
                        const chart = await this.$refs.chartRef.init(echarts);
                        chart.setOption(res.charts)
                    }
                });
            },
			on_date_change(e) {
				this.date = e.target.value;
			},
            on_comm_type_change(e) {
                this.comm_type_idx = e.target.value
            },
            on_comm_add(e) {
                getApp().api_call({
                    url: config.getCommTypesUrl,
                    method: 'GET',
                    data: {},
                    success: (res) => {
                        this.comm_types = res.filter(it=> it.id > 0);  // 过滤id大于0的才是收入的
                        this.comm_type_idx = -1;
                        this.comm_amount = '';
                        this.comm_remark = '';
                        this.$refs.dialogCommAdd.open();
                    }
                });
            },
            on_dialogCommAdd_ok() {
                if (!this.date) {
                    uni.showToast({
                      title: '请选择收入日期',
                      icon: 'none'
                    });
                    return
                }
                if (this.comm_type_idx == -1) {
                    uni.showToast({
                      title: '请选择收入类型',
                      icon: 'none'
                    });
                    return
                }
                if (this.comm_amount <= 0) {
                    uni.showToast({
                      title: '请输入收入金额',
                      icon: 'none'
                    });
                    return
                }
                getApp().api_call({
                    url: config.addCommUrl,
                    method: 'POST',
                    data: {
                        date: this.date,
                        type: this.comm_types[this.comm_type_idx].id,
                        amount: this.comm_amount,
                        remark: this.comm_remark
                    },
                    success:(res) => {
                        this.$refs.dialogCommAdd.close();
                        uni.showToast({
                          title: '添加成功！',
                          icon: 'none'
                        });
                        this.load_data();
                    }
                });
            },
            on_dialogCommAdd_cancel() {
                this.$refs.dialogCommAdd.close();
            }
		}
	}
</script>

<style>
    page {
        background-color: #fefffe;
    }
	.head_box {
        box-shadow: 0px 6px 12px -4px rgba(225, 225, 225, 0.5);
        padding: 20rpx;
        display: flex;
        flex-direction: row;
		align-items: center;
		justify-content: flex-start;
        flex-wrap: wrap;
    }
    
    .head_item {
        box-shadow: 0 0 12px rgba(225, 225, 225, 1);
        padding: 0 20rpx;
        margin: 10rpx;
    }
    
	.chart_box {
		box-shadow: 0px 6px 12px -4px rgba(225, 225, 225, 0.5);
        border-radius: 5px;
        height: 500rpx;
        width: 100%;
	}
	
	.btn_group {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		padding: 20rpx;
	}
	
	.btn_wrap{
		background-color: #FFFFFF;
		margin: 10rpx;
		display: flex;
		flex-direction: column;
		align-items:center;
		justify-content:center;
		border-radius: 10px;
		box-shadow: 0 0 12px rgba(225, 225, 225, 1);
		height: 156rpx;
		width: 156rpx;
		text-align: center;
	}
	
	.btn_img{
		width: 70rpx;
	}
	
	.tap_hover {
		background-color: #D9D9D9;
	}
    
    .dlg-content {
        background-color: white;
        padding: 20rpx;
        box-sizing: border-box;
        border-radius: 5px;
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
    }
    
	.price1 {
		color: #FFB400;
	}
</style>
