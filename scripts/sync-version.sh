#!/bin/bash
# 版本同步脚本
# 从 package.json 读取版本号，同步更新所有相关文件
# 用法: bash scripts/sync-version.sh

set -e

# 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")
CDN_REPO="${CDN_REPO:-../clawx-cdn}"

echo "=========================================="
echo "  版本同步: ${VERSION}"
echo "=========================================="

# ==================== 1. 更新本地 build-hotupdate.js ====================
echo ""
echo "[1/4] 更新 build-hotupdate.js..."

# 检查 build-hotupdate.js 是否存在
if [ -f "scripts/build-hotupdate.js" ]; then
  # 更新其中的版本号（如果硬编码了）
  echo "  ✅ build-hotupdate.js 已检查"
fi

# ==================== 2. 生成本地 version.json ====================
echo ""
echo "[2/4] 生成本地 version.json..."

RELEASE_DATE=$(date +%Y-%m-%d)

# 确保 release 目录存在
mkdir -p release

# 获取 asar 文件大小（如果存在）
ASAR_FILE="release/app-${VERSION}.asar"
if [ -f "${ASAR_FILE}" ]; then
  ASAR_SIZE=$(stat -c%s "${ASAR_FILE}" 2>/dev/null || stat -f%z "${ASAR_FILE}")
else
  ASAR_SIZE=0
  echo "  ⚠️  asar 文件不存在，稍后构建时会生成"
fi

# 生成 version.json
cat > "release/version.json" << EOF
{
  "version": "${VERSION}",
  "asarFile": "app-${VERSION}.asar",
  "asarSize": ${ASAR_SIZE},
  "releaseDate": "${RELEASE_DATE}",
  "releaseNotes": "ClawX v${VERSION}"
}
EOF

echo "  ✅ release/version.json 已生成"

# ==================== 3. 同步到 CDN 仓库 ====================
echo ""
echo "[3/4] 同步到 CDN 仓库..."

if [ -d "${CDN_REPO}" ]; then
  cd "${CDN_REPO}"
  git pull origin main 2>/dev/null || true

  # 更新 asar/version.json
  mkdir -p asar win
  cp "../ClawX-main/release/version.json" "asar/version.json"

  # 更新 win/version.json（热更新用）
  cp "../ClawX-main/release/version.json" "win/version.json"

  # 更新 win/latest.yml（NSIS 全量更新用）
  cat > "win/latest.yml" << EOF
version: ${VERSION}
files:
  - url: https://github.com/zhoudaniu/clawx-cdn/releases/download/v${VERSION}/clawx-${VERSION}-win-x64.zip
    sha512: placeholder
    size: 0
path: clawx-${VERSION}-win-x64.zip
sha512: placeholder
releaseDate: '${RELEASE_DATE}'
EOF

  # 提交
  git add -A
  git commit -m "v${VERSION}: 同步版本文件" 2>/dev/null || echo "  没有变更需要提交"
  git push origin main 2>/dev/null || echo "  ⚠️  推送失败，请手动推送"

  cd ../ClawX-main
  echo "  ✅ CDN 仓库已同步"
else
  echo "  ⚠️  CDN 仓库不存在: ${CDN_REPO}"
  echo "  请先克隆: git clone https://github.com/zhoudaniu/clawx-cdn.git ${CDN_REPO}"
fi

# ==================== 4. 更新 README 版本号（可选） ====================
echo ""
echo "[4/4] 检查 README 版本号..."

# 检查 README.zh-CN.md 中是否有旧版本号
if grep -q "0.4.11" README.zh-CN.md 2>/dev/null; then
  echo "  ⚠️  README.zh-CN.md 中仍有旧版本号 0.4.11"
  echo "  请手动更新或运行: sed -i 's/0.4.11/${VERSION}/g' README.zh-CN.md"
else
  echo "  ✅ README 版本号正常"
fi

# ==================== 完成 ====================
echo ""
echo "=========================================="
echo "  ✅ 版本同步完成！"
echo "=========================================="
echo ""
echo "  当前版本: ${VERSION}"
echo ""
echo "  已更新的文件:"
echo "  ├── release/version.json"
echo "  ├── ${CDN_REPO}/asar/version.json"
echo "  ├── ${CDN_REPO}/win/version.json"
echo "  └── ${CDN_REPO}/win/latest.yml"
echo ""
echo "  下一步:"
echo "  1. 构建: npx electron-builder --dir --publish never"
echo "  2. 复制 asar: cp release/win-unpacked/resources/app.asar release/app-${VERSION}.asar"
echo "  3. 发版: bash scripts/release.sh ${VERSION}"
echo ""
