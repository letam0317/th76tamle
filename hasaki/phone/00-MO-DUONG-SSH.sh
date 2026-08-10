#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
#  MỞ ĐƯỜNG SSH — chạy MỘT LẦN trong Termux trên Xiaomi 13
# ---------------------------------------------------------------------
#  Mục đích DUY NHẤT của file này: đưa điện thoại tới trạng thái
#  "ssh vào được từ máy tính". Sau bước này mọi việc còn lại làm từ xa,
#  bạn không phải chạm vào điện thoại nữa.
#
#  Nó KHÔNG cài dự án, KHÔNG đụng vào dữ liệu, KHÔNG cần root.
#  Chạy lại nhiều lần vẫn an toàn.
#
#  CÁCH CHẠY: mở Termux, gõ đúng 1 dòng:
#     curl -fsSL <link raw file này> | bash
#  hoặc chép file này vào máy rồi:  bash 00-MO-DUONG-SSH.sh
# =====================================================================
set -u

buoc() { echo; echo "==> $*"; }
loi()  { echo "!! $*" >&2; }

buoc "1/6 Cập nhật danh sách gói"
# -y để không hỏi; DEBIAN_FRONTEND tránh mọi prompt tương tác
pkg update -y >/dev/null 2>&1 || loi "pkg update lỗi — kiểm tra Wi-Fi rồi chạy lại"

buoc "2/6 Cài gói nền"
# nodejs-lts : chạy dự án            openssh : đường điều khiển từ xa
# git        : kéo mã nguồn          cronie  : lịch chạy trong ngày
# socat      : cầu nối tới trình duyệt (dùng ở giai đoạn sau)
# termux-api : đọc pin/nhiệt độ cho nhịp tim
pkg install -y nodejs-lts git openssh cronie socat termux-api || {
  loi "Cài gói thất bại. Nhiều khả năng Termux tải từ Play Store (bản hỏng)."
  loi "Gỡ đi, cài lại Termux từ F-Droid hoặc GitHub rồi chạy lại file này."
  exit 1
}

buoc "3/6 Giữ CPU thức (không để máy ngủ khi tắt màn hình)"
termux-wake-lock 2>/dev/null && echo "   đã bật" || echo "   (bỏ qua — sẽ bật lại sau)"

buoc "4/6 Đặt mật khẩu đăng nhập ssh"
# Termux không có mật khẩu mặc định. Lệnh passwd sẽ hỏi 2 lần.
if [ -s "$PREFIX/var/lib/termux-auth/passwd" ] 2>/dev/null || [ -f "$HOME/.ssh_da_dat_mk" ]; then
  echo "   đã đặt trước đó, bỏ qua"
else
  echo "   >>> Gõ một mật khẩu (màn hình sẽ KHÔNG hiện ký tự nào — bình thường), rồi gõ lại lần 2:"
  passwd && touch "$HOME/.ssh_da_dat_mk"
fi

buoc "5/6 Bật dịch vụ ssh"
pkill sshd 2>/dev/null
sshd && echo "   sshd đang chạy (cổng 8022)" || loi "sshd không khởi động được"

buoc "6/6 Tự bật lại sau khi khởi động máy"
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/10-ssh.sh" <<'BOOT'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
sshd
BOOT
chmod +x "$HOME/.termux/boot/10-ssh.sh"
echo "   đã đặt. (Cần app Termux:Boot — cài cùng nguồn với Termux)"

# ---------------------------------------------------------------------
echo
echo "====================================================="
echo " XONG. Gửi 3 dòng dưới đây cho người cấu hình giúp bạn:"
echo "====================================================="
echo -n " Địa chỉ IP : "
{ ip -4 addr show 2>/dev/null | grep -oE 'inet [0-9.]+' | grep -v '127.0.0.1' | awk '{print $2}' | head -1; } \
  || ifconfig 2>/dev/null | grep -oE 'inet [0-9.]+' | grep -v '127.0.0.1' | awk '{print $2}' | head -1
echo " Cổng       : 8022"
echo " Tài khoản  : $(whoami)"
echo
echo " Kiểm thử từ máy tính (thay <IP> bằng số ở trên):"
echo "     ssh -p 8022 $(whoami)@<IP>"
echo
echo " LƯU Ý: địa chỉ IP có thể đổi khi máy nối lại Wi-Fi."
echo " Nhờ IT đặt IP tĩnh, hoặc chạy lại file này để xem IP mới."
echo "====================================================="
