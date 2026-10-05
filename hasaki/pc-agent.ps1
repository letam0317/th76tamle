param(
    [string]$WebhookUrl = "https://script.google.com/macros/s/AKfycbz_THAY_BANG_URL_GAS_CUA_BAN/exec"
)

# pc-agent.ps1 - Agent doc phien dang nhap WMS va gui ve trung tam (1-purpose)
# Chay hoan toan cuc bo, khong mo port, khong mo cua so.

$ErrorActionPreference = 'SilentlyContinue'

# 1. Lay thong tin co ban cua may
$Hostname = $env:COMPUTERNAME
$WinUser = $env:USERNAME
$IpAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.254.*' }).IPAddress[0]

# 2. Ham giai ma JWT (chi doc Payload)
function Decode-JwtPayload($token) {
    try {
        $parts = $token.Split('.')
        if ($parts.Length -lt 2) { return $null }
        $base64 = $parts[1].Replace('-', '+').Replace('_', '/')
        switch ($base64.Length % 4) {
            2 { $base64 += "==" }
            3 { $base64 += "=" }
        }
        $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
        return $json | ConvertFrom-Json
    } catch {
        return $null
    }
}

# 3. Quet LevelDB cua Chrome va Edge tim Token
$LocalApp = $env:LOCALAPPDATA
$Paths = @(
    "$LocalApp\Google\Chrome\User Data\Default\Local Storage\leveldb",
    "$LocalApp\Microsoft\Edge\User Data\Default\Local Storage\leveldb"
)

$FoundSub = ""
$MaxExp = 0

foreach ($Dir in $Paths) {
    if (Test-Path $Dir) {
        $Files = Get-ChildItem -Path $Dir -Include *.ldb, *.log -Recurse -File
        foreach ($File in $Files) {
            try {
                # Copy ra file tam de doc tranh loi bi khoa boi trinh duyet
                $TempFile = [System.IO.Path]::GetTempFileName()
                Copy-Item -Path $File.FullName -Destination $TempFile -Force
                
                # Doc file dang byte va chuyen sang chuoi ky tu ascii/latin1
                $Bytes = [System.IO.File]::ReadAllBytes($TempFile)
                $Content = [System.Text.Encoding]::GetEncoding(28591).GetString($Bytes) # ISO-8859-1
                
                if ($Content -match "auth_store") {
                    # Tim tat ca cac doan giong JWT
                    $Regex = [regex]'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*'
                    $Matches = $Regex.Matches($Content)
                    foreach ($Match in $Matches) {
                        $Payload = Decode-JwtPayload $Match.Value
                        if ($Payload -and $Payload.sub) {
                            if ($Payload.exp -gt $MaxExp) {
                                $MaxExp = $Payload.exp
                                $FoundSub = $Payload.sub
                            }
                        }
                    }
                }
                Remove-Item -Path $TempFile -Force
            } catch {}
        }
    }
}

# Neu khong tim thay thi de trong
if (-not $FoundSub) { $FoundSub = "" }

# 4. Gui bao cao ve Google Apps Script
$Payload = @{
    action = "upsertPcLogin"
    hostname = $Hostname
    ip = $IpAddress
    winUser = $WinUser
    wmsSub = $FoundSub
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

$JsonPayload = $Payload | ConvertTo-Json

try {
    Invoke-RestMethod -Uri $WebhookUrl -Method Post -ContentType "application/json" -Body $JsonPayload -TimeoutSec 10
} catch {
    # Bo qua neu loi mang
}
