import App from './App'
import uviewPlus from '@/uni_modules/uview-plus'
import api from './api/index.js'
import store from '@/store';
import mixin from '@/utils/mixin.js';
import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  // 配置全局api
  app.config.globalProperties.$api = api
  app.use(uviewPlus)
  const pinia = createPinia();
  pinia.use(
    createPersistedState({
      storage: {
        getItem(key) {
          return uni.getStorageSync(key);
        },
        setItem(key, value) {
          uni.setStorageSync(key, value);
        },
        removeItem(key) {
          uni.removeStorageSync(key);
        }
      },
      auto: true, // 启用所有Store默认持久化
    })
  );
  app.use(pinia);
  app.config.globalProperties.$store = store;
  app.mixin(mixin);
  return {
    app
  }
}
// #endif

