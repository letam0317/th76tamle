# -*- coding: utf-8 -*-
"""Bổ sung cột "Link Drive ảnh" vào tab 9999 của sheet "Lịch làm việc Shopee - Hasaki",
đặt NGAY BÊN PHẢI cột "Giờ tải ảnh lên Drive". Link lấy từ g-sheet "plieu" (form phế liệu, tab gid 324113612).

KHOÁ NỐI (chốt 23/09/2026 sau khi soi dữ liệu thật):
  · Tab 9999 có cột "Tên file ảnh trên Drive" (vd "CamScanner 20-11-24 12.10_1 - Chi Tam Le.jpg") và
    "Giờ tải ảnh lên Drive" (= createdTime của file Drive, giờ VN).
  · Sheet plieu chỉ có LINK Drive (cột "Phiếu cân (nếu có)" + các cột tách bên phải; từ 10/2025 một
    dòng form chứa 5–10 link). KHÔNG nối được bằng dấu thời gian form (101/155 dòng lệch > 1 giờ).
  · File ảnh trên Drive để "ai có link" xem được ⇒ tra Drive API lấy TÊN + createdTime của từng id,
    rồi khớp TÊN file (chuẩn hoá khoảng trắng); còn sót thì khớp createdTime với "Giờ tải ảnh".

Chạy:
  python bo-sung-link-anh-drive.py --soi          # chỉ IN tiêu đề + 5 dòng mẫu của 2 tab, không ghi gì
  python bo-sung-link-anh-drive.py --thu          # ghép thử, in bảng đối soát, KHÔNG ghi
  python bo-sung-link-anh-drive.py --ghi          # ghi thật (chèn cột nếu chưa có, chỉ đụng cột đó)

Quyền: Chung/khoa/service_account.json (timvieclamdem@cadem-508607.iam.gserviceaccount.com) — sheet đích chia sẻ SỬA,
sheet nguồn chia sẻ XEM (user đã mở 23/09/2026). Không gọi WMS/work/hr — 0 lượt upstream.
"""
import sys, os, re, json, datetime as dt
import requests
import gspread
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request

HERE = os.path.dirname(os.path.abspath(__file__))
SA_FILE = os.path.join(os.path.dirname(HERE), 'Chung', 'khoa', 'service_account.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

DICH_ID, DICH_TAB = '1GD-SjEoW3K20pBPfcDAsQV7gkNUjZT12g75ppBwUhak', '9999'
NGUON_ID, NGUON_GID = '1ZRP61AiCRlxP2ggb4l_m_8H5R9McHGI1T_OQGBv4jbA', 324113612
COT_MOC = 'Giờ tải ảnh lên Drive'      # cột neo — cột mới đứng ngay bên phải
COT_TEN = 'Tên file ảnh trên Drive'
COT_MOI = 'Link Drive ảnh'
COT_LINK_NGUON = 'Phiếu cân (nếu có):'  # từ cột này sang phải là link phiếu cân (các cột tách không có tiêu đề)
ID_RE = re.compile(r'(?:open\?id=|/d/)([A-Za-z0-9_-]{20,})')
VN = dt.timezone(dt.timedelta(hours=7))


def chuan(s):
    """So khớp tiêu đề/tên file: bỏ khoảng trắng thừa, thường hoá."""
    return re.sub(r'\s+', ' ', str(s or '')).strip().casefold()


def creds():
    return Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)


def mo():
    c = gspread.authorize(creds())
    dich = c.open_by_key(DICH_ID)
    nguon = c.open_by_key(NGUON_ID)
    return dich, nguon, dich.worksheet(DICH_TAB), nguon.get_worksheet_by_id(NGUON_GID)


def soi(ws, ten, n=5):
    vals = ws.get_all_values()
    print(f'\n=== {ten}: tab "{ws.title}" · {len(vals)} dòng × {len(vals[0]) if vals else 0} cột')
    for i, r in enumerate(vals[:n + 1], 1):
        print(i, [c[:40] for c in r])
    return vals


def cot_theo_ten(header, ten):
    m = chuan(ten)
    for i, h in enumerate(header):
        if chuan(h) == m:
            return i
    return -1


def lay_id_nguon(v_n):
    """Toàn bộ id Drive ở vùng phiếu cân của sheet nguồn, giữ thứ tự xuất hiện, bỏ trùng.
    Trả về [(id, dòng_nguồn)]."""
    header = v_n[0]
    c0 = cot_theo_ten(header, COT_LINK_NGUON)
    if c0 < 0:
        raise SystemExit(f'Nguồn không có cột "{COT_LINK_NGUON}"')
    ra, seen = [], set()
    for i, r in enumerate(v_n[1:], 2):
        for c in r[c0:]:
            for fid in ID_RE.findall(c):
                if fid not in seen:
                    seen.add(fid); ra.append((fid, i))
    return ra


def tra_ten_drive(ids):
    """Drive API: id → {name, createdTime}. File để 'ai có link' nên SA đọc được metadata."""
    cr = creds(); cr.refresh(Request())
    H = {'Authorization': 'Bearer ' + cr.token}
    ra, loi = {}, []
    for fid in ids:
        r = requests.get(f'https://www.googleapis.com/drive/v3/files/{fid}?fields=name,createdTime', headers=H, timeout=30)
        if r.status_code == 200:
            ra[fid] = r.json()
        else:
            loi.append((fid, r.status_code))
    return ra, loi


def gio_vn(iso):
    """createdTime ISO (UTC) → 'dd/mm/yyyy HH:MM:SS' giờ VN — cùng dạng cột "Giờ tải ảnh lên Drive"."""
    t = dt.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(VN)
    return t.strftime('%d/%m/%Y %H:%M:%S')


def ghep(v_d, v_n):
    """Trả về (values_cot_moi[dòng 2..], báo cáo)."""
    header = v_d[0]
    c_moc, c_ten = cot_theo_ten(header, COT_MOC), cot_theo_ten(header, COT_TEN)
    if c_moc < 0 or c_ten < 0:
        raise SystemExit(f'Đích thiếu cột "{COT_MOC}" hoặc "{COT_TEN}"')
    ids = lay_id_nguon(v_n)
    meta, loi = tra_ten_drive([f for f, _ in ids])
    theo_ten, theo_gio = {}, {}
    trung_ten = []
    for fid, dong in ids:
        m = meta.get(fid)
        if not m:
            continue
        k = chuan(m['name'])
        if k in theo_ten:
            trung_ten.append((m['name'], theo_ten[k][0], fid))
        theo_ten.setdefault(k, (fid, dong))
        theo_gio.setdefault(gio_vn(m['createdTime']), (fid, dong))
    values, khop_ten, khop_gio, sot, dung = [], 0, 0, [], set()
    for i, r in enumerate(v_d[1:], 2):
        ten, gio = r[c_ten].strip() if len(r) > c_ten else '', r[c_moc].strip() if len(r) > c_moc else ''
        if not ten and not gio:
            values.append(''); continue
        hit = theo_ten.get(chuan(ten))
        if hit:
            khop_ten += 1
        else:
            hit = theo_gio.get(gio)
            if hit:
                khop_gio += 1
        if hit:
            values.append(f'https://drive.google.com/open?id={hit[0]}'); dung.add(hit[0])
        else:
            values.append(''); sot.append((i, r[4] if len(r) > 4 else '', ten, gio))
    thua = [(fid, dong, meta[fid]['name']) for fid, dong in ids if fid in meta and fid not in dung]
    bao = {'so_link_nguon': len(ids), 'tra_drive_loi': loi, 'trung_ten': trung_ten, 'khop_ten': khop_ten,
           'khop_gio': khop_gio, 'sot_dich': sot, 'thua_nguon': thua, 'c_moc': c_moc}
    return values, bao


def in_bao(bao):
    print(f'\nLink phiếu cân ở nguồn: {bao["so_link_nguon"]} · tra Drive lỗi: {len(bao["tra_drive_loi"])} {bao["tra_drive_loi"][:5]}')
    print(f'Khớp theo TÊN file: {bao["khop_ten"]} · khớp theo GIỜ tạo (bù): {bao["khop_gio"]}')
    if bao['trung_ten']:
        print('Tên file TRÙNG ở nguồn (lấy id đầu):'); [print('  ', x) for x in bao['trung_ten']]
    print(f'Dòng đích có ảnh nhưng KHÔNG tìm được link: {len(bao["sot_dich"])}')
    for x in bao['sot_dich']: print('   dòng', *x)
    print(f'Link nguồn KHÔNG có dòng đích nào: {len(bao["thua_nguon"])}')
    for x in bao['thua_nguon']: print('   nguồn dòng', x[1], x[2], x[0])


def ghi(ws_d, v_d, values, bao):
    header = v_d[0]
    c_moi = bao['c_moc'] + 2          # 1-based: ngay bên phải cột mốc
    da_co = cot_theo_ten(header, COT_MOI)
    if da_co >= 0 and da_co != c_moi - 1:
        raise SystemExit(f'Cột "{COT_MOI}" đã tồn tại ở vị trí {da_co + 1}, không phải {c_moi} — dừng để tránh ghi nhầm.')
    if da_co < 0:
        # chèn 1 cột mới tại c_moi (kế thừa định dạng cột bên trái); công thức/tham chiếu tự dịch theo
        ws_d.insert_cols([[COT_MOI] + values], col=c_moi, value_input_option='RAW', inherit_from_before=True)
        print(f'Đã CHÈN cột mới tại vị trí {c_moi} ({gspread.utils.rowcol_to_a1(1, c_moi)[:-1]}) và ghi {sum(1 for v in values if v)} link.')
    else:
        ws_d.update(range_name=gspread.utils.rowcol_to_a1(2, c_moi) + ':' + gspread.utils.rowcol_to_a1(len(values) + 1, c_moi),
                    values=[[v] for v in values], value_input_option='RAW')
        print(f'Cột "{COT_MOI}" đã có ở {c_moi} — chỉ cập nhật {sum(1 for v in values if v)} link.')
    # đọc lại để xác nhận
    v2 = ws_d.get_all_values()
    h2 = v2[0]
    print('Tiêu đề sau ghi (cột 10..14):', h2[9:14])
    so = sum(1 for r in v2[1:] if len(r) >= c_moi and r[c_moi - 1].startswith('https://'))
    print(f'Đọc lại: {so} ô có link ở cột {c_moi}.')


def main():
    che_do = (sys.argv[1] if len(sys.argv) > 1 else '--soi')
    dich, nguon, ws_d, ws_n = mo()
    print('Đích :', dich.title, '| tab:', ws_d.title)
    print('Nguồn:', nguon.title, '| tab:', ws_n.title)
    if che_do == '--soi':
        soi(ws_d, 'ĐÍCH'); soi(ws_n, 'NGUỒN'); return
    v_d, v_n = ws_d.get_all_values(), ws_n.get_all_values()
    values, bao = ghep(v_d, v_n)
    in_bao(bao)
    if che_do == '--thu':
        print('\n(--thu: chưa ghi gì)'); return
    if che_do == '--ghi':
        ghi(ws_d, v_d, values, bao); return
    raise SystemExit('Chế độ không hợp lệ: --soi | --thu | --ghi')


if __name__ == '__main__':
    main()
