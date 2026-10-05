/* 05/10/2026 — chấm công + sổ cổng 1 ngày ở kho 170 (location 398) → lọc người RA trong khoảng giờ. Đọc, không ghi.
 * node _cc-ngay.mjs <YYYY-MM-DD> <HH:mm từ> <HH:mm đến> */
import { layTokenSongWork } from "./session-rules.js";
const [NGAY, TU, DEN] = process.argv.slice(2);
const token = await layTokenSongWork(process.cwd(), () => {});
const H = { authorization: token, accept: "application/json", origin: "https://hr.hasaki.vn", referer: "https://hr.hasaki.vn/" };
const ms = (v) => (!v ? null : typeof v === "number" ? v * 1000 : Date.parse(v));
const a = Date.parse(NGAY + "T" + TU + ":00+07:00"), b = Date.parse(NGAY + "T" + DEN + ":00+07:00");
const gio = (t) => new Date(t + 7 * 36e5).toISOString().slice(11, 16);
const rows = []; for (let off = 0; off < 3000; off += 500) { const j = await (await fetch(`https://wshr.hasaki.vn/api/hr/timesheet?location_id=398&from_date=${NGAY}&to_date=${NGAY}&limit=500&offset=${off}`, { headers: H })).json(); const r = j.data?.rows || []; rows.push(...r); if (r.length < 500) break; }
console.log("chấm công:", rows.length);
for (const x of rows) { const ra = ms(x.check_out); if (ra && ra >= a && ra <= b) console.log("RA", gio(ra), "vào", x.check_in ? gio(ms(x.check_in)) : "-", x.staff?.code, x.staff?.staff_name, "·", x.staff?.department?.name || x.department?.name || "", x.staff?.major?.name || x.major?.name || ""); }
