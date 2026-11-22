// Electron main process: owns the window and the durable save file.
//
// Deliberately thin — all game logic stays in the renderer. The renderer's
// storage bridge (src/platform/desktop.ts) sends the whole store document; this
// process writes it atomically so a crash or power loss cannot leave a
// half-written save behind.
//
// Save location: %APPDATA%/Rise of the Realm/store.json (userData on any OS)
// Recovery:     store.json.bak is the previous good document.
'use strict';
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEV_URL = process.env.ROTR_DEV_URL || '';

function storeFile() {
  return path.join(app.getPath('userData'), 'store.json');
}

function readStore() {
  const file = storeFile();
  // Main document first, then the previous good copy.
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const raw = fs.readFileSync(candidate, 'utf8');
      JSON.parse(raw); // validate before handing it to the renderer
      return raw;
    } catch { /* try the next candidate */ }
  }
  return null;
}

function writeStore(json) {
  if (typeof json !== 'string' || json.length > 64 * 1024 * 1024) return false;
  const file = storeFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Keep one previous good document for corruption recovery.
    try { if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`); } catch { /* first save */ }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, file); // atomic on NTFS and POSIX
    return true;
  } catch (err) {
    console.error('[store] write failed', err);
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0a0e16',
    title: 'Rise of the Realm',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Phaser's loop must keep running when the window loses focus (alt-tab
      // during a raid should not pause the world).
      backgroundThrottling: false
    }
  });

  win.once('ready-to-show', () => win.show());

  // F11 fullscreen, F12 devtools in development only.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    if (input.key === 'F12' && DEV_URL) { win.webContents.toggleDevTools(); event.preventDefault(); }
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  return win;
}

// One instance owns the save file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  ipcMain.handle('store:load', () => readStore());
  ipcMain.handle('store:save', (_event, json) => writeStore(json));
  // Synchronous flush on pagehide: the renderer is going away and a queued
  // promise would be lost.
  ipcMain.on('store:flush', (event, json) => {
    event.returnValue = writeStore(json);
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
