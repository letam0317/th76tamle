// qc-dong-bo-thanh-phan.mjs — MÁY KIỂM «cùng việc = cùng nhãn, cùng thành phần» (21/10/2026, user «luật có máy kiểm chưa? t rất quan tâm»).
// Đánh giá 20/10 mục 4.3: cùng một ý vẽ 4 kiểu (liên kết gạch chấm / chip / nút xanh / chip sức khoẻ), «Quyết định» · «Mở để quyết» · «Chưa xử lý ↗»,
// chip viết hoa không thống nhất, Máy trạm thiếu tên việc. Bộ này đọc MÃ (không cần trình duyệt, <1 s) — chạy trong QC đêm và trước khi đẩy.
//   node qc-dong-bo-thanh-phan.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)), KS = path.join(DIR, "kiemsoatkho");
const doc = (f) => fs.readFileSync(path.join(KS, f), "utf8");
const maJS = (s) => s.split(/\r?\n/).filter((l) => !/^\s*(\.|#|@media|\/\*|\*|"\.|"#)/.test(l)).join("\n");   // bỏ dòng CSS/chú thích, chỉ đo mã dựng HTML
let loi = 0; const ok = (dk, ten, them) => { console.log((dk ? "  OK   " : "  FAIL ") + ten + (them ? " — " + them : "")); if (!dk) loi++; };
const idx = doc("index.html"), xm = doc("hasaki-xacminh.js"), mt = doc("hasaki-maytram.js");
const idxJS = maJS(idx), xmJS = maJS(xm);

/* 1. Nhãn hành động «quyết» — chỉ MỘT tên: «Quyết định» (nút chính); không còn «Mở để quyết» */
ok(!/Mở để quyết/.test(xmJS) && !/Mở để quyết/.test(idxJS), "nhãn quyết định: không còn «Mở để quyết»");
/* 2. Mở phiếu work.hasaki — một nhãn «Mở task ↗» ở Vi phạm, thanh bên, Theo máy */
const moTask = [...idxJS.matchAll(/>Mở( task)?( ↗)?<\/a>/g)].map((m) => m[0]);
ok(moTask.length && moTask.every((t) => t === ">Mở task ↗</a>"), "liên kết mở phiếu: chỉ «Mở task ↗»", moTask.join(" "));
/* 3. Trạng thái Vi phạm = chip chuẩn .hsk-chip; không còn liên kết gạch chấm/badge riêng trong mã dựng */
ok(/class="hsk-chip \$\{STT_CHIP/.test(idxJS) && !/class="status-link"/.test(idxJS) && !/class="badge badge-link"/.test(idxJS), "Vi phạm: trạng thái là .hsk-chip, không còn .status-link/.badge-link");
/* 4. Độ chắc của máy: 3 nhãn ngắn, viết hoa đầu, không «Máy chắc chắn» / «cần bạn xem» */
const muc = /var MUC_MAY = \{([^\n]*)\}/.exec(xm); const nhanMuc = muc ? [...muc[1].matchAll(/\["([^"]+)"/g)].map((m) => m[1]) : [];
ok(nhanMuc.includes("Máy chắc") && nhanMuc.includes("Cần bạn xem") && nhanMuc.every((n) => /^[A-ZÀ-Ỹ]/.test(n)) && !nhanMuc.includes("Máy chắc chắn"), "Xác minh: nhãn độ chắc ngắn, cùng kiểu viết hoa", nhanMuc.join(" · "));
/* 5. Máy trạm: mọi việc trong cai-pc/dieu-phoi.json có tên tiếng Việt (không lộ mã kỹ thuật) */
const ten = /var TEN_VIEC = \{([\s\S]*?)\};/.exec(mt); const keys = ten ? [...ten[1].matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]) : [];
const dp = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8")); const viec = (dp.viec || []).map((v) => v.ten);
const thieu = viec.filter((v) => !keys.includes(v));
ok(viec.length > 0 && !thieu.length, "Máy trạm: " + viec.length + "/" + viec.length + " việc có tên tiếng Việt", thieu.length ? "thiếu: " + thieu.join(", ") : "");
/* 6. Thanh bên: số chỉ ở mục cần người làm (tong/maytram/hangmuc không số; Nhật ký không số) */
ok(/KHONG_SO=\{ tong:1, maytram:1, hangmuc:1 \}/.test(idx) && /x\.k === "tg" \? "" :/.test(idx), "thanh bên: số chỉ ở Vi phạm / Theo tác vụ / Theo máy");
/* 7. Nút «+ Biên bản» không thường trực: web chỉ hiện khi rê chuột, phiếu huỷ/khoá không có nút */
ok(/#pane-task tbody \.c-bb \.bb-up\{opacity:0/.test(idx) && !/btn-disabled" disabled title="Task đã huỷ/.test(idxJS), "Vi phạm: nút biên bản chỉ hiện khi cần");
/* 8. Thành phần chung có mặt và được nạp trước mô-đun */
ok(fs.existsSync(path.join(KS, "thanh-phan.css")) && /href="thanh-phan\.css/.test(idx) && /src="tien-ich\.js/.test(idx), "thanh-phan.css + tien-ich.js được nạp ở index.html");
/* 9. Tệp mới không tự vẽ chip ngoài họ chuẩn (hsk-chip / hx-tag / mb-tag / hm-xl) trong mã dựng HTML của index.html */
const hoChip = new Set([...idxJS.matchAll(/class="([a-z0-9-]*(?:tag|chip|pill)[a-z0-9-]*)/g)].map((m) => m[1]));
/* họ cũ còn tồn 21/10 (răng cưa — KHÔNG thêm họ mới, chuyển dần sang hsk-chip): kpi-pill (Tổng kết), vp-tag (pop-up Vi phạm), chip (thanh lọc) */
const la = [...hoChip].filter((c) => !/^(hsk-chip|hx-tag|mb-tag|hm-xl|tag|kpi-pill|vp-tag|chip)$/.test(c));
ok(!la.length, "index.html: chip chỉ thuộc họ chuẩn (+3 họ cũ chờ chuyển)", la.length ? "lạ: " + la.join(", ") : [...hoChip].join(", "));
console.log(loi ? `\n${loi} HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
