# server.ps1 - accurate and fast pnu backend
[net.servicepointmanager]::securityprotocol = [net.securityprotocoltype]::tls12

$port = 8000
$basedir = get-location
$savedzip = join-path $basedir "official_bjd.zip"

$global:bjddata = @()
$global:bjdlookup = @{}

# bigrams for similarity
function get-bigrams($s) {
    $set = new-object system.collections.generic.hashset[string]
    if (!$s -or $s.length -lt 2) { return $set }
    for ($i = 0; $i -lt $s.length - 1; $i++) { $set.add($s.substring($i, 2)) | out-null }
    return $set
}

# optimized data sync
function sync-fromzip($zippath) {
    write-host "[bjd] indexing database..." -foregroundcolor cyan
    try {
        if (!(test-path $zippath)) { return 0 }
        $temp = join-path $basedir "temp_extract"
        expand-archive $zippath $temp -force
        $txt = get-childitem $temp -filter "*.txt" | select-object -first 1
        $lines = [system.io.file]::readalllines($txt.fullname, [system.text.encoding]::getencoding("euc-kr"))
        
        $newdata = new-object system.collections.generic.list[object]
        $newlookup = @{}
        $pat_del = [char]0xd3d0 + [char]0xc9c0 # "폐지"
        
        foreach ($l in $lines) {
            if ($l.contains($pat_del)) { continue }
            $p = $l -split "\t"
            if ($p.length -ge 2) {
                $code = $p[0].trim(); $name = $p[1].trim()
                if ($code.length -eq 10) {
                    $norm = $name.replace(" ", "").tolower()
                    $item = @{ code = $code; name = $name; norm = $norm; big = get-bigrams $norm }
                    $newdata.add($item)
                    if (!$newlookup.containskey($norm)) { $newlookup[$norm] = $item }
                }
            }
        }
        $global:bjddata = $newdata.toarray()
        $global:bjdlookup = $newlookup
        write-host "[bjd] loaded $($global:bjddata.count) items." -foregroundcolor green
        return $global:bjddata.count
    } finally {
        if (test-path $temp) { remove-item $temp -recurse -force -erroraction silentlycontinue }
    }
}

if (test-path $savedzip) { sync-fromzip $savedzip | out-null }

$listener = new-object system.net.httplistener
$listener.prefixes.add("http://localhost:$port/")
try { $listener.start() } catch { exit }

function send-json($ctx, $data) {
    $json = $data | convertto-json -compress -depth 10
    $buf = [system.text.encoding]::utf8.getbytes($json)
    $ctx.response.contenttype = "application/json; charset=utf-8"
    $ctx.response.addheader("access-control-allow-origin", "*")
    $ctx.response.outputstream.write($buf, 0, $buf.length)
    $ctx.response.close()
}

write-host "server running at http://localhost:$port" -foregroundcolor cyan

while ($listener.islistening) {
    try {
        $ctx = $listener.getcontext(); $req = $ctx.request; $p = $req.url.absolutepath
        
        if ($req.httpmethod -eq "get") {
            if ($p -eq "/api/bjd/status") {
                $ts = if(test-path $savedzip){ (get-item $savedzip).lastwritetime.tostring("yyyy-mm-dd hh:mm") } else { "none" }
                send-json $ctx @{ status="ok"; count=$global:bjddata.count; updatedat=$ts }
            }
            elseif ($p -eq "/api/bjd/all") { 
                $clientData = $global:bjddata | ForEach-Object { @{ code = $_.code; name = $_.name; norm = $_.norm } }
                send-json $ctx $clientData 
            }
            else {
                $f = if($p -eq "/"){"index.html"}else{$p.trimstart("/")}
                $filepath = join-path $basedir $f
                if (test-path $filepath) {
                    $mime = switch ([system.io.path]::getextension($filepath)) { ".html"{"text/html;charset=utf-8"} ".js"{"application/javascript;charset=utf-8"} ".css"{"text/css;charset=utf-8"} default{"application/octet-stream"} }
                    $ctx.response.contenttype = $mime
                    $b = [system.io.file]::readallbytes($filepath)
                    $ctx.response.outputstream.write($b, 0, $b.length)
                } else { $ctx.response.statuscode = 404 }
                $ctx.response.close()
            }
        }
        elseif ($req.httpmethod -eq "post") {
            if ($p -eq "/api/process/rows") {
                write-host "[api] processing request..." -foregroundcolor gray
                $data = (new-object system.io.streamreader($req.inputstream)).readtoend() | convertfrom-json
                $addrcache = @{}; $result = new-object system.collections.generic.list[object]
                foreach ($r in $data) {
                    $nreg = $r._normreg; $lcode = $r._landcode; $pnu = ""; $err = ""
                    if ($nreg) {
                        $target = $nreg.replace(" ", "").tolower(); $match = $null
                        if ($addrcache.containskey($target)) { $match = $addrcache[$target] }
                        else {
                            # 1. Exact Match
                            if ($global:bjdlookup.containskey($target)) { $match = $global:bjdlookup[$target] }
                            else {
                                # 2. Partial/Inclusion Match (Powerful for short names like "김량장동")
                                $candidates = $global:bjddata | Where-Object { $_.norm.Contains($target) -or $target.Contains($_.norm) }
                                if ($candidates.Count -gt 0) {
                                    $match = $candidates | Select-Object -First 1
                                } else {
                                    # 3. Fuzzy Match (Last resort)
                                    $tbig = get-bigrams $target; $max = 0
                                    foreach ($item in $global:bjddata) {
                                        $ibig = $item.big
                                        if ($tbig.count -gt 0 -and $ibig.count -gt 0) {
                                            $intersect = 0
                                            foreach ($bi in $tbig) { if ($ibig.contains($bi)) { $intersect++ } }
                                            $score = (2.0 * $intersect) / ($tbig.count + $ibig.count)
                                            if ($score -gt $max) { $max = $score; $match = $item }
                                            if ($max -gt 0.85) { break }
                                        }
                                    }
                                    if ($max -lt 0.4) { $match = $null }
                                }
                            }
                            $addrcache[$target] = $match
                        }
                        if ($match) { $pnu = "$($match.code)$lcode" } 
                        else { $err = "FAIL: No BJD match" } # Fixed: Starts with FAIL
                    }
                    $items = [ordered]@{}; foreach ($prop in $r.psobject.properties) {
                        if ($prop.name -ne "_normreg" -and $prop.name -ne "_landcode") { $items[$prop.name] = $prop.value }
                    }
                    $items["PNU"] = $pnu; $items["PNU_ERROR"] = $err; $result.add([pscustomobject]$items)
                }
                write-host "[api] done." -foregroundcolor green
                send-json $ctx $result.toarray()
            }
        }
    } catch { write-host "[error] $($_.exception.message)" -foregroundcolor red }
}
