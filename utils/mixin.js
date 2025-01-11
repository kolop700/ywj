// 抽取公用的实例 - 操作成功与失败消息提醒内容等
export default {
    data() {
        return {
            sexList: [
                { name: '男', value: 0 },
                { name: '女', value: 1 },
            ],
        };
    },
    methods: {
        // 操作成功消息提醒内容
        submitOk(msg) {
            uni.showToast({
                title: msg || '操作成功！',
            });
        },
        // 操作失败消息提醒内容
        submitFail(msg) {
            uni.showToast({
                icon: 'none',
                duration: 3000,
                title: msg || '网络异常，请稍后重试！',
            });
        },
        // 加载框
        submitLoading(msg) {
            uni.showLoading({
                title: msg || '加载中',
            });
            setTimeout(function () {
                uni.hideLoading();
            }, 1000);
        },
    },
};

/* <template>
  <view>
    {{ sexList }}
    <button @click="handleSubmit">测试提交</button>
  </view>
</template>

<script setup>
import { getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance();

async function submit() { 
  try {
    await proxy.submitOk('保存成功');
    console.log('提交成功');
  } catch (error) {
    console.error('提交失败:', error);
    proxy.$message?.error?.('提交失败，请重试');
  }
} */

// // 处理提交按钮点击
// const handleSubmit = () => {
//   submit();
// }
// </script>

// <style scoped>
// button {
//   margin: 20px;
//   padding: 10px 20px;
//   background-color: #007AFF;
//   color: #fff;
//   border-radius: 5px;
//   border: none;
// }
// </style>
