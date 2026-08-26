# Filaments Bridge

Local bridge for Bambu Lab LAN printers. It keeps the printer on the private LAN while Filaments Manager can display live status and queue controls remotely.

## Requirements

- Node.js 20+
- The computer/Raspberry Pi running the bridge must stay on the same LAN as the Bambu printer.
- Bambu LAN/Developer access enabled so MQTT TLS on port 8883 is available.

## Install

```bash
cd bridge
npm install
npm start
```

Expected output:

```text
Filaments Bridge listening on http://127.0.0.1:18473
```

Then open Filaments Manager on the same computer, go to Printers, choose **ربط Bambu LAN**, enter the printer IP, serial number and LAN access code, then press **حفظ وربط**.

The bridge stores the Bambu access code and the Filaments session locally in:

```text
~/.filaments-bridge/config.json
```

The file is created with owner-only permissions where supported.

## Current remote controls

- Live online/offline state
- Nozzle temperature and target
- Bed temperature and target
- Chamber temperature when reported by the printer
- Print progress
- Remaining print time
- Current job/file
- Pause
- Resume
- Stop
- Standard speed preset

## Camera

The control UI already contains the camera area. Camera relay is the next bridge component: A1/P1 families use the local TLS JPEG stream on port 6000; X1/H2 families can use the local RTSPS stream on port 322 when enabled.
