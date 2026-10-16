<template>
    <view>
        <view class="head">
            <button type="primary" size="mini" @click="on_add">新增</button>
        </view>
		<view v-if="loading" style="text-align: center;">加载中...</view>
		<view v-else>
			<view class="list" v-if="agencys.length">
				<view class="item" v-for="item in agencys" :key="item.age_id" 
                    :data-age_id="item.age_id" @click="on_item">
					<view class="row1">
						<view class="title">{{item.age_name}}({{item.type_label}})</view>
                        <view v-if="item.status == 1" style="color: green;">{{item.status_label}}</view>
                        <view v-else style="color: red;">{{item.status_label}}</view>
					</view>
					<view class="row1">
						<view>{{item.remark}}</view>
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
    import uniPopupDialog from '@/components/uni-popup/uni-popup-dialog.vue'
    
    export default {
		components: {
			uniPopupDialog
		},
        data() {
            return {
                loading: true,
				cur_page: 1,
				page_count: 1,
                agencys: []
            }
        },
		onShow(){
			this.check_login({
                backtype: 'switch',
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
            load_data(_obj) {
				let obj = _obj || {};
				let page = obj.page || 1;
				let next_page = obj.next_page || false;
				getApp().api_call({
					url: config.qryAgencyUrl,
					method: 'GET',
					data: {
						account_id: this.account_id,
						start_date: this.start_date,
						end_date: this.end_date,
						page: page
					},
					loading: '加载中',
					success: (res) => {
						this.cur_page = res.page;
						this.page_count = res.pages;
						if (next_page) {
							this.agencys = this.agencys.concat(res.items);
						} else {
							this.agencys = res.items;
						}
					},
					complete: () => {
						this.loading = false;
						typeof obj.complete == 'function' && obj.complete();
					}
				});
            },
            on_add(e) {
                uni.navigateTo({url: '/pages/users/edit'});
            },
            on_item(e) {
                let age_id = e.currentTarget.dataset.age_id
                uni.navigateTo({url: `/pages/users/edit?age_id=${age_id}`});
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
    
	.item {
		padding: 20rpx;
		background-color: #FFFFFF;
		border-bottom: 1rpx solid #F2F2F2;
        box-sizing: border-box;
	}
	
	.title {
		font-size: 1rem;
		font-weight: bold;
	}
</style>
