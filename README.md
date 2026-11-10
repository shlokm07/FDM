# FDM - Fluent Download Manager

A fast, lightweight Windows 11 Fluent Download Manager powered by a native C# WebView2 desktop shell, a standalone Node.js multi-connection download daemon, a React + Tailwind CSS dashboard with bundled Inter typography, and an interactive Chrome & Edge browser extension.

---

## Features

### Desktop Application (`desktop-app/`)
- **Windows 11 Fluent Interface**: Clean Light (`#F8FAFC` / `#4F46E5`) and Dark (`#111827` / `#818CF8`) themes with locally bundled `Inter` variable typography and Lucide icons.
- **Balanced 3-Zone Download Cards**: Displays file type icon, filename, category, downloaded/total bytes, smooth progress bar, percentage, live speed, **smoothed ETA**, status pill, pause/resume/retry/open controls, and a `More` / right-click context menu.
- **Collapsible Sidebar & Network Monitor**: Navigation views (`Dashboard`, `All Downloads`, `Downloading`, `Queued`, `Completed`, `Failed`, `Categories`, `Settings`), collapsible icon-rail mode, and a collapsible bottom network monitor with a live 60-second throughput graph and active TCP socket slice visualization.
- **Multi-Connection Segmented Engine**: Parallel HTTP Range workers (`4–32` threads), dynamic chunk splitting, token-bucket global speed limiting, HLS `.m3u8` AES-128 stream downloading, and crash-safe `.idm-state.json` resume journaling (with DPAPI cookie encryption on Windows).
- **Persistent Library & Local Sync**: Persists download history in `%LOCALAPPDATA%\REA-IDM\history.json` and scans your downloads directory on startup.

### Chrome & Edge Extension (`chrome-extension/`)
- **Interactive 3-Tab Companion Popup**:
  - **Page Media**: Lists network-sniffed video/audio streams and DOM downloadable links on the active tab with category filters and 1-click download/copy actions.
  - **Downloads**: Live download progress, pause/resume/cancel, and folder quick-open directly inside the browser popup.
  - **Quick Add & Rules**: Paste URLs with thread selection (`4–32`), toggle download interception, floating video bar visibility, and minimum file-size filtering.
- **On-Demand Floating Video Bar & Batch Grabber**: Non-intrusive floating pill on playing/hovered HTML5 `<video>` players (never auto-downloads when watching) plus an in-page **Grab All Media & Links** modal via right-click context menu.
- **Dual Bridge**: Connects directly via local HTTP (`127.0.0.1:8765`) and falls back to Chrome/Edge Native Messaging (`com.rea.idm`) to wake the desktop app automatically.

### Installer & Uninstaller
- **`REA-IDM-Setup.exe`**: 2-step native setup wizard featuring a required **User Agreement & Terms of Use** acceptance screen (`TERMS_OF_USE.txt`), custom destination folder picker, Desktop/Start Menu shortcuts, Windows Installed Apps registration, and optional Chrome/Edge extension onboarding.
- **`Uninstall.exe`**: Clean Windows uninstaller accessible from Windows Settings (`Installed Apps`), Start Menu (`Uninstall FDM`), or the install folder—stops running processes, cleans shortcuts & registry hooks, optionally removes app cache, and leaves downloaded user files untouched.

---

## Project Structure

```text
FDM/
├── TERMS_OF_USE.txt                  # End-User License Agreement & Terms of Use
├── chrome-extension/                 # Manifest V3 Chrome & Edge Extension
│   ├── manifest.json
│   ├── background/service-worker.js
│   ├── content/
│   ├── popup/
│   └── icons/
└── desktop-app/
    ├── package.json                  # React 18, Tailwind CSS 4, Vite 5, Lucide, Inter
    ├── vite.config.ts
    ├── tsconfig.ui.json
    ├── assets/app.ico                # Multi-resolution Windows app icon
    ├── scripts/build-exe.mjs         # Bundles UI + Node.js SEA core binary
    └── src/
        ├── main.ts                   # Daemon / Native Messaging Host entry point
        ├── engine/                   # Probe, SegmentWorker, DownloadManager, Limiter, Journal
        ├── server/                   # QueueManager, DaemonServer, HlsStreamDownloader
        ├── native/
        │   ├── REA-IDM.cs            # C# WinForms + Edge WebView2 host & System Tray
        │   ├── Setup.cs              # 2-step EULA & Destination Installer
        │   └── Uninstall.cs          # Native Windows Uninstaller
        └── ui/                       # React + TypeScript + Tailwind Fluent Dashboard
```

---

## Building from Source (Windows)

### Prerequisites
- Node.js `v22+`
- `.NET Framework 4` C# compiler (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`)
- Microsoft Edge WebView2 SDK assemblies (`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`, `WebView2Loader.dll`) placed in `desktop-app/bin/`

### 1. Install Frontend Dependencies & Build UI
```powershell
cd desktop-app
npm install
npm run build:ui
npx tsc -p tsconfig.ui.json
```

### 2. Build Standalone Core Daemon (`rea-idm-core.exe`)
From the parent workspace directory:
```powershell
node desktop-app/scripts/build-exe.mjs
```

### 3. Compile Native Windows Executables
```powershell
cd desktop-app
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /platform:x64 /target:winexe /win32icon:assets\app.ico /out:bin\REA-IDM.exe /reference:System.Windows.Forms.dll,System.Drawing.dll,System.dll,System.Web.Extensions.dll,bin\Microsoft.Web.WebView2.Core.dll,bin\Microsoft.Web.WebView2.WinForms.dll src\native\REA-IDM.cs
& $csc /target:winexe /win32icon:assets\app.ico /out:bin\Uninstall.exe /reference:System.Windows.Forms.dll,System.Drawing.dll,System.dll src\native\Uninstall.cs
& $csc /target:winexe /win32icon:assets\app.ico /out:..\REA-IDM-Setup.exe /reference:System.Windows.Forms.dll,System.Drawing.dll,System.dll,Microsoft.CSharp.dll src\native\Setup.cs
```

---

## Privacy & Terms

**FDM - Fluent Download Manager** runs locally on `127.0.0.1:8765`, sends zero telemetry to external servers, and is governed by [`TERMS_OF_USE.txt`](TERMS_OF_USE.txt).
