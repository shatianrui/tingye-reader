'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The only native surface the renderer gets: an allow-list of IPC channels.
const SYNC = new Set(['fs:paths', 'fs:info', 'fs:mkdir', 'fs:list', 'fs:delete', 'fs:write', 'fs:copy', 'fs:move', 'dialog:message']);
const ASYNC = new Set(['fs:read', 'secure:get', 'secure:set', 'secure:delete', 'dialog:open', 'shell:open', 'net:fetch']);

contextBridge.exposeInMainWorld('tingyeDesktop', {
  platform: process.platform,
  sync(channel, ...args) {
    if (!SYNC.has(channel)) throw new Error('Blocked desktop channel: ' + channel);
    const result = ipcRenderer.sendSync(channel, ...args);
    if (!result || !result.ok) throw new Error((result && result.error) || 'Desktop call failed');
    return result.value;
  },
  invoke(channel, ...args) {
    if (!ASYNC.has(channel)) return Promise.reject(new Error('Blocked desktop channel: ' + channel));
    return ipcRenderer.invoke(channel, ...args);
  },
  abort(id) { ipcRenderer.send('net:abort', String(id)); },
});
