# -*- coding: utf-8 -*-
# =============================================================================================
# NGUNG DUNG (14/09/2026). File nay KHONG cao du lieu:
#   - scrape_jobs.py chi ghi lai 20 tin nam cung trong code, khong he goi mang.
#   - Lich Windows "DailyNightJobSync" TUNG goi file nay 9h moi sang (den 05/10/2026). DA TAT 05/10/2026 khi don thu muc goc.
# Ban thay the: Apps Script gan trong chinh bang tinh -> viec-lam-ca-dem/README.md
# Chay file nay se GHI DE mat du lieu moi cao duoc.
# =============================================================================================
import subprocess
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

print("=== [9:00 AM] BAT DAU TIEN TRINH DONG BO VIEC LAM CA DEM TPHCM ===")

# Buoc 1: Cao du lieu moi nhat
print("[1/2] Dang thu thap du lieu viec lam ca dem...")
subprocess.run(["python", r"C:\Users\lechitam\.gemini\antigravity-cli\brain\3192a49b-9f2c-4050-90d5-cb868bf88b0b\scratch\scrape_jobs.py"], check=True)

# Buoc 2: Day len Google Sheet va format theo chuan QC
print("[2/2] Dang dong bo len Google Sheet va ap dung dinh dang QC...")
subprocess.run(["python", r"C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu\upload_to_sheet.py"], check=True)

print("=== HOAN TAT DONG BO DU LIEU VA DINH DANG THEO CHUAN QC ===")
