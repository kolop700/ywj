<template>
    <view>
        <uni-section type="line">
            <uni-notice-bar text="分佣规则: 先按点数分给[下级用户],剩余的才按点数分给[合作伙伴]" />
        </uni-section>
		<view class="uni-padding-wrap uni-common-mt" style="margin-top: 20rpx;">
			<form @submit="form_submit">
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">状态</view>
                        <radio-group name="status" style="margin-left: 55rpx;">
                            <radio value="1" :checked="status == 1"><text style="margin-right: 10px;">已启用</text></radio>
                            <radio value="0" :checked="status == 0"><text style="margin-right: 10px;">已禁用</text></radio>
                        </radio-group>
					</view>
				</view>
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">用户类型</view>
                        <radio-group name="type" style="margin-left: 55rpx;" @change="on_type_change">
                            <radio value="0" :checked="type == 0"><text style="margin-right: 10px;">下级用户</text></radio>
                            <radio value="1" :checked="type == 1"><text style="margin-right: 10px;">合作伙伴</text></radio>
                        </radio-group>
					</view>
				</view>
				<view class="uni-form-item ">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">账户名</view>
						<input class="uni-input" name="age_name" :value="age_name" :disabled="Boolean(age_id)"/>
					</view>
				</view>
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">管理账号密码</view>
						<input class="uni-input" name="age_password" 
                            :placeholder="age_id?'修改管理账号密码':''"/>
					</view>
				</view>
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">运营账号密码</view>
						<input class="uni-input" name="comm_password" 
                            :placeholder="age_id?'修改运营账号密码':''"/>
					</view>
				</view>
				<view class="uni-form-item" v-for="item in ratios" v-if="item.id>0||(type== 0 && is_admin)" :key="item.id">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">{{item.label}}分佣点数</view>
						<input class="uni-input" type="digit" :name="'ratio_' + item.id" 
                            :value="item.ratio" placeholder="取值0至1之间,保留4位小数"/>
					</view>
				</view>
				<view class="uni-form-item">
					<view class="uni-input-wrapper uni-row">
                        <view class="uni-title">备注</view>
						<textarea class="uni-textarea" style="margin-left: 55rpx;" name="remark" :value="remark"/>
					</view>
				</view>
				<view class="uni-form-item uni-column">
					<view class="uni-btn-v">
						<button type="primary" formType="submit">保存</button>
					</view>
				</view>
			</form>
		</view>
    </view>
</template>

<script>
    import config from "common/config.js"
    
    export default {
        data() {
            return {
                age_id: '',
                age_name: '',
                status: 1,
                type: 0,
                ratios: [],
                is_admin: false,
                remark: ''
            }
        },
        onLoad(options) {
            this.age_id = options.age_id 
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
                if (this.age_id) {
                    getApp().api_call({
                        url: config.getAgencyUrl,
                        method: 'GET',
                        data: {
                            age_id: this.age_id
                        },
                        loading: '加载中',
                        success: (res) => {
                            this.age_name = res.age_name
                            this.status = res.status
                            this.type = res.type
                            this.ratios = res.ratios
                            this.remark = res.remark
                        }
                    });
                } else {  // 没有age_id，说明是新增
                    getApp().api_call({
                        url: config.getCommTypesUrl,
                        method: 'GET',
                        data: {},
                        success: (res) => {
                            this.ratios = res
                        }
                    });
                }
            },
            on_type_change(e) {
                this.type = e.detail.value
            },
			form_submit(e){
				let formdata = e.detail.value;
				if (!formdata.age_name){
					uni.showToast({
						icon: 'none',
						title: '请输入账户名'
					})
					return;
				}
				if (!this.age_id && !formdata.age_password){
					uni.showToast({
						icon: 'none',
						title: '请输入管理账号密码'
					})
					return;
				}
				if (!this.age_id && !formdata.comm_password){
					uni.showToast({
						icon: 'none',
						title: '请输入运营账号密码'
					})
					return;
				}
                // 组装ratios参数
                let ratios = {}
                for (const key in formdata) {
                    if (key.startsWith('ratio_')) {
                        let value = formdata[key]
                        let id = key.split('_')[1]
                        if (id && value) {
                            ratios[id] = value
                        }
                    }
                }
                getApp().api_call({
                    url: config.saveAgencyUrl,
                    method: 'POST',
                    data: {
                        age_id: this.age_id,
                        age_name: formdata.age_name,
                        age_password: formdata.age_password,
                        comm_password: formdata.comm_password,
                        type: formdata.type,
                        status: formdata.status,
                        remark: formdata.remark,
                        ratios: ratios
                    },
                    success: (res) => {
                        this.age_id = res.age_id
                        uni.showToast({
                            icon: 'none',
                            title: '保存成功！'
                        })
                    }
                });
            }
        }
    }
</script>

<style>
    .uni-title {
        width: 200rpx;
    }
    
    .uni-textarea {
        height: 150rpx;
    }

</style>
