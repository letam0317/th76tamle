"""
sheet-b1-treo.py — dựng lại Google Sheet "PHIẾU B1 TREO" (WF591) cho NGƯỜI ĐỌC, dùng lâu dài.

  Sheet 1LKUszPO… (letam0317, không chia sẻ). Bố cục 3 tab:
    • PHIẾU B1 TREO   — trang người đọc: 1 dòng tình trạng, cách dùng, bảng gọn 12 cột; cột VÀNG =
                         quyết định của bạn (dropdown) + ghi chú. Phiếu còn mở lên trước, đã đóng xuống
                         cuối (chữ xám).
    • BẰNG CHỨNG      — chữ đầy đủ máy truy vết (ảnh, lịch sử WMS, NV nghi, camera, clip) cho các phiếu
                         đã soi; trang chính chỉ tóm tắt.
    • DU-LIEU-MAY     — (ẨN) 19 cột thô bản 25/09 + 29/09; nguồn cho các lần dựng lại.
  Công cụ khác muốn ghi "đã xử lý"/clip/NV nghi → ghi vào .exports/b1-treo-cap-nhat.json
  ({mã phiếu: {tên cột DU-LIEU-MAY: giá trị}}), rồi chạy lại script này (sổ đè lên dữ liệu thô).

  Tình trạng hôm nay lấy từ .exports/tasks-cache.json (dây chuyền 5S làm tươi) ⇒ 0 lượt gọi work/wms/hr.
  Quyết định + ghi chú của bạn đọc lại từ tab PHIẾU B1 TREO theo mã phiếu ⇒ không mất qua các lần dựng lại.
  Nạp ĐÈ cùng fileId (link giữ nguyên; gid đổi mỗi lần nạp — đừng dùng link #gid=).

  Cách chạy:  python sheet-b1-treo.py          (diễn tập: chỉ dựng file .xlsx tạm, in tình trạng)
              python sheet-b1-treo.py --lam    (nạp đè lên Sheet + đọc lại để QC)
"""
import io, json, math, os, re, sys, datetime as dt, urllib.request, urllib.parse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

sys.stdout.reconfigure(encoding="utf-8")
DIR = os.path.dirname(os.path.abspath(__file__))
SHEET_ID = "1LKUszPOSmJJdAQvX8txhoubtDyyjs7_zenFk_-9v0rU"
TAB_DOC, TAB_QT, TAB_BC, TAB_MAY = "PHIẾU B1 TREO", "QUY TẮC XÁC MINH", "BẰNG CHỨNG", "DU-LIEU-MAY"
COT_QD, COT_GC = "QUYẾT ĐỊNH CỦA BẠN", "Ghi chú của bạn"
LAM = "--lam" in sys.argv
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
now = dt.datetime.now()

# ── token clasp (Drive v3) ─────────────────────────────────────────────────────────────────────────
def token():
    rc = json.load(open(os.path.join(os.path.expanduser("~"), ".clasprc.json"), encoding="utf8"))
    t = rc["tokens"]["default"] if "tokens" in rc else rc["token"]
    body = urllib.parse.urlencode({"client_id": t["client_id"], "client_secret": t["client_secret"],
                                   "refresh_token": t["refresh_token"], "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", body))["access_token"]

TK = token()
def http(url, data=None, method=None, headers=None):
    h = {"authorization": "Bearer " + TK, **(headers or {})}
    return urllib.request.urlopen(urllib.request.Request(url, data=data, method=method, headers=h)).read()

def tai_ve():
    return load_workbook(io.BytesIO(http("https://www.googleapis.com/drive/v3/files/%s/export?mimeType=%s"
                                         % (SHEET_ID, urllib.parse.quote(XLSX)))))

def nap_de(buf):
    b = "b1treo" + now.strftime("%H%M%S")
    meta = json.dumps({"mimeType": "application/vnd.google-apps.spreadsheet"}).encode()
    body = (b"--" + b.encode() + b"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta +
            b"\r\n--" + b.encode() + b"\r\nContent-Type: " + XLSX.encode() + b"\r\n\r\n" + buf +
            b"\r\n--" + b.encode() + b"--")
    http("https://www.googleapis.com/upload/drive/v3/files/%s?uploadType=multipart" % SHEET_ID, body, "PATCH",
         {"content-type": "multipart/related; boundary=" + b})

# ── đọc bản đang có ────────────────────────────────────────────────────────────────────────────────
def ma_phieu(cell):
    s = (cell.hyperlink.target if cell.hyperlink and cell.hyperlink.target else "") + " " + str(cell.value or "")
    m = re.search(r"task_id=(\d+)", s) or re.search(r"\b(1\d{7})\b", s)
    return m.group(1) if m else None

def doc_bang(ws, dong_tieu_de):
    hdr = [str(c.value or "").strip() for c in ws[dong_tieu_de]]
    out = []
    for r in ws.iter_rows(min_row=dong_tieu_de + 1):
        if not any(c.value not in (None, "") for c in r): continue
        out.append((r, {hdr[i]: r[i].value for i in range(len(hdr)) if hdr[i]}))
    return hdr, out

wb0 = tai_ve()
ten_tab = [w.title for w in wb0]
ws_may = wb0[TAB_MAY] if TAB_MAY in ten_tab else wb0.worksheets[0]   # lần đầu: tab thô 25/09 là tab đầu
HDR_MAY, tho = doc_bang(ws_may, 1)
RAW = {}
for r, d in tho:
    i = ma_phieu(r[HDR_MAY.index("Link task")])
    if i: RAW[i] = [c.value for c in r[:len(HDR_MAY)]]
# Kết quả cò canh-b1.mjs: phiếu treo B1 mới (chưa có trong bảng) → thêm dòng thô từ tasks-cache.
KQ = {}
try: KQ = json.load(open(os.path.join(DIR, ".exports", "canh-b1-ketqua.json"), encoding="utf8"))
except FileNotFoundError: pass
_C0 = json.load(open(os.path.join(DIR, ".exports", "tasks-cache.json"), encoding="utf8"))
_by = {re.search(r"task_id=(\d+)", v[1]).group(1): v for v in _C0["rows"].values() if re.search(r"task_id=(\d+)", v[1] or "")}
for i, k in KQ.items():
    if i in RAW or i not in _by or k.get("luat") == "VS": continue
    v = _by[i]; moi = [None] * len(HDR_MAY)
    for ten, gt in (("STT", len(RAW) + 1), ("Link task", "https://work.hasaki.vn/tasks?task_id=" + i), ("Ngày ghi nhận", v[_C0["header"].index("Ngày vi phạm:")]),
                    ("Vị trí", v[_C0["header"].index("Vị trí ghi nhận")]), ("Hạng mục", v[_C0["header"].index("Lỗi vi phạm")]), ("Nhóm", "Máy thêm " + now.strftime("%d/%m"))):
        if ten in HDR_MAY: moi[HDR_MAY.index(ten)] = gt
    RAW[i] = moi
# Sổ cập nhật của máy: {mã phiếu: {tên cột DU-LIEU-MAY: giá trị}} — công cụ khác ghi vào đây rồi chạy lại script.
SO_CAP_NHAT = os.path.join(DIR, ".exports", "b1-treo-cap-nhat.json")
try:
    for i, cot in json.load(open(SO_CAP_NHAT, encoding="utf8")).items():
        if i in RAW:
            for ten, gt in cot.items():
                if ten in HDR_MAY: RAW[i][HDR_MAY.index(ten)] = gt
except FileNotFoundError:
    pass
qd = {}
if TAB_DOC in ten_tab:   # quyết định bạn đã ghi ở các lần trước
    ws = wb0[TAB_DOC]
    dong = next(r for r in range(1, 12) if ws.cell(r, 1).value == "Phiếu")
    hdr, rows = doc_bang(ws, dong)
    for r, d in rows:
        i = ma_phieu(r[0])
        if i: qd[i] = (d.get(COT_QD) or "", d.get(COT_GC) or "")
for i, v in RAW.items():   # cột K bản thô ("GHI CHÚ (bạn điền)") nếu trước đó bạn đã gõ vào
    k = v[HDR_MAY.index("GHI CHÚ (bạn điền)")] if "GHI CHÚ (bạn điền)" in HDR_MAY else None
    if k and not (qd.get(i, ("", ""))[1]): qd[i] = (qd.get(i, ("", ""))[0], k)

# ── tình trạng hôm nay từ tasks-cache ──────────────────────────────────────────────────────────────
C = json.load(open(os.path.join(DIR, ".exports", "tasks-cache.json"), encoding="utf8"))
H = C["header"]
CACHE = {re.search(r"task_id=(\d+)", v[1]).group(1): v for v in C["rows"].values() if re.search(r"task_id=(\d+)", v[1] or "")}
BUOC = [h[:-len(" ▸ Status")] for h in H if h.endswith(" ▸ Status")]
TEN_BUOC = lambda b: "Điều hướng" if b.startswith("Điều") else b.split(" ")[0].rstrip(".")
def ngay(s):
    try: return dt.datetime.strptime(str(s)[:19], "%Y-%m-%d %H:%M:%S")
    except Exception: return None

def tinh_trang(i):
    """→ (chữ, mức) mức: 'dong' | 'do' (≥14 ngày) | 'cam' (≥3) | 'xanh'"""
    v = CACHE.get(i)
    if not v: return ("Không thấy trong dữ liệu 5S (có thể đã bị xoá)", "dong")
    st = {b: v[H.index(b + " ▸ Status")] for b in BUOC if v[H.index(b + " ▸ Status")] not in ("", None)}
    if v[3] == "Finished":
        if any(s == "Failed" for s in st.values()): return ("Đã đóng — fail (không ghi lỗi)", "dong")
        b1 = st.get("B1. Xác minh lỗi vi phạm")
        if b1 == "Canceled" or (st and list(st.values())[-1] == "Canceled"): return ("Đã đóng — dừng/huỷ", "dong")
        return ("Đã đóng", "dong")
    mo = [b for b, s in st.items() if s == "None"]
    if not mo: return ("Đang mở", "xanh")
    b = mo[-1]
    g = ngay(v[H.index(b + " ▸ Ngày giao")]) if (b + " ▸ Ngày giao") in H else None
    n = (now - g).days if g else None
    ten = {"B1": "B1 — chờ xác minh", "B1.1": "B1.1 — chờ NV xác nhận", "Điều hướng": "bước Điều hướng"}.get(TEN_BUOC(b), TEN_BUOC(b))
    chu = "Còn treo ở %s" % ten + (" · %d ngày" % n if n is not None else "")
    return (chu, "do" if (n or 0) >= 14 else "cam" if (n or 0) >= 3 else "xanh")

# ── dịch nhãn máy sang câu thường ──────────────────────────────────────────────────────────────────
VI_SAO = {
    "Vi phạm thao tác/bảo quản (A2)": "Lỗi thao tác/bảo quản hàng (không phải vệ sinh) — máy chưa có luật tự tìm người",
    "Vị trí không có trong bảng phân công": "Vị trí chưa có người phụ trách trong bảng phân công vệ sinh",
    "Khu WH": "Khu WH chưa có bảng phân công vệ sinh",
    "Vệ sinh chưa đạt (báo cáo rồi vẫn bẩn)": "Đã báo cáo vệ sinh nhưng vẫn bị ghi lỗi bẩn",
    "Thiếu ngày ghi nhận → không xác định ca": "Phiếu thiếu ngày ghi nhận nên không biết ca nào",
    "Phụ trách nghỉ (ngắn)": "Người phụ trách nghỉ 1–2 ngày",
    "Phụ trách nghỉ (dài)": "Người phụ trách nghỉ dài (từ 3 ngày)",
    "Task rác": "Phiếu tạo nhầm/thử",
    "Đi làm KHÔNG báo cáo": "Người phụ trách có đi làm nhưng không báo cáo vệ sinh",
}
GOI_Y = {
    "Xác minh tay (camera)": "Xem camera rồi quyết người",
    "Suy từ task 1297 theo ngày / bổ sung phân công": "Lấy người trực khu theo task hằng ngày; nên bổ sung bảng phân công",
    "Suy từ task 1297 (khu) theo ngày": "Lấy người trực khu theo task hằng ngày",
    "Cò tự gán người + đẩy B1.1 (tự động)": "Gán người phụ trách kệ và chuyển B1.1",
    "CHỜ quy tắc phụ trách nghỉ": "Áp luật người phụ trách nghỉ (nhắc QLTT / ghi cho QLTT)",
    "Xử tay": "Bạn xử tay",
    "Huỷ": "Huỷ phiếu",
}
NHOM = {"A1": "Kệ A1", "WH": "Khu WH", "KHÁC": "Khu khác"}
LUA_CHON = ["Gán lỗi cho NV máy nghi", "Gán cho người phụ trách kệ", "Fail - trùng lưu trình",
            "Fail - không xác định được NV", "Fail - đã khắc phục/không vi phạm", "Huỷ phiếu (tạo nhầm)",
            "Cắt thêm clip camera", "Giữ - chờ xác minh tay", "Khác (ghi ở cột Ghi chú)"]

def g(v, ten):
    return v[HDR_MAY.index(ten)] if ten in HDR_MAY and v[HDR_MAY.index(ten)] not in (None, "") else ""
def gon(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"
def ngay_vn(x):
    d = x if isinstance(x, dt.datetime) else ngay(x) or (dt.datetime.strptime(str(x)[:10], "%Y-%m-%d") if re.match(r"\d{4}-\d\d-\d\d", str(x)) else None)
    return d.strftime("%d/%m/%Y") if d else str(x or "")

K_ANH, K_WMS, K_NV, K_GY, K_CAM, K_CLIP, K_XL = ("29/09 · Ảnh cho thấy", "29/09 · Truy vết WMS (bằng chứng)",
    "29/09 · NV nghi · độ chắc", "29/09 · Gợi ý (anh/chị quyết ở cột K)", "29/09 · Camera trích video được",
    "29/09 · Clip bằng chứng (đã gắn vào B1)", "29/09 · Đã xử lý")
K_ANH, K_WMS, K_NV, K_GY, K_CAM, K_CLIP, K_XL = [next((h for h in HDR_MAY if h.endswith(k.split(" · ", 1)[1])), k)
                                                   for k in (K_ANH, K_WMS, K_NV, K_GY, K_CAM, K_CLIP, K_XL)]

dong = []
for i, v in RAW.items():
    tt, muc = tinh_trang(i)
    soi = any(g(v, k) for k in (K_ANH, K_WMS, K_NV))
    cam = g(v, K_CAM)
    if g(v, K_CLIP): cam_txt = "Đã gắn clip vào B1"
    elif cam and "không" in cam.lower(): cam_txt = "Không có camera ở vị trí này"
    elif cam: cam_txt = "Có camera (%s), chưa cắt clip" % gon(re.sub(r"\s*\(đầu ghi.*", "", cam), 40)
    else: cam_txt = ""
    tim = []
    nv = str(g(v, K_NV))
    if nv.lower().startswith("không xác định"): tim.append("Chưa xác định được người")
    elif nv: tim.append("Nghi: " + gon(nv, 160))
    if cam_txt: tim.append("Camera: " + cam_txt)
    if soi: tim.append("→ đủ chi tiết ở tab BẰNG CHỨNG")
    nn = str(g(v, "Nguyên nhân (truy vết)"))
    cv = CACHE.get(i) or []
    ngay_ghi = g(v, "Ngày ghi nhận")
    if not ngay_ghi or str(ngay_ghi) == "undefined":   # bản thô thiếu ngày → lấy "Ngày vi phạm:" trên phiếu
        ngay_ghi = (cv[H.index("Ngày vi phạm:")] if cv else "") or (cv[5] if cv else "")
    visao = VI_SAO.get(nn, nn or "Truy vết bổ sung 29/09")
    goiy = gon(g(v, K_GY), 220) or GOI_Y.get(str(g(v, "Hướng xử đề xuất")), g(v, "Hướng xử đề xuất"))
    k = KQ.get(i) if muc != "dong" else None
    nghi = bool(goiy and str(goiy).startswith("⚠"))
    if k and k.get("luat") != "VS":   # kết quả cò canh-b1 theo bộ luật
        if k["ketLuan"] == "B1.1":
            nv0 = k["nv"][0]
            goi_luat = "[%s] Máy chắc: chuyển B1.1 cho %s (%s)%s" % (k["luat"], nv0["ten"], nv0["code"],
                       " — chờ bạn duyệt luật ở tab QUY TẮC XÁC MINH" if k.get("choDuyet") else "")
        else:
            nghi = True
            goi_luat = "[%s] ⚠ NGHI NGỜ — bạn quyết: %s" % ({"KHAC": "Chưa có luật"}.get(k["luat"], k["luat"]), gon(k["lyDo"], 240))
        if k.get("canBan"): goi_luat += "\n⚠ Cần bạn: " + k["canBan"]; nghi = True
        goiy = goi_luat + ("\n— Ghi chú soi tay 29/09: " + str(goiy) if goiy else "")
        if not tim and k.get("nv"):
            tim.append("WMS người châm hàng vào ô 72h trước ảnh: " + "; ".join("%s%s%s" % (n.get("ten") or "?", " (%s)" % n["code"] if n.get("code") else "", " %s cái" % n["qty"] if n.get("qty") is not None else "") for n in k["nv"][:6]))   # 14/10: nv không có qty → KeyError văng cả bước ghi sheet
        if not tim and k.get("camera"): tim.append("Camera: " + k["camera"] + " (đầu ghi .19)")
    dong.append(dict(
        id=i, ngay=ngay_vn(ngay_ghi), ngay_sx=str(ngay_ghi)[:10],
        vitri=g(v, "Vị trí"), khu=NHOM.get(g(v, "Nhóm"), gon(g(v, "Nhóm"), 20)), loi=gon(g(v, "Hạng mục"), 150),
        tt=tt, muc=muc, visao=visao, nghi=nghi and muc != "dong",
        pt=g(v, "Phụ trách kệ") or "—", tim="\n".join(tim) or "—", goiy=goiy,
        qd=qd.get(i, ("", ""))[0], gc=qd.get(i, ("", ""))[1], xl=gon(g(v, K_XL), 200), soi=soi, v=v))
THU_TU = {"do": 0, "cam": 1, "xanh": 2, "dong": 4}
dong.sort(key=lambda d: (THU_TU[d["muc"]] + (0.5 if d["qd"] and d["muc"] != "dong" else 0),
                         -int(re.search(r"(\d+) ngày", d["tt"]).group(1)) if re.search(r"(\d+) ngày", d["tt"]) else 0, d["ngay_sx"]))
mo = [d for d in dong if d["muc"] != "dong"]
cho = [d for d in mo if not d["qd"]]
qua14 = [d for d in mo if d["muc"] == "do"]
nghi_ngo = [d for d in mo if d["nghi"] and not d["qd"]]

# ── dựng workbook ──────────────────────────────────────────────────────────────────────────────────
TEAL, VANG_D, VANG = "0F766E", "B45309", "FEF3C7"
thin = Side(style="thin", color="CBD5E1"); BD = Border(left=thin, right=thin, top=thin, bottom=thin)
F = lambda **k: Font(name="Arial", size=k.pop("size", 10), **k)
TOP = Alignment(wrap_text=True, vertical="top")
MAU = {"do": ("B91C1C", "FEE2E2"), "cam": ("B45309", "FFEDD5"), "xanh": ("15803D", "DCFCE7"), "dong": ("64748B", "F1F5F9")}

def so_dong(text, rong):
    cpl = max(rong * 1.3, 6)
    return sum(max(1, math.ceil(len(p) / cpl)) for p in str(text or "").split("\n"))

def dau_trang(ws, tieu_de, tinh_trang_chu, cach_dung, ncot):
    ws.sheet_view.showGridLines = False
    ws["A1"] = tieu_de; ws["A1"].font = F(bold=True, size=14, color=TEAL)
    ws["A2"] = tinh_trang_chu; ws["A2"].font = F(bold=True, size=11)
    ws["A3"] = cach_dung; ws["A3"].font = F(italic=True, color="475569")
    for r in (1, 2, 3):
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=ncot)
        ws.cell(r, 1).alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 26; ws.row_dimensions[2].height = 22; ws.row_dimensions[3].height = 40

def tieu_de_bang(ws, R0, cot, vang=()):
    for j, (h, w) in enumerate(cot, 1):
        c = ws.cell(R0, j, h); c.border = BD
        c.font = F(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor=VANG_D if j in vang else TEAL)
        c.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[R0].height = 34

wb = Workbook()
ws = wb.active; ws.title = TAB_DOC
COT = [("Phiếu", 13), ("Ngày ghi nhận", 11), ("Vị trí", 19), ("Lỗi ghi nhận", 30), ("Tình trạng hôm nay", 17),
       ("Máy tìm được", 34), ("Máy gợi ý", 34), (COT_QD, 24), (COT_GC, 24),
       ("Vì sao máy chưa tự xử lý", 26), ("Người phụ trách kệ", 18), ("Máy đã làm", 26)]
J_QD, J_GC = 8, 9
R0 = 5
dau_trang(ws, "PHIẾU 5S CÒN TREO Ở BƯỚC XÁC MINH (B1) — WF 591 · KHO 170",
          "Tình trạng %s: %d phiếu — %d còn mở (%d treo từ 14 ngày trở lên) · %d ca máy NGHI NGỜ chờ bạn quyết · %d đã đóng."
          % (now.strftime("%H:%M %d/%m/%Y"), len(dong), len(mo), len(qua14), len(nghi_ngo), len(dong) - len(mo)),
          "Cách dùng: đọc 'Máy tìm được' + 'Máy gợi ý' → chọn ở cột VÀNG 'Quyết định của bạn'; máy đọc cột vàng để làm tiếp.\n"
          "Đỏ = treo ≥14 ngày · cam = 3–13 ngày · xám ở cuối = đã đóng. Bấm 'Mở …' để vào phiếu. Truy vết đầy đủ ở tab BẰNG CHỨNG.", len(COT))
tieu_de_bang(ws, R0, COT, vang=(J_QD, J_GC))
for n, d in enumerate(dong):
    r = R0 + 1 + n
    val = ["Mở %s" % d["id"], d["ngay"], d["vitri"], d["loi"], d["tt"], d["tim"], d["goiy"], d["qd"], d["gc"],
           d["visao"], d["pt"], d["xl"]]
    xam = d["muc"] == "dong"
    for j, x in enumerate(val, 1):
        c = ws.cell(r, j, x); c.alignment = TOP; c.border = BD
        c.font = F(color="94A3B8" if xam else "1E293B")
    a = ws.cell(r, 1); a.hyperlink = "https://work.hasaki.vn/tasks?task_id=%s" % d["id"]
    a.font = F(color="94A3B8" if xam else "1D4ED8", underline="single")
    fg, bg = MAU[d["muc"]]
    ws.cell(r, 5).font = F(bold=True, color=fg); ws.cell(r, 5).fill = PatternFill("solid", fgColor=bg)
    if d["nghi"]: ws.cell(r, 7).fill = PatternFill("solid", fgColor="FFEDD5"); ws.cell(r, 7).font = F(color="9A3412", bold=True)
    for j in (J_QD, J_GC): ws.cell(r, j).fill = PatternFill("solid", fgColor="F8FAFC" if xam else VANG)
    ws.row_dimensions[r].height = 16 * max(so_dong(val[j], COT[j][1]) for j in range(len(val))) + 6
dv = DataValidation(type="list", formula1='"%s"' % ",".join(LUA_CHON), allow_blank=True, showErrorMessage=False)
ws.add_data_validation(dv); dv.add("H%d:H%d" % (R0 + 1, R0 + len(dong) + 50))
ws.freeze_panes = "B%d" % (R0 + 1); ws.auto_filter.ref = "A%d:L%d" % (R0, R0 + len(dong))

# BẰNG CHỨNG
wb2 = wb.create_sheet(TAB_BC)
COT2 = [("Phiếu", 13), ("Vị trí", 20), ("Tình trạng hôm nay", 18), ("Ảnh cho thấy", 34), ("Lịch sử WMS (ai lấy/cất hàng, giờ nào)", 60),
        ("NV nghi · độ chắc", 34), ("Camera", 24), ("Clip bằng chứng", 34), ("Máy đã làm", 26)]
soi = [d for d in dong if d["soi"] or g(d["v"], K_CAM)]
dau_trang(wb2, "BẰNG CHỨNG MÁY TRUY VẾT — từng phiếu đã soi",
          "%d phiếu đã soi (ảnh + lịch sử WMS + camera) · %d phiếu đã gắn clip vào B1."
          % (len(soi), sum(1 for d in soi if g(d["v"], K_CLIP))),
          "Trang chỉ để đọc. Máy KHÔNG nhận diện mặt — 'NV nghi' suy từ lịch sử WMS; clip/ảnh trên phiếu để bạn tự xem. "
          "Ghi quyết định ở tab PHIẾU B1 TREO.", len(COT2))
tieu_de_bang(wb2, R0, COT2)
for n, d in enumerate(soi):
    r = R0 + 1 + n; v = d["v"]
    anh = str(g(v, K_ANH))
    if anh.startswith("http"): anh = "(chưa mô tả — xem ảnh trên phiếu)"
    nv = str(g(v, K_NV))
    if nv.lower().startswith("không xác định"): nv = "Chưa xác định được người"
    val = ["Mở %s" % d["id"], d["vitri"], d["tt"], anh, g(v, K_WMS), nv, g(v, K_CAM), g(v, K_CLIP), g(v, K_XL)]
    for j, x in enumerate(val, 1):
        c = wb2.cell(r, j, x); c.alignment = TOP; c.border = BD; c.font = F()
    a = wb2.cell(r, 1); a.hyperlink = "https://work.hasaki.vn/tasks?task_id=%s" % d["id"]; a.font = F(color="1D4ED8", underline="single")
    fg, bg = MAU[d["muc"]]; wb2.cell(r, 3).font = F(bold=True, color=fg); wb2.cell(r, 3).fill = PatternFill("solid", fgColor=bg)
    wb2.row_dimensions[r].height = min(16 * max(so_dong(val[j], COT2[j][1]) for j in range(len(val))) + 6, 400)
wb2.freeze_panes = "B%d" % (R0 + 1)

# QUY TẮC XÁC MINH — bộ luật (quy-tac-xac-minh-b1.json) + cột Bạn duyệt (giữ theo mã luật qua các lần dựng)
BO = json.load(open(os.path.join(DIR, "quy-tac-xac-minh-b1.json"), encoding="utf8"))
MUC = BO["mucTuDong"]
duyet_cu = {}
if TAB_QT in ten_tab:
    wq = wb0[TAB_QT]
    dq = next(r for r in range(1, 12) if wq.cell(r, 1).value == "Mã")
    hq, rq = doc_bang(wq, dq)
    for r, d in rq:
        if d.get("Mã"): duyet_cu[str(d["Mã"])] = (d.get("Bạn duyệt") or "", d.get("Ghi chú của bạn") or "")
wq = wb.create_sheet(TAB_QT, 1)
COTQ = [("Mã", 8), ("Nhóm", 14), ("Tên luật", 26), ("Mục QUY-ĐỊNH (trừ % · xử lý) + giải nghĩa", 34), ("Khi nào áp", 36), ("Máy làm gì", 44), ("Án lệ (ca đã quyết)", 30),
        ("Bạn duyệt", 22), ("Ghi chú của bạn", 26), ("Chạy ở · từ ngày", 18),
        ("Khác luật cũ ở đâu · bối cảnh sửa", 46)]   # 02/10 user: sửa luật phải nêu khác luật cũ/bối cảnh để duyệt
moi_cho = [l for l in BO["luat"] if l.get("moi") and duyet_cu.get(l["ma"], ("", ""))[0] in ("", MUC["hoi"])]
dau_trang(wq, "QUY TẮC XÁC MINH B1 — máy dựa vào đây để tự xử hoặc hỏi bạn",
          "%d luật · %d luật mới chờ bạn duyệt · máy CHỈ tự làm luật bạn duyệt «%s»; luật khác máy chỉ ghi gợi ý + NGHI NGỜ ở tab PHIẾU B1 TREO."
          % (len(BO["luat"]), len(moi_cho), MUC["tu-lam"]),
          "Cách dùng: đọc 'Khi nào áp' + 'Máy làm gì' → chọn ở cột VÀNG 'Bạn duyệt'. Muốn sửa luật: ghi ở 'Ghi chú của bạn', máy sửa luật rồi\n"
          "kiểm lại bằng mọi án lệ (ca bạn đã quyết) trước khi chạy. Mỗi quyết định của bạn ở tab PHIẾU B1 TREO được lưu thành án lệ mới.", len(COTQ))
tieu_de_bang(wq, R0, COTQ, vang=(8, 9))
duyet_ra = {}
for n, l in enumerate(BO["luat"]):
    r = R0 + 1 + n
    bd, gcq = duyet_cu.get(l["ma"], ("", ""))
    if not bd: bd = MUC["tu-lam"] if l["macDinh"] == "tu-lam" else MUC["hoi"]
    duyet_ra[l["ma"]] = bd
    al = "\n".join("%s: %s" % (a["phieu"], gon(a.get("ghiChu", ""), 120)) for a in l.get("anLe", [])) or "—"
    # 01/10 user: mỗi luật phải trỏ số mục trong tab QUY-DINH + giải nghĩa điều kiện từ câu quy định
    qdl = l.get("quyDinh")
    qd_txt = ("\n".join("Mục %s (trừ %s · %s): %s" % (q["muc"], q["tru"], q["xuLy"], gon(q["cau"], 110)) for q in qdl) if qdl
              else "— luật thủ tục: áp theo mục của phiếu")
    if l.get("giaiNghia"): qd_txt += "\n→ " + l["giaiNghia"]
    val = [l["ma"], l["nhom"], l["ten"], qd_txt, l["dieuKien"], l["mayLam"], al, bd, gcq, "%s · %s" % (l["chay"], l["tu"]), l.get("khacCu") or "—"]
    for j, x in enumerate(val, 1):
        c = wq.cell(r, j, x); c.alignment = TOP; c.border = BD; c.font = F(bold=(j == 1))
    for j in (8, 9): wq.cell(r, j).fill = PatternFill("solid", fgColor=VANG)
    if l in moi_cho:
        wq.cell(r, 3).font = F(bold=True, color="9A3412")
        wq.cell(r, 3).value = ("ĐỀ XUẤT · " if l.get("deXuat") else "MỚI · ") + l["ten"]
    if l.get("deXuat"):   # luật máy ĐỀ XUẤT từ các ca đã soi — chưa chạy, chờ bạn duyệt/sửa
        for j in range(1, len(COTQ) + 1): wq.cell(r, j).fill = PatternFill("solid", fgColor="FFF7ED" if j not in (8, 9) else VANG)
    if l.get("khacCu"): wq.cell(r, 11).font = F(bold=True, color="9A3412")
    wq.row_dimensions[r].height = 16 * max(so_dong(val[j], COTQ[j][1]) for j in range(len(val))) + 6
dvq = DataValidation(type="list", formula1='"%s"' % ",".join(MUC.values()), allow_blank=True, showErrorMessage=False)
wq.add_data_validation(dvq); dvq.add("H%d:H%d" % (R0 + 1, R0 + len(BO["luat"]) + 20))
wq.freeze_panes = "B%d" % (R0 + 1)

# Xuất cho canh-b1.mjs: duyệt luật · quyết định của bạn · vài trường thô cần tra mã NV
EXP = os.path.join(DIR, ".exports")
json.dump(duyet_ra, open(os.path.join(EXP, "quy-tac-duyet.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
json.dump({d["id"]: {"qd": d["qd"], "gc": d["gc"]} for d in dong if d["qd"] or d["gc"]},
          open(os.path.join(EXP, "b1-quyet-dinh.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
json.dump({d["id"]: {"nghi": str(g(d["v"], K_NV)), "phuTrach": str(g(d["v"], "Phụ trách kệ"))} for d in dong},
          open(os.path.join(EXP, "b1-treo-raw.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

# DU-LIEU-MAY (ẩn) — giữ nguyên 19 cột thô
wm = wb.create_sheet(TAB_MAY)
wm.append(HDR_MAY)
for i, v in RAW.items():
    v = list(v)
    if isinstance(v[0], float) and v[0].is_integer(): v[0] = int(v[0])
    wm.append(v)
wm.sheet_state = "hidden"
wb.active = 0

buf = io.BytesIO(); wb.save(buf); buf = buf.getvalue()
open(os.path.join(os.environ.get("TEMP", DIR), "sheet-b1-treo.xlsx"), "wb").write(buf)
print("Dựng: %d phiếu · %d còn mở (%d ≥14 ngày) · %d chờ quyết · %d đã đóng · %d phiếu có bằng chứng · %d quyết định giữ lại"
      % (len(dong), len(mo), len(qua14), len(cho), len(dong) - len(mo), len(soi), sum(1 for d in dong if d["qd"] or d["gc"])))
if not LAM:
    print("(diễn tập — thêm --lam để nạp lên Sheet)"); sys.exit(0)

nap_de(buf)
w = tai_ve()   # QC: đọc lại
tabs = [(x.title, x.sheet_state) for x in w]
d1 = w[TAB_DOC]
n1 = sum(1 for r in range(R0 + 1, d1.max_row + 1) if d1.cell(r, 1).value)
qd_lai = sum(1 for r in range(R0 + 1, d1.max_row + 1) if d1.cell(r, J_QD).value or d1.cell(r, J_GC).value)
ok = tabs[0][0] == TAB_DOC and n1 == len(dong) and qd_lai == sum(1 for d in dong if d["qd"] or d["gc"]) and (TAB_MAY, "hidden") in tabs
print("Đọc lại: tab", tabs, "· dòng", n1, "· quyết định", qd_lai, "→", "OK" if ok else "LỆCH — kiểm tay")
sys.exit(0 if ok else 3)
