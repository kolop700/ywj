package com.yefiot.cloudguard

import android.app.Application

/**
 * 壳 Application。
 * 广告 SDK 的实际初始化由 JS 在用户同意隐私政策后调用 ad.init 触发（见 TakuAdManager）。
 */
class ShellApp : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
