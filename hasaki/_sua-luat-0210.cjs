// 02/10/2026: gộp luật rút từ 151 án lệ B3 (.exports/an-le-b3.json) + câu trả lời của user 02/10 vào sổ luật.
// Mỗi luật sửa/thêm có trường khacCu = khác luật cũ ở đâu + bối cảnh, để user duyệt ở tab QUY TẮC XÁC MINH.
const fs = require("fs"); const F = __dirname + "/quy-tac-xac-minh-b1.json";
const j = JSON.parse(fs.readFileSync(F, "utf8")); const L = (m) => j.luat.find((x) => x.ma === m);
const QD = (muc, cau, tru, xuLy) => ({ muc, cau, tru, xuLy });
const NGAY = "02/10/2026";
const themAnLe = (l, ds) => { l.anLe = (l.anLe || []).filter((a) => !ds.some((d) => d.phieu === a.phieu)).concat(ds); };

// VS-03 — user 02/10 xác nhận giữ: không ghi nhận khi phụ trách nghỉ 1–2 ngày trước ngày ghi nhận
const v3 = L("VS-03");
v3.dieuKien = "Người phụ trách nghỉ 1–2 ngày (các ngày TRƯỚC ngày ghi nhận) và không ai báo cáo ô trong ngày xét — kể cả khi ảnh cho thấy bụi nhiều lớp";
v3.khacCu = "02/10: GIỮ NGUYÊN cách xử (dừng phiếu), chỉ ghi rõ «nghỉ trước ngày ghi nhận» + «kể cả bụi nhiều lớp». Bối cảnh: 5 phiếu cũ (tháng 5–7) vẫn ghi lỗi dù NV nghỉ, vì «bụi nhiều lớp» (11819055…) — bạn chốt 02/10 KHÔNG ghi nhận ca này; bỏ đề xuất VS-06. 5 phiếu cũ đã xong → để nguyên (RA-01).";
themAnLe(v3, [{ phieu: "11819055", ghiChu: "05/2026 ghi lỗi dù NV off («bụi nhiều lớp») — theo luật 02/10 sẽ DỪNG phiếu; phiếu đã xong, để nguyên" }]);

// SH-01 — tách 3 dạng ảnh theo kết quả chạy thử 5 án lệ (.exports/thu-sh02.json: 2/5 khớp người soạn cuối)
const s1 = L("SH-01");
s1.dieuKien = "Theo DẠNG ẢNH: (a) thùng rỗng hoặc thùng còn dở do người soạn để lại → người SOẠN CUỐI CÙNG SKU đó tại ô trước giờ chụp (≤8h, chi tiết nhóm soạn); (b) ≥2 thùng lẻ cùng mở, chưa gom → người CẤT gần nhất (lệnh push vào ô); (c) mở thùng mới khi thùng cũ còn hàng → mọi người soạn SKU đó tại ô từ lần cất gần nhất, camera chọn người mở thùng thứ 2";
s1.mayLam = "Tra picking-group (danh sách theo ngày 1–2 lượt + chi tiết nhóm, quét ngược từ giờ ảnh, dừng sớm: 7–27 lượt/phiếu) → ghi sheet người theo dạng ảnh + clip camera đúng phút. Chỉ tự kết luận khi camera xác nhận (CAM-03).";
s1.khacCu = "02/10: Cũ = 1 cách «người làm thùng rỗng / soạn cuối». Mới = tách 3 dạng ảnh. Bối cảnh: chạy thử 5 phiếu cũ, «người soạn cuối» chỉ đúng 2/5 (11976910, 12163813); 11684195 lỗi là người mở thùng mới (soạn hôm trước); 11903194 và 12229738 lỗi là người cất (2 thùng lẻ chưa gom). 18 phiếu B3 cùng nhóm: 100% có clip camera, 0 NV chối.";
themAnLe(s1, [
  { phieu: "11976910", ghiChu: "dạng (a): máy ra nganntk6 10:16 = B1 Nguyễn Thị Kim Ngân ✓" },
  { phieu: "12163813", ghiChu: "dạng (a): máy ra trangnh1 10:59 = B1 Nguyễn Huyền Trang ✓" },
  { phieu: "11684195", ghiChu: "dạng (c): soạn cuối tuyenhn 07:07 nhưng B1 = Lu Ngọc Phượng (soạn SKU ở ô 18:17 hôm trước, mở thùng mới)" },
  { phieu: "11903194", ghiChu: "dạng (b): B1 = Phùng Lê Cao Minh (người cất, không soạn)" },
  { phieu: "12229738", ghiChu: "dạng (b): bình luận B1 «push phải gom 2 thùng lẻ thành 1» → Hoàng Trọng Phát (người cất)" }]);

// TB-01 — không đổi điều kiện, thêm bối cảnh án lệ (đề xuất TB-04 gộp vào đây)
L("TB-01").khacCu = "02/10: KHÔNG đổi điều kiện. Thêm bối cảnh: 14 phiếu B3 cùng hạng mục (mục 5) đều 1 người = người cất số lượng lớn gần nhất, 0 NV chối; bằng chứng mẫu = ảnh lịch sử chuyển WMS tô dòng PUSH_MASTER (13262000: phongdt 1.562 cái 20:28). Đề xuất TB-04 đã gộp vào đây.";

// TB-03 — gộp TB-05 (dấu hiệu + bằng chứng chuẩn + án lệ)
const t3 = L("TB-03");
if (!t3.dieuKien.includes("push 36")) t3.dieuKien += "; hoặc lệnh push/pick ở ô có số không khớp thực tế (vd push 36, thực tế 18; push kệ trên mà bỏ hàng kệ dưới)";
t3.khacCu = "02/10: thêm dấu hiệu «lệnh push/pick có số không khớp thực tế» + bằng chứng chuẩn của người xác minh (clip chia đôi: camera kệ + lịch sử chuyển WMS tô dòng). Bối cảnh: 39 phiếu B3 mục 28 — 21 phiếu là lệch số/sai vị trí (luật này), 18 phiếu là lấy xe soạn sai thứ tự (tách sang XE-01). Đề xuất TB-05 gộp vào đây.";
themAnLe(t3, [{ phieu: "12171228", ghiChu: "B3.2: Minh push inbin 36 thực tế 18; Phi push kệ trên, thực tế bỏ kệ dưới — 2 NV, clip camera 505-8-10 + lịch sử WMS" },
  { phieu: "12543937", ghiChu: "B3.2: chuyển bin dư so với thực tế — Phạm Đức Minh (clip minhpd3)" }]);

const moi = [
 { ma: "XE-01", nhom: "Soạn · đóng gói", ten: "Lấy xe soạn không theo thứ tự (ra thẳng khu đang soạn)",
   tuKhoa: ["xe pick", "tap ket xe", "5l3-25", "5l3-27", "pick 2 xe"],
   dieuKien: "NV đóng gói BẮT ĐẦU ĐÓNG một xe trong vòng 5 phút sau lúc xe đó soạn xong (tức đứng chờ lấy ngay ở khu đang soạn), trong khi khu «đã soạn xong – chờ đóng gói» còn xe CÙNG đơn vị vận chuyển soạn xong sớm hơn ≥5 phút mà chưa ai đóng. Phụ: đóng 2 xe chồng giờ (xe sau bắt đầu trước khi xe trước đóng xong). Chỉ xác nhận phiếu ĐÃ có ảnh: giờ ảnh cách giờ soạn xong ≤5 phút",
   mayLam: "Tra danh sách picking group theo ngày (1–2 lượt: người soạn, picking_end_at, packing_by_name, packing_start_at, đơn vị vận chuyển) → liệt kê xe chờ trước + số phút → ghi sheet. KHÔNG tự lập phiếu hàng loạt (5,4% số xe trong kho thoả điều kiện, sau khi loại xe tự soạn tự đóng). Lời giải thích «bạn soạn xong rồi em mới lấy» không gỡ lỗi.",
   macDinh: "hoi", chay: "canh-b1 (chưa chạy — ĐỀ XUẤT)", tu: NGAY, moi: true, deXuat: true,
   quyDinh: [QD(28, "Thao tác vật lý với hàng hóa (trưng bày, luân chuyển, hạn sử dụng) đúng theo yêu cầu của hệ thống và ngược lại", "5%", "Biên bản (lần 3: Ngưng hợp tác)")],
   giaiNghia: "Bạn giải nghĩa 02/10: NV đóng phải lấy xe ở khu đã soạn xong – chờ đóng theo thứ tự; ra thẳng khu đang soạn lấy xe → (1) xe soạn trước bị bỏ chờ → nguy cơ trễ đơn; (2) lựa xe nhẹ/ít SKU/dễ đóng → không công bằng.",
   khacCu: "02/10: LUẬT MỚI (trước đây gom chung mục 28/TB-03, không có cách máy kiểm). Bối cảnh: 18 phiếu B3 (07–09/07, 07–08/08), 10 NV chối đều bị bác. Chạy thử 19 cặp phiếu–NV: 11 khớp án lệ (giờ ảnh trùng gần như từng phút với lúc xe soạn xong); 7 không khớp vì giờ ảnh tròn (09:00, 18:00…) — ghi ước chừng.",
   anLe: [{ phieu: "12899623", ghiChu: "Bảo Thy: xe soạn xong 07:35:30, ảnh 07:35, 7 xe chờ trước — chối «bạn pick xong em mới lấy», vẫn ghi B3.2" },
          { phieu: "12899128", ghiChu: "Thanh Ngân: 12 xe chờ trước" }, { phieu: "12897081", ghiChu: "Hoài Thảo: soạn xong 07:20:46, đóng 07:24, 1 xe chờ trước" }] },
 { ma: "BX-01", nhom: "Ra vào · bãi xe", ten: "NV Hasaki gửi xe ở bãi của bảo vệ / nhà cung cấp – đối tác",
   tuKhoa: ["bai xe", "xe may", "gui xe"],
   dieuKien: "NV chính thức hoặc part-time Hasaki gửi xe ở (1) bãi bên trái camera «AI Bao Ve» (đầu ghi 170 QL1A - 4 = 172.16.10.16, kênh 16) — bãi của bảo vệ/NCC; hoặc (2) cụm xe sát cột camera «Bai Xe May» (đầu ghi 170 QL1A - 3 = 172.16.10.12, kênh 32) — bãi NCC/đối tác. Người không phải NV Hasaki (bảo vệ, tạp vụ, tài xế NCC) → loại",
   mayLam: "Camera: kẹp lúc xe vào bãi (1 khung/20 s) → người gửi xe đi bộ vào → khớp với sổ cổng bảo vệ /hr/history-location trong 1–3 phút sau (trang phục, khẩu trang, tóc, túi) → ghi sheet NGHI NGỜ kèm giờ + khung hình. Ảnh cổng chỉ để đối chiếu nội bộ (CAM-03). Máy KHÔNG nhận mặt; không có dòng sổ cổng khớp giờ → «chưa định danh».",
   macDinh: "hoi", chay: "người soi (chưa có cò)", tu: NGAY, moi: true, deXuat: true,
   quyDinh: [QD(17, "Vi phạm kiểm soát ra vào kho tổng hoặc đóng mở cổng để ra vào hoặc nhập/xuất hàng không đúng quy định mà không có sự đồng ý của cấp Quản lý", "5%", "Không")],
   giaiNghia: "QUY-ĐỊNH không có mục riêng cho bãi xe; 4 phiếu bãi xe đã xử (12016845, 12706045, 13014439, 13063346) đều ghi mục 17 → B3.2. Phương án khác: mục 25 «khu vực không được phép» (2%) — CẦN BẠN CHỌN.",
   khacCu: "02/10: LUẬT MỚI. Cũ: chỉ có án lệ 12016845 (người xác minh khoanh vùng xe PTCH vs bảo vệ/tạp vụ/OS trên ảnh). Mới: thêm 2 camera bạn chỉ định + cách định danh bằng giờ sổ cổng.",
   anLe: [{ phieu: "12016845", ghiChu: "05/2026 bãi xe NCC — bắt 1 xe PTCH, 2 xe bên cạnh của NCC (QL hỏi «3 xe sao bắt 1»)" }] },
 { ma: "CAM-04", nhom: "Camera", ten: "Lỗi hành vi tại chỗ → camera ở khu đó",
   tuKhoa: ["an uong", "nghi ngoi", "ccdc", "vpp", "chan loi di", "dua gion", "ly nuoc"],
   dieuKien: "Hạng mục ăn uống/nghỉ ngơi (24), CCDC-VPP-vật dụng cá nhân (8), chắn lối đi (25), đùa giỡn/làm việc riêng (26), tập trung (19) — không có lệnh WMS để truy",
   mayLam: "Theo CAM-03: tìm đồ vật/người trên camera khu đó, lùi tới người đặt/bỏ lại đồ → ghi sheet giờ + clip. Cùng người lặp lại nhiều ngày → ghi làm tình tiết. Nhiều người trong ảnh → ghi đủ từng người (CH-02).",
   macDinh: "hoi", chay: "người soi", tu: NGAY, moi: true, deXuat: true, quyDinh: null,
   khacCu: "02/10: LUẬT MỚI, gom cách làm của 27 phiếu B3 (CCDC 92% có clip, ăn uống 30%, 9/27 phiếu nhiều NV). Áp mục của phiếu.",
   anLe: [{ phieu: "12111702", ghiChu: "bình lọc nước cổng PO: «liên tục 2 ngày 2 ly nước đều là 1 nhân viên» (Minh Thám) — clip camera cổng" }] },
 { ma: "CH-04", nhom: "Chung", ten: "Chối mà không có bằng chứng → không đổi kết quả",
   dieuKien: "B1.1 ghi «Không phải lỗi cá nhân» nhưng không đưa bằng chứng mới (ảnh/clip/chấm công) phản bác bằng chứng B1",
   mayLam: "Đi tiếp như lỗi cá nhân. Chỉ trả về B1 khi NV đưa được bằng chứng ngược. Với kiem-giai-trinh-ai: AI chỉ kết luận ĐÚNG khi có sự thật đối chiếu được, không dựa lời giải trình.",
   macDinh: "hoi", chay: "kiem-giai-trinh-ai (chưa chạy thật)", tu: NGAY, moi: true, deXuat: true, quyDinh: null,
   khacCu: "02/10: LUẬT MỚI. Bối cảnh: 16/16 phiếu B3 NV chối không kèm bằng chứng đều vẫn bị ghi; 1 phiếu có bằng chứng ngược → trả B1 (11772738 «bạn Mỹ Trinh chứng minh được không làm việc riêng»). Khớp luật AI kiểm giải trình (01/10).",
   anLe: [{ phieu: "11772738", ghiChu: "trả về B1 vì NV chứng minh được không làm việc riêng" }] }];
for (const m of moi) { const i = j.luat.findIndex((x) => x.ma === m.ma); if (i >= 0) j.luat[i] = m; else j.luat.push(m); }
if (!Array.isArray(j.nhatKy)) j.nhatKy = j.nhatKy ? [j.nhatKy] : [];
j.nhatKy.push(NGAY + " (phiên an-le-b3): " + "Gộp luật từ 151 án lệ B3 + trả lời user: VS-03 (giữ, rõ chữ), SH-01 (3 dạng ảnh), TB-01/TB-03 (bối cảnh, gộp TB-04/TB-05); thêm ĐỀ XUẤT XE-01, BX-01, CAM-04, CH-04; bỏ VS-06. Trường khacCu = khác luật cũ + bối cảnh.");
fs.writeFileSync(F, JSON.stringify(j, null, 1) + "\n"); console.log("luật:", j.luat.length, "· có khacCu:", j.luat.filter((l) => l.khacCu).map((l) => l.ma).join(" "));

// ---- 02/10 chiều: user sửa lượt 2 ----
{
  const x = L("XE-01");
  if (!x.dieuKien.startsWith("Chỉ xét xe NV ĐÓNG mà NGƯỜI KHÁC SOẠN"))
    x.dieuKien = "Chỉ xét xe NV ĐÓNG mà NGƯỜI KHÁC SOẠN (tự soạn rồi tự đóng xe của mình KHÔNG vi phạm). " + x.dieuKien;
  x.khacCu = x.khacCu.replace(/ \| Lượt 2.*$/, "") + " | Lượt 2 (02/10 chiều, bạn sửa): thêm điều kiện người đóng ≠ người soạn. Đếm lại 1.845 xe: 50% là tự soạn tự đóng; số xe nghi vi phạm 302 → 99 (5,4%). Án lệ cũ đều là đóng xe người khác soạn nên kết quả chạy thử không đổi.";
  const b = L("BX-01");
  b.quyDinh = [QD(25, "Không trữ hay trưng bày hàng hóa, công cụ, văn phòng phẩm,... chắn lối đi hoặc tại khu vực không được phép", "2%", "Không")];
  b.giaiNghia = "Bạn chốt 02/10: tính mục 25 «khu vực không được phép» (2% → nhánh B3.1), KHÔNG dùng mục 17 như 4 phiếu bãi xe cũ.";
  b.khacCu = b.khacCu.replace(/ \| Lượt 2.*$/, "") + " | Lượt 2: mục 17 (5%) → mục 25 (2%) theo bạn chốt. Định danh: giờ chấm công gần như trùng lúc dựng xe (NV chấm bằng điện thoại, có khi TRƯỚC lúc dựng xe) → mỗi lượt gửi xe ra 2–4 người cùng phút; chỉ dùng kèm trang phục ở ảnh cổng.";
}
// ---- 02/10 chiều: user "cần chụp ảnh ghi lại những trường hợp này mỗi ngày để t ra quyết định và nhận diện" ----
{
  const b = L("BX-01");
  b.chay = "canh-bai-xe.mjs (task 5S Canh bai xe 10:15 + 14:45)";
  b.mayLam = "MỖI NGÀY canh-bai-xe.mjs: mẫu 5 s mỗi 3 phút (05:30–10:00, 12:00–14:30) → vùng bãi đổi rồi đứng yên = 1 lượt xe vào/ra → cắt đoạn ≤6 phút trước đó, chụp khung có người + ảnh cổng + chấm công gần giờ → Videos/5S-bang-chung/bai-xe/<ngày>/BAO-CAO.html để BẠN quyết và nhận diện. Máy KHÔNG nhận mặt, KHÔNG lập phiếu. Ảnh cổng chỉ nội bộ.";
}
fs.writeFileSync(F, JSON.stringify(j, null, 1) + "\n"); console.log("lượt 2 xong");
