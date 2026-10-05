import gspread
from google.oauth2.service_account import Credentials

SERVICE_ACCOUNT_FILE = r'C:\Users\lechitam\New folder\Chung\khoa\service_account.json'
SHEET_ID = '1oHmNxMS1wwZvPiwb9r6bS0Tn8CxiPF3spi6xjf9I8QQ'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
client = gspread.authorize(creds)
spreadsheet = client.open_by_key(SHEET_ID)

for ws in spreadsheet.worksheets():
    print(ws.title)
