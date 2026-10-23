# tim-goc-cam-a1.py — TÌM Ô KỆ A1 GIỐNG ẢNH VI PHẠM NHẤT bằng ảnh vệ sinh Planogram (OpenCV, không AI) — 23/10/2026.
# User 23/10 t3: «ghi nhận có chụp lại ảnh vi phạm → tra hình ảnh planogram để tìm hình ảnh tương đồng — giúp xác định góc cam nhanh nhất
#   — chỉ áp dụng kệ mâm A1»; chọn nguồn = CHỈ ảnh vệ sinh (request_image), cách so = OpenCV trên máy.
#   Bước 1 (lap-chi-so): .exports/plg-a1-chiso.json {vị trí: [url CDN ảnh vệ sinh]} → tải 1 lần (CDN cdn-media-wms, không phải API WMS),
#            thu nhỏ cạnh dài 960px → .exports/plg-a1-anh/<vị trí>/<n>.jpg + đặc trưng SIFT .npz (đã có thì bỏ qua — 0 lượt tải lại).
#   Bước 2 (so): ảnh vi phạm → SIFT → so từng ảnh chỉ số (FLANN, tỉ lệ Lowe 0,75, RANSAC) → điểm ô = số điểm khớp hình học (inlier) cao nhất.
#   python tim-goc-cam-a1.py lap-chi-so
#   python tim-goc-cam-a1.py thu .exports/plg-a1-thu.json     (đo độ trúng trên phiếu A1 đã biết vị trí)
#   python tim-goc-cam-a1.py so <đường dẫn / url ảnh>            (in JSON top 5)
import sys, os, json, re, urllib.request, concurrent.futures as cf
import numpy as np, cv2
sys.stdout.reconfigure(encoding="utf-8")

DIR = os.path.dirname(os.path.abspath(__file__))
EXP = os.path.join(DIR, ".exports")
GOC = os.path.join(EXP, "plg-a1-anh")
CANH = 960
sift = cv2.SIFT_create(nfeatures=1500)
flann = cv2.FlannBasedMatcher({"algorithm": 1, "trees": 5}, {"checks": 48})

def tai(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 audit-dc tim-goc-cam"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def nho(buf):
    a = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_GRAYSCALE)
    if a is None: return None
    h, w = a.shape; k = CANH / max(h, w)
    return cv2.resize(a, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA) if k < 1 else a

def dac_trung(img):
    kp, ds = sift.detectAndCompute(img, None)
    if ds is None or len(kp) < 20: return None, None
    return np.float32([p.pt for p in kp]), ds

def ten_vt(vt): return re.sub(r"[^A-Za-z0-9-]", "_", vt)

def lap_chi_so():
    cs = json.load(open(os.path.join(EXP, "plg-a1-chiso.json"), encoding="utf8"))
    viec = []
    for vt, ds in cs.items():
        for i, u in enumerate(ds):
            f = os.path.join(GOC, ten_vt(vt), "%d.npz" % i)
            if not os.path.exists(f): viec.append((vt, i, u, f))
    def lam(v):
        vt, i, u, f = v
        try:
            img = nho(tai(u))
            if img is None: return "hong"
            pt, ds = dac_trung(img)
            if ds is None: return "it-diem"
            os.makedirs(os.path.dirname(f), exist_ok=True)
            cv2.imwrite(f[:-4] + ".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
            np.savez_compressed(f, pt=pt, ds=ds)
            return "ok"
        except Exception as e:
            return "loi"
    dem = {}
    with cf.ThreadPoolExecutor(4) as ex:   # 4 luồng — nhẹ cho CDN
        for kq in ex.map(lam, viec): dem[kq] = dem.get(kq, 0) + 1
    print(json.dumps({"can_tai": len(viec), "ket_qua": dem}, ensure_ascii=False))

def nap_chi_so():
    out = []
    for d in sorted(os.listdir(GOC)):
        for f in sorted(os.listdir(os.path.join(GOC, d))):
            if f.endswith(".npz"):
                z = np.load(os.path.join(GOC, d, f)); out.append((d, f, z["pt"], z["ds"]))
    return out

def diem(pt1, ds1, pt2, ds2):
    try: m = flann.knnMatch(ds1, ds2, k=2)
    except cv2.error: return 0
    tot = [a for a, b in (x for x in m if len(x) == 2) if a.distance < 0.75 * b.distance]
    if len(tot) < 8: return 0
    A = np.float32([pt1[a.queryIdx] for a in tot]); B = np.float32([pt2[a.trainIdx] for a in tot])
    H, mask = cv2.findHomography(A, B, cv2.RANSAC, 6.0)
    return int(mask.sum()) if mask is not None else 0

class ChiSo:   # 1 chỉ mục FLANN chung cho mọi ảnh: so 1 lượt rồi bỏ phiếu theo ảnh, chỉ RANSAC 20 ảnh dẫn đầu (nhanh ~50 lần so với so từng ảnh)
    def __init__(self, CS):
        self.CS = CS
        self.ds = np.vstack([c[3] for c in CS]).astype(np.float32)
        self.chu = np.concatenate([np.full(len(c[3]), i, np.int32) for i, c in enumerate(CS)])
        self.dau = np.cumsum([0] + [len(c[3]) for c in CS])
        self.fl = cv2.FlannBasedMatcher({"algorithm": 1, "trees": 5}, {"checks": 64}); self.fl.add([self.ds]); self.fl.train()

def so(buf, CS):
    img = nho(buf)
    if img is None: return {"loi": "không đọc được ảnh"}
    pt, ds = dac_trung(img)
    if ds is None: return {"loi": "ảnh ít chi tiết"}
    m = CS.fl.knnMatch(ds, k=2)
    tot = [a for a, b in (x for x in m if len(x) == 2) if a.distance < 0.8 * b.distance]
    phieu = {}
    for a in tot: phieu.setdefault(int(CS.chu[a.trainIdx]), []).append(a)
    dan = sorted(phieu.items(), key=lambda x: -len(x[1]))[:20]
    tot_o = {}
    for i, ms in dan:
        d, f, p2, _ = CS.CS[i]
        s = 0
        if len(ms) >= 8:
            A = np.float32([pt[a.queryIdx] for a in ms]); B = np.float32([p2[a.trainIdx - CS.dau[i]] for a in ms])
            H, mask = cv2.findHomography(A, B, cv2.RANSAC, 6.0); s = int(mask.sum()) if mask is not None else 0
        if s > tot_o.get(d, (0, ""))[0]: tot_o[d] = (s, f)
    xep = sorted(tot_o.items(), key=lambda x: -x[1][0])[:5]
    return {"top": [{"viTri": d.replace("_", "-"), "diem": s, "anh": f} for d, (s, f) in xep]}

def khoa_ke(vt):   # F0-A1-516-03-04-02 → 516-03 (dãy-kệ)
    m = re.match(r"F0-A1-(\w{3})-(\d{2})", vt.strip()); return m.group(1) + "-" + m.group(2) if m else ""

if __name__ == "__main__":
    lenh = sys.argv[1] if len(sys.argv) > 1 else ""
    if lenh == "lap-chi-so": lap_chi_so()
    elif lenh == "so":
        CS = ChiSo(nap_chi_so()); a = sys.argv[2]
        buf = tai(a) if a.startswith("http") else open(a, "rb").read()
        print(json.dumps(so(buf, CS), ensure_ascii=False))
    elif lenh == "thu":
        CS = ChiSo(nap_chi_so()); ds = json.load(open(sys.argv[2], encoding="utf8"))
        ke_co = {khoa_ke(d.replace("_", "-")) for d, *_ in CS.CS}
        tk = {"top1": 0, "top3": 0, "top5": 0, "n": 0, "khong_co_trong_chi_so": 0}
        for p in ds:
            k = khoa_ke(p["vt"])
            if k not in ke_co: tk["khong_co_trong_chi_so"] += 1; continue
            try: kq = so(tai(p["anh"][0]), CS)
            except Exception as e: print(p["id"], "tải ảnh lỗi", e); continue
            if "top" not in kq: print(p["id"], kq); continue
            ks = [khoa_ke(x["viTri"]) for x in kq["top"]]
            tk["n"] += 1
            for n in (1, 3, 5):
                if k in ks[:n]: tk["top%d" % n] += 1
            print(p["id"], p["vt"], "→", " · ".join("%s(%d)" % (x["viTri"], x["diem"]) for x in kq["top"][:3]), "ĐÚNG" if k in ks[:1] else ("top" + str(ks.index(k) + 1) if k in ks else "TRƯỢT"), flush=True)
        print(json.dumps(tk, ensure_ascii=False))
