/**
 * qc-chia-clip.mjs — QC CHIA VIỆC CẮT CLIP 2 MÁY TRẠM (23/10/2026). KHÔNG ghi dữ liệu thật, KHÔNG gọi đầu ghi camera.
 *  A. Chia phần: tim-bang-chung-b1 --thu --phan=1/2 và 2/2 → tập phiếu RỜI NHAU, HỢP LẠI = bản 1/1 (không phiếu nào bị bỏ / làm 2 lần).
 *  B. dai-lui chia phần cùng luật (đọc mã nguồn: cuaToi trong bộ lọc việc).
 *  C. Khoá máy: khoá đang giữ bởi tiến trình SỐNG → phần sau chờ rồi bỏ lượt; khoá của tiến trình đã chết → chạy luôn (không kẹt mãi).
 *  D. Bộ đối soát kiem-chia-clip.mjs trên dữ liệu GIẢ (thư mục tạm) — từng kịch bản K1…K9 phải bắt đúng mã, và K1 sạch không báo nhầm.
 *  E. Cấu hình: dieu-phoi phần 1/2 ghim chéo, khoaChung:false; dong-bo-xm gộp 3 chiều bang-chung-b1 + b1-cho-camera; XML phần 2 lệch 1 giờ.
 */
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync, spawn } from "node:child_process"; import { fileURLToPath } from "node:url";
import { ghiJson } from "./so-ghi.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
let dat = 0, hong = 0; const ok = (d, ten, them = "") => { d ? dat++ : hong++; console.log((d ? "ĐẠT " : "HỎNG") + "  " + ten + (them ? " — " + them : "")); };
const chay = (args, env = {}) => { try { return execFileSync(process.execPath, args, { cwd: DIR, encoding: "utf8", env: { ...process.env, ...env }, timeout: 300000, windowsHide: true }); } catch (e) { return String(e.stdout || "") + String(e.stderr || "") + "\n[exit " + e.status + "]"; } };
const idsTu = (out) => new Set([...out.matchAll(/(?:▶ |\(thử\) )(\d{7,9})\b/g)].map((m) => m[1]));

/* ---- A ---- */
const ca = chay(["tim-bang-chung-b1.mjs", "--thu", "--phan=1/1", "--max=999"]), p1 = chay(["tim-bang-chung-b1.mjs", "--thu", "--phan=1/2", "--max=999"]), p2 = chay(["tim-bang-chung-b1.mjs", "--thu", "--phan=2/2", "--max=999"]);
const sC = idsTu(ca), s1 = idsTu(p1), s2 = idsTu(p2);
ok(sC.size > 0, "A0 bản 1/1 có việc để chia", sC.size + " phiếu");
ok([...s1].every((id) => !s2.has(id)), "A1 hai phần RỜI NHAU (không phiếu nào làm 2 lần)", `phần 1: ${s1.size} · phần 2: ${s2.size}`);
ok(sC.size === s1.size + s2.size && [...sC].every((id) => s1.has(id) || s2.has(id)), "A2 HỢP hai phần = bản 1/1 (không phiếu nào bị bỏ)");
ok([...s1].every((id) => Number(id) % 2 === 0) && [...s2].every((id) => Number(id) % 2 === 1), "A3 phần 1 = mã chẵn, phần 2 = mã lẻ");
ok(/\[phần 1\/2\]/.test(p1) && /\[phần 2\/2\]/.test(p2), "A4 nhật ký ghi rõ phần");

/* ---- B ---- */
const dl = fs.readFileSync("dai-lui-thoi-gian-b1.mjs", "utf8");
ok(/filter\(\(\[id, e\]\) => cuaToi\(id\)/.test(dl) && /process\.env\.XM_PHAN/.test(dl), "B1 dai-lui lọc phiếu theo cùng phần (XM_PHAN)");

/* ---- C ---- khoá máy (--id=0: không có phiếu nào ⇒ không cắt, không ghi sổ thật) */
const F_KHOA = path.join(DIR, ".exports", ".tim-bang-chung.lock"); let khoaCu = null; try { khoaCu = fs.readFileSync(F_KHOA, "utf8"); } catch { /* */ }
if (khoaCu) { ok(false, "C0 đang có khoá thật trên máy này — bỏ ca C (không đụng)"); } else {
  const ngu = spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], { stdio: "ignore", windowsHide: true });
  ghiJson(F_KHOA, { pid: ngu.pid, luc: Date.now(), phan: "1/2" }, { thut: 0, ai: "qc-chia-clip" });
  const t0 = Date.now(), o1 = chay(["tim-bang-chung-b1.mjs", "--phan=2/2", "--id=0"], { TBC_CHO_PHUT: "0.08" });
  ok(/bỏ lượt/.test(o1) && Date.now() - t0 >= 4000, "C1 khoá của tiến trình SỐNG → phần sau chờ rồi bỏ lượt", Math.round((Date.now() - t0) / 1000) + " s");
  ok(JSON.parse(fs.readFileSync(F_KHOA, "utf8")).pid === ngu.pid, "C2 bỏ lượt KHÔNG xoá khoá của người khác");
  ngu.kill(); await new Promise((r) => setTimeout(r, 800));
  const o2 = chay(["tim-bang-chung-b1.mjs", "--phan=2/2", "--id=0"], { TBC_CHO_PHUT: "0.08" });
  ok(!/bỏ lượt/.test(o2) && /\[phần 2\/2\]/.test(o2), "C3 khoá của tiến trình ĐÃ CHẾT → chạy luôn (không kẹt)");
  ok(!fs.existsSync(F_KHOA), "C4 chạy xong tự nhả khoá");
  try { fs.unlinkSync(F_KHOA); } catch { /* */ }
}

/* ---- D ---- kiem-chia-clip trên dữ liệu giả */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "qc-chia-clip-")), BC = path.join(T, "bc"), MAYD = path.join(BC, "may");
for (const d of [path.join(T, "cai-pc"), path.join(T, ".exports", "kenh-luc-chup"), MAYD, path.join(BC, "bai-xe")]) fs.mkdirSync(d, { recursive: true });
for (const f of ["kiem-chia-clip.mjs", "so-ghi.mjs"]) fs.copyFileSync(f, path.join(T, f));
fs.copyFileSync("cai-pc/dieu-phoi.json", path.join(T, "cai-pc", "dieu-phoi.json"));
const iso = (msLui) => new Date(Date.now() - msLui).toISOString(), vn = (msLui) => new Date(Date.now() - msLui + 7 * 36e5).toISOString().slice(0, 19).replace("T", " ");
const PHAT = Date.now() - 3 * 36e5;
const dau = (may, phan, msLui) => `${may} · phần ${phan} · ${iso(msLui)}`;
const clip = (ten, msLui) => { const f = path.join(MAYD, ten); fs.writeFileSync(f, Buffer.alloc(60e3)); const t = new Date(Date.now() - msLui); fs.utimesSync(f, t, t); };
/* phiếu chẵn = phần 1 (JE), lẻ = phần 2 (FOQ) */
const so = {}, kq = {}, CW = {}, ghi = (f, o) => ghiJson(path.join(T, f), o, { thut: 0, ai: "qc-chia-clip" });
const mkPhieu = (id, lanKho, extra = {}) => { const bin = "F0-A1-501-0" + (id % 9) + "-01-01", ngay = vn(30 * 36e5);
  so[id] = { anh: ["x.jpg"], luc: ngay, taiLuc: iso(10 * 36e5), lanKho, ...extra }; kq[id] = { bin, ngay, luc: iso(10 * 36e5) };
  CW[bin + "|" + ngay] = { rec: lanKho.filter((e) => !e.chieu).map((e) => ({ at: e.at })), ra: [] }; fs.writeFileSync(path.join(T, ".exports", "kenh-luc-chup", id + ".json"), "{}"); };
// K1 sạch: phiếu 100 (phần 1) clip đúng máy JE, có tệp
clip("100_LAN-a_ch1.mp4", 2 * 36e5); mkPhieu(100, [{ at: vn(40 * 36e5), clip: "100_LAN-a_ch1.mp4", may: dau("DESKTOP-JE75K38", "1/2", 2 * 36e5) }]);
// K2 trễ: phiếu 102 có lượt chưa clip, dữ liệu 10 giờ
mkPhieu(102, [{ at: vn(41 * 36e5) }]);
// K3a bản cũ: phiếu 104 clip tạo SAU phát hành, không dấu
clip("104_LAN-b_ch1.mp4", 1 * 36e5); mkPhieu(104, [{ at: vn(42 * 36e5), clip: "104_LAN-b_ch1.mp4" }]);
// K3b lệch phần: phiếu 106 (phần 1) mà dấu phần 2/2
clip("106_LAN-c_ch1.mp4", 1 * 36e5); mkPhieu(106, [{ at: vn(43 * 36e5), clip: "106_LAN-c_ch1.mp4", may: dau("DESKTOP-FOQ5T89", "2/2", 1 * 36e5) }]);
// K4 hỏng 3 lần
mkPhieu(108, [{ at: vn(44 * 36e5), hong: 3 }]);
// K5 clip chưa về (không có tệp, dấu 2 giờ trước)
mkPhieu(110, [{ at: vn(45 * 36e5), clip: "110_LAN-d_ch1.mp4", may: dau("DESKTOP-JE75K38", "1/2", 2 * 36e5) }]);
// K7 trùng: phiếu 113 cùng lượt 2 tệp (2 mục cùng at)
clip("113_LAN-e_ch1.mp4", 2 * 36e5); clip("113_LAN-e_ch2.mp4", 2 * 36e5); const at7 = vn(46 * 36e5);
mkPhieu(113, [{ at: at7, clip: "113_LAN-e_ch1.mp4", may: dau("DESKTOP-FOQ5T89", "2/2", 2 * 36e5) }, { at: at7, clip: "113_LAN-e_ch2.mp4", may: dau("DESKTOP-JE75K38", "2/2", 2 * 36e5) }]);
// K8 cắt thêm gỡ 0 clip mà còn lượt
mkPhieu(115, [{ at: vn(47 * 36e5) }], { themXong: { yc: iso(9 * 36e5), luc: iso(8 * 36e5), n: 0 } }); kq[115].luc = iso(9 * 36e5);
ghi(".exports/bang-chung-b1.json", so); ghi(".exports/canh-b1-ketqua.json", kq); ghi(".cache-canh-b1.json", CW);
ghi(".exports/soan-hang-b1.json", {}); ghi(".exports/b1-cho-camera.json", {});
// K6: lần kiểm trước có clip 117_LAN-f mà nay mất khỏi bảng
ghi(".exports/.kiem-chia-clip-truoc.json", { clip: { "117|117_LAN-f_ch1.mp4": 1, "100|100_LAN-a_ch1.mp4": 1 } }); clip("117_LAN-f_ch1.mp4", 5 * 36e5);
const outD = (() => { try { return execFileSync(process.execPath, ["kiem-chia-clip.mjs", "--phat-hanh=" + new Date(PHAT).toISOString()], { cwd: T, encoding: "utf8", env: { ...process.env, KIEM_KHONG_8591: "1", BAIXE_DIR: path.join(BC, "bai-xe") }, timeout: 60000 }); } catch (e) { return String(e.stdout || "") + "\n[exit " + e.status + "]"; } })();
const R = JSON.parse(fs.readFileSync(path.join(T, ".exports", "kiem-chia-clip.json"), "utf8")), co = (ma, id) => R.canhBao.some((c) => c.ma === ma && (!id || c.phieu === String(id)));
ok(!R.canhBao.some((c) => c.phieu === "100"), "D1 K1 phiếu chuẩn KHÔNG bị báo nhầm");
ok(co("K2", 102), "D2 K2 lượt chưa có clip quá 6 giờ → báo trễ");
ok(co("K3", 104), "D3 K3 clip sau phát hành không dấu máy → báo «bản mã cũ»");
ok(co("K3", 106), "D4 K3 phiếu phần 1 mà dấu phần 2 → báo lệch phần");
ok(co("K4", 108), "D5 K4 lượt hỏng 3 lần → báo bỏ hẳn");
ok(co("K5", 110), "D6 K5 clip ghi bảng mà tệp chưa về laptop → báo");
ok(co("K6", 117), "D7 K6 clip lần trước có nay MẤT → báo");
ok(co("K7", 113), "D8 K7 cùng lượt 2 tệp clip → báo trùng");
ok(co("K8", 115), "D9 K8 «Cắt thêm» gỡ 0 clip còn lượt → báo");
ok(R.canhBao.every((c) => c.xuLy && c.xuLy.length > 10), "D10 mọi cảnh báo có hướng xử lý");
ok(/\[exit 4\]/.test(outD), "D11 có cảnh báo mức cao → mã thoát 4 (lịch/giám sát nhận biết được)");
ok(R.theoMay["DESKTOP-JE75K38"] && R.theoMay["DESKTOP-FOQ5T89"], "D12 thống kê tách theo máy", Object.keys(R.theoMay).join(", "));
fs.rmSync(T, { recursive: true, force: true });

/* ---- E ---- cấu hình */
const C = JSON.parse(fs.readFileSync("cai-pc/dieu-phoi.json", "utf8")), v1 = C.viec.find((v) => v.ten === "tim-bang-chung-b1"), v2 = C.viec.find((v) => v.ten === "tim-bang-chung-b1-2");
ok(v1 && v2 && v1.env.XM_PHAN === "1/2" && v2.env.XM_PHAN === "2/2", "E1 2 việc phần 1/2 và 2/2");
ok(v1.uuTien[0] === "DESKTOP-JE75K38" && v2.uuTien[0] === "DESKTOP-FOQ5T89" && v1.uuTien[1] === v2.uuTien[0] && v2.uuTien[1] === v1.uuTien[0], "E2 ghim chéo (mỗi máy dự phòng cho máy kia)");
ok(v1.khoaChung === false && v2.khoaChung === false && v1.dongBoXm && v2.dongBoXm, "E3 không giữ khoá chung, vẫn đồng bộ dữ liệu");
const G = JSON.parse(fs.readFileSync("cai-pc/dong-bo-xm.json", "utf8"));
ok(["bang-chung-b1.json", "b1-cho-camera.json"].every((f) => G.gop.includes(".exports/" + f) && G.chung.includes(".exports/" + f)), "E4 tệp 2 phần cùng ghi được gộp 3 chiều");
ok(G.vao.includes(".exports/soan-hang-b1.json"), "E5 sổ soạn hàng laptop → PC (vao)");
const x1 = fs.readFileSync("cai-pc/tasks-xml/5S_Tim_bang_chung_B1.xml", "utf8"), x2 = fs.readFileSync("cai-pc/tasks-xml/" + v2.xml, "utf8");
const gio = (x) => (x.match(/<StartBoundary>[^T]*T(\d\d):(\d\d)/) || []).slice(1).map(Number);
const [h1, m1] = gio(x1), [h2, m2] = gio(x2);
ok(Math.abs((h2 * 60 + m2) - (h1 * 60 + m1)) === 60 && /<Interval>PT2H/.test(x2), "E6 phần 2 chạy LỆCH 1 giờ phần 1 (đầu ghi không bị 2 máy tải cùng lúc)", `${h1}:${m1} / ${h2}:${m2}`);
ok(/"tim-bang-chung-b1-2"/.test(fs.readFileSync("chay-xm.mjs", "utf8")), "E7 nhật ký máy có phần 2");
/* ---- F ---- gộp 3 chiều (2 phần cùng ghi hàng chờ): xoá của BÊN NÀO cũng phải giữ — 23/10 bắt lỗi họ xoá thì mục «sống lại» */
const { gop3 } = await import("./dong-bo-xm.mjs"), G0 = { a: { l: 1 }, b: { l: 2 }, c: { l: 3 } }, J = (x) => JSON.stringify(x, Object.keys(x).sort());
ok(J(gop3(G0, { ...G0, d: { l: 4 } }, { a: { l: 1 }, b: { l: 2 } })) === J({ a: { l: 1 }, b: { l: 2 }, d: { l: 4 } }), "F1 máy kia gỡ phiếu khỏi hàng chờ + máy này thêm phiếu mới → giữ cả hai thay đổi");
ok(J(gop3(G0, { b: { l: 2 }, c: { l: 3 } }, G0)) === J({ b: { l: 2 }, c: { l: 3 } }), "F2 máy này gỡ, máy kia không đổi → gỡ");
ok(J(gop3(G0, { ...G0, c: { l: 9 } }, { a: { l: 1 }, b: { l: 2 } })) === J({ a: { l: 1 }, b: { l: 2 }, c: { l: 9 } }), "F3 máy kia gỡ mà máy này vừa SỬA → giữ bản sửa (không mất yêu cầu mới)");
console.log(`\nKẾT QUẢ: ${dat} đạt · ${hong} hỏng`); process.exit(hong ? 1 : 0);
