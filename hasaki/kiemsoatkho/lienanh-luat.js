/* lienanh-luat.js — BỘ LUẬT KHOẢNG CÁCH cho bố trí kho Liên Anh (05/10/2026)
 * Tệp này được commit (không chứa toạ độ/bố cục). Giá trị sửa được ngay trên trang (bảng "Luật") —
 * bản sửa lưu cùng bố cục trong lienanh-bocuc.js (gitignore), tệp này là MẶC ĐỊNH.
 *   ma    = mã luật          a / b = loại đối tượng (dayKe · sorter · cua · khu · cot · tuong · vat = đồ rời khác)
 *   min   = khoảng cách tối thiểu (m) · muc = "loi" (CHẶN Chốt) | "canhBao" (chỉ báo vàng)
 *   nguon = căn cứ · verify = 1 đã có căn cứ chuẩn, 0 = CHƯA VERIFY (giả định/thông lệ — user xác nhận)
 * Giải thích đầy đủ + cách đổi số: hasaki/LIENANH-RULES.md */
window.LIENANH_LUAT = {
  ver: "2026-10-05",
  luat: [
    { ma: "L01", ten: "Lối xe nâng giữa 2 dãy kệ song song", a: "dayKe", b: "dayKe", min: 3.0, dv: "m", muc: "loi", verify: 1,
      nguon: "trang mẫu new-warehouse (xe nâng đứng lái) · NCC Thăng Long 2 900", kheLungMin: 0.15, kheLungMax: 0.5,
      mo: "2 dãy chồng hình chiếu ≥ 1 bay; khe lưng 0,15–0,5 chỉ hợp lệ khi cả hai là selective" },
    { ma: "L02", ten: "Lối cắt trong dãy kệ (đầu nối đầu)", a: "dayKe", b: "dayKe", min: 3.0, dv: "m", muc: "canhBao", verify: 1,
      nguon: "trang mẫu 'lối cắt 3 m'", noi: 0.1, mo: "≤ 0,1 = nối liền; ≥ 3,0 = lối cắt; ở giữa = báo" },
    { ma: "L03", ten: "Kệ cách tường bao", a: "dayKe", b: "tuong", min: 0.5, dv: "m", muc: "loi", verify: 0,
      nguon: "thông lệ — CHƯA VERIFY", mo: "trừ kệ sát tường (kieu don) được dán tường ≤ 0,05" },
    { ma: "L04", ten: "Không đè cột nhà", a: "*", b: "cot", min: 0.0, dv: "m", muc: "loi", verify: 1,
      nguon: "hình học", minKe: 0.1, mo: "mọi vật (trừ khu, cửa) không được đè cột; dãy kệ cách cột ≥ 0,1" },
    { ma: "L05", ten: "Lối người giữa đồ rời", a: "vat", b: "vat", min: 1.2, dv: "m", muc: "canhBao", verify: 0,
      nguon: "QCVN 06:2022 lối thoát nạn ≥ 1,0–1,2 — CHƯA VERIFY", chong: 0.6, ghepKhit: 0.012,
      mo: "2 đồ rời (bàn, locker, kệ nhẹ…) chồng hình chiếu ≥ 0,6 mà khe 0,012–1,2 = hẹp; ghép khít (≤ 0,012) được phép" },
    { ma: "L06", ten: "Dải trước cửa phải trống", a: "cua", b: "*", min: 3.0, dv: "m", muc: "loi", verify: 0,
      nguon: "PCCC / xe ra vào — CHƯA VERIFY", sauNguoi: 1.5, mo: "cửa xe (xuat/dock): sâu 3,0; cửa người (thoat): 1,5; cửa nap: miễn (xe nạp đậu ngay cửa)" },
    { ma: "L07", ten: "Sorter cách kệ / lồng", a: "sorter", b: "dayKe", min: 2.0, dv: "m", muc: "loi", verify: 1,
      nguon: "trang mẫu AISLE 2,0 (lối kéo lồng ngoài)", mo: "cũng áp cho cumLong" },
    { ma: "L08", ten: "Sorter cách cột E/J", a: "sorter", b: "cot", min: 0.5, dv: "m", muc: "canhBao", verify: 1,
      nguon: "trang mẫu (máy cách cột 2,3 m)", mo: "trạm người xếp: pallet ngoài gần cột hơn → báo" },
    { ma: "L09", ten: "Sạc xe nâng cách kệ / khu dễ cháy", a: "tuSac", b: "dayKe", min: 1.5, dv: "m", muc: "loi", verify: 0,
      nguon: "NFPA 505 / OSHA 1910.178 không nêu số — CHƯA VERIFY", mo: "cũng áp cho oXeNang ↔ dayKe và tuSac ↔ khu giấy/bóng vụn/VPP" },
    { ma: "L10", ten: "Khu giấy tái chế / bóng vụn cách tủ điện, sạc", a: "khuChay", b: "tuSac", min: 3.0, dv: "m", muc: "loi", verify: 0,
      nguon: "CHƯA VERIFY", mo: "khu có nhom 'chay' (giấy, bóng vụn)" },
    { ma: "L11", ten: "Khu không chồng khu · vật nằm trong khu", a: "khu", b: "khu", min: 0.0, dv: "m", muc: "loi", verify: 1,
      nguon: "nghiệp vụ", mo: "khu ngoài nhà (ngoai) không xét; vật ngoài khu = cảnh báo (sorter được phép thò line #5 sang khu kề)" },
    { ma: "L12", ten: "Vật nằm trong nhà", a: "*", b: "nha", min: 0.0, dv: "m", muc: "loi", verify: 1,
      nguon: "hình học", mo: "trừ khu ngoai, dockCont, xe tải" },
    { ma: "L13", ten: "Dải xe dock không chồng khu ngoài", a: "dockCont", b: "khuNgoai", min: 0.0, dv: "m", muc: "loi", verify: 1,
      nguon: "nghiệp vụ", mo: "" },
    { ma: "L14", ten: "Khu staging phải có cửa xuất trên cạnh", a: "khuStaging", b: "cua", min: 0.0, dv: "m", muc: "canhBao", verify: 1,
      nguon: "nghiệp vụ", mo: "" }
  ]
};
