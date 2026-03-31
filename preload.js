const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openLauncherFolder: () => ipcRenderer.invoke('open-launcher-folder'),
  openPath: targetPath => ipcRenderer.invoke('open-path', targetPath),

  async callBackend(endpoint, data = {}) {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(data);
      const options = {
        hostname: '127.0.0.1',
        port: 5123,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const req = http.request(options, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { resolve({ ok: false, error: 'Invalid JSON from backend' }); }
        });
      });
      req.on('error', err => reject(err));
      req.write(body);
      req.end();
    });
  },
});
