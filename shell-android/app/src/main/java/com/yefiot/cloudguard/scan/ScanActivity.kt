package com.yefiot.cloudguard.scan

import com.journeyapps.barcodescanner.CaptureActivity

/**
 * 扫码页（基于 ZXing embedded）。
 *
 * 直接继承 CaptureActivity 即可获得取景框、自动对焦与结果回传；
 * 启动时通过 ScanOptions / Intent extras 指定「仅二维码」与提示文案，
 * 结果由 ScanContract 统一解析。
 */
class ScanActivity : CaptureActivity()
