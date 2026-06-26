#!/bin/bash
# ClawX 一键发版脚本
# 用法: bash scripts/release.sh [版本号]
# 示例: bash scripts/release.sh 0.0.1

set -e

# ==================== 配置 ====================
VERSION=${1:-$(node -p "require('./package.json').version")}
CDN_REPO_DIR="${CDN_REPO_DIR:-../clawx-cdn}"
CDN_REPO_URL="https://github.com/zhoudaniu/clawx-cdn.git"
SOURCE_REPO_URL="https://github.com/zhoudaniu/claw-api.git"
RELEASE_DIR="release"
UNPACKED_DIR="${RELEASE_DIR}/win-unpacked"

echo "=========================================="
echo "  ClawX 发版脚本 v${VERSION}"
echo "=========================================="

# ==================== 步骤 1: 检查版本号 ====================
echo ""
echo "[1/6] 检查版本号..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "  当前 package.json 版本: ${CURRENT_VERSION}"

if [ "$CURRENT_VERSION" != "$VERSION" ]; then
  echo "  ⚠️  版本号不匹配！请先修改 package.json 的 version 为 ${VERSION}"
  echo "  或者运行: npm version ${VERSION} --no-git-tag-version"
  exit 1
fi
echo "  ✅ 版本号确认: ${VERSION}"

# ==================== 步骤 1.5: 同步版本文件 ====================
echo ""
echo "[1.5/6] 同步版本文件到 CDN 仓库..."
bash scripts/sync-version.sh
echo "  ✅ 版本文件已同步"

# ==================== 步骤 2: 构建 ====================
echo ""
echo "[2/6] 构建应用..."

# 清理旧的构建产物
rm -rf "${UNPACKED_DIR}" "${RELEASE_DIR}/clawx-${VERSION}-win-x64.zip" "${RELEASE_DIR}/app-${VERSION}.asar"

# 构建解压版（--dir 生成 win-unpacked 目录）
npx electron-builder --dir --publish never --config electron-builder.yml

echo "  ✅ 构建完成"

# ==================== 步骤 3: 压缩 ZIP ====================
echo ""
echo "[3/6] 压缩 ZIP..."

cd "${RELEASE_DIR}"
# 使用 PowerShell 压缩（Windows 环境）
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'clawx-${VERSION}-win-x64.zip' -Force"
cd ..

echo "  ✅ ZIP 已生成: ${RELEASE_DIR}/clawx-${VERSION}-win-x64.zip"

# ==================== 步骤 4: 复制 asar + 生成 version.json ====================
echo ""
echo "[4/6] 准备热更新文件..."

# 复制 asar
cp "${UNPACKED_DIR}/resources/app.asar" "${RELEASE_DIR}/app-${VERSION}.asar"

# 获取 asar 文件大小
ASAR_SIZE=$(stat -c%s "${RELEASE_DIR}/app-${VERSION}.asar" 2>/dev/null || stat -f%z "${RELEASE_DIR}/app-${VERSION}.asar")

# 获取当前日期
RELEASE_DATE=$(date +%Y-%m-%d)

echo "  asar 大小: ${ASAR_SIZE} bytes"
echo "  ✅ 热更新文件已准备"

# ==================== 步骤 5: 上传到 CDN 仓库 ====================
echo ""
echo "[5/6] 上传到 CDN 仓库..."

# 克隆或更新 CDN 仓库
if [ -d "${CDN_REPO_DIR}" ]; then
  cd "${CDN_REPO_DIR}"
  git pull origin main
else
  git clone "${CDN_REPO_URL}" "${CDN_REPO_DIR}"
  cd "${CDN_REPO_DIR}"
fi

# 复制 asar 到 CDN 仓库
mkdir -p win
cp "../ClawX-main/${RELEASE_DIR}/app-${VERSION}.asar" "win/app-${VERSION}.asar"

# 生成 version.json
cat > win/version.json << EOF
{
  "version": "${VERSION}",
  "asarFile": "app-${VERSION}.asar",
  "asarSize": ${ASAR_SIZE},
  "releaseDate": "${RELEASE_DATE}",
  "releaseNotes": "ClawX v${VERSION}"
}
EOF

# 提交推送
git add -A
git commit -m "v${VERSION}: 更新热更新文件" || echo "  没有变更需要提交"
git push origin main

cd ..
echo "  ✅ CDN 仓库已更新（Cloudflare Pages 将自动部署）"

# ==================== 步骤 6: 上传到 GitHub Releases ====================
echo ""
echo "[6/6] 上传到 GitHub Releases..."

# 使用 gh CLI 创建 Release
if command -v gh &> /dev/null; then
  gh release create "v${VERSION}" \
    "${RELEASE_DIR}/clawx-${VERSION}-win-x64.zip" \
    --title "ClawX v${VERSION}" \
    --notes "ClawX v${VERSION} Windows 绿色版" \
    --repo "zhoudaniu/claw-api" 2>/dev/null || \
  echo "  ⚠️  请手动上传到 GitHub Releases: https://github.com/zhoudaniu/claw-api/releases/new"
else
  echo "  ⚠️  未安装 gh CLI，请手动上传到 GitHub Releases"
  echo "  地址: https://github.com/zhoudaniu/claw-api/releases/new"
  echo "  文件: ${RELEASE_DIR}/clawx-${VERSION}-win-x64.zip"
fi

# ==================== 完成 ====================
echo ""
echo "=========================================="
echo "  ✅ 发版完成！"
echo "=========================================="
echo ""
echo "  版本: ${VERSION}"
echo ""
echo "  上传内容:"
echo "  ├── CDN 仓库 (clawx-cdn)"
echo "  │   ├── win/version.json    ← 版本清单，供热更新检查"
echo "  │   └── win/app-${VERSION}.asar  ← 代码包，供热更新下载"
echo "  │"
echo "  └── GitHub Releases (claw-api)"
echo "      └── clawx-${VERSION}-win-x64.zip  ← 绿色版，供新用户下载"
echo ""
echo "  用户端更新流程:"
echo "  ├── 已有用户: 启动 → CDN 检查 version.json → 下载 asar → 重启"
echo "  └── 新用户:   下载 zip → 解压 → 双击运行"
echo ""
