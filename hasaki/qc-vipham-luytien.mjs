/**
 * qc-vipham-luytien.mjs — kiểm bộ đếm vi phạm luỹ tiến (vipham-vesinh.mjs) bằng dữ liệu GIẢ có đáp án
 * trước, không chạm WMS/Sheet. Chạy: node qc-vipham-luytien.mjs
 *
 *  LUẬT (user chốt 17/09/2026):
 *   · 1 lần = 1 NGÀY ĐÃ KHÉP mà người phụ trách CÓ chấm công nhưng ô mình phụ trách không ai báo cáo.
 *   · Cứ mỗi 3 lần thì bắn MỘT task ghi nhận, trừ 2% KPI. 6 lần = 2 phiếu (−4%), 9 lần = 3 phiếu (−6%)…
 *   · Lần lẻ chưa đủ 3 VẪN NẰM TRONG SỔ chờ cộng tiếp — không mất, không bị phiếu trước "nuốt".
 *   · HÔM NAY không tính (ca chưa khép, người ta còn thời gian để làm).
 *
 *  Ca kiểm:
 *   ① tinhSoViPham — đếm đúng ngày/ô, bỏ ngày nghỉ, bỏ ô người khác làm thay, giữ ngày cũ, xoá quá hạn
 *   ② gopGhiNhanKpi — đọc mã NV + mốc từ biên bản (kể cả biên bản chỉ kê 3 ngày của phiếu)
 *   ③ chuKy — MA TRẬN 0…15 lần: số phiếu, ngày của phiếu sắp lập, phần lẻ giữ lại
 *   ④ Lập phiếu LIÊN TIẾP — 9 lần phải ra đúng 3 phiếu (−6%), không nuốt phần dư
 *   ⑤ Hôm nay không tính · ngày cũ vẫn tính · chuỗi cột đi vòng không mất dữ liệu
 */
import { tinhSoViPham, gopGhiNhanKpi, chuKy, chuoiCot, docCotVp, docCotGhi, lechNgay, ngayIso, MOI_LAN, HM_VESINH } from "./vipham-vesinh.mjs";

let loi = 0, n = 0;
const ca = (ten, ok, ghi) => { n++; if (!ok) loi++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };
const T = "2026-09-17", mocLay = lechNgay(T, -6);   // CC_LAY = 7 ngày → tính lại từ 11/09

const pcBy = {
  "F0-A1-501-01": { em: "a@x.vn", code: "111", ten: "A Nguyễn" },
  "F0-A1-501-02": { em: "a@x.vn", code: "111", ten: "A Nguyễn" },
  "F0-A1-502-01": { em: "b@x.vn", code: "222", ten: "B Trần" },
  "F0-A8-503-01-01-01": { em: "c@x.vn", code: "", ten: "C Lê" }      // thiếu mã → vá từ danh bạ
};
const byEmail = { "c@x.vn": { code: "333", name: "C Lê" } };
const ccNv = {
  "111": { em: "a@x.vn", ten: "A Nguyễn", d: { "2026-09-16": "05:50-17:30", "2026-09-15": "05:52-17:31", "2026-09-12": "06:00-17:00", "2026-09-10": "06:00-17:00" } },
  "222": { em: "b@x.vn", ten: "B Trần", d: { "2026-09-15": "05:50-17:30" } },                 // 16/09 nghỉ
  "333": { em: "c@x.vn", ten: "C Lê", d: { "2026-09-16": "06:00-??:??" } }
};
const req = [
  // 16/09: A không báo cáo 2 ô (→ 1 lần, so=2) · B nghỉ (ô 502-01 trống nhưng không tính) · C có đi làm, ô A8 không ai báo
  { n: "2026-09-16", l: "F0-A1-501-01-04-01", e: "", st: 1 }, { n: "2026-09-16", l: "F0-A1-501-02-04-01", e: "", st: 7 },
  { n: "2026-09-16", l: "F0-A1-502-01-04-01", e: "", st: 1 }, { n: "2026-09-16", l: "F0-A8-503-01-01-01", e: "", st: 1 },
  // 15/09: A được B báo cáo thay ô 501-01 (không tính), ô 501-02 đã Approved (không tính) → A 0 lần; B tự báo cáo
  { n: "2026-09-15", l: "F0-A1-501-01-04-01", e: "b@x.vn", st: 4 }, { n: "2026-09-15", l: "F0-A1-501-02-04-01", e: "", st: 4 },
  { n: "2026-09-15", l: "F0-A1-502-01-04-01", e: "b@x.vn", st: 3 },
  // 12/09: A không báo cáo 1 ô → 1 lần
  { n: "2026-09-12", l: "F0-A1-501-01-04-01", e: "", st: 1 },
  // 10/09 (ngoài cửa sổ lấy lại): trong sổ cũ đã có A với so=1; lượt quét nay thấy 2 ô trống → phải GIỮ so=1
  { n: "2026-09-10", l: "F0-A1-501-01-04-01", e: "", st: 1 }, { n: "2026-09-10", l: "F0-A1-501-02-04-01", e: "", st: 1 },
  // hôm nay: chưa khép → không ghi
  { n: T, l: "F0-A1-501-01-04-01", e: "", st: 1 }
];
const vpCu = { nv: { "111": { em: "a@x.vn", ten: "A Nguyễn", d: { "2026-09-10": { so: 1, o: ["F0-A1-501-01"] }, "2026-07-01": { so: 1, o: ["F0-A1-501-01"] } } } } };

console.log("LUẬT: mỗi " + MOI_LAN + " lần = 1 phiếu −2% · lần lẻ giữ lại · hôm nay không tính\n");
console.log("① tinhSoViPham");
const kq = tinhSoViPham({ reqNgay: req, pcBy, ccNv, byEmail, today: T, mocLay, vpCu, giuNgay: 60 });
const A = kq.nv["111"], B = kq.nv["222"], C = kq.nv["333"];
ca("A 16/09: 1 lần, 2 ô", A && A.d["2026-09-16"] && A.d["2026-09-16"].so === 2 && A.d["2026-09-16"].o.join() === "F0-A1-501-01,F0-A1-501-02", JSON.stringify(A && A.d["2026-09-16"]));
ca("A 15/09: người khác làm thay / Approved → không tính", A && !A.d["2026-09-15"]);
ca("A 12/09: 1 lần", A && A.d["2026-09-12"] && A.d["2026-09-12"].so === 1);
ca("A 10/09: ngoài cửa sổ → GIỮ sổ cũ so=1 (không viết lại quá khứ)", A && A.d["2026-09-10"] && A.d["2026-09-10"].so === 1, JSON.stringify(A && A.d["2026-09-10"]));
ca("A 01/07: quá 60 ngày → xoá", A && !A.d["2026-07-01"]);
ca("HÔM NAY chưa khép → sổ không có " + T, A && !A.d[T]);
ca("B 16/09 nghỉ → không tính", !B);
ca("C thiếu mã trong phân công → vá từ danh bạ (333), 16/09 1 lần", C && C.d["2026-09-16"] && C.d["2026-09-16"].so === 1, JSON.stringify(C));
ca("thongKe hợp lý", kq.thongKe.nguoi === 2 && kq.thongKe.lan === 4, JSON.stringify(kq.thongKe));

console.log("② gopGhiNhanKpi");
const audit = [
  { ngay: "Date(2026,8,17,9,3,0)", hienTrang: "Yêu cầu planogram #1: Chưa vệ sinh\nLink: x\nPhụ trách: A Nguyễn (111) -Có đi làm nhưng KHÔNG báo cáo vệ sinh ô này\nVi phạm luỹ tiến: đủ 3 lần (10/09/2026 · 12/09/2026 · 16/09/2026) → KPI -2%", viTri: "F0-A1-501-01-04-01", hangMuc: HM_VESINH },
  { ngay: "Date(2026,7,20,8,0,0)", hienTrang: "bụi", viTri: "F0-A1-502-01-04-01", hangMuc: HM_VESINH },                    // không có mã → suy từ chủ vị trí B
  { ngay: "Date(2026,8,17,9,0,0)", hienTrang: "Phụ trách: A Nguyễn (111)", viTri: "F0-A1-501-01-04-01", hangMuc: "Tắt các thiết bị điện khi không sử dụng." }   // hạng mục khác → bỏ
];
const ghi = gopGhiNhanKpi(audit, pcBy, byEmail);
ca("A: mốc = ngày CUỐI trong dòng luỹ tiến (16/09), không phải ngày lập (17/09)", (ghi["111"] || [])[0] === "2026-09-16", JSON.stringify(ghi["111"]));
ca("B: không có mã → suy từ chủ vị trí, mốc = ngày lập (gviz tháng đếm từ 0 → 20/08)", (ghi["222"] || [])[0] === "2026-08-20", JSON.stringify(ghi["222"]));
ca("Hạng mục khác không tính", Object.keys(ghi).length === 2);
ca("ngayIso: Date(2026,8,17,…) → 2026-09-17", ngayIso("Date(2026,8,17,8,40,21)") === "2026-09-17");

console.log("③ chuKy — MA TRẬN 0…15 lần (chưa ghi nhận lần nào)");
const ngay = (i) => "2026-09-" + String(i).padStart(2, "0");
const soVp = (so) => { const d = {}; for (let i = 1; i <= so; i++) d[ngay(i)] = { so: 1, o: ["F0-A1-501-01"] }; return d; };
const DEN = "2026-09-30";
console.log("   n  | phiếu nợ | % tổng | phiếu này kê | lẻ giữ lại | nút");
for (const so of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]) {
  const k = chuKy(soVp(so), [], DEN);
  const phieuDung = Math.floor(so / MOI_LAN), leDung = so % MOI_LAN;
  const nut = k.du ? (k.soPhieu > 1 ? "Ghi nhận 5S · còn " + k.soPhieu + " phiếu" : "Ghi nhận 5S · lần 3/3") : (so ? "(chữ) lần " + so + "/3" : "nút thường");
  console.log("   " + String(so).padEnd(3) + "| " + String(k.soPhieu).padEnd(9) + "| " + String(k.soPhieu * 2 + "%").padEnd(7) + "| " +
    (k.keNay.length ? k.keNay.map(x => x.slice(-2)).join(",") : "—").padEnd(13) + "| " + String(k.duLai).padEnd(11) + "| " + nut);
  ca("n=" + so + ": " + phieuDung + " phiếu (−" + phieuDung * 2 + "%), lẻ " + leDung, k.soPhieu === phieuDung && k.duLai === leDung && k.du === (phieuDung >= 1) && k.n === so);
  if (phieuDung) ca("n=" + so + ": phiếu sắp lập kê ĐÚNG 3 ngày cũ nhất", k.keNay.length === MOI_LAN && k.keNay[0] === ngay(1) && k.keNay[2] === ngay(3), k.keNay.join(","));
}

console.log("④ Lập phiếu LIÊN TIẾP — mốc = ngày thứ 3 của phiếu vừa lập");
for (const tong of [3, 6, 7, 9, 11]) {
  const vp = soVp(tong); let ghiD = [], phieu = 0, veta = [];
  for (let i = 0; i < 10; i++) {
    const k = chuKy(vp, ghiD, DEN);
    if (!k.du) break;
    veta.push(k.keNay.map(x => x.slice(-2)).join(","));
    ghiD = [...ghiD, k.keNay[k.keNay.length - 1]];   // biên bản kê 3 ngày → gopGhiNhanKpi lấy ngày cuối = ngày thứ 3
    phieu++;
  }
  const conLai = chuKy(vp, ghiD, DEN);
  const dung = Math.floor(tong / MOI_LAN);
  ca(tong + " lần → lập được " + phieu + " phiếu = −" + phieu * 2 + "% (đúng: " + dung + " phiếu, −" + dung * 2 + "%), còn lẻ " + conLai.n,
    phieu === dung && conLai.n === tong % MOI_LAN && !conLai.du, "phiếu kê: " + veta.join(" | "));
}

console.log("⑤ Mốc ghi nhận · hôm nay · chuỗi cột");
const vp9 = soVp(9);
let k5 = chuKy(vp9, [ngay(3)], DEN);
ca("Đã ghi nhận mốc 03/09 → chu kỳ mới đếm từ 04/09: còn 6 lần = 2 phiếu", k5.n === 6 && k5.soPhieu === 2 && k5.ngay[0] === ngay(4), JSON.stringify({ n: k5.n, phieu: k5.soPhieu, dau: k5.ngay[0] }));
k5 = chuKy(vp9, [ngay(9)], DEN);
ca("Ghi nhận mốc = ngày cuối cùng → chu kỳ mới rỗng", k5.n === 0 && !k5.du);
k5 = chuKy(vp9, [ngay(3), ngay(6)], DEN);
ca("Hai mốc → lấy mốc GẦN NHẤT (06/09): còn 3 lần = 1 phiếu", k5.n === 3 && k5.soPhieu === 1);
k5 = chuKy(vp9, [DEN], ngay(5));
ca("Soi NGÀY CŨ 05/09: mốc 30/09 nằm SAU ngày xem nên không tính, còn 5 lần", k5.n === 5 && k5.moc === "", JSON.stringify({ n: k5.n, moc: k5.moc }));
k5 = chuKy(soVp(2), [], DEN);
ca("2 lần → KHÔNG phiếu, không kê ngày nào, giữ đủ 2 lần", !k5.du && k5.soPhieu === 0 && k5.keNay.length === 0 && k5.duLai === 2);
const vpHomNay = Object.assign(soVp(2), { [T]: { so: 1, o: [] } });
ca("chuKy KHÔNG tự thêm hôm nay (sổ có sao đếm vậy)", chuKy(soVp(2), [], T).n === 2 && chuKy(vpHomNay, [], T).n === 3);
const s = chuoiCot(A, ghi["111"]);
ca("cột vi phạm mới nhất trước, đủ ô", /^2026-09-16:2:F0-A1-501-01,F0-A1-501-02 \| 2026-09-12:1:F0-A1-501-01 \| 2026-09-10:1:F0-A1-501-01$/.test(s.vp), s.vp);
const d2 = docCotVp(s.vp), g2 = docCotGhi(s.ghi);
ca("đọc lại đúng số ngày/số ô/ô", Object.keys(d2).length === 3 && d2["2026-09-16"].so === 2 && d2["2026-09-16"].o.length === 2 && d2["2026-09-12"].o[0] === "F0-A1-501-01");
ca("đọc lại mốc ghi nhận", g2[0] === "2026-09-16", JSON.stringify(g2));
ca("chuỗi rác không làm hỏng (bỏ qua phần không khớp)", Object.keys(docCotVp("abc | 2026-09-01:x | 2026-09-02:1")).length === 1 && docCotGhi("| 2026 | 2026-09-02 |")[0] === "2026-09-02");

console.log("\n" + (loi ? "✗ " + loi + "/" + n + " ca hỏng" : "✓ " + n + "/" + n + " ca đạt"));
process.exit(loi ? 1 : 0);
