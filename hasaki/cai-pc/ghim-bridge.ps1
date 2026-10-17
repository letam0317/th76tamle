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
    # 17/10 user "may QLIT dang nhap o Chrome": ghim CA Edge LAN Chrome (cung goi crx/update.xml) + ghi ten may vao policy 3rdparty
    #   (extension 1.6.5 doc chrome.storage.managed.may, kem khi day phien -> bang May tram ghi phien vao dung the may).
    $giaTri = "$id;$url/update.xml"
    $kq = @()
    foreach ($td in @(@{ ten = "Edge"; goc = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"; dl = "Microsoft\Edge" }, @{ ten = "Chrome"; goc = "HKLM:\SOFTWARE\Policies\Google\Chrome"; dl = "Google\Chrome" })) {
      $khoa = "$($td.goc)\ExtensionInstallForcelist"
      # BAY (QC 16/10): New-Item -Force tren khoa registry DA CO = tao lai khoa, XOA SACH gia tri cu (extension khac bi go) -> chi tao khi chua co
      if (-not (Test-Path $khoa)) { New-Item -Path $khoa -Force | Out-Null }
      $k = Get-Item -Path $khoa
      $ten = $null; $max = 0
      foreach ($n in $k.GetValueNames()) {
        if ($n -notmatch '^\d+$') { continue }
        if ([int]$n -gt $max) { $max = [int]$n }
        if ([string]$k.GetValue($n) -like "$id;*") { $ten = $n }
      }
      $moi = -not ($ten -and [string]$k.GetValue($ten) -eq $giaTri)
      if ($moi) { if (-not $ten) { $ten = [string]($max + 1) }; New-ItemProperty -Path $khoa -Name $ten -PropertyType String -Value $giaTri -Force | Out-Null }
      $kp = "$($td.goc)\3rdparty\extensions\$id\policy"
      foreach ($b in @("$($td.goc)\3rdparty", "$($td.goc)\3rdparty\extensions", "$($td.goc)\3rdparty\extensions\$id", $kp)) { if (-not (Test-Path $b)) { New-Item -Path $b | Out-Null } }
      if ((Get-ItemProperty -Path $kp -Name may -ErrorAction SilentlyContinue).may -ne $env:COMPUTERNAME) { New-ItemProperty -Path $kp -Name may -PropertyType String -Value $env:COMPUTERNAME -Force | Out-Null }
      # Da CAI THAT chua: dem ho so trinh duyet co thu muc Extensions\<id> (Chrome may khong vao mien co the CHAN goi ngoai cua hang)
      $cai = @(Get-ChildItem "C:\Users\*\AppData\Local\$($td.dl)\User Data\*\Extensions\$id" -Directory -ErrorAction SilentlyContinue).Count
      $kq += "$($td.ten) $(if($moi){'GHIM MOI'}else{'da ghim'}), cai $cai ho so"
    }
    return "bridge: $ver$(if($doi){' (goi moi)'}) - " + ($kq -join " | ")
  } catch { return "bridge: [X] $_" }
}
