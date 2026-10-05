# -*- coding: utf-8 -*-
import csv
import sys
import gspread
from google.oauth2.service_account import Credentials

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

CSV_PATH = r'C:\Users\lechitam\New folder\viec-lam-ca-dem\python-cu\Viec_lam_ca_dem.csv'
SERVICE_ACCOUNT_FILE = r'C:\Users\lechitam\New folder\Chung\khoa\service_account.json'
SHEET_ID = '1oHmNxMS1wwZvPiwb9r6bS0Tn8CxiPF3spi6xjf9I8QQ'

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def main():
    print("Dang ket noi den Google Sheet...")
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SHEET_ID)
    worksheet = spreadsheet.get_worksheet(0)

    # Doc du lieu tu CSV
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        raw_rows = list(reader)

    if not raw_rows:
        print("Khong co du lieu trong CSV!")
        return

    # Chuyen doi cot Link (Cot index 9) sang cong thuc HYPERLINK dung dau cham phay ; (cho vi_VN locale)
    header = raw_rows[0]
    link_idx = 9 if len(header) > 9 and 'link' in header[9].lower() else -1

    formatted_rows = [header]
    for row in raw_rows[1:]:
        new_row = list(row)
        if link_idx != -1 and len(new_row) > link_idx:
            raw_url = new_row[link_idx].strip()
            if raw_url.startswith('http'):
                # Locale vi_VN bat buoc phan tach tham so bang dau cham phay ;
                new_row[link_idx] = f'=HYPERLINK("{raw_url}"; "👉 Ứng tuyển ngay")'
        formatted_rows.append(new_row)

    # Xoa du lieu cu va cap nhat toan bo voi value_input_option='USER_ENTERED' de Google Sheets render HYPERLINK
    worksheet.clear()
    worksheet.update(values=formatted_rows, value_input_option='USER_ENTERED')

    num_rows = len(formatted_rows)
    num_cols = len(header)
    col_letter = chr(ord('A') + num_cols - 1)
    
    # 1. Thiet lap do rong chuan pixel cho tung cot (Column Widths):
    # A: Nguon (110px - gon gang)
    # B: Ten cong viec (270px - rong rai)
    # C: Chi tiet cong viec (380px - rong rai doc van ban dai)
    # D: Yeu cau cong viec (320px - rong rai doc yeu cau)
    # E: Thoi gian lam viec (140px)
    # F: Muc luong (170px)
    # G: Dia chi (250px)
    # H: Khoang cach o to (160px)
    # I: Danh gia review cong ty (280px)
    # J: Link (140px)
    # K: Nhan (80px)
    column_pixel_widths = [110, 270, 380, 320, 140, 170, 250, 160, 280, 140, 80]
    width_requests = []
    for idx, width in enumerate(column_pixel_widths[:num_cols]):
        width_requests.append({
            'updateDimensionProperties': {
                'range': {
                    'sheetId': worksheet.id,
                    'dimension': 'COLUMNS',
                    'startIndex': idx,
                    'endIndex': idx + 1
                },
                'properties': {'pixelSize': width},
                'fields': 'pixelSize'
            }
        })
    try:
        spreadsheet.batch_update({'requests': width_requests})
    except Exception as e:
        print(f"Luu y khi chinh do rong cot: {e}")

    # 2. Dinh dang chuan QC cho Google Sheet
    try:
        # Header (A1:K1): Nen xanh Navy (#1C4587), chu trang in dam, can giua
        worksheet.format(f'A1:{col_letter}1', {
            "backgroundColor": {
                "red": 0.11,
                "green": 0.27,
                "blue": 0.53
            },
            "horizontalAlignment": "CENTER",
            "verticalAlignment": "MIDDLE",
            "textFormat": {
                "bold": True,
                "foregroundColor": {
                    "red": 1.0,
                    "green": 1.0,
                    "blue": 1.0
                },
                "fontSize": 10
            }
        })

        # Dong bang dong dau tien (Freeze row 1)
        worksheet.freeze(rows=1)

        # Dinh dang toan bo bang: Can giua chieu doc, bat Wrap text cho tat ca cac o
        worksheet.format(f'A2:{col_letter}{num_rows}', {
            "verticalAlignment": "MIDDLE",
            "wrapStrategy": "WRAP",
            "textFormat": {
                "fontSize": 9
            }
        })

        # Can le cac cot chuyen biet:
        # A (Nguon): Can giua
        worksheet.format(f'A2:A{num_rows}', {"horizontalAlignment": "CENTER"})
        # E (Thoi gian): Can giua, in dam
        worksheet.format(f'E2:E{num_rows}', {"horizontalAlignment": "CENTER", "textFormat": {"bold": True}})
        # F (Muc luong): Can giua
        worksheet.format(f'F2:F{num_rows}', {"horizontalAlignment": "CENTER"})
        # H (Khoang cach o to): Can giua, in dam mau xanh la
        worksheet.format(f'H2:H{num_rows}', {
            "horizontalAlignment": "CENTER",
            "textFormat": {
                "bold": True,
                "foregroundColor": {"red": 0.05, "green": 0.45, "blue": 0.15}
            }
        })
        # I (Danh gia review): Can trai, wrap text
        worksheet.format(f'I2:I{num_rows}', {"horizontalAlignment": "LEFT"})
        # J (Link Hyperlink): Can giua, in dam
        worksheet.format(f'J2:J{num_rows}', {
            "horizontalAlignment": "CENTER",
            "textFormat": {"bold": True}
        })
        # K (Nhan): Can giua, in dam mau do
        worksheet.format(f'K2:K{num_rows}', {
            "horizontalAlignment": "CENTER",
            "textFormat": {
                "bold": True,
                "foregroundColor": {"red": 0.85, "green": 0.15, "blue": 0.15}
            }
        })

    except Exception as e:
        print(f"Luu y dinh dang: {e}")

    print("Da cap nhat Google Sheet thanh cong: sua loi Link, chinh do rong cot, khoang cach xe hoi!")
    print(f"URL: {spreadsheet.url}")

if __name__ == '__main__':
    main()
