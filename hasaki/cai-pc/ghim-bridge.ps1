# ghim-bridge.ps1 - GHIM extension wms-bridge vao Edge cua MOI nguoi dung tren PC (16/10/2026).
#   User 16/10: "toi yeu cau cai san luon ma chua lam" -> bo cai + task tu cap nhat (SYSTEM, 2h) tu ghim, khong cai tay.
#   Cach: chep wms-bridge.crx vao C:\ProgramData\AuditFactory\wms-bridge (moi user doc duoc; C:\AuditFactory chi SYSTEM+Admin)
#   + update.xml (file:///) + policy HKLM ExtensionInstallForcelist (giong laptop dang chay bang HKCU, factory/wms-bridge/ghim-extension.mjs).
#   Edge tu cai khi khoi dong/nap lai policy; nguoi dung khong tat/xoa duoc. Ban moi = thay crx + ban.json trong repo, PC tu theo.
#   Phien ma extension day len GAS mang danh tinh NGUOI DANG DANG NHAP -> chi dung DOC; cac co GHI chi lay phien tamlc (layTokenGhiWork).
#   Thuan ASCII (bay em-dash PS 5.1).
function Ghim-Bridge([string]$kit) {
  try {
    $nguon = Join-Path $kit "wms-bridge"
    $crx = Join-Path $nguon "wms-bridge.crx"
    if (-not (Test-Path $crx)) { return "bridge: thieu goi crx trong repo" }
    $ban = Get-Content (Join-Path $nguon "ban.json") -Raw | ConvertFrom-Json
    $id = [string]$ban.id; $ver = [string]$ban.version
    if ($id -notmatch '^[a-p]{32}$') { return "bridge: id sai trong ban.json" }
    $dich = "C:\ProgramData\AuditFactory\wms-bridge"
    New-Item -ItemType Directory -Force -Path $dich | Out-Null
    $crxDich = Join-Path $dich "wms-bridge.crx"
    $doi = $true
    if (Test-Path $crxDich) { $doi = (Get-FileHash $crx).Hash -ne (Get-FileHash $crxDich).Hash }
    if ($doi) { Copy-Item $crx $crxDich -Force }
    $url = "file:///" + ($dich -replace '\\', '/')
    $xml = "<?xml version='1.0' encoding='UTF-8'?>`n<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>`n  <app appid='$id'>`n    <updatecheck codebase='$url/wms-bridge.crx' version='$ver' />`n  </app>`n</gupdate>`n"
    $xmlF = Join-Path $dich "update.xml"
    if (-not (Test-Path $xmlF) -or (Get-Content $xmlF -Raw) -ne $xml) { [IO.File]::WriteAllText($xmlF, $xml, (New-Object Text.UTF8Encoding $false)) }
    # moi user (ke ca nguoi dang nhap thuong) doc duoc
    & icacls $dich /grant "*S-1-5-32-545:(OI)(CI)RX" /T /Q 2>&1 | Out-Null
    $khoa = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist"
    # BAY (QC 16/10): New-Item -Force tren khoa registry DA CO = tao lai khoa, XOA SACH gia tri cu (extension khac bi go) -> chi tao khi chua co
    if (-not (Test-Path $khoa)) { New-Item -Path $khoa -Force | Out-Null }
    $giaTri = "$id;$url/update.xml"
    $k = Get-Item -Path $khoa
    $ten = $null; $max = 0
    foreach ($n in $k.GetValueNames()) {
      if ($n -notmatch '^\d+$') { continue }
      if ([int]$n -gt $max) { $max = [int]$n }
      if ([string]$k.GetValue($n) -like "$id;*") { $ten = $n }
    }
    if ($ten -and [string]$k.GetValue($ten) -eq $giaTri) { return "bridge: da ghim $ver$(if($doi){' (goi moi)'})" }
    if (-not $ten) { $ten = [string]($max + 1) }
    New-ItemProperty -Path $khoa -Name $ten -PropertyType String -Value $giaTri -Force | Out-Null
    return "bridge: GHIM MOI $ver (policy so $ten) - Edge tu cai khi mo lai"
  } catch { return "bridge: [X] $_" }
}
