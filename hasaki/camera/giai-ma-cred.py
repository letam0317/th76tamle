# -*- coding: utf-8 -*-
"""
Giai ma user/pass dau ghi trong OrganizationDevice.xml cua SmartPSS.
HOAN TOAN NGOAI TUYEN — chi giai ma chuoi trong file, KHONG dang nhap dau ghi.
Chi khi giai ra chuoi ASCII sach (vd username='admin') moi coi la dung khoa.
"""
import base64, xml.etree.ElementTree as ET, sys, itertools
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

XML = r"C:\Users\Public\SmartPSS\Organization\OrganizationDevice.xml"

# Cac khoa AES-128-ECB ung vien da biet/duoc ghi nhan cho SmartPSS/DSS.
# Deu la 16 byte. Thu het, giu lai khoa nao cho ra chuoi in duoc.
CAND_KEYS = [
    b"getDefaultConfig",         # 16 ky tu - hay gap trong cong cu SmartPSS
    b"SmartPSS-Encrypt",
    b"DsscZx_ProtoBuf!",
    b"zhougf@dahuatech",
    b"0123456789abcdef",
    b"1234567890123456",
    b"ipms_ipms_ipms_!",
    b"dahua_dahua_dss!",
    b"\x00" * 16,
]

def de(ct, key):
    try:
        d = Cipher(algorithms.AES(key), modes.ECB(), default_backend()).decryptor()
        return d.update(ct) + d.finalize()
    except Exception:
        return None

def in_duoc(b):
    if not b:
        return False
    # bo padding PKCS7 neu co
    pad = b[-1]
    if 1 <= pad <= 16 and b.endswith(bytes([pad]) * pad):
        b = b[:-pad]
    if not b:
        return False
    try:
        s = b.decode("ascii")
    except Exception:
        return False
    return all(32 <= ord(c) < 127 for c in s) and len(s) >= 1

def txt(b):
    pad = b[-1]
    if 1 <= pad <= 16 and b.endswith(bytes([pad]) * pad):
        b = b[:-pad]
    return b.decode("ascii", "replace")

def main():
    root = ET.parse(XML).getroot()
    devs = [(d.get("name"), base64.b64decode(d.get("username")),
             base64.b64decode(d.get("password"))) for d in root]

    # Mau kiem chung: username dau ghi Dahua gan nhu chac chan la 'admin'
    name0, u0, p0 = devs[0]
    khoa_dung = None
    for key in CAND_KEYS:
        out = de(u0, key)
        if in_duoc(out):
            print(f"[THU] khoa {key!r:24} -> username[0] = {txt(out)!r}")
            if txt(out).lower() in ("admin", "root", "888888", "666666"):
                khoa_dung = key
                break

    if not khoa_dung:
        print("\n[DUNG] Khong khoa ung vien nao cho ra username hop le.")
        print("       KHONG thu dang nhap. Can anh cung cap user/mat khau dau ghi")
        print("       -> ghi vao hasaki/.env: CAM_USER=... / CAM_PASS=...")
        sys.exit(2)

    print(f"\n[OK] Khoa dung: {khoa_dung!r}\n")
    print(f"{'Thiet bi':22} {'user':12} {'pass'}")
    print("-" * 50)
    for name, u, p in devs:
        du, dp = de(u, khoa_dung), de(p, khoa_dung)
        print(f"{name:22} {txt(du):12} {txt(dp)}")

if __name__ == "__main__":
    main()
