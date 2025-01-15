/**
 * 布局相关的工具函数
 */

/**
 * 获取页面可用高度
 * @param {Object} options 配置项
 * @param {Boolean} options.hasNav 是否包含导航栏，默认true
 * @param {Boolean} options.hasTabBar 是否包含底部标签栏，默认false
 * @returns {String} 返回可用高度，如'800px'
 */
export const getPageHeight = (options = {}) => {
  const { hasNav = true, hasTabBar = false } = options
  const sys = uni.getSystemInfoSync()
  
  // #ifdef MP-WEIXIN
  return '100%'  // 微信小程序使用百分比高度
  // #endif
  
  let height = sys.windowHeight
  
  // #ifdef H5
  return height + 'px'
  // #endif
  
  // #ifdef APP-PLUS || MP
  // 减去状态栏高度
  height -= sys.statusBarHeight
  
  // 减去导航栏高度（如果有）
  if (hasNav) {
    height -= 44 // 导航栏固定高度
  }
  
  // 减去底部标签栏高度（如果有）
  if (hasTabBar) {
    height -= 50 // tabBar固定高度
  }
  
  return height + 'px'
  // #endif
}

/**
 * 获取状态栏高度
 * @returns {Number} 状态栏高度（px）
 */
export const getStatusBarHeight = () => {
  const sys = uni.getSystemInfoSync()
  return sys.statusBarHeight || 0
}

/**
 * 获取导航栏高度
 * @returns {Number} 导航栏高度（px）
 */
export const getNavBarHeight = () => {
  return 44 // 导航栏固定高度
}

/**
 * 获取底部安全区域高度
 * @returns {Number} 安全区域高度（px）
 */
export const getSafeAreaBottom = () => {
  const sys = uni.getSystemInfoSync()
  return sys.safeAreaInsets?.bottom || 0
} 

/**
 * 计算ScrollView可用高度
 * @returns {Promise<number>} 返回可用高度（单位rpx）
 */
export const calculateScrollViewHeight = () => {
  return new Promise((resolve) => {
    const sys = uni.getSystemInfoSync()
    const query = uni.createSelectorQuery()
    const windowHeight = sys.windowHeight
    
    // #ifdef MP-WEIXIN || APP-PLUS
    const statusBarHeight = sys.statusBarHeight || 0
    const navBarHeight = 44 // 导航栏高度
    
    // 获取表单和广告区域高度
    query.select('.form-section').boundingClientRect()
    query.select('.ad-section').boundingClientRect()
    
    query.exec((res) => {
      const [formRect, adRect] = res
      if (formRect && adRect) {
        // 计算列表可用高度 = 窗口高度 - 状态栏 - 导航栏 - 表单高度 - 广告高度
        const availableHeight = windowHeight - statusBarHeight - navBarHeight - formRect.height - adRect.height
        // 转换为rpx
        const rpxHeight = (availableHeight * (750 / sys.windowWidth))
        resolve(rpxHeight)
      } else {
        resolve(750) // 默认高度
      }
    })
    // #endif
    
    // #ifdef H5
    // H5端不需要计算高度，使用flex布局
    resolve(0)
    // #endif
  })
}


// 布局样式
// .container {
//     min-height: v-bind(windowHeight);
//     height: v-bind(windowHeight);
//     display: flex;
//     flex-direction: column;
//     background: #F5F5F5;
//     box-sizing: border-box;
//     padding-bottom: env(safe-area-inset-bottom);
//   }
// .form-section {
//     flex: none;  /* 不伸缩，保持自身大小 */
//   }
  
//   .list-section {
//     flex: 1;     /* 占据剩余空间 */
//   }
  
//   .ad-section {
//     flex: none;  /* 不伸缩，保持自身大小 */
//     height: 150rpx;
//   }

