<template>
	<view class="container">
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
            <template v-if="items.length">
                <view class="order_list" >
                    <view class="order_item" v-for="item in items" :key="item.age_id">
                        <view class="row1">
                            <view class="title">用户：{{item.age_name}}</view>
                            <view class="title">佣金：<text class="price1">￥{{item.amount}}</text></view>
                        </view>
                        <view class="row1">
                            <view>开户行：{{item.bank}}</view>
                            <view>户名：{{item.name}}</view>
                        </view>
                        <view class="row">
                            <view>银行卡号：<text selectable="true">{{item.bankcard}}</text></view>
                        </view> 
                    </view>
                </view>
                <view class="settle_box" v-if="status == 0">
                    <uni-section type="line">
                        <uni-notice-bar text="请给以上用户转账,完成后点[完成结算]" />
                    </uni-section>
                    <view class="row1" style="padding: 20rpx;">
                        <label>
                            <switch type="checkbox" @change="on_check" />确认已全部转账完成
                        </label>
                        <button type="primary" size="mini" @click="on_settle" :disabled="!confirm">完成结算</button>
                    </view>
                </view>
            </template>
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
                order_id: '',
                status: 0,
                confirm: false,
                items: [
                    // {
                    //     age_id: 1,
                    //     age_name: '张三',
                    //     amount: 100,
                    //     name: '张三',
                    //     bank: '工行',
                    //     bankcard: '23040320200303'
                    // },
                    // {
                    //     age_id: 2,
                    //     age_name: '李四',
                    //     amount: 200,
                    //     name: '张四',
                    //     bank: '工行',
                    //     bankcard: '23040320200303'
                    // },
                ]
            }
        },
        onLoad(query) {
            this.loading = true
            this.order_id = query.order_id
            
            getApp().api_call({
                url: config.qrySettleRecordUrl,
                method: 'GET',
                data: {
                    order_id: this.order_id
                },
                loading: '加载中',
                success: (res) => {
                    this.status = res.status
                    this.items = res.items
                },
                complete: () => {
                    this.loading = false;
                }
            });
        },
        methods: {
            on_check(e) {
               this.confirm = e.detail.value
            },
            on_settle() {
                getApp().api_call({
                    url: config.settleOrderUrl,
                    method: 'POST',
                    data: {
                        order_id: this.order_id
                    },
                    loading: '提交中',
                    success: (res) => {
                        uni.showToast({
                            icon: 'none',
                            title: '结算完成！',
                            duration: 2000
                        });
                        setTimeout(()=>{
                            uni.navigateBack()
                        }, 2000)
                    }
                });
            }
        }
    }
</script>

<style>
    .container {
        padding: 20rpx;
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

	.price1 {
		font-size: 1rem;
		font-weight: bold;
		color: #FFB400;
	}
    
    .settle_box {
        margin-top: 20rpx;
        background-color: white;
    }
</style>
