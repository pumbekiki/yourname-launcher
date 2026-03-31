const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const os   = require('os');

let mainWindow;
let pythonProcess;
const BACKEND_PORT = 5123;

function getBundledBackendExePath() {
  return path.join(process.resourcesPath, 'backend', 'yourname_launcher_backend.exe');
}

function getBundledBridgeJarPath() {
  return path.join(process.resourcesPath, 'bridge', 'bridge.jar');
}

function getAppIconPath() {
  return path.join(__dirname, '1.ico');
}

// ─── FIX: Copy server.py to temp dir (avoids Cyrillic/spaces in path) ──
function getPythonScriptPath() {
  const src = path.join(__dirname, 'backend', 'server.py');
  const tmp = path.join(os.tmpdir(), 'yourname_launcher_server.py');
  try {
    fs.copyFileSync(src, tmp);
    console.log('[Launcher] server.py copied to:', tmp);
    return tmp;
  } catch (e) {
    console.warn('[Launcher] Could not copy server.py, using original:', e.message);
    return src;
  }
}

function killStaleBackends() {
  const scriptPath = path.join(os.tmpdir(), 'yourname_launcher_server.py').replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -match '^python(3)?(\\.exe)?$' -and $_.CommandLine -like '*yourname_launcher_server.py*'",
    "}",
    "foreach ($proc in $targets) {",
    "  if ($proc.ProcessId -ne $PID) {",
    "    try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop; Write-Output ('[Launcher] Killed stale backend PID ' + $proc.ProcessId) } catch {}",
    "  }",
    "}",
  ].join('; ');

  try {
    const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      timeout: 8000,
      encoding: 'utf8',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  } catch (e) {
    console.warn('[Launcher] Failed to clean stale backends:', e.message);
  }
}

// ─── Find python (handles python / python3 / py) ─────────────────
function findPython() {
  for (const cmd of ['python', 'python3', 'py']) {
    try {
      const r = spawnSync(cmd, ['--version'], { timeout: 3000 });
      if (r.status === 0) { console.log('[Launcher] Python found:', cmd); return cmd; }
    } catch {}
  }
  return 'python';
}

// ─── Start Python backend ─────────────────────────────────────────
function startPython() {
  killStaleBackends();
  const env = {
    ...process.env,
    YOURNAME_LAUNCHER_ROOT: __dirname,
    YOURNAME_BRIDGE_JAR: app.isPackaged ? getBundledBridgeJarPath() : path.join(__dirname, 'PLauncher-main', 'src', 'bridge.jar'),
    PYTHONIOENCODING: 'utf-8',
  };

  if (app.isPackaged) {
    const backendExe = getBundledBackendExePath();
    console.log('[Launcher] Backend exe:', backendExe);
    pythonProcess = spawn(backendExe, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.resourcesPath,
      env,
    });
  } else {
    const scriptPath = getPythonScriptPath();
    const pythonCmd  = findPython();

    pythonProcess = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: os.tmpdir(),   // safe ASCII working dir
      env,
    });
  }

  pythonProcess.stdout.on('data', d => process.stdout.write('[Python] ' + d));
  pythonProcess.stderr.on('data', d => process.stderr.write('[PythonERR] ' + d));
  pythonProcess.on('close', code => console.log('[Python] exited:', code));
}

// ─── Wait for backend ─────────────────────────────────────────────
function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    const try_ = (n) => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/ping`, () => resolve());
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Backend not started'));
        setTimeout(() => try_(n - 1), 600);
      });
      req.end();
    };
    try_(retries);
  });
}

// ─── Create window ────────────────────────────────────────────────
async function createWindow() {
  startPython();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    icon: getAppIconPath(),
    frame: false,
    show: false,               // show only when ready — no white flash
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  // Show window as soon as HTML is rendered — don't wait for backend
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pythonProcess) pythonProcess.kill();
  });

  waitForBackend()
    .then(() => console.log('[Launcher] Backend ready'))
    .catch(e => console.warn('[Launcher] Backend unavailable:', e.message));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});

// ─── Window controls ──────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => {
  if (pythonProcess) pythonProcess.kill();
  mainWindow?.close();
});

ipcMain.handle('open-launcher-folder', async () => {
  const launcherDir = path.join(app.getPath('appData'), '.yourname-launcher');
  fs.mkdirSync(launcherDir, { recursive: true });
  return shell.openPath(launcherDir);
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') return '';
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  } catch {}
  return shell.openPath(targetPath);
});
