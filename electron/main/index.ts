/**
 * Electron Main Process Entry
 * Manages window creation, system tray, and IPC handlers
 *
 * NOTE: vite-plugin-electron 浼氬湪鏋勫缓瀹屾垚鍚庣敤 Node.js evaluate 缂栬瘧鍚庣殑鏂囦欢锛? * 姝ゆ椂 require("electron") 杩斿洖 npm 鍖咃紙浜岃繘鍒惰矾寰勫瓧绗︿覆锛夛紝electron.app 涓?undefined銆? * 鍥犳鎵€鏈夐《灞?app 璁块棶蹇呴』浣跨敤瀹夊叏璁块棶锛坥ptional chaining锛夋垨寤惰繜鍒?app.whenReady() 涓€? */
import { app, BrowserWindow, nativeImage, session, shell } from 'electron';
import { join } from 'path';
import { GatewayManager } from '../gateway/manager';
import { registerIpcHandlers } from './ipc-handlers';
import { HostApiRegistry } from './ipc/host-invoke';
import { createTray } from './tray';
import { createMenu } from './menu';
import { registerZoomShortcuts } from './zoom-shortcuts';

import { appUpdater, registerUpdateHandlers } from './updater';
import { logger } from '../utils/logger';
import { warmupNetworkOptimization } from '../utils/uv-env';
import { initTelemetry } from '../utils/telemetry';

import { ClawHubService } from '../gateway/clawhub';
import { extensionRegistry } from '../extensions/registry';
import { loadExtensionsFromManifest } from '../extensions/loader';
import { registerAllBuiltinExtensions } from '../extensions/builtin';
import { loadExternalMainExtensions } from '../extensions/_ext-bridge.generated';
import {
  ensureclawxContext,
  ensureclawxDefaultIdentity,
  repairclawxOnlyBootstrapFiles,
} from '../utils/openclaw-workspace';
import { autoInstallCliIfNeeded, generateCompletionCache, installCompletionToProfile } from '../utils/openclaw-cli';
import { isQuitting, setQuitting } from './app-state';
import { getMacTrafficLightPosition, syncMacTrafficLightPosition } from './traffic-light-layout';
import { getSetting } from '../utils/store';
import { applyProxySettings } from './proxy';
import { syncLaunchAtStartupSettingFromStore } from './launch-at-startup';
import {
  clearPendingSecondInstanceFocus,
  consumeMainWindowReady,
  createMainWindowFocusState,
  requestSecondInstanceFocus,
} from './main-window-focus';
import {
  createQuitLifecycleState,
  markQuitCleanupCompleted,
  requestQuitLifecycleAction,
} from './quit-lifecycle';
import { createSignalQuitHandler } from './signal-quit';
import { acquireProcessInstanceFileLock } from './process-instance-lock';
import { ensureBuiltinSkillsInstalled, ensurePreinstalledSkillsInstalled, trimBundledOpenClawSkillsAndConfigs } from '../utils/skill-config';

import { deviceOAuthManager } from '../utils/device-oauth';
import { browserOAuthManager } from '../utils/browser-oauth';
import { whatsAppLoginManager } from '../utils/whatsapp-login';
// Disable hardware acceleration BEFORE app.whenReady() -- required at top-level
// before the app becomes ready.  In the vite-plugin-electron build-evaluate phase
// pp may be undefined, so we guard with optional chaining.
app?.disableHardwareAcceleration();

import { syncAllProviderAuthToRuntime } from '../services/providers/provider-runtime-sync';

const WINDOWS_APP_USER_MODEL_ID = 'app.clawx.desktop';
const isE2EMode = process.env.clawx_E2E === '1';
const requestedUserDataDir = process.env.clawx_USER_DATA_DIR?.trim();
const requestedRemoteDebuggingPort = process.env.clawx_REMOTE_DEBUGGING_PORT?.trim();

// --- 椤跺眰瀹夊叏鍒濆鍖栵紙Node.js evaluate 鏃?app 鍙兘涓?undefined锛?--

if (requestedRemoteDebuggingPort) {
  app?.commandLine?.appendSwitch('remote-debugging-port', requestedRemoteDebuggingPort);
}

if (isE2EMode && requestedUserDataDir) {
  app?.setPath('userData', requestedUserDataDir);
}

// 渚挎惡妯″紡妫€娴嬶紙寤惰繜鍒?app 灏辩华鍚庢墽琛岋級
function setupPortableMode(): void {
  if (requestedUserDataDir || isE2EMode) return;
  const fs = require('fs');
  const path = require('path');
  const appRoot = app.isPackaged
    ? path.dirname(process.execPath)
    : path.resolve(__dirname, '../..');

  const portableMarker = path.join(appRoot, 'portable');
  const isPortableByMarker = fs.existsSync(portableMarker);

  let isPortableByWritable = false;
  try {
    const testFile = path.join(app.getAppPath(), '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch {
    isPortableByWritable = true;
  }

  if (isPortableByMarker || isPortableByWritable) {
    const portableDataDir = path.join(appRoot, 'data');
    if (!fs.existsSync(portableDataDir)) {
      fs.mkdirSync(portableDataDir, { recursive: true });
    }
    app.setPath('userData', portableDataDir);
    console.info(`[clawx] 渚挎惡妯″紡锛歶serData 宸查噸瀹氬悜鍒?${portableDataDir}`);
  }
}

// Disable GPU + Linux desktop锛堝欢杩熷埌 app 灏辩华鍚庢墽琛岋級
function initAppLevelSettings(): void {
  if (process.platform === 'linux') {
    const linuxApp = app as typeof app & { setDesktopName?: (desktopName: string) => void };
    linuxApp.setDesktopName?.('clawx.desktop');
  }
}

function sendMainWindowEvent(channel: string, payload: unknown): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

/**
 * Resolve the icons directory path (works in both dev and packaged mode)
 */
function getIconsDir(): string {
  if (app.isPackaged) {
    // Packaged: icons are in extraResources 鈫?process.resourcesPath/resources/icons
    return join(process.resourcesPath, 'resources', 'icons');
  }
  // Development: relative to dist-electron/main/
  return join(__dirname, '../../resources/icons');
}

/**
 * Get the app icon for the current platform
 */
function getAppIcon(): Electron.NativeImage | undefined {
  if (process.platform === 'darwin') return undefined; // macOS uses the app bundle icon

  const iconsDir = getIconsDir();
  const iconPath =
    process.platform === 'win32'
      ? join(iconsDir, 'icon.ico')
      : join(iconsDir, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

/**
 * Create the main application window
 */
function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';
  const useCustomTitleBar = isWindows;
  const shouldSkipSetupForE2E = process.env.clawx_E2E_SKIP_SETUP === '1';

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true, // Enable <webview> for embedding OpenClaw Control UI
    },
    titleBarStyle: isMac ? 'hiddenInset' : useCustomTitleBar ? 'hidden' : 'default',
    trafficLightPosition: isMac
      ? getMacTrafficLightPosition(false)
      : undefined,
    frame: isMac || !useCustomTitleBar,
    show: false,
  });

  registerZoomShortcuts(win);

  // Handle external links 鈥?only allow safe protocols to prevent arbitrary
  // command execution via shell.openExternal() (e.g. file://, ms-msdt:, etc.)
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      } else {
        logger.warn(`Blocked openExternal for disallowed protocol: ${parsed.protocol}`);
      }
    } catch {
      logger.warn(`Blocked openExternal for malformed URL: ${url}`);
    }
    return { action: 'deny' };
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    const rendererUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    if (shouldSkipSetupForE2E) {
      rendererUrl.searchParams.set('e2eSkipSetup', '1');
    }
    win.loadURL(rendererUrl.toString());
    if (!isE2EMode) {
      win.webContents.openDevTools();
    }
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'), {
      query: shouldSkipSetupForE2E
        ? { e2eSkipSetup: '1' }
        : undefined,
    });
  }

  return win;
}

function focusWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  clearPendingSecondInstanceFocus(mainWindowFocusState);
  focusWindow(mainWindow);
}

function createMainWindow(): BrowserWindow {
  const win = createWindow();

  win.once('ready-to-show', () => {
    if (mainWindow !== win) {
      return;
    }

    if (process.platform === 'darwin') {
      void getSetting('sidebarCollapsed').then((sidebarCollapsed) => {
        syncMacTrafficLightPosition(win, sidebarCollapsed);
      });
    }

    const action = consumeMainWindowReady(mainWindowFocusState);
    if (action === 'focus') {
      focusWindow(win);
      return;
    }

    win.show();
  });

  win.on('close', (event) => {
    if (!isQuitting() && !isE2EMode) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  mainWindow = win;
  return win;
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  // Initialize logger first
  logger.init();
  logger.info('=== clawx Application Starting ===');
  logger.debug(
    `Runtime: platform=${process.platform}/${process.arch}, electron=${process.versions.electron}, node=${process.versions.node}, packaged=${app.isPackaged}, pid=${process.pid}, ppid=${process.ppid}`
  );

  if (!isE2EMode) {
    // Warm up network optimization (non-blocking)
    void warmupNetworkOptimization();

    // Initialize Telemetry early
    await initTelemetry();

    // Apply persisted proxy settings before creating windows or network requests.
    await applyProxySettings();
    await syncLaunchAtStartupSettingFromStore();
  } else {
    logger.info('Running in E2E mode: startup side effects minimized');
  }

  // Set application menu
  await createMenu();

  // Create the main window
  const window = createMainWindow();

  // Create system tray
  if (!isE2EMode) {
    createTray(window);
  }

  // Override security headers ONLY for the OpenClaw Gateway Control UI.
  // The URL filter ensures this callback only fires for gateway requests,
  // avoiding unnecessary overhead on every other HTTP response.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['http://127.0.0.1:18789/*', 'http://localhost:18789/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['X-Frame-Options'];
      delete headers['x-frame-options'];
      if (headers['Content-Security-Policy']) {
        headers['Content-Security-Policy'] = headers['Content-Security-Policy'].map(
          (csp) => csp.replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self' *")
        );
      }
      if (headers['content-security-policy']) {
        headers['content-security-policy'] = headers['content-security-policy'].map(
          (csp) => csp.replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self' *")
        );
      }
      callback({ responseHeaders: headers });
    },
  );

  // Register IPC handlers
  registerIpcHandlers(gatewayManager, clawHubService, window, hostApiRegistry);

  // 鍒濆鍖栫儹鏇存柊妯″潡锛堥潪 E2E 妯″紡锛?
  if (!isE2EMode) {
    try {
      const { setupHotUpdater } = require('../../scripts/hot-updater');
      setupHotUpdater(window);
    } catch (error) {
      logger.warn('Hot updater initialization failed:', error);
    }
  }

  // Initialize extension system
  await extensionRegistry.initialize({
    gatewayManager,
    getMainWindow: () => mainWindow,
    hostApi: {
      register: (extensionId, contributions) => (
        hostApiRegistry.registerExtensionContributions(extensionId, contributions)
      ),
    },
  });

  // Wire marketplace provider to ClawHubService if an extension provides one
  const marketplaceProvider = extensionRegistry.getMarketplaceProvider();
  if (marketplaceProvider) {
    clawHubService.setMarketplaceProvider(marketplaceProvider);
  }

  // Register update handlers
  registerUpdateHandlers(appUpdater, window);

  // Note: Auto-check for updates is driven by the renderer (update store init)
  // so it respects the user's "Auto-check for updates" setting.

  // Seed a stable default IDENTITY.md before the Gateway initializes the
  // workspace so clawx desktop sessions skip OpenClaw's chat-first bootstrap.
  if (!isE2EMode) {
    void ensureclawxDefaultIdentity().catch((error) => {
      logger.warn('Failed to seed default clawx identity:', error);
    });
  }

  // Repair any bootstrap files that only contain clawx markers (no OpenClaw
  // template content). This fixes a race condition where ensureclawxContext()
  // previously created the file before the gateway could seed the full template.
  if (!isE2EMode) {
    void repairclawxOnlyBootstrapFiles().catch((error) => {
      logger.warn('Failed to repair bootstrap files:', error);
    });
  }

  // Pre-deploy built-in skills (feishu-doc, feishu-drive, feishu-perm, feishu-wiki)
  // to ~/.openclaw/skills/ so they are immediately available without manual install.
  if (!isE2EMode) {
    void ensureBuiltinSkillsInstalled().catch((error) => {
      logger.warn('Failed to install built-in skills:', error);
    });
  }

  // Keep community builds aligned with clawx-biz by physically trimming
  // bundled OpenClaw consumer skills on startup (dev + packaged), keeping only
  // `skill-creator`. This also prunes stale openclaw.json entries for trimmed
  // bundled skills so we do not keep `enabled: false` config for skills that no
  // longer exist.
  if (!isE2EMode) {
    void trimBundledOpenClawSkillsAndConfigs().then(({ removed, removedConfigs, kept }) => {
      if (removed > 0 || removedConfigs > 0) {
        logger.info(
          `Trimmed bundled OpenClaw skills: removed ${removed}, pruned configs ${removedConfigs}, kept ${kept.join(', ')}`,
        );
      }
    });
  }

  // Pre-deploy bundled third-party skills from resources/preinstalled-skills.
  // This installs full skill directories (not only SKILL.md) in an idempotent,
  // non-destructive way and never blocks startup.
  if (!isE2EMode) {
    void ensurePreinstalledSkillsInstalled().catch((error) => {
      logger.warn('Failed to install preinstalled skills:', error);
    });
  }

  // Plugin installation is now configuration-driven:
  // - When a channel is added via UI: ensureXxxPluginInstalled() in IPC handlers
  // - When Gateway starts: ensureConfiguredPluginsUpgraded() in config-sync.ts
  // No need to pre-install all bundled plugins at app startup.

  // Bridge gateway and host-side events before any auto-start logic runs, so
  // renderer subscribers observe the full startup lifecycle.
  gatewayManager.on('status', (status: { state: string }) => {
    sendMainWindowEvent('gateway:status-changed', status);
    if (status.state === 'running' && !isE2EMode) {
      void ensureclawxContext().catch((error) => {
        logger.warn('Failed to re-merge clawx context after gateway reconnect:', error);
      });
    }
  });

  gatewayManager.on('error', (error) => {
    sendMainWindowEvent('gateway:error', { message: error.message });
  });

  gatewayManager.on('notification', (notification) => {
    sendMainWindowEvent('gateway:notification', notification);
  });

  gatewayManager.on('gateway:health', (data) => {
    sendMainWindowEvent('gateway:health-changed', data);
  });

  gatewayManager.on('gateway:presence', (data) => {
    sendMainWindowEvent('gateway:presence-changed', data);
  });

  gatewayManager.on('chat:message', (data) => {
    sendMainWindowEvent('gateway:chat-message', data);
  });

  gatewayManager.on('chat:runtime-event', (data) => {
    sendMainWindowEvent('chat:runtime-event', data);
  });

  gatewayManager.on('channel:status', (data) => {
    sendMainWindowEvent('gateway:channel-status', data);
  });

  gatewayManager.on('exit', (code) => {
    sendMainWindowEvent('gateway:exit', { code });
  });

  deviceOAuthManager.on('oauth:code', (payload) => {
    sendMainWindowEvent('oauth:code', payload);
  });

  deviceOAuthManager.on('oauth:success', (payload) => {
    sendMainWindowEvent('oauth:success', { ...payload, success: true });
  });

  deviceOAuthManager.on('oauth:error', (error) => {
    sendMainWindowEvent('oauth:error', error);
  });

  browserOAuthManager.on('oauth:code', (payload) => {
    sendMainWindowEvent('oauth:code', payload);
  });

  browserOAuthManager.on('oauth:success', (payload) => {
    sendMainWindowEvent('oauth:success', { ...payload, success: true });
  });

  browserOAuthManager.on('oauth:error', (error) => {
    sendMainWindowEvent('oauth:error', error);
  });

  whatsAppLoginManager.on('qr', (data) => {
    sendMainWindowEvent('channel:whatsapp-qr', data);
  });

  whatsAppLoginManager.on('success', (data) => {
    sendMainWindowEvent('channel:whatsapp-success', data);
  });

  whatsAppLoginManager.on('error', (error) => {
    sendMainWindowEvent('channel:whatsapp-error', error);
  });

  // Start Gateway automatically (this seeds missing bootstrap files with full templates)
  const gatewayAutoStart = await getSetting('gatewayAutoStart');
  if (!isE2EMode && gatewayAutoStart) {
    try {
      await syncAllProviderAuthToRuntime();
      logger.debug('Auto-starting Gateway...');
      await gatewayManager.start();
      logger.info('Gateway auto-start succeeded');
    } catch (error) {
      logger.error('Gateway auto-start failed:', error);
      mainWindow?.webContents.send('gateway:error', String(error));
    }
  } else if (isE2EMode) {
    logger.info('Gateway auto-start skipped in E2E mode');
  } else {
    logger.info('Gateway auto-start disabled in settings');
  }

  // Merge clawx context snippets into the workspace bootstrap files.
  // The gateway seeds workspace files asynchronously after its HTTP server
  // is ready, so ensureclawxContext will retry until the target files appear.
  if (!isE2EMode) {
    void ensureclawxContext().catch((error) => {
      logger.warn('Failed to merge clawx context into workspace:', error);
    });
  }

  // Auto-install openclaw CLI and shell completions (non-blocking).
  if (!isE2EMode) {
    void autoInstallCliIfNeeded((installedPath) => {
      mainWindow?.webContents.send('openclaw:cli-installed', installedPath);
    }).then(() => {
      generateCompletionCache();
      installCompletionToProfile();
    }).catch((error) => {
      logger.warn('CLI auto-install failed:', error);
    });
  }
}

// Global references
let mainWindow: BrowserWindow | null = null;
let gatewayManager!: GatewayManager;
let clawHubService!: ClawHubService;
const hostApiRegistry = new HostApiRegistry();
const mainWindowFocusState = createMainWindowFocusState();
const quitLifecycleState = createQuitLifecycleState();

// --- 鍗曞疄渚嬮攣锛堝湪 app.whenReady 鍐呴儴鎵ц锛?--
let releaseProcessInstanceFileLock: () => void = () => {};

// Application lifecycle 鈥?涓嶅姞 if (app) 鍒ゆ柇锛岀‘淇濆湪鐪熸鐨?Electron 杩涚▼涓?always 娉ㄥ唽
app.whenReady().then(() => {
  // 姝ゆ椂 app 宸插氨缁紝鍙互瀹夊叏璁块棶鎵€鏈?Electron API

  // 渚挎惡妯″紡妫€娴?
  try { setupPortableMode(); } catch (e) { logger.warn('Portable mode setup failed:', e); }

  // 搴旂敤绾у埆璁剧疆
  initAppLevelSettings();

  // 璁惧缁戝畾鏍￠獙锛堥潪 E2E 妯″紡涓嬫墽琛岋級
  if (!isE2EMode) {
    try {
      const { verifyDevice } = require('../../scripts/device-verify');
      const verified = verifyDevice();
      if (!verified) return;
    } catch (error) {
      logger.error('Device verification failed:', error);
      if (app.isPackaged) return;
    }
  }

  // 鍗曞疄渚嬮攣
  const electronLock = isE2EMode ? true : app.requestSingleInstanceLock();
  if (!electronLock) {
    console.info('[clawx] Another instance already holds the single-instance lock; exiting');
    app.exit(0);
    return;
  }

  if (!isE2EMode) {
    try {
      const fileLock = acquireProcessInstanceFileLock({
        userDataDir: app.getPath('userData'),
        lockName: 'clawx',
        force: true,
      });
      releaseProcessInstanceFileLock = fileLock.release;
      if (!fileLock.acquired) {
        const ownerDescriptor = fileLock.ownerPid
          ? `${fileLock.ownerFormat ?? 'legacy'} pid=${fileLock.ownerPid}`
          : 'unknown';
        console.info(`[clawx] Another instance holds process lock (${fileLock.lockPath}, ${ownerDescriptor}); exiting`);
        app.exit(0);
        return;
      }
    } catch (error) {
      console.warn('[clawx] File lock acquisition failed, continuing:', error);
    }
  }

  // 注册信号处理和退出清理
  const requestQuitOnSignal = createSignalQuitHandler({
    logInfo: (message) => logger.info(message),
    requestQuit: () => app.quit(),
  });

  process.on('exit', () => {
    releaseProcessInstanceFileLock();
  });

  process.once('SIGINT', () => requestQuitOnSignal('SIGINT'));
  process.once('SIGTERM', () => requestQuitOnSignal('SIGTERM'));

  app.on('will-quit', () => {
    releaseProcessInstanceFileLock();
  });

  if (process.platform === 'win32') {
    app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
  }

  gatewayManager = new GatewayManager();
  clawHubService = new ClawHubService();

  // Register builtin extensions and load manifest
  registerAllBuiltinExtensions();
  loadExternalMainExtensions();
  void loadExtensionsFromManifest().catch((err) => {
    logger.warn('Failed to load extensions from manifest:', err);
  });

  // When a second instance is launched, focus the existing window instead.
  app.on('second-instance', () => {
    logger.info('Second clawx instance detected; redirecting to the existing window');

    const focusRequest = requestSecondInstanceFocus(
      mainWindowFocusState,
      Boolean(mainWindow && !mainWindow.isDestroyed()),
    );

    if (focusRequest === 'focus-now') {
      focusMainWindow();
      return;
    }

    logger.debug('Main window is not ready yet; deferring second-instance focus until ready-to-show');
  });

  void initialize().catch((error) => {
    logger.error('Application initialization failed:', error);
  });

  // Register activate handler AFTER app is ready to prevent
  // "Cannot create BrowserWindow before app is ready" on macOS.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      focusMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isE2EMode) {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  setQuitting();
  const action = requestQuitLifecycleAction(quitLifecycleState);

  if (action === 'allow-quit') {
    return;
  }

  event.preventDefault();

  if (action === 'cleanup-in-progress') {
    logger.debug('Quit requested while cleanup already in progress; waiting for shutdown task to finish');
    return;
  }

  void extensionRegistry.teardownAll();

  const stopPromise = gatewayManager?.stop().catch((err) => {
    logger.warn('gatewayManager.stop() error during quit:', err);
  }) ?? Promise.resolve();
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), 5000);
  });

  void Promise.race([stopPromise.then(() => 'stopped' as const), timeoutPromise]).then((result) => {
    if (result === 'timeout') {
      logger.warn('Gateway shutdown timed out during app quit; proceeding with forced quit');
      void gatewayManager?.forceTerminateOwnedProcessForQuit().then((terminated) => {
        if (terminated) {
          logger.warn('Forced gateway process termination completed after quit timeout');
        }
      }).catch((err) => {
        logger.warn('Forced gateway termination failed after quit timeout:', err);
      });
    }
    markQuitCleanupCompleted(quitLifecycleState);
    app.quit();
  });
});

// Best-effort Gateway cleanup on unexpected crashes.
const emergencyGatewayCleanup = (reason: string, error: unknown): void => {
  logger.error(`${reason}:`, error);
  try {
    void gatewayManager?.stop().catch(() => { /* ignore */ });
  } catch {
    // ignore
  }
  setTimeout(() => {
    process.exit(1);
  }, 3000).unref();
};

process.on('uncaughtException', (error) => {
  emergencyGatewayCleanup('Uncaught exception in main process', error);
});

process.on('unhandledRejection', (reason) => {
  emergencyGatewayCleanup('Unhandled promise rejection in main process', reason);
});

// Export for testing
export { mainWindow, gatewayManager };
