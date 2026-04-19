# server.ps1 - Final Administrative Unit Validation Engine
# Strictly rejects broad parent matches when specific units (Gun, Eup, Myeon, Dong, Ri) are unmatched in the input.

if ($PSVersionTable.PSVersion.Major -ge 7) {
    try { [System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance) } catch { }
}
$utf8 = [System.Text.Encoding]::UTF8; [console]::OutputEncoding = $utf8
add-type -assemblyname system.io.compression.filesystem

function global:Get-CoreBjdName([string]$raw) {
    if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
    $n = [regex]::Replace($raw, "[()\[\]\s]", "")
    $s_tb = "$([char]0xD2B9)$([char]0xBCC4)"; $s_jc = "$([char]0xC790)$([char]0xCE58)"; $s_gy = "$([char]0xAD11)$([char]0xC5ED)"
    $s_si = "$([char]0xC2DC)"; $s_do = "$([char]0xB3C4)"
    if ($n.StartsWith("$([char]0xACBD)$([char]0xB0A8)")) { $n = $n.Replace("$([char]0xACBD)$([char]0xB0A8)", "$([char]0xACBD)$([char]0xC0C1)$([char]0xB0A8)") }
    elseif ($n.StartsWith("$([char]0xACBD)$([char]0xBD81)")) { $n = $n.Replace("$([char]0xACBD)$([char]0xBD81)", "$([char]0xACBD)$([char]0xC0C1)$([char]0xBD81)") }
    elseif ($n.StartsWith("$([char]0xC804)$([char]0xB0A8)")) { $n = $n.Replace("$([char]0xC804)$([char]0xB0A8)", "$([char]0xC804)$([char]0xB77C)$([char]0xB0A8)") }
    elseif ($n.StartsWith("$([char]0xC804)$([char]0xBD81)")) { $n = $n.Replace("$([char]0xC804)$([char]0xBD81)", "$([char]0xC804)$([char]0xB77C)$([char]0xBD81)") }
    elseif ($n.StartsWith("$([char]0xCDA9)$([char]0xB0A8)")) { $n = $n.Replace("$([char]0xCDA9)$([char]0xB0A8)", "$([char]0xCDA9)$([char]0xCCAD)$([char]0xB0A8)") }
    elseif ($n.StartsWith("$([char]0xCDA9)$([char]0xBD81)")) { $n = $n.Replace("$([char]0xCDA9)$([char]0xBD81)", "$([char]0xCDA9)$([char]0xCCAD)$([char]0xBD81)") }
    $n = $n.Replace($s_tb+$s_jc+$s_do, "").Replace($s_tb+$s_jc+$s_si, "").Replace($s_tb+$s_si, "").Replace($s_gy+$s_si, "").Replace($s_do, "")
    return $n.ToLower()
}

class BjdItem {
    [string]$code; [string]$name; [string]$norm
    BjdItem([string]$c, [string]$n) { $this.code = $c; $this.name = $n; $this.norm = Get-CoreBjdName $n }
}

$port = 8000; $basedir = get-location; $savedzip = join-path $basedir "official_bjd.zip"
$global:bjddata = [System.Collections.Generic.List[BjdItem]]::new()

function load-bjd-to-memory() {
    if (!(test-path $savedzip)) { return $false }
    write-host "[bjd] Initializing final precise engine..." -foregroundcolor cyan
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($savedzip)
        $entry = $zip.Entries | Where-Object { $_.FullName -like "*.txt" } | Select-Object -First 1
        $stream = $entry.Open(); $reader = new-object system.io.streamreader($stream, [system.text.encoding]::getencoding(949))
        $raw = $reader.ReadToEnd().Replace("\0",""); $reader.close(); $stream.close(); $zip.Dispose()
        $tempList = [System.Collections.Generic.List[BjdItem]]::new(35000); $s_pe = [string][char]0xD3D0; $s_ji = [string][char]0xC9C0
        foreach ($l in $raw -split "\r?\n") {
            if ([string]::IsNullOrWhiteSpace($l)) { continue }
            $p = $l -split "\t"
            if ($p.length -ge 3 -and ($p[2].Contains($s_pe+$s_ji) -or $p[2].trim() -eq "0")) { continue }
            if ($p.length -ge 2) { $tempList.Add([BjdItem]::new($p[0].trim(), $p[1].trim())) }
        }
        $global:bjddata = $tempList | Sort-Object { $_.norm.Length } -Descending
        write-host "[bjd] Ready ($($global:bjddata.Count))" -foregroundcolor green; return $true
    } catch { write-host "[err] $($_.Exception.Message)" -foregroundcolor red }
    return $false
}

function handle-request($ctx) {
    if ($null -eq $ctx) { return }
    $req = $ctx.request; $p = $req.url.absolutepath
    try {
        if ($req.httpmethod -eq "get") {
            if ($p -eq "/api/bjd/status") {
                $statusJson = "{`"status`":`"ok`",`"count`":$($global:bjddata.Count),`"isReady`":true}"
                $buf = $utf8.getbytes($statusJson); $ctx.response.contenttype="application/json"; $ctx.response.contentlength64=$buf.length; $ctx.response.outputstream.write($buf,0,$buf.length); $ctx.response.close()
            }
            elseif ($p -eq "/api/bjd/all") {
                $sb = new-object system.text.stringbuilder
                [void]$sb.Append("["); $count = 0
                foreach ($item in $global:bjddata) {
                    if ($count -gt 0) { [void]$sb.Append(",") }
                    [void]$sb.Append("{`"code`":`"$($item.code)`",`"name`":`"$($item.name)`",`"norm`":`"$($item.norm)`"}")
                    $count++
                }
                [void]$sb.Append("]"); $buf=$utf8.getbytes($sb.ToString()); $ctx.response.contenttype="application/json; charset=utf-8"; $ctx.response.contentlength64=$buf.length; $ctx.response.outputstream.write($buf,0,$buf.length); $ctx.response.close()
            }
            else {
                $f = if($p -eq "/" -or $p -eq ""){"index.html"}else{$p.trimstart("/")}; $filepath=join-path $basedir $f
                if (test-path $filepath) {
                    $ext = [system.io.path]::getextension($filepath).tolower()
                    $ctx.response.contenttype = switch($ext) {".html"{"text/html"} ".css"{"text/css"} ".js"{"application/javascript"} default{"application/octet-stream"}}
                    $b = [system.io.file]::readallbytes($filepath); $ctx.response.outputstream.write($b,0,$b.length)
                } else { $ctx.response.statuscode = 404 }; $ctx.response.close()
            }
        }
        elseif ($req.httpmethod -eq "post") {
            if ($p -eq "/api/process/rows") {
                $sr = new-object system.io.streamreader($req.inputstream, $utf8); $ibody = $sr.readtoend(); $sr.close()
                $rows = $ibody | convertfrom-json; $sb = new-object system.text.stringbuilder; [void]$sb.Append("[")
                $units = @("$([char]0xAD6C)","$([char]0xC74D)","$([char]0xBA74)","$([char]0xB3D9)","$([char]0xB9AC)") # 구,읍,면,동,리
                $count = 0
                foreach ($r in $rows) {
                    if ($count -gt 0) { [void]$sb.Append(",") }
                    $nreg = if($r.psobject.properties['_normReg']){$r._normReg} else {$r._normreg}
                    $lcode = if($r.psobject.properties['_landCode']){$r._landCode} else {$r._landcode}
                    $pnu = ""; $p_err = ""
                    if ($nreg) {
                        $target = Get-CoreBjdName $nreg; $m = $null
                        # 1. Exact Match
                        foreach ($idx in $global:bjddata) { if ($idx.norm -eq $target) { $m = $idx; break } }
                        # 2. Sequential Fuzzy Matching with Administrative Unit Guard
                        if (!$m) { 
                            foreach ($idx in $global:bjddata) { 
                                if ($target.StartsWith($idx.norm) -or $target.EndsWith($idx.norm) -or $idx.norm.EndsWith($target) -or $target.Contains($idx.norm) -or $idx.norm.Contains($target)) {
                                    # UNIT GUARD: If match is Sido/Sigungu (ends with 5+ zeros)
                                    if ($idx.code.EndsWith("00000")) {
                                        # Fail if input has more specific units (Gu/Eup/Myeon/Dong/Ri) than the match
                                        $isTooBroad = $false
                                        foreach ($u in $units) { if ($target.Contains($u) -and -not $idx.norm.Contains($u)) { $isTooBroad = $true; break } }
                                        if ($isTooBroad) { continue }
                                    }
                                    $m = $idx; break 
                                } 
                            } 
                        }
                        if ($m) { $pnu = "$($m.code)$($lcode)" } else { $p_err = "FAIL"; write-host "[match] FAIL: $nreg" -foregroundcolor yellow }
                    }
                    $cleanR = $r.psobject.copy()
                    $cleanR.psobject.properties.remove("_normReg"); $cleanR.psobject.properties.remove("_normreg")
                    $cleanR.psobject.properties.remove("_landCode"); $cleanR.psobject.properties.remove("_landcode")
                    $outJson = $cleanR | ConvertTo-Json -Compress
                    $outJson = $outJson.TrimEnd("}") + ",`"PNU`":`"$pnu`",`"PNU_ERROR`":`"$p_err`"}"
                    [void]$sb.Append($outJson); $count++
                }
                [void]$sb.Append("]"); $buf=$utf8.getbytes($sb.ToString()); $ctx.response.contenttype="application/json"; $ctx.response.contentlength64=$buf.length; $ctx.response.outputstream.write($buf,0,$buf.length); $ctx.response.close()
            }
        }
    } catch { try { $ctx.response.close() } catch {} }
}

$listener = new-object system.net.httplistener; $listener.prefixes.add("http://localhost:$port/")
try { $listener.start(); write-host "[sys] Online: http://localhost:$port" -foregroundcolor green } catch { exit }
load-bjd-to-memory
while ($listener.islistening) { try { handle-request $listener.getcontext() } catch {} }
