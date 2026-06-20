<div align="center">

<img src="public/favicon.svg" alt="The Frame" width="72" height="72" />

# The Frame

**A living picture frame for the warmth of your home.**

*Fill it from your phone. Never miss a birthday. Watch your memories drift by.*

<br />

![React](https://img.shields.io/badge/React-18-51b3c9?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-tsx-444?style=flat-square&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-calendar-003b57?style=flat-square&logo=sqlite&logoColor=white)
![ESPHome](https://img.shields.io/badge/ESPHome-e--ink-000?style=flat-square&logo=esphome&logoColor=white)

</div>

---

The Frame turns an ordinary wooden picture frame into the quiet heart of your home. It gently
cycles through your favourite photos and remembers every birthday and anniversary — so you
never miss the moments that matter. Adding a memory or a date is effortless: scan the little
code beside the frame and you're in, straight from your phone. **No apps to install, nothing
to fuss over.**

## ✨ Highlights

- 📷 **A gallery you curate from the couch** — upload, crop, and reorder photos right from your phone.
- 🎂 **Birthdays it never forgets** — a warm, minimal calendar for the dates that matter.
- 📱 **Scan-and-go** — a printed QR beside the frame opens everything in your browser. Zero installs.
- 🪵 **Made for the wall** — a soft, sunlit-linen interface designed to feel at home, not like a gadget.
- 🌙 **Sips power** — the e-ink display refreshes hourly by day and rests overnight, so a charge lasts and lasts.
- 🌍 **Speaks your language** — Polish-first, English on tap.

## 🌙 A gentle daily rhythm

The e-ink display refreshes once an hour through the day, then rests quietly overnight — its
last change is at **23:00** and it wakes again at **07:00**. No needless wake-ups while you
sleep, so a single charge stretches as far as it can.

## 🚀 Getting started

```bash
npm install      # also wires up the pre-commit hook
npm run dev      # http://localhost:7375  (or http://<lan-ip>:7375 from your phone)
```

<details>
<summary>More commands &amp; configuration</summary>

```bash
npm run verify   # lint + typecheck + test + build — the pre-commit gate
npm run build    # production bundle → dist/
npm run qr       # print-ready LAN QR → public/frame-qr.{png,svg,html}
                 # host is explicit: FRAME_LAN_HOST=192.168.1.50 npm run qr
```

Run it for real with **pm2** (single app `the-frame` on `:7375`):

```bash
pm2 start ecosystem.config.cjs
```

Configuration lives in `.env` (copy from `.env.example`): `PORT`, `FRAME_GALLERY_DIR`,
`FRAME_CALENDAR_DB`, `FRAME_LAN_HOST`.

</details>

---

<div align="center">
<sub>Built with care to live on a wall, not in a drawer.</sub>
</div>
