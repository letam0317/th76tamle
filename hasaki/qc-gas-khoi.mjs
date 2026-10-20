// qc-gas-khoi.mjs — kiểm «khói» SAU MỖI deploy Apps Script (20/10/2026, sau khi tách 13 tệp): vài lượt gọi nhẹ, CHỈ ĐỌC,
// chứng minh bản mới chạy được ở mọi tệp (ThietBi/MayTram/XacMinh/TaiKhoan/chính) và các cửa gác còn nguyên (401/403).
//   node qc-gas-khoi.mjs
import "dotenv/config";
import { gasPost } from "./session-rules.js";
const URL0 = process.env.APPSCRIPT_URL, KEY = process.env.APPSCRIPT_KEY;
if (!URL0 || !KEY) { console.log("thiếu APPSCRIPT_URL / APPSCRIPT_KEY trong .env"); process.exit(2); }
let loi = 0; const ok = (dk, ten, them) => { console.log((dk ? "  OK   " : "  FAIL ") + ten + (them ? " — " + String(them).slice(0, 160) : "")); if (!dk) loi++; };
const get = async (q) => { const r = await fetch(URL0 + "?" + q, { redirect: "follow", signal: AbortSignal.timeout(60e3) }); return r.text(); };
const post = (b, n) => gasPost(b, () => {}, n).catch((e) => ({ status: "error", message: String(e.message || e) }));

let j = await post({ action: "pcBang", key: KEY }, "pcBang"); ok(j && j.status === "success" && Array.isArray(j.bang || j.may), "MayTram: pcBang (khoá) → bảng máy", (j.bang || j.may || []).length + " máy");
/* 20/10 tai nạn pcJson_ trùng tên: nhịp ghi xong mà bảng không thấy máy → mọi nhịp bị xoá. Gửi nhịp THỬ, bảng phải có máy thử, rồi xoá. */
const MAY_THU = "QC-THU-GAS-" + new Date().toTimeString().slice(0, 5).replace(":", "");   // tên khác mỗi lượt; bản mới deploy cần ~10-20 s mới phục vụ → thử lại 3 lần
let thayMay = false, lanNhip = 0;
for (; lanNhip < 3 && !thayMay; lanNhip++) { if (lanNhip) await new Promise((r) => setTimeout(r, 10000)); j = await post({ action: "pcNhip", key: KEY, nhip: { may: MAY_THU, ramTrongPct: 50, cpuPct: 1, ban: "thu", dangChay: [], lan: lanNhip } }, "pcNhip"); thayMay = !!(j && j.status === "success" && (j.bang || []).some((m) => m.may === MAY_THU)); }
ok(thayMay, "MayTram: pcNhip thử → bảng thấy máy thử (PCNHIP_ ghi được, lần " + lanNhip + ")", j && (j.status + " · bảng " + (j.bang || []).map((m) => m.may).join(",") + " · goiBam " + (j.goiBam || "(trống)")));
await post({ action: "pcLenh", key: KEY, may: MAY_THU, xoa: true }, "pcLenh-xoa");
j = await post({ action: "pcBoCai" }, "pcBoCai"); ok(j && Number(j.code) === 401, "MayTram: pcBoCai không phiên → 401", j && (j.code + " " + j.message));
j = await post({ action: "pcBang", key: "sai-khoa" }, "pcBang-sai"); ok(j && j.status !== "success", "chính: khoá sai → từ chối", j && j.message);
j = await post({ action: "sucKhoeDuLieu", key: KEY }, "sucKhoeDuLieu"); ok(j && j.status === "success" && j.props && j.sheets, "chính: sucKhoeDuLieu (mới)", j && j.props ? `${j.props.so} khoá · ${(j.props.byte / 1024).toFixed(0)} KB/500 KB · ` + j.sheets.map((s) => s.ten + ":" + (s.o ? Math.round(s.o / 1000) + "k ô" : "lỗi " + s.loi)).join(" · ") : j && j.message);
j = await post({ action: "xm_ds", key: KEY }, "xm_ds"); ok(j && j.status === "success", "XacMinh: xm_ds (khoá)", j && (j.message || (j.ds ? Object.keys(j.ds).length + " tệp" : "")));
let t = await get("action=readTab&tab=CHAMCONG-VESINH&sheet=CHAMCONG-VESINH&callback=cb"); ok(/403|canKhoa/.test(t), "ReadTab: readTab không tb → 403", t.slice(0, 90));
t = await get("action=lastSync&callback=cb"); ok(/success/.test(t), "Form5S: lastSync GET", t.slice(0, 90));
t = await get("action=bridgeCaps&callback=cb"); ok(/bridgeToken/.test(t), "chính: bridgeCaps GET");
j = await post({ action: "tb_tra", tb: "mqcgiagia1" }, "tb_tra"); ok(j && (j.status === "success" || j.status === "error"), "ThietBi: tb_tra mã giả trả lời", j && (j.status + " " + (j.duyet !== undefined ? "duyet=" + j.duyet : j.message || "")));
j = await post({ action: "tk_toi", phien: "qc-phien-gia" }, "tk_toi"); ok(j && j.status !== undefined, "TaiKhoan: tk_toi phiên giả trả lời", j && (j.status + " " + (j.message || "")));
console.log(loi ? `\n${loi} HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
