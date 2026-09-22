#!/usr/bin/env bash
# ============================================================
# 云卫家 iOS 壳一键构建脚本（Mac / CI 通用）
#
# 用法：
#   bash scripts/build-ios.sh              # 构建 + 导出 ipa（本地验证）
#   bash scripts/build-ios.sh upload       # 构建 + 导出 + 上传 App Store Connect（TestFlight）
#
# 前置（Mac 上）：
#   - macOS 15.6 及以上 + Xcode 26 及以上（含 iOS 26 SDK，App Store 上传硬性要求）
#   - xcodegen：brew install xcodegen
#   - CocoaPods（集成 Taku 聚合 SDK + 莱特摩比 SDK）：brew install cocoapods（或 sudo gem install cocoapods）
#   - H5 产物已同步（仓库根）：npm run build:h5 && npm run sync:h5
#
# upload 模式认证（二选一）：
#   1) Xcode 已登录开发者账号（本地 Mac 常用，无需额外参数）
#   2) App Store Connect API Key（CI / 无图形环境）：
#      ASC_KEY_PATH=AuthKey_XXXX.p8 ASC_KEY_ID=XXXX ASC_ISSUER_ID=YYYY \
#        bash scripts/build-ios.sh upload
# ============================================================
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/shell-ios"

MODE="${1:-export}"

echo "[build-ios] 当前 Xcode："
xcodebuild -version

# 1) 修复 Git for Windows 提交导致的 framework 执行位缺失（可忽略报错）
chmod +x Vendor/WechatOpenSDK/WechatOpenSDK.xcframework/ios-arm64/WechatOpenSDK.framework/WechatOpenSDK 2>/dev/null || true
chmod +x Vendor/WechatOpenSDK/WechatOpenSDK.xcframework/ios-arm64_x86_64-simulator/WechatOpenSDK.framework/WechatOpenSDK 2>/dev/null || true

# 2) 生成 Xcode 工程（每次修改 project.yml 后必须重跑）
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "[build-ios] 未安装 xcodegen，请先执行：brew install xcodegen"
  exit 1
fi
xcodegen generate

# 2.1) CocoaPods：存在 Podfile 时执行 pod install（Taku 聚合主包/酷映 Adx 适配器/莱特摩比 SDK 等）并改用 .xcworkspace 构建
#      注意顺序：xcodegen 会重建 xcodeproj，必须在生成之后再 pod install
BUILD_TARGET_ARGS=(-project CloudGuard.xcodeproj)
if [ -f Podfile ]; then
  if ! command -v pod >/dev/null 2>&1; then
    echo "[build-ios] 检测到 Podfile 但未安装 CocoaPods：brew install cocoapods（或 sudo gem install cocoapods）"
    exit 1
  fi
  pod install
  BUILD_TARGET_ARGS=(-workspace CloudGuard.xcworkspace)
fi

# 3) 可选：App Store Connect API Key 认证参数（CI 用；本地已登录 Xcode 可不设）
AUTH_ARGS=()
if [ -n "${ASC_KEY_PATH:-}" ] && [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then
  AUTH_ARGS=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  echo "[build-ios] 使用 App Store Connect API Key 认证"
fi

# 4) 归档（Release）
rm -rf build/CloudGuard.xcarchive build/ipa
xcodebuild archive \
  ${BUILD_TARGET_ARGS[@]+"${BUILD_TARGET_ARGS[@]}"} \
  -scheme CloudGuard \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/CloudGuard.xcarchive \
  -allowProvisioningUpdates \
  ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}

# 5) 导出 ipa（upload 模式：生成临时 plist 将 destination 改为 upload 直传）
OPTS="ExportOptions.plist"
if [ "$MODE" = "upload" ]; then
  OPTS="build/ExportOptions.upload.plist"
  mkdir -p build
  sed 's|<string>export</string>|<string>upload</string>|' ExportOptions.plist > "$OPTS"
  echo "[build-ios] 上传模式：导出后自动直传 App Store Connect（可在 TestFlight 查看）"
fi

xcodebuild -exportArchive \
  -archivePath build/CloudGuard.xcarchive \
  -exportOptionsPlist "$OPTS" \
  -exportPath build/ipa \
  -allowProvisioningUpdates \
  ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"}

echo "[build-ios] 全部完成。产物目录：shell-ios/build/ipa"
