// Preload bridge: the only surface the renderer sees of the desktop shell.
// No node APIs, no filesystem — just the store document in and out.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rotrDesktop', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (json) => ipcRenderer.invoke('store:save', json),
  flushStore: (json) => {
    try { ipcRenderer.sendSync('store:flush', json); } catch { /* closing */ }
  }
});
