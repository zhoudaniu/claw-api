/**
 * 热更新模块
 * 从 GitHub Releases 获取版本信息，下载 asar 文件进行热更新
 *
 * CDN 仓库结构:
 * clawx-cdn/
 * ├─ win/
 * │  ├─ latest.yml          # electron-builder 版本清单
 * │  ├─ clawx-{version}-Setup.exe
 * │  ├─ clawx-{version}-Setup.exe.blockmap
 * │  └─ clawx-{version}-full.nupkg
 * ├─ asar/
 * │  ├─ latest.yml          # asar 版本清单（包含 asar 下载信息）
 * │  └─ clawx-{version}.asar
 * └─ README.md
 */
const { app, dialog, BrowserWindow, ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 分钟
const INITIAL_DELAY_MS = 3000; // 启动后延迟 3 秒

// Cloudflare Pages 配置（GitHub 仓库自动部署）
const CDN_BASE_URL = process.env.HOTUPDATE_CDN_URL || 'https://clawx-cdn.pages.dev';
const ASAR_DIR = 'asar';

// 状态
let checkTimer = null;
let mainWindow = null;
let isChecking = false;
let isDownloading = false;

/**
 * 获取当前版本号
 * @returns {string} 版本号
 */
function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(app.getAppPath(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * 获取 resources 目录路径
 * @returns {string} resources 目录路径
 */
function getResourcesPath() {
  if (app.isPackaged) {
    // 便携模式下，resources 目录在 exe 所在目录下
    const appRoot = path.dirname(process.execPath);
    const portableResources = path.join(appRoot, 'resources');
    if (fs.existsSync(portableResources)) {
      return portableResources;
    }
    // 默认返回 app 所在目录
    return path.dirname(app.getAppPath());
  }
  return path.resolve(__dirname, '../..');
}

/**
 * 获取 app.asar 文件路径
 * @returns {string} app.asar 路径
 */
function getAsarPath() {
  return path.join(getResourcesPath(), 'app.asar');
}

/**
 * 发送进度到渲染进程
 * @param {number} progress - 进度百分比 (0-100)
 * @param {string} status - 状态描述
 */
function sendProgress(progress, status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hotupdate:progress', { progress, status });
  }
}

/**
 * 发送更新结果到渲染进程
 * @param {object} result - 结果对象
 */
function sendResult(result) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hotupdate:result', result);
  }
}

/**
 * HTTP GET 请求
 * @param {string} url - 请求 URL
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<{statusCode: number, data: string, headers: object}>}
 */
function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 处理重定向
        httpGet(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
  });
}

/**
 * 从 CDN 获取 asar 目录的 version.json
 * @returns {Promise<object|null>} 版本信息
 */
async function fetchAsarLatestYml() {
  const url = `${CDN_BASE_URL}/${ASAR_DIR}/version.json`;

  console.log(`[hot-updater] 获取 version.json: ${url}`);

  try {
    const response = await httpGet(url, 10000);

    if (response.statusCode !== 200) {
      console.warn(`[hot-updater] 获取 version.json 失败: HTTP ${response.statusCode}`);
      return null;
    }

    // 解析 JSON
    const data = JSON.parse(response.data);

    if (!data || !data.version) {
      console.warn('[hot-updater] version.json 格式无效');
      return null;
    }

    return {
      version: data.version,
      releaseDate: data.releaseDate,
      releaseNotes: data.releaseNotes || '',
      asarFile: data.asarFile || `app-${data.version}.asar`,
      asarSize: data.asarSize || 0,
      asarSha512: data.asarSha512 || '',
    };
  } catch (error) {
    console.warn('[hot-updater] 获取 version.json 网络错误:', error.message);
    return null;
  }
}

/**
 * 下载文件
 * @param {string} url - 下载 URL
 * @param {string} destPath - 目标路径
 * @param {number} expectedSize - 预期文件大小
 * @returns {Promise<boolean>} 是否下载成功
 */
async function downloadFile(url, destPath, expectedSize) {
  console.log(`[hot-updater] 开始下载: ${url}`);

  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 处理重定向
        downloadFile(res.headers.location, destPath, expectedSize)
          .then(resolve)
          .catch(() => resolve(false));
        return;
      }

      if (res.statusCode !== 200) {
        console.error(`[hot-updater] 下载失败: HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }

      const totalBytes = expectedSize || parseInt(res.headers['content-length'], 10) || 0;
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        fileStream.write(chunk);

        // 计算并发送进度
        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          sendProgress(progress, `下载中... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`);
        }
      });

      res.on('end', () => {
        fileStream.end(() => {
          console.log(`[hot-updater] 下载完成: ${destPath}`);
          resolve(true);
        });
      });

      res.on('error', (error) => {
        fileStream.end();
        try {
          fs.unlinkSync(destPath);
        } catch {}
        console.error('[hot-updater] 下载网络错误:', error.message);
        resolve(false);
      });
    });

    req.on('error', (error) => {
      console.error('[hot-updater] 下载请求失败:', error.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      try {
        fs.unlinkSync(destPath);
      } catch {}
      console.error('[hot-updater] 下载超时');
      resolve(false);
    });
  });
}

/**
 * 替换 asar 文件
 * Windows 上需要先重命名为 .old，再替换
 * @param {string} newAsarPath - 新 asar 文件路径
 * @returns {boolean} 是否替换成功
 */
function replaceAsar(newAsarPath) {
  const currentAsarPath = getAsarPath();
  const oldAsarPath = `${currentAsarPath}.old`;

  try {
    // 删除旧的 .old 文件（如果存在）
    if (fs.existsSync(oldAsarPath)) {
      fs.unlinkSync(oldAsarPath);
    }

    // 重命名当前 asar 为 .old
    fs.renameSync(currentAsarPath, oldAsarPath);
    console.log(`[hot-updater] 已重命名旧文件: ${currentAsarPath} -> ${oldAsarPath}`);

    // 复制新文件到目标位置
    fs.copyFileSync(newAsarPath, currentAsarPath);
    console.log(`[hot-updater] 已替换 asar 文件: ${newAsarPath} -> ${currentAsarPath}`);

    // 删除下载的临时文件
    fs.unlinkSync(newAsarPath);

    return true;
  } catch (error) {
    console.error('[hot-updater] 替换 asar 文件失败:', error);

    // 尝试回滚
    try {
      if (!fs.existsSync(currentAsarPath) && fs.existsSync(oldAsarPath)) {
        fs.renameSync(oldAsarPath, currentAsarPath);
        console.log('[hot-updater] 已回滚 asar 文件');
      }
    } catch {
      // 回滚也失败了
    }

    return false;
  }
}

/**
 * 比较版本号
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} -1: v1 < v2, 0: v1 == v2, 1: v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * 检查并执行热更新
 * @returns {Promise<object>} 更新结果
 */
async function checkForHotUpdate() {
  if (isChecking || isDownloading) {
    return { updated: false, reason: '正在检查或下载中' };
  }

  // 开发模式（resources 目录不存在时）跳过热更新
  if (!app.isPackaged) {
    return { updated: false, reason: '开发模式跳过热更新' };
  }

  isChecking = true;

  try {
    console.log('[hot-updater] 开始检查更新...');

    // 获取远程版本信息
    const remoteVersion = await fetchAsarLatestYml();
    if (!remoteVersion) {
      return { updated: false, reason: '获取版本信息失败' };
    }

    const currentVersion = getCurrentVersion();
    console.log(`[hot-updater] 当前版本: ${currentVersion}, 最新版本: ${remoteVersion.version}`);

    // 比较版本号
    if (compareVersions(remoteVersion.version, currentVersion) <= 0) {
      console.log('[hot-updater] 已是最新版本');
      return { updated: false, reason: '已是最新版本' };
    }

    // 弹窗确认更新
    const result = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${remoteVersion.version}`,
      detail: `当前版本: v${currentVersion}\n\n更新说明:\n${remoteVersion.releaseNotes || '无'}`,
      buttons: ['立即更新', '稍后再说'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result !== 0) {
      return { updated: false, reason: '用户取消更新' };
    }

    // 开始下载
    isDownloading = true;
    sendProgress(0, '准备下载...');

    // 构建 asar 下载 URL
    const asarUrl = `${CDN_BASE_URL}/${ASAR_DIR}/${remoteVersion.asarFile}`;

    // 下载到临时目录
    const tempAsarPath = path.join(
      app.getPath('temp'),
      `clawx-update-${remoteVersion.version}.asar`
    );

    const downloaded = await downloadFile(asarUrl, tempAsarPath, remoteVersion.asarSize);

    if (!downloaded) {
      sendResult({ success: false, error: '下载更新文件失败' });
      return { updated: false, reason: '下载失败' };
    }

    sendProgress(90, '正在替换文件...');

    // 替换 asar 文件
    const replaced = replaceAsar(tempAsarPath);
    if (!replaced) {
      sendResult({ success: false, error: '替换文件失败' });
      return { updated: false, reason: '替换失败' };
    }

    sendProgress(100, '更新完成');

    // 提示重启
    const restartResult = dialog.showMessageBoxSync(mainWindow, {
      type: 'info',
      title: '更新完成',
      message: '更新已完成',
      detail: '新版本将在重启后生效，是否立即重启？',
      buttons: ['立即重启', '稍后重启'],
      defaultId: 0,
      cancelId: 1,
    });

    if (restartResult === 0) {
      app.relaunch();
      app.exit(0);
    }

    sendResult({ success: true, version: remoteVersion.version });
    return { updated: true, version: remoteVersion.version };
  } catch (error) {
    console.error('[hot-updater] 检查更新异常:', error);
    sendResult({ success: false, error: error.message });
    return { updated: false, reason: error.message };
  } finally {
    isChecking = false;
    isDownloading = false;
  }
}

/**
 * 启动定时检查更新
 */
function startPeriodicCheck() {
  if (checkTimer) {
    clearInterval(checkTimer);
  }

  checkTimer = setInterval(() => {
    checkForHotUpdate().catch((error) => {
      console.warn('[hot-updater] 定时检查更新失败:', error);
    });
  }, CHECK_INTERVAL_MS);

  console.log(`[hot-updater] 已启动定时检查（间隔 ${CHECK_INTERVAL_MS / 1000 / 60} 分钟）`);
}

/**
 * 停止定时检查更新
 */
function stopPeriodicCheck() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

/**
 * 初始化热更新模块
 * @param {BrowserWindow} window - 主窗口
 */
function setupHotUpdater(window) {
  mainWindow = window;

  // 注册 IPC 处理器
  ipcMain.handle('hotupdate:check', () => {
    return checkForHotUpdate();
  });

  ipcMain.handle('hotupdate:getVersion', () => {
    return {
      current: getCurrentVersion(),
      resourcesPath: getResourcesPath(),
      isPackaged: app.isPackaged,
    };
  });

  // 延迟启动定时检查
  setTimeout(() => {
    startPeriodicCheck();
  }, INITIAL_DELAY_MS);

  console.log('[hot-updater] 热更新模块已初始化');
  console.log(`[hot-updater] CDN: ${CDN_BASE_URL}`);
}

module.exports = {
  setupHotUpdater,
  checkForHotUpdate,
  stopPeriodicCheck,
  getCurrentVersion,
};
