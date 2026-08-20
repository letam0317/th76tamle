/**
 * qc-tvt-quet.mjs — kiểm PHẠM VI của bộ quét "Tồn tại vị trí" mà KHÔNG gọi WMS:
 * chỉ 2 kho nguyên liệu, và chỉ SKU vải. Chạy được mọi lúc, kể cả khi không có token.
 */
import { BO_TVT, nhomVai, laVai, chuaKhaiBao, laBaiCho, boQuaViTri, VT_BO_QUA, dungBangTvt, TVT_HEADER, VT_CHO } from "./ton-vitri.mjs";
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
if (!VT_BO_QUA.includes("F0-KHO-HM")) xau("mất khu miễn trừ F0-KHO-HM");
[["F0-KHO-HM-01-04-01", true], ["F0-KHO-HM-01-01-01", true], ["F0-KHO-HM", true],
 ["F0-KHO-503-09-04-01", false], ["F0-AJ-00-00-00-00", false], ["F0-KHO-512-04-04-01", false]].forEach(([v, mong]) => {
  if (boQuaViTri(v) !== mong) xau("boQuaViTri('" + v + "') = " + boQuaViTri(v) + ", mong " + mong);
});
if (!loi) ok("F0-KHO-HM* bị loại, các ô F0-KHO khác vẫn giữ");

console.log("⑤ Bảng ghi Sheet");
const bang = dungBangTvt([{ cty: "Mastige", it: { warehouse_name: "WH - MATERIAL - MTG", location_description: "F0-AJ-00-00-00-00",
  uid: "VN001", sku: "422304497", product_name: "Vải single jersey/TN006B", category_name: "Thời Trang (NVL)",
  brand_name: "Vải", qty: 1600, uom: "Cái", status_name: "In-BIN", group_uid: "0", updated_at: "2026-05-26 14:24:06" } }]);
if (bang[0].length !== TVT_HEADER.length) xau("dòng " + bang[0].length + " ô ≠ header " + TVT_HEADER.length + " ô");
else ok("số ô khớp header (" + TVT_HEADER.length + ")");
if (bang[0][TVT_HEADER.indexOf("Nhóm")] !== "Vải") xau("cột Nhóm không ra 'Vải'");
else ok("cột Nhóm điền đúng");

console.log(loi ? "\n✗ " + loi + " lỗi" : "\n✓ QC phạm vi bộ quét: đạt");
process.exit(loi ? 1 : 0);
