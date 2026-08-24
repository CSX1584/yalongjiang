#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="雅砻江运维智能体系统"
APP_BUNDLE="$PROJECT_DIR/release/$APP_NAME.app"
PACKAGE_NAME="$APP_NAME-macOS-通用版"
PACKAGE_DIR="$PROJECT_DIR/release/$PACKAGE_NAME"
ZIP_PATH="$PROJECT_DIR/release/$PACKAGE_NAME.zip"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/yalong-ops-macos.XXXXXX")"
export CLANG_MODULE_CACHE_PATH="$TEMP_DIR/clang-module-cache"
export SWIFT_MODULECACHE_PATH="$TEMP_DIR/swift-module-cache"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少构建工具: $1" >&2
    exit 1
  fi
}

require_command npm
require_command xcrun
require_command lipo
require_command ditto
require_command codesign
require_command shasum

cd "$PROJECT_DIR"

echo "[1/6] 构建 Web 生产版..."
npm run build
find "$PROJECT_DIR/dist" -name '.DS_Store' -type f -delete

echo "[2/6] 编译 Intel + Apple Silicon 通用启动器..."
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
CLANG="$(xcrun --find clang)"
for ARCH in x86_64 arm64; do
  "$CLANG" \
    -fobjc-arc \
    -fmodules \
    -arch "$ARCH" \
    -mmacosx-version-min=11.0 \
    -isysroot "$SDK_PATH" \
    -framework Cocoa \
    -framework WebKit \
    "$PROJECT_DIR/macos/Launcher.m" \
    -o "$TEMP_DIR/launcher-$ARCH"
done
lipo -create "$TEMP_DIR/launcher-x86_64" "$TEMP_DIR/launcher-arm64" -output "$TEMP_DIR/launcher"

echo "[3/6] 生成应用图标..."
ICON_DIR="$TEMP_DIR/icons"
mkdir -p "$ICON_DIR"
xcrun swift "$PROJECT_DIR/macos/AppIcon.swift" "$TEMP_DIR/icon-1024.png"
for SIZE in 16 32 64 128 256 512 1024; do
  sips -z "$SIZE" "$SIZE" "$TEMP_DIR/icon-1024.png" --out "$ICON_DIR/$SIZE.png" >/dev/null
done
xcrun swift "$PROJECT_DIR/macos/CreateICNS.swift" "$ICON_DIR" "$TEMP_DIR/AppIcon.icns"

echo "[4/6] 组装 .app..."
rm -rf "$APP_BUNDLE" "$PACKAGE_DIR" "$ZIP_PATH" "$ZIP_PATH.sha256"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources/web"
install -m 755 "$TEMP_DIR/launcher" "$APP_BUNDLE/Contents/MacOS/YalongOPS"
install -m 644 "$TEMP_DIR/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
ditto "$PROJECT_DIR/dist" "$APP_BUNDLE/Contents/Resources/web"

cat > "$APP_BUNDLE/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>雅砻江运维智能体系统</string>
  <key>CFBundleExecutable</key>
  <string>YalongOPS</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>cn.ylhdc.ops.demo</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>雅砻江运维智能体系统</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_BUNDLE"

echo "[5/6] 生成分发说明和 ZIP..."
mkdir -p "$PACKAGE_DIR"
ditto "$APP_BUNDLE" "$PACKAGE_DIR/$APP_NAME.app"
cat > "$PACKAGE_DIR/使用说明.txt" <<'README'
雅砻江运维智能体系统 - macOS 版

系统要求：
- macOS 11 Big Sur 或更高版本
- 同时支持 Intel 和 Apple 芯片 Mac
- 大部分界面可离线使用；三维地图底图需要联网加载

启动方法：
1. 先完整解压 ZIP 压缩包。
2. 双击“雅砻江运维智能体系统.app”。
3. 无需安装 Node.js，也无需执行命令。

首次打开提示“无法验证开发者”时：
1. 在 Finder 中按住 Control 键并点击 App，选择“打开”。
2. 在弹窗中再次选择“打开”。

该 App 是本地演示包，不会安装后台服务。关闭窗口即退出应用。
README

ditto -c -k --norsrc --noextattr --noqtn --keepParent "$PACKAGE_DIR" "$ZIP_PATH"
(
  export LC_ALL=C
  cd "$PROJECT_DIR/release"
  shasum -a 256 "$PACKAGE_NAME.zip" > "$PACKAGE_NAME.zip.sha256"
)

echo "[6/6] 验证分发包..."
codesign --verify --deep --strict "$APP_BUNDLE"
plutil -lint "$APP_BUNDLE/Contents/Info.plist"
lipo -archs "$APP_BUNDLE/Contents/MacOS/YalongOPS"
unzip -tq "$ZIP_PATH"
mkdir -p "$TEMP_DIR/verify"
ditto -x -k "$ZIP_PATH" "$TEMP_DIR/verify"
codesign --verify --deep --strict "$TEMP_DIR/verify/$PACKAGE_NAME/$APP_NAME.app"

echo
echo "构建完成："
echo "  $ZIP_PATH"
echo "  $ZIP_PATH.sha256"
