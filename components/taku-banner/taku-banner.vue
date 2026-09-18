<template>
  <view class="taku-banner" ref="bannerRef"></view>
</template>

<script>
// 模块级共享状态（本文件所有组件实例共享）：
// 共享同一原生横幅实例后，页面切换时「旧页面迟到的 doHide」可能误藏新页面刚展示的横幅。
// 约定：谁最后发起展示谁持有 owner 令牌，只有持有者可执行 hide。
const bannerVisState = { owner: null }

export default { name: 'TakuBanner' }
</script>

<script setup>
/**
 * taku-banner 横幅广告组件（跨端：H5 壳 / uni-app App 通用）
 *
 * 渲染原理：横幅由原生侧以「悬浮视图」（ATBannerView）渲染，本组件负责：
 *   1) 测量组件自身在视口中的位置（CSS px）并上报原生（ad.banner.show / showBannerAd）；
 *   2) 可见性管理：滚出视口/页面被覆盖隐藏；滚动中隐藏、停止后按新位置重新展示（避免悬浮层错位）；
 *   3) 组件卸载时隐藏（原生保留实例便于复用）；
 *   4) 与预加载协同：同一广告位在所有页面共用原生实例（bannerPositionKey），
 *      登录后预加载完成的横幅可被任意页面进页即复用展示（见 store/modules/ad.js preloadBanner）。
 *
 * 原生实现对应：
 *   - H5 壳（shell-android）：桥接方法 ad.banner.show / ad.banner.hide
 *   - uni-app App：插件模块 TakuAdBridge.showBannerAd / hideBannerAd
 * 位置换算：原生侧 = rect(CSS px) × dpr（devicePixelRatio / pixelRatio）。
 *
 * App 端页面显示/滚动经 utils/mixin.js 全局广播校准（taku:pageShow / taku:pageScroll）。
 */
import { onMounted, onBeforeUnmount, nextTick, watch, ref, getCurrentInstance } from 'vue'
import TakuAds, { bannerPositionKey } from '@/common/taku-sdk'

const props = defineProps({
  placementId: { type: String, default: '' }
})

const instance = getCurrentInstance()
const bannerRef = ref(null)

let observer = null        // 可见性观察器（H5）
let firstTimer = null      // 首次展示延迟
let retryTimer = null      // SDK 未就绪重试
let scrollTimer = null     // 滚动停止检测
let retryCount = 0
let inViewport = false
let isScrolling = false
let isShown = false
let isDestroyed = false
let routeSnapshot = ''     // 挂载时所处页面路由（缓存页面中 getCurrentPages 会变化，必须快照）
let shownKey = ''          // 当前已上报展示的位置标识（hide 时精确匹配）
let needsScrollHide = true // 滚动时是否隐藏重展（常驻定位的横幅位置不随滚动变化，无需隐藏）
const myOwner = {}         // 本组件实例的展示令牌（与模块级 bannerVisState.owner 比较判定归属）

/** 当前页面栈顶路由 */
const getCurrentRoute = () => {
  try {
    const pages = getCurrentPages()
    if (pages && pages.length) return pages[pages.length - 1].route || ''
  } catch (e) { /* ignore */ }
  return ''
}

/** 位置标识：全局共享（同一广告位的原生实例跨页面复用，保证预加载成果可被复用） */
const getPositionKey = () => {
  return bannerPositionKey(props.placementId)
}

/** 本组件是否处于当前展示页面（页面栈缓存页面的组件不展示，防止悬浮层串页） */
const isCurrentPage = () => {
  const cur = getCurrentRoute()
  return !cur || !routeSnapshot || cur === routeSnapshot
}

/** 测量组件相对视口的矩形（CSS px） */
const queryRect = () => {
  return new Promise((resolve) => {
    // #ifdef H5
    const el = bannerRef.value && (bannerRef.value.$el || bannerRef.value)
    if (el && typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect()
      resolve({ left: r.left, top: r.top, width: r.width, height: r.height })
      return
    }
    // #endif
    const query = uni.createSelectorQuery().in(instance && instance.proxy)
    query.select('.taku-banner').boundingClientRect((rect) => resolve(rect || null)).exec()
  })
}

/** SDK 未就绪时延迟重试（最多 5 次，每次间隔 2s） */
const scheduleRetry = () => {
  if (isDestroyed || retryCount >= 5) return
  retryCount++
  clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    if (inViewport) doShow()
  }, 2000)
}

/** 上报原生展示横幅（位置 = 当前测量值） */
const doShow = async () => {
  if (isDestroyed || isShown || !props.placementId) return
  if (!isCurrentPage()) return
  if (!TakuAds.isReady || !TakuAds.isReady()) {
    scheduleRetry()
    return
  }
  const rect = await queryRect()
  if (isDestroyed || !rect || !rect.width) return
  const dpr = uni.getSystemInfoSync().pixelRatio || 1
  shownKey = getPositionKey()
  bannerVisState.owner = myOwner // 先声明接管：页面切换时旧页面迟到的 hide 不会误伤本次展示
  TakuAds.showBannerAd(
    {
      placementId: props.placementId,
      positionKey: shownKey,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      dpr
    },
    {
      onAdLoaded() { console.log('[taku-banner] loaded:', props.placementId) },
      onAdFailed(res) { console.warn('[taku-banner] failed:', res && res.msg) }
    }
  )
  isShown = true
}

/** 隐藏横幅（原生保留实例，便于复用） */
const doHide = () => {
  if (!isShown) return
  isShown = false
  // 已被其他页面组件接管展示（页面切换竞争）：跳过 hide，避免误藏对方的横幅
  if (bannerVisState.owner !== myOwner) return
  bannerVisState.owner = null
  TakuAds.hideBannerAd(shownKey)
}

/** 检测横幅是否常驻定位（fixed 或页面级非滚动元素）：此类横幅位置不随滚动变化，滚动无需隐藏重展 */
// #ifdef H5
const detectNeedsScrollHide = () => {
  try {
    let node = bannerRef.value && (bannerRef.value.$el || bannerRef.value)
    while (node && node.nodeType === 1 && node !== document.body) {
      const cs = window.getComputedStyle(node)
      if (cs.position === 'fixed') return false
      const ov = cs.overflowY || cs.overflow || ''
      if (ov === 'auto' || ov === 'scroll' || ov === 'overlay') return true
      node = node.parentElement
    }
    // 无滚动容器祖先：仅当文档本身可滚动时才会随滚动移动
    return document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
  } catch (e) {
    return true
  }
}
// #endif

/** 滚动中隐藏，停止 250ms 后按新位置重新展示（H5 window 滚动 / App 页面滚动广播共用） */
const onScrollTick = () => {
  if (isDestroyed) return
  if (!needsScrollHide) return // 常驻定位横幅：滚动不影响位置，保持展示
  if (!isShown && !isScrolling) return
  if (!isScrolling) {
    isScrolling = true
    doHide()
  }
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    isScrolling = false
    if (inViewport) doShow()
  }, 250)
}

// #ifndef H5
/** App 端页面显示广播：本页为当前页则展示，否则隐藏（页面被覆盖时移除悬浮层） */
const onPageShowApp = () => {
  if (isDestroyed) return
  if (isCurrentPage()) {
    if (!isScrolling) doShow()
  } else {
    doHide()
  }
}
// #endif

// #ifdef H5
/** H5 路由变化：离开本页隐藏横幅（防悬浮层串页），回到本页且可见时恢复展示 */
const onRouteChange = () => {
  if (isDestroyed) return
  setTimeout(() => {
    if (isDestroyed) return
    if (isCurrentPage()) {
      if (inViewport && !isScrolling) doShow()
    } else {
      doHide()
    }
  }, 60)
}
// #endif

// 广告位变化：先隐藏旧横幅，再按新广告位展示
watch(() => props.placementId, () => {
  if (isShown) doHide()
  if (inViewport) doShow()
})

onMounted(() => {
  routeSnapshot = getCurrentRoute()
  nextTick(() => {
    // 等页面布局稳定、SDK 初始化完成后开始（300ms 兜底）
    firstTimer = setTimeout(() => {
      // #ifdef H5
      const el = bannerRef.value && (bannerRef.value.$el || bannerRef.value)
      needsScrollHide = detectNeedsScrollHide()
      if (el && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver((entries) => {
          const entry = entries && entries[0]
          if (!entry) return
          inViewport = !!entry.isIntersecting
          if (inViewport) {
            if (!isScrolling) doShow()
          } else {
            doHide()
          }
        }, { threshold: 0 })
        observer.observe(el)
      } else {
        inViewport = true
        doShow()
      }
      window.addEventListener('scroll', onScrollTick, true)
      window.addEventListener('hashchange', onRouteChange)
      // #endif
      // #ifndef H5
      inViewport = true
      doShow()
      uni.$on('taku:pageShow', onPageShowApp)
      uni.$on('taku:pageScroll', onScrollTick)
      // #endif
    }, 300)
  })
})

onBeforeUnmount(() => {
  isDestroyed = true
  clearTimeout(firstTimer)
  clearTimeout(retryTimer)
  clearTimeout(scrollTimer)
  if (observer) {
    observer.disconnect()
    observer = null
  }
  // #ifdef H5
  window.removeEventListener('scroll', onScrollTick, true)
  window.removeEventListener('hashchange', onRouteChange)
  // #endif
  // #ifndef H5
  uni.$off('taku:pageShow', onPageShowApp)
  uni.$off('taku:pageScroll', onScrollTick)
  // #endif
  doHide()
})
</script>

<style lang="scss" scoped>
.taku-banner {
  width: 100%;
  min-height: 120rpx;
}
</style>
