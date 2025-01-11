<template>
  <view class="page-container">
    <!-- 顶部用户信息 - 固定高度 -->
    <view class="user-header">
      <view class="avatar">
        <up-icon name="account" size="24"></up-icon>
      </view>
      <text>张三</text>
    </view>

    <!-- 内容区域 - 自适应高度 -->
    <view class="content-wrapper">
      <!-- 公告横幅 -->
      <view class="notice-banner">
        <up-image
          src="/static/img/img_ad.png"
          width="100%"
          height="100%"
          shape="aspectFill"></up-image>
      </view>

      <!-- 功能按钮网格 -->
      <view class="grid-wrapper">
        <up-grid :border="false" :col="3">
          <up-grid-item
            v-for="(item, index) in menuList"
            :key="index"
            @click="handleGridItemClick(item)">
            <view class="grid-item">
              <image
                :src="item.icon"
                mode="aspectFit"
                class="grid-icon"></image>
              <text class="grid-text">{{ item.name }}</text>
            </view>
          </up-grid-item>
        </up-grid>
      </view>

      <!-- 底部按钮 -->
      <view class="bottom-btns">
        <view class="custom-btn">
          <image
            src="/static/icons/icon_opendoor_code.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">扫码开门</text>
        </view>
        <view class="custom-btn">
          <image
            src="/static/icons/icon_opendoor_one.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">远程开门</text>
        </view>
      </view>
    </view>

    <!-- 底部广告区域 - 固定高度 -->
    <view class="ad-section">
      <up-image
        src="/static/img/img_ad.png"
        width="100%"
        height="160rpx"
        shape="round"></up-image>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      menuList: [
        {
          name: "用户登录",
          icon: "/static/icons/icon_user_login.png",
          url: "/user_package/pages/login/index",
        },
        { name: "房屋申请", icon: "/static/icons/icon_hous_application.png" },
        { name: "访客密码", icon: "/static/icons/icon_guest_password.png" },
        {
          name: "开门二维码",
          icon: "/static/icons/icon_opendoor_password.png",
        },
        { name: "我的", icon: "/static/icons/icon_my.png" },
        { name: "使用帮助", icon: "/static/icons/icon_help.png" },
      ],
    };
  },
  methods: {
    handleGridItemClick(item) {
      if (item.url) {
        uni.navigateTo({
          url: item.url,
        });
      }
    },
  },
};
</script>

<style lang="scss">
.page-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 10rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.user-header {
  height: 6vh;
  min-height: 70rpx;
  flex: none;
  display: flex;
  align-items: center;
  padding: 10rpx;

  .avatar {
    width: 5vh;
    height: 5vh;
    min-width: 50rpx;
    min-height: 50rpx;
    border-radius: 50%;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 15rpx;
  }

  text {
    font-size: calc(12px + 0.5vh);
  }
}

.content-wrapper {
  height: calc(94vh - 200rpx - 20rpx);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: center;
  gap: 20rpx;
}

.notice-banner {
  height: 20%;
  min-height: 90rpx;
  border-radius: 8rpx;
  overflow: hidden;
  margin: 0;
}

.grid-wrapper {
  height: 45%;
  overflow: hidden;
  margin: 0;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    .grid-icon {
      width: 150rpx;
      height: 150rpx;
    }

    .grid-text {
      font-size: 24rpx;
      margin-top: 10rpx;
    }
  }
}

.bottom-btns {
  height: 30%;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20rpx;

  .custom-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .btn-icon {
      width: 200rpx;
      height: 200rpx;
      margin-bottom: 10rpx;
    }

    .btn-text {
      font-size: 24rpx;
      color: #333;
    }
  }
}

.ad-section {
  height: 200rpx;
  flex: none;
  margin-top: auto;
  padding: 0 10rpx;

  :deep(.up-image) {
    border-radius: 8rpx;
    overflow: hidden;
  }
}
</style>
