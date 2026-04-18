# server.ps1 - Fast Startup Version
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Port = 8000
$BaseDir = Get-Location
$SavedZip = Join-Path $BaseDir "official_bjd.zip"

$global:BjdData = @()
$global:IsLoading = $false

# Core Parser Function (Optimized for speed)
function Sync-FromZip($ZipPath) {
    $global:IsLoading = $true
    Write-Host "[BJD] Processing $ZipPath..." -ForegroundColor Gray
    try {
        if (!(Test-Path $ZipPath)) { return 0 }
        $Temp = Join-Path $BaseDir "temp_extract"
        if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue }
        Expand-Archive $ZipPath $Temp -Force
        $Txt = Get-ChildItem $Temp -Filter "*.txt" | Select-Object -First 1
        if (!$Txt) { return 0 }
        
        $Encoding = [System.Text.Encoding]::GetEncoding("euc-kr")
        $Lines = [System.IO.File]::ReadAllLines($Txt.FullName, $Encoding)
        $NewData = New-Object System.Collections.Generic.List[object]
        
        # Binary strings for "폐지" to avoid encoding issues in script file itself
        $pat_deleted = [char]0xd3d0 + [char]0xc9c0 # 폐지 (EUC-KR)
        
        foreach ($l in $Lines) {
            if ($l.Contains($pat_deleted) -or $l.Contains("폐지")) { continue }
            $p = $l -split "\t"
            if ($p.Length -ge 2) {
                $code = $p[0].Trim()
                if ($code.Length -eq 10 -and $code -match "^\d+$") {
                    $NewData.Add(@{ code = $code; name = $p[1].Trim() })
                }
            }
        }
        $global:BjdData = $NewData.ToArray()
        return $global:BjdData.Count
    } finally {
        if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue }
        $global:IsLoading = $false
    }
}

# Start Listener FIRST so browser can connect immediately
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")
try { 
    $Listener.Start()
    Write-Host "Server started on http://localhost:$Port" -ForegroundColor Cyan
} catch { exit }

# Start Loading in background (relative to the listener loop)
# Note: Since PS 5.1 is single-threaded in this loop, we just load before loop
if (Test-Path $SavedZip) {
    Write-Host "[System] Loading data from ZIP..." -ForegroundColor Yellow
    Sync-FromZip $SavedZip
    Write-Host "[System] Load complete ($($global:BjdData.Count) records)." -ForegroundColor Green
}

function Send-JsonResponse($Context, $Data, $Status = 200) {
    $Json = $Data | ConvertTo-Json -Compress
    $Buffer = [System.Text.Encoding]::UTF8.GetBytes($Json)
    $Context.Response.StatusCode = $Status
    $Context.Response.ContentType = "application/json; charset=utf-8"
    $Context.Response.ContentLength64 = $Buffer.Length
    $Context.Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
    $Context.Response.Close()
}

function Send-FileResponse($Context, $Path) {
    if (Test-Path $Path) {
        $Ext = [System.IO.Path]::GetExtension($Path)
        $Mime = switch ($Ext) { ".html"{"text/html;charset=utf-8"} ".js"{"application/javascript;charset=utf-8"} ".css"{"text/css;charset=utf-8"} default{"application/octet-stream"} }
        $Buffer = [System.IO.File]::ReadAllBytes($Path)
        $Context.Response.ContentType = $Mime
        $Context.Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
    } else { $Context.Response.StatusCode = 404 }
    $Context.Response.Close()
}

while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext(); $Request = $Context.Request; $Path = $Request.Url.AbsolutePath
        if ($Request.HttpMethod -eq "GET") {
            if ($Path -eq "/api/bjd/status") {
                $st = if($global:IsLoading){ "loading" } else { "ok" }
                $ts = if(Test-Path $SavedZip){ (Get-Item $SavedZip).LastWriteTime.ToString("yyyy-MM-dd HH:mm") } else { "None" }
                Send-JsonResponse $Context @{ status=$st; count=$global:BjdData.Count; updatedAt=$ts }
            }
            elseif ($Path -eq "/api/bjd/all") {
                if ($global:IsLoading) { Send-JsonResponse $Context @{ status="loading" } 503 }
                else { Send-JsonResponse $Context $global:BjdData }
            }
            elseif ($Path -eq "/api/bjd/search") {
                $q = $Request.QueryString["q"]
                Write-Host "[BJD] Searching: $q" -ForegroundColor Gray
                if ($q) {
                    $keywords = $q -split "\s+" | Where-Object { $_ }
                    $m = $global:BjdData | Where-Object {
                        $name = $_.name
                        $allMatch = $true
                        foreach ($k in $keywords) {
                            if ($name -notmatch [regex]::Escape($k)) { $allMatch = $false; break }
                        }
                        $allMatch
                    } | Select-Object -First 50
                } else { $m = @() }
                Send-JsonResponse $Context $m
            }
            else {
                $f = if($Path -eq "/"){"index.html"}else{$Path.TrimStart("/")}
                Send-FileResponse $Context (Join-Path $BaseDir $f)
            }
        }
        elseif ($Request.HttpMethod -eq "POST") {
            if ($Path -eq "/db/update-official") {
                try {
                    $Url = "https://www.code.go.kr/etc/codeFullDown.do"
                    Invoke-WebRequest -Uri $Url -Method Post -Body "codeseId=00002" -OutFile $SavedZip -ContentType "application/x-www-form-urlencoded" -UserAgent "Mozilla/5.0"
                    $Count = Sync-FromZip $SavedZip
                    Send-JsonResponse $Context @{ status="success"; count=$Count }
                } catch {
                    Send-JsonResponse $Context @{ status="error"; message=$_.Exception.Message } 500
                }
            }
            elseif ($Path -eq "/api/bjd/reset") {
                $global:BjdData = @(); if(Test-Path $SavedZip){Remove-Item $SavedZip -Force}
                Send-JsonResponse $Context @{ status="success" }
            }
        }
    } catch { }
}
