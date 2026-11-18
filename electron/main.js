const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// One window. Web security is relaxed because this is a local player app: it needs to talk to
// whatever server address the user types in (http or https) without browser cross-site limits.
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 900, minHeight: 560,
    backgroundColor: '#1b3fd0', title: 'Clearview', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { webSecurity: false, autoplayPolicy: 'no-user-gesture-required', contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
Menu.setApplicationMenu(null);
const one = app.requestSingleInstanceLock();
if (!one) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
