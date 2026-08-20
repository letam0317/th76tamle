/**
 * ld-wms.mjs — BỘ LÁI máy ảo LDPlayer (app "Hasaki WMS", package com.fulfillment_app) qua ADB.
 * Dùng để tự động các thao tác LẶP LẠI trên app (kiểm kê checklist SKU…) thay vì gõ tay.
 *
 *  CÀI ĐẶT MỘT LẦN (đã làm 20/08/2026): LDPlayer mặc định TẮT ADB
 *  (`vms/config/leidian0.config` → `"basicSettings.adbDebug": 0`) nên `adb connect` bị chối cổng.
 *  Bật: dừng máy ảo (`ldconsole quit --index 0`) → sửa khoá đó thành 1 → `ldconsole launch --index 0`
 *  → `adb connect 127.0.0.1:5555`. Sửa khi máy ảo ĐANG chạy thì lúc thoát nó ghi đè lại config.
 *
 *  BẪY GIT BASH: đối số kiểu `/sdcard/ui.xml` bị MSYS đổi thành `C:/Program Files/Git/sdcard/…`
 *  → luôn đặt MSYS_NO_PATHCONV=1 (đã set sẵn trong tệp này khi gọi adb).
 *
 *  Lệnh:
 *    node ld-wms.mjs anh [tệp.png]          — chụp màn hình
 *    node ld-wms.mjs doc                    — liệt kê mọi phần tử có chữ (kèm toạ độ)
 *    node ld-wms.mjs bam "<chữ>"            — bấm vào phần tử chứa chữ đó
 *    node ld-wms.mjs bamxy <x> <y>
 *    node ld-wms.mjs go "<nội dung>"        — gõ vào ô đang focus
 *    node ld-wms.mjs xoa [n]                — xoá n ký tự trong ô đang focus (mặc định 30)
 *    node ld-wms.mjs phim <BACK|ENTER|…>
 *    node ld-wms.mjs keo <x1> <y1> <x2> <y2> [ms]
 *    node ld-wms.mjs cho "<chữ>" [giây]     — chờ tới khi chữ xuất hiện
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADB = process.env.LD_ADB || "D:/LDPlayer/LDPlayer9/adb.exe";
export const DEV = process.env.LD_DEV || "127.0.0.1:5555";
const MOI = { ...process.env, MSYS_NO_PATHCONV: "1" };

export function adb(args, opt = {}) {
  return execFileSync(ADB, ["-s", DEV, ...args], { env: MOI, maxBuffer: 64 * 1024 * 1024, ...opt });
}
export function shell(cmd) { return adb(["exec-out", ...cmd.split(" ")], { encoding: "utf8" }); }

/** Chụp màn hình ra tệp PNG (exec-out để không bị \r\n phá nhị phân). */
export function anh(tep = "man-hinh.png") {
  const buf = adb(["exec-out", "screencap", "-p"]);
  fs.mkdirSync(path.dirname(path.resolve(tep)), { recursive: true });
  fs.writeFileSync(tep, buf);
  return { tep, byte: buf.length };
}

/** Đọc cây UI → mảng phần tử {chu, id, lop, mota, x, y, o:[x1,y1,x2,y2], bamduoc, oNhap}. */
export function doc() {
  adb(["shell", "uiautomator", "dump", "/sdcard/ui.xml"], { encoding: "utf8" });
  const xml = adb(["exec-out", "cat", "/sdcard/ui.xml"], { encoding: "utf8" });
  const ra = [];
  for (const m of xml.matchAll(/<node\b([^>]*)>/g)) {
    const a = m[1];
    const lay = (k) => { const r = a.match(new RegExp(k + '="([^"]*)"')); return r ? r[1] : ""; };
    const b = lay("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const o = [+b[1], +b[2], +b[3], +b[4]];
    ra.push({
      chu: giaiMa(lay("text")), id: lay("resource-id"), lop: lay("class"), mota: giaiMa(lay("content-desc")),
      o, x: Math.round((o[0] + o[2]) / 2), y: Math.round((o[1] + o[3]) / 2),
      bamduoc: lay("clickable") === "true", oNhap: /EditText/.test(lay("class")),
    });
  }
  return ra;
}
function giaiMa(s) { return String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'); }

/** Tìm phần tử: khớp CHÍNH XÁC trước, không có thì khớp CHỨA; xét cả text và content-desc và resource-id. */
export function tim(sel, ds = doc()) {
  const s = String(sel).toLowerCase();
  const co = (n) => [n.chu, n.mota, n.id].filter(Boolean).map((t) => t.toLowerCase());
  return ds.find((n) => co(n).some((t) => t === s)) || ds.find((n) => co(n).some((t) => t.includes(s))) || null;
}
/** Bấm — mặc định leo lên phần tử cha bấm được nếu chính nó không clickable (RN hay để text trơ). */
export function bam(sel, ds = doc()) {
  const n = tim(sel, ds);
  if (!n) throw new Error('Không thấy phần tử "' + sel + '" trên màn hình');
  adb(["shell", "input", "tap", String(n.x), String(n.y)]);
  return n;
}
export function bamXY(x, y) { adb(["shell", "input", "tap", String(x), String(y)]); }
export function go(text) { adb(["shell", "input", "text", String(text).replace(/ /g, "%s")]); }
export function xoa(n = 30) { for (let i = 0; i < n; i++) adb(["shell", "input", "keyevent", "67"]); }
export function phim(k) { adb(["shell", "input", "keyevent", /^\d+$/.test(k) ? k : "KEYCODE_" + String(k).toUpperCase()]); }
export function keo(x1, y1, x2, y2, ms = 300) { adb(["shell", "input", "swipe", x1, y1, x2, y2, ms].map(String)); }
export const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chờ tới khi thấy chữ (poll 1s). Trả phần tử hoặc null khi hết giờ. */
export async function cho(sel, giay = 20) {
  for (let i = 0; i < giay; i++) {
    const n = tim(sel);
    if (n) return n;
    await nghi(1000);
  }
  return null;
}
/** Màn hình đang là gì — in gọn mọi chữ để lần đường. */
export function motA() { return doc().filter((n) => n.chu || n.mota).map((n) => (n.chu || n.mota) + " @" + n.x + "," + n.y + (n.oNhap ? " [ô nhập]" : "")); }

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [, , lenh, ...t] = process.argv;
  try {
    if (lenh === "anh") console.log(JSON.stringify(anh(t[0] || "man-hinh.png")));
    else if (lenh === "doc") console.log(motA().join("\n"));
    else if (lenh === "bam") console.log("đã bấm: " + JSON.stringify(bam(t.join(" "))));
    else if (lenh === "bamxy") bamXY(t[0], t[1]);
    else if (lenh === "go") go(t.join(" "));
    else if (lenh === "xoa") xoa(Number(t[0] || 30));
    else if (lenh === "phim") phim(t[0]);
    else if (lenh === "keo") keo(...t);
    else if (lenh === "cho") console.log(JSON.stringify(await cho(t[0], Number(t[1] || 20))));
    else console.log("lệnh: anh | doc | bam | bamxy | go | xoa | phim | keo | cho");
  } catch (e) { console.error("✗ " + e.message); process.exit(1); }
}
