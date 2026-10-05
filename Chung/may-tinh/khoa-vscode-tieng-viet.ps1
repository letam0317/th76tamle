# ============================================================
#  KHOA GIAO DIEN VS CODE O TIENG VIET  (locale = vi)
#  - Bao dam argv.json luon co "locale": "vi" va o che do chi-doc
#  - Bao dam goi ngon ngu tieng Viet van con cai dat
#  Chay tu dong moi lan dang nhap Windows qua Task Scheduler:
#      VSCode-Khoa-Tieng-Viet
#  Muon GO KHOA: xem cuoi tap tin nay.
# ============================================================

$ErrorActionPreference = 'Continue'

$argvPath = Join-Path $env:APPDATA 'Code\User\argv.json'
$extId    = 'buivantinh.dmctn-vscode-language-pack-vi'
$extDir   = Join-Path $env:USERPROFILE '.vscode\extensions'
$codeCmd  = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'
$logPath  = Join-Path $PSScriptRoot 'khoa-vscode-tieng-viet.log'

function Ghi([string]$msg) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    try { Add-Content -Path $logPath -Value $line -Encoding utf8 } catch {}
}

$noiDungArgv = @'
// Tap tin nay cho phep truyen tham so co dinh cho VS Code moi lan khoi dong.
// KHOA NGON NGU: tieng Viet (vi). Dung sua dong "locale" neu khong co chu dinh doi ngon ngu.
{
	"locale": "vi"
}
'@

$daSua = $false

# --- 1) argv.json phai khai bao locale = vi -------------------
$canGhi = $true
if (Test-Path $argvPath) {
    $txt = Get-Content $argvPath -Raw -ErrorAction SilentlyContinue
    if ($txt -match '"locale"\s*:\s*"vi"') { $canGhi = $false }
}
if ($canGhi) {
    $thuMuc = Split-Path $argvPath
    if (-not (Test-Path $thuMuc)) { New-Item -ItemType Directory -Force -Path $thuMuc | Out-Null }
    if (Test-Path $argvPath) {
        try { Set-ItemProperty -Path $argvPath -Name IsReadOnly -Value $false -ErrorAction Stop } catch {}
    }
    Set-Content -Path $argvPath -Value $noiDungArgv -Encoding utf8
    $daSua = $true
    Ghi 'argv.json bi doi -> da ghi lai locale = vi'
}

# --- 2) Khoa chi-doc de khong ai doi ngam --------------------
if (Test-Path $argvPath) {
    try { Set-ItemProperty -Path $argvPath -Name IsReadOnly -Value $true -ErrorAction Stop } catch {}
}

# --- 3) Goi ngon ngu tieng Viet phai con ---------------------
$coExt = $false
if (Test-Path $extDir) {
    $hit = Get-ChildItem -Path $extDir -Directory -Filter "$extId-*" -ErrorAction SilentlyContinue
    if ($hit) { $coExt = $true }
}
if (-not $coExt) {
    if (Test-Path $codeCmd) {
        & $codeCmd --install-extension $extId --force *> $null
        $daSua = $true
        Ghi "Goi ngon ngu bien mat -> da cai lai $extId"
    } else {
        Ghi 'Khong tim thay code.cmd - bo qua buoc cai goi ngon ngu'
    }
}

if (-not $daSua) { Ghi 'OK - VS Code van dang khoa tieng Viet' }

# ============================================================
#  GO KHOA (khi nao muon quay lai tieng Anh):
#    Unregister-ScheduledTask -TaskName 'VSCode-Khoa-Tieng-Viet' -Confirm:$false
#    Set-ItemProperty "$env:APPDATA\Code\User\argv.json" -Name IsReadOnly -Value $false
#    Roi mo VS Code > Ctrl+Shift+P > "Configure Display Language" > English
# ============================================================
