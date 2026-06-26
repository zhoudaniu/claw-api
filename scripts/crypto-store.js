/**
 * AES 加解密 + 隐藏目录读写模块
 * 用于设备绑定信息的安全存储
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// AES-128-ECB 密钥（内置，16字节）
const AES_KEY = Buffer.from('Cl@wX2026Secure!', 'utf-8');

// 绑定文件相对路径
const BINDING_RELATIVE_PATH = path.join('.openclaw', '.device_binding');

/**
 * AES-128-ECB 加密
 * @param {string} plaintext - 明文
 * @returns {string} Base64 编码的密文
 */
function encrypt(plaintext) {
  const cipher = crypto.createCipheriv('aes-128-ecb', AES_KEY, null);
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * AES-128-ECB 解密
 * @param {string} ciphertext - Base64 编码的密文
 * @returns {string} 解密后的明文
 */
function decrypt(ciphertext) {
  const decipher = crypto.createDecipheriv('aes-128-ecb', AES_KEY, null);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

/**
 * 获取绑定文件的完整路径
 * @returns {string} 绑定文件路径
 */
function getBindingFilePath() {
  return path.join(os.homedir(), BINDING_RELATIVE_PATH);
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 设置文件隐藏属性（Windows）
 * @param {string} filePath - 文件路径
 */
function setFileHidden(filePath) {
  if (process.platform === 'win32') {
    try {
      // 使用 attrib 命令设置隐藏属性
      const { execSync } = require('child_process');
      execSync(`attrib +h "${filePath}"`, { windowsHide: true });
    } catch (error) {
      console.warn('[crypto-store] 设置文件隐藏属性失败:', error.message);
    }
  }
}

/**
 * 保存设备绑定信息
 * @param {string} fingerprint - 设备指纹
 * @returns {boolean} 是否保存成功
 */
function saveBindingInfo(fingerprint) {
  try {
    const filePath = getBindingFilePath();
    const dirPath = path.dirname(filePath);

    // 确保目录存在
    ensureDir(dirPath);

    // 加密指纹
    const encryptedData = encrypt(fingerprint);

    // 写入文件
    fs.writeFileSync(filePath, encryptedData, 'utf-8');

    // 设置隐藏属性
    setFileHidden(filePath);

    console.log('[crypto-store] 设备绑定信息已保存');
    return true;
  } catch (error) {
    console.error('[crypto-store] 保存绑定信息失败:', error);
    return false;
  }
}

/**
 * 读取设备绑定信息
 * @returns {string|null} 解密后的指纹，文件不存在返回 null
 */
function loadBindingInfo() {
  try {
    const filePath = getBindingFilePath();

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const encryptedData = fs.readFileSync(filePath, 'utf-8').trim();

    if (!encryptedData) {
      return null;
    }

    // 解密指纹
    const fingerprint = decrypt(encryptedData);
    return fingerprint;
  } catch (error) {
    console.error('[crypto-store] 读取绑定信息失败:', error);
    return null;
  }
}

/**
 * 检查绑定文件是否存在
 * @returns {boolean}
 */
function bindingFileExists() {
  return fs.existsSync(getBindingFilePath());
}

module.exports = {
  encrypt,
  decrypt,
  saveBindingInfo,
  loadBindingInfo,
  bindingFileExists,
  getBindingFilePath,
};
