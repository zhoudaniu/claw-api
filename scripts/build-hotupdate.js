/**
 * 热更新构建脚本
 * 生成 asar/latest.yml 用于热更新
 *
 * 使用方法：
 *   node scripts/build-hotupdate.js
 *
 * 输出：
 *   - release/hotupdate/asar/latest.yml - asar 版本清单文件
 *   - release/hotupdate/asar/clawx-{version}.asar - asar 文件（供上传）
 *
 * CDN 仓库结构:
 * clawx-cdn/
 * ├─ win/
 * │  ├─ latest.yml          # electron-builder 版本清单（完整安装包）
 * │  ├─ clawx-{version}-Setup.exe
 * │  ├─ clawx-{version}-Setup.exe.blockmap
 * │  └─ clawx-{version}-full.nupkg
 * ├─ asar/
 * │  ├─ latest.yml          # asar 热更新版本清单
 * │  └─ clawx-{version}.asar
 * └─ README.md
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// GitHub 配置（可通过环境变量覆盖）
const GITHUB_OWNER = process.env.HOTUPDATE_GH_OWNER || 'zhoudaniu';
const GITHUB_REPO = process.env.HOTUPDATE_GH_REPO || 'clawx-cdn';
const ASAR_SOURCE = 'release/win-unpacked/resources/app.asar';

/**
 * 获取当前版本号
 * @returns {string} 版本号
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  return packageJson.version;
}

/**
 * 获取文件信息
 * @param {string} filePath - 文件路径
 * @returns {object} 文件信息
 */
function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha512').update(buffer).digest('hex');

  return {
    size: stats.size,
    sha512: hash,
  };
}

/**
 * 生成 asar/latest.yml
 * @param {string} version - 版本号
 * @param {string} asarFile - asar 文件名
 * @param {object} fileInfo - 文件信息
 * @returns {string} yml 内容
 */
function generateAsarLatestYml(version, asarFile, fileInfo) {
  const now = new Date().toISOString();

  return `# ClawX Hot Update - asar Package
# Generated at ${now}
# CDN Repository: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}

version: ${version}
releaseDate: ${now}
asarFile: ${asarFile}
asarSize: ${fileInfo.size}
asarSha512: ${fileInfo.sha512}
releaseNotes: |
  v${version} 更新
  - 优化性能
  - 修复已知问题
`;
}

/**
 * 主函数
 */
function main() {
  console.log('=== ClawX 热更新构建脚本 ===\n');

  // 获取版本号
  const version = getCurrentVersion();
  console.log(`当前版本: ${version}`);

  // 检查 asar 文件是否存在
  const asarPath = path.resolve(ASAR_SOURCE);
  if (!fs.existsSync(asarPath)) {
    console.error(`错误: asar 文件不存在: ${asarPath}`);
    console.error('请先执行打包命令生成 asar 文件');
    console.error('  pnpm run package:win');
    process.exit(1);
  }

  // 获取 asar 文件信息
  const fileInfo = getFileInfo(asarPath);
  const asarFileName = `clawx-${version}.asar`;

  console.log(`asar 文件: ${asarPath}`);
  console.log(`asar 大小: ${(fileInfo.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`asar SHA512: ${fileInfo.sha512.substring(0, 16)}...`);

  // 创建输出目录
  const outputDir = path.resolve('release', 'hotupdate', 'asar');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 复制 asar 文件
  const asarOutputPath = path.join(outputDir, asarFileName);
  fs.copyFileSync(asarPath, asarOutputPath);
  console.log(`\nasar 文件已复制到: ${asarOutputPath}`);

  // 生成 asar/latest.yml
  const ymlContent = generateAsarLatestYml(version, asarFileName, fileInfo);
  const ymlPath = path.join(outputDir, 'latest.yml');
  fs.writeFileSync(ymlPath, ymlContent, 'utf-8');
  console.log(`asar/latest.yml 已生成: ${ymlPath}`);

  // 打印 latest.yml 内容
  console.log('\n=== asar/latest.yml 内容 ===');
  console.log(ymlContent);

  console.log('\n=== 构建完成 ===');
  console.log(`\nCDN 仓库结构:`);
  console.log(`clawx-cdn/`);
  console.log(`├─ asar/`);
  console.log(`│  ├─ latest.yml`);
  console.log(`│  └─ ${asarFileName}`);
  console.log(`└─ win/  (完整安装包，由 electron-builder 发布时自动生成)`);

  console.log(`\n下一步:`);
  console.log(`1. 将 asar/ 目录上传到 GitHub 仓库: ${GITHUB_OWNER}/${GITHUB_REPO}`);
  console.log(`   git checkout main`);
  console.log(`   git add asar/`);
  console.log(`   git commit -m "Release v${version}"`);
  console.log(`   git push`);

  console.log(`\n2. 发布新版本 (自动生成 win/ 目录):`);
  console.log(`   - 创建 GitHub Release 并上传完整安装包`);
  console.log(`   - 或使用 electron-builder 的 GitHub publisher`);
}

main();
