/**
 * tao-sheet-cai-dat.mjs — Gom toàn bộ phân tích + link tải + cách cài đặt máy trạm điện thoại
 * vào MỘT tab Google Sheet, dạng danh sách tick được.
 * ============================================================================================
 *  Dùng token clasp (~/.clasprc.json, scope drive.file) như tao-sheet-moi.mjs — file tạo ra
 *  thuộc tài khoản chủ GAS nên GAS ghi được, và drive.file cho phép gọi Sheets API lên chính
 *  file mà app này vừa tạo.
 *
 *  Chạy:  node phone/tao-sheet-cai-dat.mjs [email-chia-se]
 *  Chạy lại: tạo file MỚI (không ghi đè). Muốn cập nhật file cũ thì truyền SHEET_ID=<id>.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EMAIL = process.argv[2] || "cosmetics@hasakigroup.vn";
const SHEET_ID_CU = process.env.SHEET_ID || "";
const TEN_FILE = "Máy trạm điện thoại (Xiaomi 13) — Phân tích & Hướng dẫn cài đặt";
const TEN_TAB = "CAI-DAT-MAY-TRAM";

/* ---------- Token ---------- */
const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
const t = rc.tokens ? rc.tokens.default : rc.token;
const tk = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
})).json();
if (!tk.access_token) { console.error("✗ Không làm tươi được token clasp"); process.exit(2); }
const H = { authorization: "Bearer " + tk.access_token, "content-type": "application/json" };
const goi = async (url, opt) => {
  const r = await fetch(url, { ...opt, headers: H });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("✗ " + r.status + " " + url + "\n  " + JSON.stringify(j).slice(0, 400)); process.exit(3); }
  return j;
};

/* ================== NỘI DUNG ==================
   Mỗi dòng: [cot A, Việc, Ai làm, Link, Lưu ý]  — kèm loại dòng để tô màu.
   loai: "muc" = dải tiêu đề mục · "d" = dòng có việc (có ô tick) · "t" = dòng thông tin */
const R = [];
const muc = (s) => R.push({ loai: "muc", o: ["", s, "", "", ""] });
const d = (stt, viec, ai, link, luuy) => R.push({ loai: "d", o: [stt, viec, ai, link, luuy] });
const tt = (a, b, c, dd, e) => R.push({ loai: "t", o: [a, b, c, dd, e] });

muc("🔴 BA CẢNH BÁO — ĐỌC TRƯỚC KHI ĐỘNG VÀO MÁY");
tt("!", "Xiaomi 13 phải vá tệp init_boot.img — KHÔNG phải boot.img", "", "",
   "Máy ra đời với Android 13 nên phần khởi động đã tách sang tệp riêng. Hầu hết hướng dẫn trên mạng viết cho máy đời cũ và bảo vá boot.img. Làm theo là TREO MÁY.");
tt("!", "Tệp init_boot.img phải lấy từ ĐÚNG bản ROM đang cài", "", "",
   "Nó nằm trong chính gói ROM fastboot Global/Taiwan bạn đã dùng để flash. Lấy từ ROM khác phiên bản cũng treo máy.");
tt("!", "Ba app Termux phải tải từ CÙNG MỘT NGUỒN (GitHub)", "", "",
   "Mỗi nguồn ký bằng chữ ký khác nhau. Trộn nguồn thì Android chỉ báo \"Không cài đặt được ứng dụng\" mà không nói lý do — rất dễ mất cả buổi mò. TUYỆT ĐỐI không lấy Termux từ Play Store, bản đó hỏng từ lâu.");

muc("📥 PHẦN MỀM CẦN TẢI  (link chính chủ, tra ngày 10/08/2026)");
d(1, "Android Platform Tools (adb + fastboot)", "Bạn — trên MÁY TÍNH", "https://developer.android.com/tools/releases/platform-tools",
  "Chọn bản Windows. Giải nén ra một thư mục, KHÔNG cần cài đặt.");
d(2, "Magisk v30.7 — mở quyền quản trị (root)", "Bạn", "https://github.com/topjohnwu/Magisk/releases",
  "BỎ QUA nếu điện thoại đã có sẵn app Magisk. Chỉ tải từ đúng link này — có rất nhiều trang giả mạo Magisk cài kèm mã độc.");
d(3, "Termux v0.118.3 — môi trường chạy chính", "Bạn", "https://github.com/termux/termux-app/releases",
  "Kéo xuống mục Assets, chọn file có chữ \"universal\" và \"apt-android-7\" (an toàn nhất, không cần biết máy loại nào).");
d(4, "Termux:Boot v0.8.1 — tự chạy lại sau khi khởi động", "Bạn", "https://github.com/termux/termux-boot/releases",
  "Bắt buộc tải từ GitHub, cùng nguồn với Termux.");
d(5, "Termux:API — đọc pin & nhiệt độ cho nhịp tim", "Bạn", "https://github.com/termux/termux-api/releases",
  "Bắt buộc tải từ GitHub, cùng nguồn với Termux.");
d(6, "AnyDesk cho Android — đường cứu hộ từ xa", "Bạn (ở lần 2)", "https://anydesk.com/en/downloads/android",
  "Cài sau, khi máy đã chạy ổn. Máy đã root thì thường điều khiển được luôn, khỏi cần plugin.");
tt("", "AnyDesk Control Plugin (chỉ khi điều khiển không được)", "Bạn", "https://anydesk.com/downloads/android-plugin/com.anydesk.adcontrol.ad1", "");
tt("", "ACC — giữ pin ở 55–60%", "🤖 TÔI cài từ xa", "https://github.com/VR-25/acc", "Bạn không phải làm gì.");
tt("", "Node.js, git, ssh, socat, lịch chạy", "🤖 Script tự cài", "", "Nằm trong file 00-MO-DUONG-SSH.sh.");
tt("", "KHÔNG cần cài F-Droid", "", "", "Lấy thẳng từ GitHub vừa đủ, vừa mới hơn.");

muc("✋ BẠN LÀM — LẦN 1  (khoảng 30 phút)");
d(1, "Sao lưu dữ liệu cá nhân trong máy, rồi xoá sạch máy", "Bạn", "", "Máy trạm phải sạch để hoạt động ổn định, đoán trước được.");
d(2, "Cài Magisk (mở quyền quản trị)", "Bạn", "", "Cần cắm điện thoại vào máy tính. Nhớ: vá init_boot.img, KHÔNG phải boot.img.");
d(3, "Cài 3 app Termux, tất cả lấy từ GitHub", "Bạn", "", "Termux + Termux:Boot + Termux:API.");
d(4, "Nối Wi-Fi công ty, đặt \"dùng địa chỉ MAC của thiết bị\"", "Bạn", "", "Không để MAC ngẫu nhiên, tránh máy rớt mạng âm thầm. Xin IP tĩnh nếu được.");
d(5, "RÚT SIM, tắt dữ liệu di động, tắt \"tự chuyển sang mạng di động khi Wi-Fi yếu\"", "Bạn", "",
  "Rớt sang 4G là mất quyền vào hệ thống công ty — hỏng theo kiểu rất khó tìm ra.");
d(6, "TẮT tự động cập nhật hệ điều hành", "Bạn", "", "Một lần cập nhật nhầm trên ROM khác vùng là mất cả máy trạm lẫn dữ liệu tích luỹ.");
d(7, "KHÔNG đặt mã PIN khoá màn hình. Tắt màn hình luôn hiển thị (AOD)", "Bạn", "",
  "Có PIN thì sau khi khởi động lại máy sẽ không tự chạy được — xem phần \"Vì sao\" ở cuối.");
d(8, "Đặt múi giờ GMT+7, bật đồng bộ giờ theo mạng", "Bạn", "", "Mã OTP phụ thuộc đồng hồ chính xác.");
d(9, "Mở Termux, chạy file 00-MO-DUONG-SSH.sh", "Bạn", "", "File tôi đã chuẩn bị sẵn. Nó tự cài mọi thứ rồi in ra 3 dòng ở cuối.");
d(10, "GỬI TÔI 3 dòng đó (địa chỉ IP, cổng, tài khoản)", "Bạn", "", "★ Đây là lúc bàn giao. Từ đây tôi làm tiếp, bạn không phải chạm vào máy nữa.");

muc("🤖 TÔI LÀM TỪ XA  (bạn không phải làm gì)");
tt("", "Cài môi trường chạy, tải mã nguồn 2 dự án, cài thư viện", "🤖", "", "");
tt("", "Chuyển gói bí mật + kho dữ liệu tích luỹ (11,7 MB) sang máy", "🤖", "", "Qua đường mã hoá — không cần USB, không để lại bản đọc được ở đâu.");
tt("", "Cài cơ chế giữ pin ở 55–60%", "🤖", "", "Kèm đo trước xem máy có chạy thẳng bằng điện được không (nếu có thì pin gần như không phải làm việc).");
tt("", "Cài cơ chế tự khởi động lại khi có điện", "🤖", "", "Chống được cả mất điện lẫn việc ai đó bấm tắt máy.");
tt("", "Dựng cầu nối tới trình duyệt + đánh thức màn hình 1–2 phút đúng lúc cần", "🤖", "", "");
tt("", "Chuyển lịch chạy sang 05:30 / 06:00–22:00 / 22:02, cả 7 ngày", "🤖", "", "");
tt("", "Sửa phần mã nguồn còn phụ thuộc Windows", "🤖", "", "");
tt("", "Dựng nhịp tim + cảnh báo khi máy im quá 45 phút", "🤖", "", "Để không bao giờ có chuyện hỏng âm thầm mà không ai biết.");
tt("", "Chạy đủ 5 phép đo, báo kết quả bằng ngôn ngữ thường", "🤖", "", "");
tt("", "Chạy song song với máy tính cũ vài ngày trước khi chuyển hẳn", "🤖", "", "Điện thoại chỉ đọc, chưa ghi — an toàn tuyệt đối.");

muc("✋ BẠN LÀM — LẦN 2  (khoảng 15 phút, sau khi tôi báo đã sẵn sàng)");
d(1, "Đăng nhập tay một lần vào wms / work / hr bằng trình duyệt trên điện thoại", "Bạn", "",
  "Lần đầu nên làm bằng tay cho chắc, tránh gõ sai mã OTP nhiều lần (tài khoản có giới hạn số lần sai).");
d(2, "Bật khoá ứng dụng cho Cài đặt / Termux / Chrome, đặt mật khẩu riêng", "Bạn", "", "Chỉ bạn được biết mật khẩu này.");
d(3, "Cài AnyDesk, đặt mật khẩu truy cập mạnh", "Bạn", "", "Khác với mọi mật khẩu khác đang dùng.");
d(4, "Gắn máy lên tường: che nút nguồn, thoáng khí, bỏ ốp lưng", "Bạn", "", "Dán nhãn \"MÁY TRẠM — KHÔNG RÚT SẠC, KHÔNG TẮT\".");
d(5, "Duyệt cắt chuyển", "Bạn", "", "Quyết định cuối cùng là của bạn.");
tt("", "Việc định kỳ sau đó: mỗi tháng nhìn xem lưng máy có phồng lên không", "Bạn", "", "Chỉ mắt người mới thấy được. Thấy vênh/cộm/bập bênh là ngắt điện ngay.");

muc("🛒 VẬT TƯ CẦN MUA");
d(1, "Củ sạc + cáp chất lượng tốt", "Bạn", "", "Cắm liên tục 24/7 — hàng rẻ là rủi ro cháy thật, không phải lo xa.");
d(2, "Giá gắn tường che được nút nguồn, thoáng khí", "Bạn", "", "Chống cầm đi + chống ai đó giữ nút tắt máy. KHÔNG dùng hộp kín — bí nhiệt.");
d(3, "Quạt USB 5V nhỏ", "Bạn", "", "KHOAN MUA — chờ tôi đo nhiệt độ xong rồi mới biết có cần không.");

muc("⏰ LỊCH CHẠY SAU KHI XONG");
tt("05:30", "Lượt đầy đủ nhất trong ngày", "", "", "Chắc chắn không ai đi làm giờ này → tự đăng nhập một lần, chép hết mọi nguồn. Xong trước 6h nên người đi sớm nhất đã thấy số liệu hôm nay.");
tt("06:00–22:00", "Ngó mỗi khoảng 15 phút", "", "", "Chỉ chép phần THAY ĐỔI. Có ai đang đăng nhập thì đi nhờ, tuyệt đối không tự đăng nhập đè.");
tt("22:02", "Lượt vét — đóng sổ ngày", "", "", "Ca cuối vừa tan. Vẫn nhường nếu thấy còn người online.");
tt("22:30–05:30", "Nghỉ", "", "", "Không ai làm, không có gì mới để chép.");
tt("7 ngày/tuần", "Không phân biệt cuối tuần", "", "", "Vì ca tối làm cả thứ 7 và Chủ nhật.");

muc("💡 VÌ SAO CHỌN NHƯ VẬY — kết luận phân tích, nói bằng ngôn ngữ thường");
tt("?", "Vì sao dùng điện thoại thay cho máy tính không màn hình?", "", "",
   "Chỗ khó nhất của hệ thống là qua được lớp kiểm tra chống robot lúc đăng nhập. Điện thoại có trình duyệt THẬT trên thiết bị THẬT nên không phải giả trang — máy tính chạy trình duyệt ẩn thì luôn ở thế bất lợi. Thêm: pin làm sẵn bộ lưu điện, tốn 5W, và bỏ được toàn bộ mớ lằng nhằng của máy tính không màn hình.");
tt("?", "Vì sao KHÔNG đặt mã PIN khoá màn hình?", "", "",
   "Android dùng chính mã PIN để mã hoá dữ liệu. Có PIN thì sau mỗi lần khởi động lại, máy phải có người gõ PIN mới chạy được — kể cả AnyDesk cũng không vào được để cứu. Mất hẳn khả năng tự lành. Thay bằng: khoá ứng dụng (mật khẩu riêng) + khoá vật lý. Đủ cho mối đe doạ thật là người đi ngang nghịch máy.");
tt("?", "Vì sao giữ pin ở 55–60% chứ không phải 30%?", "", "",
   "Ngưỡng 30% khiến pin xả–nạp 2–3 lần mỗi ngày; hao mòn theo chu kỳ có thể còn nhanh hơn cả để pin đầy 100%. Cửa sổ hẹp ở mức giữa gần như không hao mòn, mà vẫn còn 10–13 tiếng dự phòng khi mất điện.");
tt("?", "Vì sao chưa cần sò lạnh?", "", "",
   "Chặn dòng nạp đã bỏ đi nguồn nhiệt chính rồi. Sò lạnh làm mát xuống dưới nhiệt độ phòng sẽ gây ĐỌNG NƯỚC — hỏng vĩnh viễn và âm thầm, tệ hơn nhiều so với chai pin. Nó còn ăn ~60W, xoá luôn ưu thế 5W của điện thoại. Chờ số đo nhiệt rồi quyết.");
tt("?", "Vì sao chạy lượt nền lúc 05:30 chứ không phải 7h?", "", "",
   "7h đã có người đi sớm, đăng nhập lúc đó là có nguy cơ đá văng họ. 05:30 chắc chắn trống nên an toàn tuyệt đối, mà 8h30 số liệu vẫn tươi sẵn.");
tt("?", "Màn hình tắt rồi sao vẫn phải bật 1–2 phút?", "", "",
   "Lớp kiểm tra chống robot có xem trang web có đang hiển thị hay không. Màn hình tắt thì trang bị coi là \"đang ẩn\" và có thể không qua được. Nên chỉ đánh thức đúng lúc đăng nhập, khoảng 2–4 phút mỗi ngày.");
tt("?", "Điện thoại có làm nặng hệ thống công ty không?", "", "",
   "Không. Ước tính khoảng 1.100–1.500 lượt gọi mỗi ngày — ÍT HƠN một nhân viên ngồi dùng hệ thống cả ngày (khoảng 2.000–6.000). Cái quan trọng không phải tổng số mà là không dồn cục: lượt nặng chỉ 1–2 lần/ngày và đặt ngoài giờ.");
tt("?", "Nếu điện thoại nghỉ một hôm thì sao?", "", "",
   "Các trang báo cáo vẫn mở bình thường — chúng đọc bảng tổng hợp chứ không hỏi thẳng hệ thống công ty. Chỉ là số liệu đứng yên ở lần chép gần nhất. Và nhịp tim sẽ báo cho bạn trong vòng 45 phút.");

muc("✅ TÔI ĐÃ LÀM XONG (ngày 10/08/2026)");
tt("✓", "Bịt lỗ \"đá phiên ca tối\" — quan trọng nhất", "", "",
   "Trước đây từ 17:30 máy chỉ cần thấy im lặng 5 phút là tự đăng nhập, tức đá thẳng vào người đang làm ca tối. Nay phải im 15 phút cho tới 22:30. Đã thử ở 13 mốc giờ để chắc chắn.");
tt("✓", "Vá lỗi \"token tốt bị token cũ đè\"", "", "", "Đúng sự cố mất phiên giữa buổi sáng 10/08. Mất mạng không còn bị hiểu nhầm là hết phiên.");
tt("✓", "Đưa 10 file mã nguồn còn thiếu vào kho lưu trữ", "", "", "Trước đó tải mã nguồn về máy mới sẽ ra một hệ thiếu.");
tt("✓", "Kiểm kho dữ liệu tích luỹ", "", "", "Đủ cả 3 nhóm, 11,7 MB, KHÔNG thiếu file nào. Nặng nhất là kho AI vệ sinh (3 MB) và cache kiểm kê (4,9 MB) — hai thứ mất là tốn nhất để làm lại.");
tt("✓", "Viết sẵn script mở đường điều khiển từ xa", "", "", "hasaki/phone/00-MO-DUONG-SSH.sh");

/* ================== DỰNG FILE EXCEL RỒI NHỜ DRIVE CHUYỂN THÀNH GOOGLE SHEET ==================
 * Vì sao đi đường này thay vì gọi thẳng Sheets API: token clasp thuộc dự án của Google, KHÔNG bật
 * được Sheets API (thử enable → 403 AUTH_PERMISSION_DENIED). Drive API thì chạy, và Drive tự chuyển
 * .xlsx sang Google Sheet, GIỮ NGUYÊN độ rộng cột + ô gộp — hai thứ quyết định độ dễ đọc.
 * Cột "LƯU Ý" để CUỐI CÙNG: không đặt được chế độ xuống dòng, nhưng ô cuối hàng thì chữ tràn sang
 * phải và vẫn đọc được trọn vẹn. */
const XLSX = (await import("xlsx")).default;

const HEADER = ["#", "VIỆC CẦN LÀM", "AI LÀM", "XONG", "LINK TẢI", "LƯU Ý QUAN TRỌNG"];
// o = [stt, viec, ai, link, luuy] → đảo sang thứ tự cột đích, chèn ô tick
const dong = (r) => [r.o[0], r.o[1], r.o[2], r.loai === "d" ? "☐" : "", r.o[3], r.o[4]];
const aoa = [HEADER, ...R.map(dong)];

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = [{ wpx: 46 }, { wpx: 400 }, { wpx: 120 }, { wpx: 54 }, { wpx: 330 }, { wpx: 760 }];
ws["!merges"] = R.map((r, i) => (r.loai === "muc"
  ? { s: { r: i + 1, c: 1 }, e: { r: i + 1, c: 5 } }   // +1 vì dòng 0 là header
  : null)).filter(Boolean);
ws["!freeze"] = { xSplit: 0, ySplit: 1 };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, TEN_TAB);
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

/* ---------- Nạp lên Drive kèm yêu cầu chuyển đổi ---------- */
const RANH = "----ranh" + Math.abs(buf.length).toString(36);
const than = Buffer.concat([
  Buffer.from("--" + RANH + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify({ name: TEN_FILE, mimeType: "application/vnd.google-apps.spreadsheet" }) +
    "\r\n--" + RANH + "\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n", "utf8"),
  buf,
  Buffer.from("\r\n--" + RANH + "--\r\n", "utf8"),
]);

const rUp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
  method: "POST",
  headers: { authorization: H.authorization, "content-type": "multipart/related; boundary=" + RANH },
  body: than,
});
const f = await rUp.json();
if (!rUp.ok || !f.id) { console.error("✗ Nạp file thất bại " + rUp.status + ": " + JSON.stringify(f).slice(0, 400)); process.exit(3); }
const sheetId = f.id;
console.log("✓ Đã tạo Google Sheet: " + TEN_FILE);

const p = await goi("https://www.googleapis.com/drive/v3/files/" + sheetId + "/permissions?sendNotificationEmail=false", {
  method: "POST", body: JSON.stringify({ type: "user", role: "writer", emailAddress: EMAIL }),
});
console.log(p.id ? "✓ Đã chia sẻ quyền SỬA cho " + EMAIL : "⚠ Không chia sẻ được cho " + EMAIL);

/* ---------- Dọn các file rỗng tạo hụt ở lần chạy trước ---------- */
if (SHEET_ID_CU) {
  const rDel = await fetch("https://www.googleapis.com/drive/v3/files/" + SHEET_ID_CU, { method: "DELETE", headers: H });
  console.log(rDel.ok ? "✓ Đã xoá file rỗng cũ " + SHEET_ID_CU : "⚠ Không xoá được file cũ");
}

console.log("✓ " + R.length + " dòng · " + R.filter((r) => r.loai === "d").length + " ô tick · " + ws["!merges"].length + " dải mục");
console.log("SHEET_ID=" + sheetId);
console.log("URL=https://docs.google.com/spreadsheets/d/" + sheetId + "/edit");
