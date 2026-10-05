#!/data/data/com.termux/files/usr/bin/bash
# Nut "Sua thong bao" (Termux:Widget) - dat lai 3 lop sua thong bao cho Xiaomi 17 Pro.
# Chi dung toi dich vu Google (com.google.android.gms) + 1 cai dat mang. Khong doc/doi app khac.
# Can: Tuy chon nha phat trien + Go loi USB + Go loi USB (Cai dat bao mat) dang BAT.
D=localhost:5555
GMS=com.google.android.gms
echo "=== SUA THONG BAO XIAOMI ==="
# chan doan ngan (ghi ~/chan-doan.txt): mang noi bo + internet cua Termux
{ date '+%F %T'; (timeout 4 bash -c 'echo > /dev/tcp/127.0.0.1/5555' 2>&1 && echo "cong5555=OK" || echo "cong5555=CHAN");
  (timeout 4 bash -c 'echo > /dev/tcp/8.8.8.8/53' 2>&1 && echo "internet=OK" || echo "internet=CHAN"); } > ~/chan-doan.txt 2>&1
pkill -9 -x adb >/dev/null 2>&1
# noi moi hoan toan (bat/tat Tuy chon nha phat trien lam ket noi cu chet ma adb van tuong con song)
adb kill-server >/dev/null 2>&1
adb start-server >/dev/null 2>&1
adb connect $D >/dev/null 2>&1
ok=""
for i in 1 2 3 4 5 6; do
  ok=$(timeout 8 adb -s $D shell echo ok 2>/dev/null | tr -d '\r')
  [ "$ok" = "ok" ] && break
  sleep 2; adb connect $D >/dev/null 2>&1
done
if [ "$ok" != "ok" ]; then
  st=$(adb -s $D get-state 2>&1 | tr -d '\r')
  echo "LOI: khong ket noi duoc go loi. ($st)"
  echo " - Kiem tra da BAT Tuy chon nha phat trien + Go loi USB."
  echo " - Neu vua khoi dong lai may: can cam may tinh chay SUA-THONG-BAO-XIAOMI.bat 1 lan (mo lai cong 5555)."
  echo " - Neu dien thoai hoi 'Cho phep go loi' -> bam Cho phep roi bam nut lai."
  read -p "Bam Enter de dong" _; exit 1
fi
S() { adb -s $D shell "$@" 2>/dev/null | tr -d '\r'; }
W() {
  { echo "W: $1 $2 $3 $4"; adb -s $D shell appops set com.android.shell WRITE_SETTINGS allow 2>&1 | head -2
    adb -s $D shell "$@" 2>&1 | head -3 | cut -c1-160
    adb -s $D shell appops set com.android.shell WRITE_SETTINGS default 2>&1 | head -2; } >> ~/chan-doan.txt
}
# lop 1
[ "$(S settings get system cloud_sleepmode_networkpolicy_enabled)" != "off" ] && W settings put system cloud_sleepmode_networkpolicy_enabled off
# lop 2
cur=$(S settings get system MILLET_NO_RESTRICT_APP)
if ! printf '%s' "$cur" | tr ',' '\n' | sed 's/ //g' | grep -qx "$GMS"; then
  cur=$(printf '%s' "$cur" | tr -d ' ')   # bo khoang trang (Xiaomi ghi "a, b")
  if [ -z "$cur" ] || [ "$cur" = "null" ]; then new=$GMS; else new="$cur,$GMS"; fi
  W settings put system MILLET_NO_RESTRICT_APP "'$new'"
fi
# lop 3
S dumpsys greezer IM GMS disable >/dev/null
# kiem tra
r1=$(S settings get system cloud_sleepmode_networkpolicy_enabled)
r2=$(S settings get system MILLET_NO_RESTRICT_APP | tr ',' '\n' | sed 's/ //g' | grep -cx "$GMS")
r3=$(S "dumpsys greezer | grep -m1 GmsLimit")
[ "$r1" = off ] && echo "Lop 1 - tat ngat mang khi ngu    : OK" || echo "Lop 1: LOI (bat Go loi USB (Cai dat bao mat))"
[ "$r2" = 1 ]   && echo "Lop 2 - Google khong bi dong bang : OK" || echo "Lop 2: LOI (bat Go loi USB (Cai dat bao mat))"
echo "$r3" | grep -q false && echo "Lop 3 - tat gioi han Google      : OK" || echo "Lop 3: LOI"
echo "$(date '+%F %T') l1=$r1 l2=$r2 l3=$(echo "$r3" | grep -c false)" >> ~/sua-thong-bao.log
adb disconnect $D >/dev/null 2>&1
echo ""
echo "XONG. Gio TAT Tuy chon nha phat trien (de VietinBank chay)."
read -p "Bam Enter de dong" _
