import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import AutoImport from 'unplugin-auto-import/vite'
const path = require('path');

// https://vitejs.dev/config/
export default defineConfig({
	// H5 产物被原生壳以本地资源加载，必须使用相对路径
	base: './',
	plugins: [
		uni(),
		AutoImport({
			imports: ['vue', 'vue-router']
		})
	],
	server: {
		proxy: {
			'/yefiot': {
				target: 'https://xy.yefiot.com',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path
			}
		}
	}
})