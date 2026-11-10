# REA-IDM: Ultra-Lightweight Internet Download Manager

A high-performance, standalone Windows alternative to Internet Download Manager (IDM), engineered for maximum download speeds with minimum system resource consumption (< 25-35 MB RAM).

---

## 📦 What is in this Folder

```
REA-IDM/
│
├── REA-IDM-Setup.exe              # 1-Click Native Windows Installer (.exe)
│
├── chrome-extension/              # Bundled Chrome & Edge Extension (Manifest V3)
│   ├── manifest.json
│   ├── background/service-worker.js
│   ├── content/sniffer.js         # Floating Video/Media Sniffer Bar (IDM style)
│   ├── content/sniffer.css
│   ├── popup/                     # Real-time Status, Speed & Interception Control
│   └── icons/
│
└── desktop-app/                   # Full Standalone Desktop Application Package
    ├── bin/
    │   ├── REA-IDM.exe            # Dedicated Native Desktop Application Window (NOT browser-based)
    │   ├── rea-idm-core.exe       # High-Speed Engine & Multi-Connection Daemon
    │   ├── ui/                    # Embedded Real-time Dashboard Static Assets
    │   └── extension/             # Packaged Extension for installation
    └── src/                       # TypeScript and Native C# Source Code
```

---

## 🚀 1. How to Install and Run (`REA-IDM-Setup.exe`)

Just like any standard Windows software:
1. Double-click **`REA-IDM-Setup.exe`**.
2. The installation wizard will:
   - Extract and install the application into `%LOCALAPPDATA%\Programs\REA-IDM`.
   - Create **Desktop** and **Start Menu** shortcuts.
   - Configure Chrome & Edge Native Messaging Host integration in the Windows Registry.
   - Ask if you want to add the **REA-IDM Chrome Extension** to your browser (`Yes / No`).
   - Launch **REA-IDM** in its own dedicated, standalone native desktop window!

---

## 🖥️ 2. Non-Browser Native Desktop Interface

Unlike web-only downloaders, REA-IDM runs in a **dedicated native Windows Form window**:
* **Standalone Window**: Real Windows title bar, minimize, maximize, and taskbar entry. **Never opens external browser tabs.**
* **System Tray Minimization**: Closing or minimizing sends REA-IDM to the Windows System Tray with a right-click menu:
  - *Open REA-IDM*
  - *Add URL*
  - *Pause All / Resume All*
  - *Speed Limiter*
  - *Exit*
* **Active Dynamic Slices Visualizer**: Displays active parallel socket connections and their live byte slices filling in real time.

---

## 🎥 3. Video & Media Sniffer (YouTube / Streaming / HTML5)

* **No Automatic Unwanted Downloads**: Simply watching or playing videos does **NOT** trigger background downloads automatically.
* **On-Demand Floating Download Bar**:
  - When watching a video on YouTube, Vimeo, Twitch, or any website, a sleek floating button appears at the top-right of the player:
    `[ ↓ Download This Video ]`
  - Hovering/clicking allows you to choose:
    - *📹 Best Quality (1080p/Auto)*
    - *🎵 Audio Only (MP3/AAC)*
    - *⚡ Direct Stream Link*
  - Clicking a quality sends the download to REA-IDM and starts multi-connection acceleration!

---

## ⚡ 4. Technical Architecture
* **Multi-Connection Segmented Acceleration**: Spawns 4 to 32 parallel TCP sockets using HTTP Range requests (`Range: bytes=start-end`).
* **Dynamic Connection Slicing**: Dynamically splits lagging segments in half to eliminate tail latency.
* **Direct NTFS Offset Streaming**: Streams bytes directly into their exact byte positions in the pre-allocated file with **zero reassembly delay**.
* **Zero-CPU Event-Driven Clipboard Sniffer**: Leverages Windows `AddClipboardFormatListener` to detect download URLs without CPU polling.
* **Crash Recovery & State Journaling**: Automatically saves `.idm-state.json` with DPAPI encryption for seamless pause/resume.
