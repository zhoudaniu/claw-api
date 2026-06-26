/**
 * 设备校验模块
 * 三种场景校验 + Electron 原生 dialog 弹窗
 */
const { dialog, app } = require('electron');
const { generateDeviceFingerprint, isWindows } = require('./device-fingerprint');
const { saveBindingInfo, loadBindingInfo, bindingFileExists } = require('./crypto-store');

/**
 * 显示错误弹窗并强制退出
 * @param {string} title - 弹窗标题
 * @param {string} message - 弹窗内容
 */
function showErrorAndExit(title, message) {
  dialog.showErrorBox(title, message);
  app.quit();
  // 强制退出进程
  // Dev mode: skip exit and just return
  if (!app.isPackaged) {
    console.warn('[device-verify] Dev mode: skipping exit --', title + ':' + message);
    return;
  }
  process.exit(1);
}

/**
 * 设备校验主函数
 * 在 app.whenReady() 中调用，通过后才创建窗口
 *
 * 三种场景：
 * 1. 首次启动：采集指纹 → 加密存储 → 弹窗"绑定成功" → 放行
 * 2. 后续启动（指纹一致）：采集指纹 → 比对 → 放行
 * 3. 后续启动（指纹不一致）：采集指纹 → 比对 → 弹窗"已绑定其他设备" → 强制退出
 * 4. 绑定文件丢失：弹窗"绑定信息丢失" → 强制退出（不可重新绑定）
 *
 * @returns {boolean} 校验是否通过
 */
function verifyDevice() {
  // Dev mode: skip if CLAWX_SKIP_DEVICE_BINDING is set
  if (process.env.CLAWX_SKIP_DEVICE_BINDING === '1') {
    console.log('[device-verify] Dev mode: skipping device verification');
    return true;
  }
  // 非 Windows 平台直接拦截
  if (!isWindows()) {
    showErrorAndExit(
      '不支持的操作系统',
      'ClawX 仅支持 Windows 平台运行。\n\nUnsupported platform: ClawX only runs on Windows.'
    );
    return false;
  }

  console.log('[device-verify] 开始设备校验...');

  // 采集当前设备指纹
  const currentFingerprint = generateDeviceFingerprint();

  // 场景 1：首次启动（绑定文件不存在）
  if (!bindingFileExists()) {
    console.log('[device-verify] 首次启动，执行设备绑定...');

    // 保存绑定信息
    const saved = saveBindingInfo(currentFingerprint);
    if (!saved) {
      showErrorAndExit(
        '绑定失败',
        '设备绑定信息保存失败，请检查磁盘权限后重试。'
      );
      return false;
    }

    // 弹窗提示绑定成功
    dialog.showMessageBoxSync({
      type: 'info',
      title: '绑定成功',
      message: '设备绑定成功',
      detail: '应用已与当前设备绑定，后续仅限此设备使用。',
      buttons: ['确定'],
    });

    console.log('[device-verify] 设备绑定成功');
    return true;
  }

  // 场景 2 & 3：后续启动（绑定文件存在）
  const savedFingerprint = loadBindingInfo();

  // 场景 4：绑定文件内容丢失或损坏
  if (savedFingerprint === null) {
    showErrorAndExit(
      '绑定信息丢失',
      '设备绑定信息文件丢失或损坏，无法验证设备身份。\n\n' +
      '请联系管理员重新部署应用。'
    );
    return false;
  }

  // 场景 3：指纹不一致（已绑定其他设备）
  if (savedFingerprint !== currentFingerprint) {
    showErrorAndExit(
      '设备不匹配',
      '该应用已绑定其他设备，无法在当前设备运行。\n\n' +
      '如需在新设备使用，请联系管理员解绑。'
    );
    return false;
  }

  // 场景 2：指纹一致，放行
  console.log('[device-verify] 设备校验通过');
  return true;
}

module.exports = {
  verifyDevice,
};
