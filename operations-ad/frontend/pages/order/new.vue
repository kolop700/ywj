<template>
    <view class="container">
        <view class="apply_box">
            <view class="row1">
                <picker mode="date" :value="date" @change="on_date_change">
                    <view class="uni-input">
                        截止日期: {{date}}
                        <image class="down_img" src="/static/imgs/down.png"></image>
                    </view>
                </picker>
                <label><switch type="checkbox" @change="check_all"></switch>全选</label>
            </view>
            <view class="uni-list">
                <checkbox-group @change="on_checkbox_change" v-if="items.length > 0">
                    <label class="uni-list-cell uni-list-cell-pd" v-for="item in items" :key="item.age_id">
                        <view>
                            <checkbox :value="item.age_id.toString()" :checked="selected_items.includes(item.age_id.toString())" >{{item.age_name}}</checkbox>
                        </view>
                        <view>￥{{item.amount}}</view>
                    </label>
                </checkbox-group>
                <view v-else style="text-align: center;padding: 20rpx 0;">列表为空</view>
            </view>
            <view class="uni-input">
                <view class="row">
                    <view>结算金额汇总:</view>
                    <view class="price1">￥{{unsettle_amount}}</view>
                </view>
            </view>
            <view class="uni-input">
                <view class="row">
                    <view>备注：</view>
                    <textarea class="remark" v-model="remark"/>
                </view>
            </view>
            <view class="row" style="margin-top: 80rpx;">
                <button type="primary" size="mini" @click="on_create">创建结算单</button>
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
                date: utils.get_current_date(),  // 截止日期
                unsettle_amount: 0,  // 待结金额
                items: [],  // 下级用户待结列表 
                remark: '',  // 订单备注
                selected_items: []
            }
        },
        onLoad() {
            this.get_unsettle_comm()
        },
        methods: {
			on_date_change(e) {
				this.date = e.target.value;
                this.get_unsettle_comm()
			},
            get_unsettle_comm() {  // 取待下级用户结算金额
				getApp().api_call({
                    loading: '加载中',
					url: config.sumUnsettleCommUrl,
					method: 'GET',
					data: {
						date: this.date
					},
					success: (res) => {
                        this.items = res
					}
				});
            },
            on_checkbox_change(e) {
                this.selected_items = e.detail.value
                this.update_unsettle_amount()
            },
            check_all(e) {
              if (e.detail.value) {
                  this.selected_items = this.items.map(it=>it.age_id.toString())
              }  else {
                  this.selected_items = []
              }
              this.update_unsettle_amount()
            },
            update_unsettle_amount() {  // 汇总待结金额
                this.unsettle_amount = this.items.map(it=>this.selected_items.includes(it.age_id.toString())?it.amount:0).reduce((a, b) => a + b, 0).toFixed(2)
            },
            on_create() {
                if (this.items.length == 0) {
                    uni.showToast({
                        icon: 'none',
                        title: '没有待结算的用户',
                        duration: 2000
                    })
                    return
                }
                if (this.selected_items.length == 0) {
                    uni.showToast({
                        icon: 'none',
                        title: '请选择要结算的用户',
                        duration: 2000
                    })
                    return
                }
				getApp().api_call({
					url: config.createOrderUrl,
					method: 'POST',
					data: {
						date: this.date,
                        age_ids: this.selected_items,
                        remark: this.remark
					},
					success: (res) => {
                        uni.showToast({
                            icon: 'none',
                            title: '创建成功！',
                            duration: 2000
                        })
                        uni.navigateBack()
					}
				});
            }
        }
    }
</script>

<style>
	.price1 {
		font-size: 1rem;
		font-weight: bold;
		color: #FFB400;
	}
    
	.apply_box{
		border-radius: 5px;
		background-color: #FFFFFF;
		padding: 20rpx;
		width: 100%;
        box-sizing: border-box;
	}
    
    .remark {
        border: 1rpx solid #D9D9D9 ;
        width: 80%;
        height: 100rpx;
    }

    .uni-list-cell {
        justify-content: space-between
    }

</style>
