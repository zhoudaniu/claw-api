/**
 * 设备指纹采集模块
 * 采集 Windows 硬件唯一标识并生成 SHA256 指纹
 */
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * 执行 wmic 命令并处理中文乱码
 * @param {string} wmicArgs - wmic 命令参数
 * @returns {string} 清理后的输出
 */
function execWmic(wmicArgs) {
  try {
    // 使用 chcp 65001 处理中文乱码，然后执行 wmic 命令
    const cmd = `chcp 65001 >nul 2>&1 && wmic ${wmicArgs}`;
    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 10000,
      windowsHide: true,
    });
    return output;
  } catch (error) {
    console.warn(`[device-fingerprint] wmic ${wmicArgs} 执行失败:`, error.message);
    return '';
  }
}

/**
 * 从 wmic 输出中提取第一个有效值
 * @param {string} output - wmic 命令输出
 * @returns {string} 清理后的值
 */
function extractWmicValue(output) {
  if (!output) return 'NONE';

  // 按行分割并过滤
  const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  // 第一行通常是标题，第二行是值
  for (let i = 1; i < lines.length; i++) {
    const value = lines[i].trim();
    // 跳过空值和标题行
    if (value && !/^(SerialNumber|ProcessorId|Caption|Name)$/i.test(value)) {
      return value;
    }
  }

  return 'NONE';
}

/**
 * 获取主板序列号
 * @returns {string} 主板序列号
 */
function getBaseboardSerial() {
  const output = execWmic('baseboard get serialnumber');
  return extractWmicValue(output);
}

/**
 * 获取 CPU 序列号
 * @returns {string} CPU 序列号
 */
function getCpuSerial() {
  const output = execWmic('cpu get ProcessorId');
  return extractWmicValue(output);
}

/**
 * 获取硬盘序列号
 * @returns {string} 硬盘序列号
 */
function getDiskSerial() {
  const output = execWmic('diskdrive get serialnumber');
  return extractWmicValue(output);
}

/**
 * 生成设备指纹
 * 拼接主板序列号 + CPU 序列号 + 硬盘序列号，然后做 SHA256 哈希
 * @returns {string} 设备指纹（64位十六进制字符串）
 */
function generateDeviceFingerprint() {
  const baseboard = getBaseboardSerial();
  const cpu = getCpuSerial();
  const disk = getDiskSerial();

  console.log('[device-fingerprint] 硬件信息:');
  console.log(`  主板序列号: ${baseboard}`);
  console.log(`  CPU 序列号: ${cpu}`);
  console.log(`  硬盘序列号: ${disk}`);

  // 拼接硬件字符串
  const hardwareString = `${baseboard}|${cpu}|${disk}`;

  // 生成 SHA256 哈希
  const fingerprint = crypto.createHash('sha256').update(hardwareString).digest('hex');

  console.log(`  设备指纹: ${fingerprint}`);

  return fingerprint;
}

/**
 * 检查当前平台是否为 Windows
 * @returns {boolean}
 */
function isWindows() {
  return process.platform === 'win32';
}

module.exports = {
  generateDeviceFingerprint,
  isWindows,
  getBaseboardSerial,
  getCpuSerial,
  getDiskSerial,
};
