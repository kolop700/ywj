<template>
  <view class="vip-page">
    <!-- 会员状态卡 -->
    <view class="vip-hero" :class="{ 'is-vip': vipActive }">
      <view class="hero-crown">
        <up-icon name="star-fill" size="46" color="#FFFFFF"></up-icon>
      </view>
      <view class="hero-text">
        <text class="hero-title">{{ vipActive ? 'VIP 会员' : '开通 VIP 会员' }}</text>
        <text class="hero-sub" v-if="vipActive && vipExpire">有效期至 {{ vipExpire }}</text>
        <text class="hero-sub" v-else>全站免广告，畅享纯净体验</text>
      </view>
    </view>

    <!-- 会员权益 -->
    <view class="card">
      <view class="card-title">会员权益</view>
      <view class="benefit" v-for="(b, i) in benefits" :key="i">
        <view class="benefit-icon">
          <up-icon :name="b.icon" size="20" color="#F5A623"></up-icon>
        </view>
        <view class="benefit-text">
          <text class="benefit-name">{{ b.name }}</text>
          <text class="benefit-desc">{{ b.desc }}</text>
        </view>
      </view>
    </view>

    <!-- 选择档位 -->
    <view class="card">
      <view class="card-title">选择档位</view>
      <view class="plans">
        <view
          v-for="p in products"
          :key="p.product_id"
          class="plan"
          :class="{ active: selectedProduct === p.product_id }"
          @tap="selectedProduct = p.product_id"
        >
          <view class="plan-tag" v-if="p.recommend">推荐</view>
          <text class="plan-title">{{ p.title }}</text>
          <!-- iOS（IAP 停用）隐藏价格：苹果 3.1.1 不允许 App 内展示外部购买价格 -->
          <view class="plan-price" v-if="!iosHidePrice">
            <text class="price-symbol">¥</text>
            <text class="price-num">{{ fmtYuan(p.price) }}</text>
          </view>
          <text class="plan-origin" v-if="!iosHidePrice && p.original_price > p.price">¥{{ fmtYuan(p.original_price) }}</text>
        </view>
      </view>
      <view class="plans-empty" v-if="!products.length">档位加载失败，下拉重试或稍后再来</view>
    </view>

    <!-- 支付方式 -->
    <view class="card">
      <view class="card-title">支付方式</view>
      <view
        class="channel"
        v-for="c in channels"
        :key="c.type"
        @tap="selectedChannel = c.type"
      >
        <up-icon :name="c.icon" size="24" :color="c.color"></up-icon>
        <text class="channel-label">{{ c.label }}</text>
        <view class="channel-radio">
          <!-- uview-plus 无 circle 空圆图标，未选中态用 CSS 圆圈，避免直显英文图标名 -->
          <up-icon
            v-if="selectedChannel === c.type"
            name="checkmark-circle-fill"
            size="22"
            color="#4A6CF7"
          ></up-icon>
          <view v-else class="circle-off"></view>
        </view>
      </view>
    </view>

    <!-- 协议勾选 -->
    <view class="agree">
      <view class="agree-check" @tap="agreed = !agreed">
        <up-icon
          v-if="agreed"
          name="checkmark-circle-fill"
          size="22"
          color="#4A6CF7"
        ></up-icon>
        <view v-else class="circle-off"></view>
      </view>
      <text class="agree-text">已阅读并同意</text>
      <text class="agree-link" @tap="openAgreement('user')">《用户服务协议》</text>
      <text class="agree-text">与</text>
      <text class="agree-link" @tap="openAgreement('privacy')">《隐私政策》</text>
    </view>

    <!-- iOS（IAP 停用）开通说明：不出现价格/支付字样，仅引导前往官方小程序 -->
    <view class="mini-tip" v-if="iosHidePrice">
      <text>开通会员权益请前往官方小程序，返回后本页面自动刷新会员状态</text>
    </view>

    <!-- 底部开通按钮 -->
    <view class="footer">
      <button class="buy-btn" :disabled="paying || !products.length" @tap="handlePurchase">
        <text v-if="paying">正在确认支付结果…</text>
        <text v-else>{{ miniPurchase ? '前往小程序开通' : (vipActive ? '续费会员' : '立即开通') }}<text class="buy-price" v-if="currentPlan && !iosHidePrice"> ¥{{ fmtYuan(currentPlan.price) }}</text></text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import vipApi from '@/api/vip/vip'
import { isVip, getVipExpireDate, syncVipStatus } from '@/utils/vipUtils'
import { purchaseVip, getPayPlatform, getPayChannels, ENABLE_IAP } from '@/utils/payUtils'
import { encrypt } from '@/utils/aesUtils'
// #ifdef H5
import { NativeApp } from '@/utils/h5-native-bridge'
// #endif

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()

// ---------- 状态 ----------
const platform = ref('')
const channels = ref([])
const products = ref([])
const selectedProduct = ref('')
const selectedChannel = ref('')
const agreed = ref(false)
const paying = ref(false)

const vipActive = ref(isVip())
const vipExpire = ref(getVipExpireDate())

const currentPlan = computed(
  () => products.value.find((p) => p.product_id === selectedProduct.value) || null
)

// iOS 且 IAP 停用 → 隐藏价格/支付字样，走跳小程序开通
const iosHidePrice = computed(() => platform.value === 'ios' && !ENABLE_IAP)
// 当前选中是否小程序渠道（iOS 默认即小程序；Android 可在支付方式里选）
const miniPurchase = computed(() => selectedChannel.value === 'mini' || iosHidePrice.value)

// 跳 ywjxcx 小程序 appvip 页参数（与 workbench my/index.vue 绑微信入口同源）
const MINI_PROGRAM = {
  appId: 'wx4c80533df6184dda', // 微信开放平台「移动应用」AppId
  userName: 'gh_67863dc191ba', // ywjxcx 小程序原始 ID
  // 【正式】0=正式版；联调时曾改为 2=体验版
  type: 0
}

// ---------- 权益文案 ----------
const benefits = [
  { icon: 'eye-off', name: '全站免广告', desc: '启动开屏、横幅、信息流广告全部关闭' },
  { icon: 'phone', name: '双端同权', desc: 'Android / iOS 同一账号通用' },
  { icon: 'clock', name: '时长顺延', desc: '续费时长自动累加，不浪费' }
]

// ---------- 工具 ----------
/** 分 → 元（整数去尾零） */
const fmtYuan = (cents) => {
  const n = Number(cents || 0) / 100
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** 渠道展示配置（icon/color 仅用于页面渲染） */
const channelMeta = {
  wechat: { icon: 'weixin-fill', color: '#07C160' },
  alipay: { icon: 'rmb-circle-fill', color: '#1677FF' },
  iap: { icon: 'gift-fill', color: '#1B1B1F' },
  mini: { icon: 'weixin-fill', color: '#07C160' }
}

// ---------- 加载 ----------
const loadProducts = async () => {
  try {
    const res = await vipApi.getVipProducts(platform.value || '')
    const list = res && Array.isArray(res.data) ? res.data : []
    products.value = list
    // 默认选中：推荐档 → 第一档
    const rec = list.find((p) => Number(p.recommend) === 1)
    selectedProduct.value = rec ? rec.product_id : (list[0] ? list[0].product_id : '')
  } catch (e) {
    products.value = []
  }
}

const refreshVipState = async () => {
  if (!userStore.userId) return
  await syncVipStatus(userStore.userId)
  vipActive.value = isVip()
  vipExpire.value = getVipExpireDate()
}

onMounted(async () => {
  platform.value = await getPayPlatform()
  channels.value = getPayChannels(platform.value).map((c) => ({
    ...c,
    icon: (channelMeta[c.type] || {}).icon || 'rmb-circle-fill',
    color: (channelMeta[c.type] || {}).color || '#4A6CF7'
  }))
  selectedChannel.value = channels.value[0] ? channels.value[0].type : ''
  await loadProducts()
  refreshVipState()
})

// ---------- 交互 ----------
const openAgreement = (type) => {
  uni.navigateTo({ url: `/user_package/pages/agreement/${type}` })
}

const handlePurchase = async () => {
  if (paying.value) return
  if (!selectedProduct.value) {
    uni.showToast({ title: '请选择开通档位', icon: 'none' })
    return
  }
  if (!selectedChannel.value) {
    uni.showToast({ title: '请选择支付方式', icon: 'none' })
    return
  }
  if (!agreed.value) {
    uni.showToast({ title: '请先勾选并同意协议', icon: 'none' })
    return
  }
  if (!userStore.userId) {
    uni.navigateTo({ url: '/user_package/pages/login/index' })
    return
  }

  // 小程序开通：不建单不拉支付，直接跳 ywjxcx appvip 页（小程序内 createVipMiniOrder 下单）
  if (miniPurchase.value) {
    openMiniProgram()
    return
  }

  paying.value = true
  try {
    const result = await purchaseVip(selectedProduct.value, {
      userId: userStore.userId,
      payType: selectedChannel.value
    })
    vipActive.value = true
    vipExpire.value = result.vipExpireDate || getVipExpireDate()
    uni.showToast({ title: '开通成功', icon: 'success' })
  } catch (e) {
    const msg = (e && (e.message || e.msg)) || '支付未完成'
    uni.showToast({ title: msg, icon: 'none', duration: 2500 })
  } finally {
    paying.value = false
  }
}

/** 拉起小程序 VIP 开通页：uid/pid 用与 voipbind 同款的混淆加密传递 */
const openMiniProgram = () => {
  // #ifdef H5
  const uid = encrypt(String(userStore.userId))
  const pid = encrypt(selectedProduct.value)
  if (!uid || !pid) {
    uni.showToast({ title: '开通参数生成失败，请重试', icon: 'none' })
    return
  }
  const query = `uid=${encodeURIComponent(uid)}&pid=${encodeURIComponent(pid)}&ts=${Date.now()}`
  NativeApp.launchMiniProgram({
    appId: MINI_PROGRAM.appId,
    userName: MINI_PROGRAM.userName,
    path: `userMode/pages/appvip/appvip?${query}`,
    type: MINI_PROGRAM.type
  }).catch((err) => {
    console.warn('[vip] 拉起小程序失败', err)
    uni.showToast({
      title: (err && (err.msg || err.errMsg)) || '打开微信小程序失败，请安装微信后重试',
      icon: 'none',
      duration: 2500
    })
  })
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在云卫家 App 内开通', icon: 'none' })
  // #endif
}

// 从小程序返回 App 时刷新会员状态（开通结果以服务端为准）
onShow(() => {
  refreshVipState()
})
</script>

<style lang="scss" scoped>
page {
  background: #F5F6FC;
}

.vip-page {
  padding: 24rpx 24rpx 236rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

/* ===== 会员状态卡 ===== */
.vip-hero {
  display: flex;
  align-items: center;
  border-radius: 28rpx;
  padding: 44rpx 36rpx;
  background-image: var(--brand-grad);
  background-color: #4A6CF7;
  box-shadow: 0 16rpx 44rpx rgba(74, 108, 247, 0.28);
  transition: background 0.3s;

  &.is-vip {
    background-image: linear-gradient(135deg, #2C2A26 0%, #4A4133 55%, #6B5633 100%);
    box-shadow: 0 16rpx 44rpx rgba(74, 63, 40, 0.32);
  }

  .hero-crown {
    width: 108rpx;
    height: 108rpx;
    flex: none;
    border-radius: 28rpx;
    background: rgba(255, 255, 255, 0.18);
    border: 2rpx solid rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-text {
    margin-left: 28rpx;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .hero-title {
      font-size: 40rpx;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 2rpx;
    }

    .hero-sub {
      margin-top: 12rpx;
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

/* ===== 白卡 ===== */
.card {
  margin-top: 24rpx;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx 28rpx;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.06);

  .card-title {
    font-size: 30rpx;
    font-weight: 700;
    color: #232838;
    margin-bottom: 24rpx;
  }
}

/* ===== 权益 ===== */
.benefit {
  display: flex;
  align-items: center;

  &:not(:last-child) {
    margin-bottom: 26rpx;
  }

  .benefit-icon {
    width: 64rpx;
    height: 64rpx;
    flex: none;
    border-radius: 20rpx;
    background: #FFF6E6;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 22rpx;
  }

  .benefit-text {
    min-width: 0;
    display: flex;
    flex-direction: column;

    .benefit-name {
      font-size: 28rpx;
      font-weight: 600;
      color: #232838;
    }

    .benefit-desc {
      margin-top: 6rpx;
      font-size: 23rpx;
      color: #8A90A2;
    }
  }
}

/* ===== 档位 ===== */
.plans {
  display: flex;
  gap: 18rpx;

  .plan {
    position: relative;
    flex: 1;
    border-radius: 20rpx;
    border: 3rpx solid #EDEFF8;
    background: #FAFBFE;
    padding: 30rpx 8rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: all 0.2s;

    &.active {
      border-color: #4A6CF7;
      background: #F2F5FF;
      box-shadow: 0 8rpx 22rpx rgba(74, 108, 247, 0.16);
    }

    .plan-tag {
      position: absolute;
      top: -3rpx;
      right: -3rpx;
      padding: 4rpx 14rpx;
      border-radius: 0 18rpx 0 18rpx;
      background: linear-gradient(135deg, #FF9F43, #FF7A2F);
      font-size: 20rpx;
      color: #ffffff;
    }

    .plan-title {
      font-size: 25rpx;
      color: #4A5068;
    }

    .plan-price {
      margin-top: 14rpx;
      display: flex;
      align-items: baseline;

      .price-symbol {
        font-size: 24rpx;
        font-weight: 700;
        color: #232838;
      }

      .price-num {
        font-size: 44rpx;
        font-weight: 800;
        color: #232838;
        margin-left: 2rpx;
      }
    }

    .plan-origin {
      margin-top: 8rpx;
      font-size: 22rpx;
      color: #A7ACBD;
      text-decoration: line-through;
    }
  }
}

.plans-empty {
  padding: 30rpx 0;
  text-align: center;
  font-size: 25rpx;
  color: #8A90A2;
}

/* ===== 支付方式 ===== */
.channel {
  display: flex;
  align-items: center;
  padding: 22rpx 4rpx;

  &:not(:last-child) {
    border-bottom: 1px solid #F0F1F8;
  }

  .channel-label {
    flex: 1;
    margin-left: 20rpx;
    font-size: 28rpx;
    color: #232838;
  }
}

/* 未选中态空心圆（替代不存在的 circle 图标；渠道行与协议勾选共用） */
.circle-off {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #C8CCD8;
  box-sizing: border-box;
}

/* ===== 协议 ===== */
.agree {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin: 26rpx 8rpx 0;

  .agree-check {
    margin-right: 10rpx;
    display: flex;
    align-items: center;
  }

  .agree-text {
    font-size: 23rpx;
    color: #8A90A2;
  }

  .agree-link {
    font-size: 23rpx;
    color: #4A6CF7;
  }
}

/* iOS 跳小程序开通提示（无价格/支付字样） */
.mini-tip {
  margin: 24rpx 8rpx 0;
  padding: 22rpx 26rpx;
  border-radius: 20rpx;
  background: #F2F5FF;
  font-size: 24rpx;
  color: #4A5068;
  line-height: 1.6;
}

/* ===== 底部按钮 ===== */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -6rpx 20rpx rgba(31, 48, 152, 0.08);
  z-index: 20;
  box-sizing: border-box;

  .buy-btn {
    width: 100%;
    height: 92rpx;
    line-height: 92rpx;
    border-radius: 46rpx;
    border: none;
    background-image: var(--brand-grad);
    background-color: #4A6CF7;
    color: #ffffff;
    font-size: 31rpx;
    font-weight: 600;

    &::after {
      border: none;
    }

    &[disabled] {
      opacity: 0.6;
      color: #ffffff;
    }

    .buy-price {
      font-size: 31rpx;
      font-weight: 700;
    }
  }
}
</style>
