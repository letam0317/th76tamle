# -*- coding: utf-8 -*-
# Tạo mẫu giọng D bằng VieNeu-TTS (chạy CPU) từ kịch bản thử 60 giây.
#   cd giong/vieneu && uv run python ../vieneu-tao-mau.py [tên giọng có sẵn]
# Kết quả: giong/thu/D-vieneu-<giọng>.wav ; nếu có giong/mau-giong-cua-toi.wav thì thêm D-vieneu-clone.wav
import sys, time, pathlib
sys.stdout.reconfigure(encoding="utf-8")
G = pathlib.Path(__file__).resolve().parent
THU = G / "thu"; THU.mkdir(exist_ok=True)
lines = (G / "kich-ban-thu-60s.txt").read_text(encoding="utf-8").strip().splitlines()
body = "\n".join(lines[1:]).replace("[hạ giọng]", "").strip()   # bỏ dòng tiêu đề + thẻ chỉ dẫn
print(f"Kịch bản {len(body)} ký tự")

# Thư mục mã nguồn clone tên "vieneu" nằm cạnh script này → Python sẽ nhập nhầm thư mục đó thay vì gói đã cài.
# Bỏ thư mục chứa script khỏi đường tìm gói trước khi import.
import os
sys.path = [p for p in sys.path if os.path.abspath(p or ".") != str(G)]
from vieneu import Vieneu
t0 = time.time()
v = Vieneu()
print(f"Nạp model xong sau {time.time()-t0:.0f}s")
try:
    presets = v.list_preset_voices(); print("Giọng có sẵn:", [p[0] for p in presets])
except Exception as e:
    presets = []; print("Không liệt kê được giọng:", e)

muon = sys.argv[1] if len(sys.argv) > 1 else "Hải Đăng"
ten = muon if any(muon in (p if isinstance(p, str) else " ".join(map(str, p))) for p in presets) or not presets else (presets[0][0] if isinstance(presets[0], (list, tuple)) else presets[0])
t1 = time.time()
try:
    audio = v.infer(body, voice=ten)
except Exception as e:
    print(f"Giọng '{ten}' lỗi ({e}) → dùng giọng mặc định"); ten = "mac-dinh"; audio = v.infer(body)
out = THU / f"D-vieneu-{ten}.wav"
v.save(audio, str(out))
print(f"Xong {out.name} sau {time.time()-t1:.0f}s (RTF ước tính = thời gian tạo / ~60s âm thanh)")

ref = G / "mau-giong-cua-toi.wav"
if ref.exists():
    t2 = time.time()
    audio = v.infer(body, ref_audio=str(ref))
    v.save(audio, str(THU / "D-vieneu-clone.wav"))
    print(f"Clone giọng xong D-vieneu-clone.wav sau {time.time()-t2:.0f}s")
else:
    print("Chưa có giong/mau-giong-cua-toi.wav → bỏ qua clone. Thu 6–8 giây giọng sạch rồi chạy lại.")
