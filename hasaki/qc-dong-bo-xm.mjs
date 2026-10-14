// qc-dong-bo-xm.mjs — QC kho dữ liệu xác minh (GAS xm_*) + bộ đồng bộ, KHÔNG đụng dữ liệu thật:
//   chỉ dùng tệp thử .exports/qc-dbxm/* và khoá tên «qc-dbxm»; dọn sạch khi xong.  node qc-dong-bo-xm.mjs
import fs from "node:fs";
import path from "node:path";
import { goi, tepMay, DS, nhomCua } from "./dong-bo-xm.mjs";

let loi = 0; const ok = (dk, ten) => { console.log((dk ? "  OK   " : "  FAIL ") + ten); if (!dk) loi++; };
const T = ".exports/qc-dbxm/thu.json", T2 = "@BC/qc-dbxm/anh.jpg";
try {
  // 1) KHOÁ CHUNG
  const k1 = await goi({ action: "xm_khoa", may: "QC-MAY-A", viec: "qc-dbxm", ttl: 120 }, "k1");
  const k2 = await goi({ action: "xm_khoa", may: "QC-MAY-B", viec: "qc-dbxm", ttl: 120 }, "k2");
  ok(k1.kq === "giu" && k2.kq === "ban" && k2.may === "QC-MAY-A", "khoá chung: A giữ được, B bị từ chối (" + k1.kq + "/" + k2.kq + ")");
  await goi({ action: "xm_khoa", may: "QC-MAY-B", viec: "qc-dbxm", tra: true }, "tra sai");
  const k3 = await goi({ action: "xm_khoa", may: "QC-MAY-B", viec: "qc-dbxm", ttl: 120 }, "k3");
  ok(k3.kq === "ban", "máy khác KHÔNG nhả hộ được khoá của A");
  await goi({ action: "xm_khoa", may: "QC-MAY-A", viec: "qc-dbxm", tra: true }, "tra");
  const k4 = await goi({ action: "xm_khoa", may: "QC-MAY-B", viec: "qc-dbxm", ttl: 120 }, "k4");
  ok(k4.kq === "giu", "A nhả → B giữ được");
  await goi({ action: "xm_khoa", may: "QC-MAY-B", viec: "qc-dbxm", tra: true }, "tra B");

  // 2) GỬI / BẢN CŨ HƠN BỊ TỪ CHỐI / TẢI / TÊN BẤT HỢP LỆ
  const b1 = Buffer.from(JSON.stringify({ v: 1, chu: "Tiếng Việt có dấu" })), b0 = Buffer.from('{"v":0}');
  const g1 = await goi({ action: "xm_gui", ten: T, b64: b1.toString("base64"), luc: 2000, h: "h1", may: "QC" }, "g1");
  const g0 = await goi({ action: "xm_gui", ten: T, b64: b0.toString("base64"), luc: 1000, h: "h0", may: "QC" }, "g0");
  const gg = await goi({ action: "xm_gui", ten: T, b64: b1.toString("base64"), luc: 3000, h: "h1", may: "QC" }, "gg");
  ok(g1.kq === "ghi" && g0.kq === "cu" && gg.kq === "giong", "gửi mới → ghi · bản CŨ hơn → từ chối · giống hệt → bỏ qua (" + [g1.kq, g0.kq, gg.kq] + ")");
  const g2 = await goi({ action: "xm_gui", ten: T2, b64: Buffer.from([255, 216, 255, 0, 1, 2]).toString("base64"), luc: 5000, h: "hb", may: "QC" }, "g2");
  ok(g2.kq === "ghi", "gửi tệp nhị phân ở thư mục bằng chứng @BC");
  const tai = await goi({ action: "xm_tai", ten: [T, T2, ".exports/qc-dbxm/khong-co.json"] }, "tai");
  const a = tai.tep.find((x) => x.ten === T), b = tai.tep.find((x) => x.ten === T2), c = tai.tep.find((x) => /khong-co/.test(x.ten));
  ok(a && Buffer.from(a.b64, "base64").equals(b1) && a.luc === 2000, "tải về đúng nội dung + giờ (tiếng Việt nguyên vẹn)");
  ok(b && Buffer.from(b.b64, "base64").equals(Buffer.from([255, 216, 255, 0, 1, 2])), "tải tệp nhị phân đúng từng byte");
  ok(c && c.thieu, "tệp không có → báo thiếu, không lỗi");
  let chan = ""; try { await goi({ action: "xm_gui", ten: "../.env", b64: "eA==", luc: 1, h: "x" }, "xau"); } catch (e) { chan = e.message; }
  let chan2 = ""; try { await goi({ action: "xm_gui", ten: ".env", b64: "eA==", luc: 1, h: "x" }, "xau2"); } catch (e) { chan2 = e.message; }
  ok(/không hợp lệ/.test(chan) && /không hợp lệ/.test(chan2), "chặn ghi tệp ngoài vùng cho phép (.env, ../)");
  const ds = await goi({ action: "xm_ds" }, "ds");
  ok(ds.ds.some((x) => x.ten === T && x.luc === 2000) && ds.ds.every((x) => !("b64" in x)), "mục lục có tệp, không kèm nội dung");

  // 3) DỌN
  const x = await goi({ action: "xm_xoa", ten: [T, T2] }, "xoa");
  const ds2 = await goi({ action: "xm_ds" }, "ds2");
  ok(x.xoa === 2 && !ds2.ds.some((y) => /qc-dbxm/.test(y.ten)), "xoá khỏi kho (Drive + mục lục)");

  // 4) DANH SÁCH TỆP TRÊN MÁY (chỉ đọc) — nhóm vao/chung phải nhẹ, «ra» lọc theo mốc thời gian
  const vc = tepMay(["vao", "chung"]), co = vc.reduce((s, f) => s + f.co, 0);
  ok(vc.length > 20 && co < 30e6, `vao+chung: ${vc.length} tệp · ${(co / 1e6).toFixed(1)} MB (nhẹ, đồng bộ được)`);
  ok(vc.some((f) => f.ten === ".exports/tasks-cache.json") && vc.some((f) => f.ten === ".canh-b11.json") && vc.some((f) => /^\.exports\/xm-tu-dong\/\d+\/BAO-CAO\.md$/.test(f.ten)), "có tasks-cache, sổ canh-b11, BAO-CAO.md từng phiếu");
  const raMoi = tepMay(["ra"], Date.now() - 60e3);
  ok(raMoi.length < 50, `«ra» chỉ lấy tệp mới (1 phút qua: ${raMoi.length} tệp) — không đẩy cả kho 1,5 GB`);
  ok(DS.ra.includes("@BC/may/**"), "nhóm «ra» gồm ảnh/clip bằng chứng @BC/may");
  // 14/10 lỗi đã gặp: mẫu «ra» trùm tệp «chung» → «kéo ra rồi xoá kho» xoá nhầm BAO-CAO.md / kenh-luc-chup/*.json
  ok(nhomCua(".exports/xm-tu-dong/1/BAO-CAO.md") === "chung" && nhomCua(".exports/kenh-luc-chup/1.json") === "chung" && nhomCua(".exports/xm-tu-dong/1/a.jpg") === "ra",
    "mỗi tệp thuộc ĐÚNG 1 nhóm (BAO-CAO.md, kenh-luc-chup/*.json là «chung», không bị «ra» xoá)");
  ok(!tepMay(["ra"], Date.now() - 24 * 3600e3).some((f) => nhomCua(f.ten) !== "ra"), "danh sách «ra» không lẫn tệp nhóm khác");
} catch (e) { console.log("  FAIL lỗi: " + e.message); loi++; }
console.log(loi ? `\n${loi} ca HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
