<template>
  <view class="container">
    <view class="title">星云小卫App隐私保护指引</view>
    <view class="content">
      <view class="section">
        <view class="section-content">
          本指引是星云小卫App开发者 "深圳市星云智慧物联科技有限公司"（以下简称"开发者"）为处理你的个人信息而制定。
        </view>
      </view>

      <view class="section">
        <view class="section-title">开发者处理的信息</view>
        <view class="section-content">
          根据法律规定，开发者仅处理实现App功能所必要的信息。

          <view>• 为了登录，开发者将在获取你的明示同意后，收集你的手机号。</view>
          <view>• 为了运维服务，开发者将在获取你的明示同意后，访问你的摄像头。</view>
          <view>• 为了运维服务，开发者将在获取你的明示同意后，访问你的麦克风。</view>
          <view>• 为了保存现场照片和记录工作场景，开发者将在获取你的明示同意后，使用你的相册（仅写入）权限。相册权限仅用于保存维修记录、设备状态等工作相关的图片。</view>
          <view>• 为了考勤打卡，开发者将在获取你的明示同意后，收集你的位置信息。</view>
          <view>• 开发者读取你的剪切板，用于复制验证码。</view>
          <view>• 开发者访问你的蓝牙，用于开门。</view>
          <view>• 开发者收集你选中的照片或视频信息，用于运维服务。</view>
          <view>• 为了身份验证和提供安全的门禁服务，开发者将在获取你的明示同意后，收集你的人脸数据。人脸数据仅用于门禁系统的身份验证，不会用于其他目的。人脸数据将被加密存储在我们的安全服务器中，保存期限为用户账号注销后30天内，期满后将自动删除。我们不会将人脸数据分享给任何第三方。</view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">你的权益</view>
        <view class="section-content">
          关于访问你的摄像头、访问你的麦克风、使用你的相册（仅写入）权限、收集你的位置信息，你可以通过以下路径：设备的"设置" - "星云小卫" - "权限"中进行管理和撤回授权。

          关于收集你的手机号、读取你的剪切板、收集你选中的照片或视频信息，你可以通过以下路径：App内的"设置" - "隐私管理" - 点击特定信息 - 点击"申请删除"，开发者承诺收到申请后将删除信息。法律法规另有规定的，开发者承诺将停止除存储和采取必要的安全保护措施之外的处理。

          关于你的个人信息，你可以通过以下方式与开发者联系，行使查阅、复制、更正、删除等法定权利。

          若你在App中注册了账号，你可以通过以下方式注销账号：
          1. 在App"我的"页面中点击"账号与安全"
          2. 选择"注销账号"
          3. 按照提示确认注销操作
          4. 注销后，你的账号信息（包括人脸数据）将在30天内完全删除

          你也可以通过以下方式与开发者联系，申请注销你在App中使用的账号。在受理你的申请后，开发者承诺在十五个工作日内完成核查和处理，并按照法律法规要求处理你的相关信息。

          邮箱: xyzhwl_008@163.com
        </view>
      </view>

      <view class="section">
        <view class="section-title">开发者对信息的存储</view>
        <view class="section-content">
          开发者承诺，除法律法规另有规定外，开发者对你的信息的保存期限应当为实现处理目的所必要的最短时间。
        </view>
      </view>

      <view class="section">
        <view class="section-title">信息的使用规则</view>
        <view class="section-content">
          开发者将会在本指引所明示的用途内使用收集的信息。

          如开发者使用你的信息超出本指引目的或合理范围，开发者必须在变更使用目的或范围前，再次以email方式告知并征得你的明示同意。
        </view>
      </view>

      <view class="section">
        <view class="section-title">信息对外提供</view>
        <view class="section-content">
          开发者承诺，不会主动共享或转让你的信息至任何第三方，如存在确需共享或转让时，开发者应当直接征得或确认第三方征得你的单独同意。

          开发者承诺，不会对外公开披露你的信息，如必须公开披露时，开发者应当向你告知公开披露的目的、披露信息的类型及可能涉及的信息，并征得你的单独同意。

          你认为开发者未遵守上述约定，或有其他的投诉建议、或未成年人个人信息保护相关问题，可通过以下方式与开发者联系。
          邮箱: xyzhwl_008@163.com
        </view>
      </view>

      <view class="section">
        <view class="section-content">
          <view>更新日期：2024-02-16</view>
          <view>生效日期：2024-02-16</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { onLoad } from "@dcloudio/uni-app"

onLoad(() => {
  uni.setNavigationBarTitle({
    title: '隐私政策'
  })
})
</script>

<style lang="scss">
.container {
  padding: 30rpx;
  background-color: #fff;
  min-height: 100vh;
  
  .title {
    font-size: 36rpx;
    font-weight: bold;
    text-align: center;
    margin-bottom: 40rpx;
    color: #333;
  }
  
  .content {
    .section {
      margin-bottom: 40rpx;
      
      .section-title {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 20rpx;
      }
      
      .section-content {
        font-size: 28rpx;
        color: #666;
        line-height: 1.8;
        text-align: justify;
        
        view {
          margin-bottom: 20rpx;
        }
      }
    }
  }
}
</style> 