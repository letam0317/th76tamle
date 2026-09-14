/**
 * qc-tvt-quet.mjs — kiểm PHẠM VI của bộ quét "Tồn tại vị trí" mà KHÔNG gọi WMS:
 * chỉ 2 kho nguyên liệu, và chỉ SKU vải. Chạy được mọi lúc, kể cả khi không có token.
 */
import { BO_TVT, nhomVai, laVai, chuaKhaiBao, laBaiCho, boQuaViTri, boQuaStatus, chuanSt, VT_BO_QUA, ST_BO_QUA, dungBangTvt, TVT_HEADER, VT_CHO,
  bangTemTheoO, nghiTonAo, khoaO, BT_CHUA_KHAI, BT_NGHI_AO } from "./ton-vitri.mjs";
let loi = 0;
const ok = (m) => console.log("  ✓ " + m);
const xau = (m) => { loi++; console.log("  ✗ " + m); };

console.log("① Phạm vi kho");
const kho = BO_TVT.flatMap((b) => b.warehouses.map((w) => b.ten + "/" + w + " = " + b.khoTen));
if (kho.length !== 2) xau("phải đúng 2 kho, đang có " + kho.length + ": " + kho.join(", "));
else ok(kho.join("  ·  "));
if (!BO_TVT.every((b) => b.khoTen)) xau("thiếu khoTen — mất chốt chặn WMS đổi ánh xạ id↔kho");
else ok("mỗi kho có tên mong đợi để đối chiếu");

console.log("② Nhận diện vải theo TÊN sản phẩm");
const mau = [
  ["Vải single jersey/TN006B_Trang Nhã/93% Cotton…", true],
  ["Vải Warp knit pique/X820040NIH_XYX/82% Nylon…", true],
  ["(Combo) Vải Weft knit scuba/PD00695MIM_XYX…", true],
  ["Chỉ Lenio/F0-1636_Phong Việt/100% Nylon/none/Đen…", false],
  ["40's/2 BPM0000J(AA) Raw White Yarn, SUPIMA COTTON 100%…", false],
  ["Thân sau Mocking/FAF36/100% Rayon…", false],
  ["", false],
];
mau.forEach(([ten, mong]) => {
  if (laVai(ten) !== mong) xau("laVai('" + ten.slice(0, 40) + "…') = " + laVai(ten) + ", mong " + mong);
});
if (!loi) ok(mau.length + " mẫu tên (kể cả 'Chỉ Lenio' và sợi Yarn) phân loại đúng");
if (nhomVai("Vải x") !== "Vải" || nhomVai("Chỉ x") !== "NVL khác") xau("nhomVai trả nhãn sai");
else ok("nhãn cột Nhóm: Vải / NVL khác");

console.log("③ Luật 'chưa khai báo' + 'bãi chờ'");
[["0", true], ["", true], ["N/A", true], ["n/a", true], ["1028251226000451", false]].forEach(([v, mong]) => {
  if (chuaKhaiBao(v) !== mong) xau("chuaKhaiBao('" + v + "') = " + chuaKhaiBao(v) + ", mong " + mong);
});
[[VT_CHO, true], ["F0-A0-01-02-03-04", true], ["F0-AJ-00-00-00-00", false], ["F0-KHO-512-04-04-01", false]].forEach(([v, mong]) => {
  if (laBaiCho(v) !== mong) xau("laBaiCho('" + v + "') = " + laBaiCho(v) + ", mong " + mong);
});
if (!loi) ok("group_uid 0/rỗng/N/A = chưa khai báo · F0-A0* = bãi chờ (F0-AJ KHÔNG phải)");

console.log("④ Khu miễn trừ " + VT_BO_QUA.join("/"));
for (const p of ["F0-KHO-HM", "F0-AJ"]) if (!VT_BO_QUA.includes(p)) xau("mất khu miễn trừ " + p);
/* F0-AJ (khu điều chỉnh) vào danh sách 20/08/2026 — 221/336 dòng nằm ở đây, KHÔNG phải việc phải đi làm.
   Bẫy: F0-AJ và bãi chờ F0-A0 chỉ khác 1 ký tự nên laBaiCho() không phủ được, phải là boQuaViTri(). */
[["F0-KHO-HM-01-04-01", true], ["F0-KHO-HM-01-01-01", true], ["F0-KHO-HM", true],
 ["F0-AJ-00-00-00-00", true], ["F0-AJ", true],
 ["F0-KHO-503-09-04-01", false], ["F0-KHO-507-01-03-01", false], ["F0-KHO-512-04-04-01", false],
 ["F0-VR-00-00-00-00", false], ["F0-A0-00-00-00-00", false]].forEach(([v, mong]) => {
  if (boQuaViTri(v) !== mong) xau("boQuaViTri('" + v + "') = " + boQuaViTri(v) + ", mong " + mong);
});
if (!loi) ok("F0-KHO-HM* + F0-AJ* bị loại, các ô F0-KHO/F0-VR khác vẫn giữ");

console.log("⑤ Trạng thái miễn trừ " + ST_BO_QUA.join("/"));
for (const st of ["adjustment - shipped", "removed", "returned supplier", "delivered", "transfer - shipped"])
  if (!ST_BO_QUA.includes(st)) xau("mất trạng thái miễn trừ '" + st + "'");
/* WMS ghi lẫn hoa/thường và lẫn khoảng trắng quanh dấu gạch ⇒ chuanSt phải gom về cùng một chuỗi.
   14/09/2026: ẩn CẢ NHÓM trạng thái kết thúc (chứng từ đã duyệt, tồn theo vị trí = 0), nhưng
   Not found PHẢI Ở LẠI — đó là ca 40.700 mm hàng còn trên kệ mà WMS hạ trạng thái sau kiểm kê. */
[["Adjustment - shipped", true], ["Adjustment - Shipped", true], ["ADJUSTMENT-SHIPPED", true],
 ["adjustment  -  shipped", true], ["Removed", true], ["REMOVED", true],
 ["Returned supplier", true], ["returned  supplier", true], ["Delivered", true],
 ["Transfer - shipped", true], ["Transfer-Shipped", true],
 ["In-BIN", false], ["Not found", false], ["Picklisted", false], ["Picking", false],
 ["Packed", false], ["", false]].forEach(([v, mong]) => {
  if (boQuaStatus(v) !== mong) xau("boQuaStatus('" + v + "') = " + boQuaStatus(v) + ", mong " + mong);
});
if (chuanSt("Adjustment-Shipped") !== "adjustment - shipped") xau("chuanSt không chuẩn hoá được dấu gạch");
if (!loi) ok("nhóm trạng thái kết thúc bị loại (mọi biến thể hoa/thường/khoảng trắng), trạng thái còn giữ hàng vẫn ở lại");

console.log("⑥ Bảng ghi Sheet");
const bang = dungBangTvt([{ cty: "Mastige", it: { warehouse_name: "WH - MATERIAL - MTG", location_description: "F0-AJ-00-00-00-00",
  uid: "VN001", sku: "422304497", product_name: "Vải single jersey/TN006B", category_name: "Thời Trang (NVL)",
  brand_name: "Vải", qty: 1600, uom: "Cái", status_name: "In-BIN", group_uid: "0", updated_at: "2026-05-26 14:24:06" } }]);
if (bang[0].length !== TVT_HEADER.length) xau("dòng " + bang[0].length + " ô ≠ header " + TVT_HEADER.length + " ô");
else ok("số ô khớp header (" + TVT_HEADER.length + ")");
if (bang[0][TVT_HEADER.indexOf("Nhóm")] !== "Vải") xau("cột Nhóm không ra 'Vải'");
else ok("cột Nhóm điền đúng");

/* ⑦ NHÓM "NGHI TỒN ẢO" (14/09/2026) — cuộn trần nằm trong ô CÒN cuộn có tem sinh TRƯỚC nó.
   Ca thật lấy từ dữ liệu 14/09: 504-06-02-01 SKU 422336829 (trần 33.400 chồng lên tem 16.600+16.800)
   và ca ÂM TÍNH HM-01-04-01 SKU 422510453 (trần 1.800 ngày 05/09, tới 10/09 mới nhập lô tem 5.000). */
console.log("⑦ Nhóm nghi tồn ảo (đếm 2 đường)");
const O = (loc, sku, uid, grp, qty, at) => ({ location_description: loc, sku, uid, group_uid: grp, qty, created_at: at });
const kho1 = [
  O("F0-KHO-504-06-02-01", "422336829", "VN-tem-1", "1028260416000004", 16600, "2026-06-24 07:51:02"),
  O("F0-KHO-504-06-02-01", "422336829", "VN-tem-2", "1028260416000004", 16800, "2026-08-26 16:05:42"),
  O("F0-KHO-504-06-02-01", "422336829", "VN-tran-1", "0", 33400, "2026-08-26 16:05:42"),
  O("F0-KHO-HM-01-04-01", "422510453", "VN-tran-2", "0", 1800, "2026-09-05 14:09:54"),
  O("F0-KHO-HM-01-04-01", "422510453", "VN-tem-3", "1028260903000019", 5000, "2026-09-10 09:55:18"),
  O("F0-KHO-505-04-01-01", "422273980", "VN-tran-3", "0", 13900, "2026-03-03 10:04:47"),
];
const bangTem = bangTemTheoO(kho1);
if (bangTem.size !== 2) xau("bangTemTheoO phải gom 2 ô có tem, được " + bangTem.size);
else ok("bangTemTheoO gom đúng 2 ô có tem (bỏ ô toàn cuộn trần)");
const temO = bangTem.get(khoaO(kho1[0]));
if (!temO || temO.qty !== 33400 || temO.n !== 2) xau("tổng SL tem trong ô sai: " + JSON.stringify(temO));
else ok("cộng đúng SL tem trong ô (16.600 + 16.800 = 33.400 · 2 cuộn)");
let loiPl = 0;
[["VN-tran-1", true, "cuộn trần chồng lên cuộn tem sinh trước ⇒ nghi tồn ảo"],
 ["VN-tran-2", false, "cuộn tem sinh SAU (05/09 → 10/09) ⇒ KHÔNG phải tồn ảo"],
 ["VN-tran-3", false, "ô không còn cuộn tem nào ⇒ chỉ là chưa khai tem"]].forEach(([uid, mong, vi]) => {
  const it = kho1.find((x) => x.uid === uid);
  if (nghiTonAo(it, bangTem) !== mong) { loiPl++; xau("nghiTonAo('" + uid + "') = " + nghiTonAo(it, bangTem) + ", mong " + mong + " — " + vi); }
});
if (!loiPl) ok("phân loại đúng 3 ca (kể cả ca âm tính HM-01-04-01)");
/* Bảng Sheet phải có đủ 2 cột mới, và nhãn loại phải TRÙNG chuỗi dashboard đang so */
const bangAo = dungBangTvt([{ cty: "Mastige", loai: BT_NGHI_AO, qtyTem: 33400,
  it: { warehouse_name: "WH - MATERIAL - MTG", location_description: "F0-KHO-504-06-02-01", uid: "VN-tran-1",
    sku: "422336829", product_name: "Vải lót váy nâu/None/95%Polyester", category_name: "Thời Trang (NVL)",
    brand_name: "Vải", qty: 33400, uom: "Cái", status_name: "In-BIN", group_uid: "0", updated_at: "2026-08-26 16:05:42" } }]);
if (bangAo[0][TVT_HEADER.indexOf("Loại bất thường")] !== BT_NGHI_AO) xau("cột Loại bất thường không ra nhãn đúng");
else ok("cột Loại bất thường = “" + BT_NGHI_AO + "”");
if (bangAo[0][TVT_HEADER.indexOf("SL cùng ô có tem")] !== 33400) xau("cột SL cùng ô có tem sai");
else ok("cột SL cùng ô có tem = 33.400");
if (BT_CHUA_KHAI !== "Chưa khai tem" || BT_NGHI_AO !== "Nghi tồn ảo")
  xau("đổi nhãn loại thì PHẢI sửa TVT_BT_CHUA/TVT_BT_AO bên factory/index.html");
else ok("nhãn loại khớp hằng số dashboard (TVT_BT_CHUA / TVT_BT_AO)");

console.log(loi ? "\n✗ " + loi + " lỗi" : "\n✓ QC phạm vi bộ quét: đạt");
process.exit(loi ? 1 : 0);
