// Intentionally minimal: the app is a self-contained web app (Zustand + IndexedDB
// for persistence) and doesn't need Node/Electron APIs in the renderer today.
// contextIsolation + no nodeIntegration keeps the renderer sandboxed regardless.
