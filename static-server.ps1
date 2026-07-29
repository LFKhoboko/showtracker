param([int]$Port = 8099)

$root = Split-Path $PSCommandPath -Parent
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

# Output PID so it can be captured
Write-Host "PID:$((Get-Process -Id $pid).Id)"
Write-Host "Serving $root on http://localhost:$Port"
Write-Host "Ready"

$mime = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/manifest+json"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain"
    ".xml"  = "application/xml"
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    
    $urlPath = $req.Url.AbsolutePath
    if ($urlPath -eq "/") { $urlPath = "/index.html" }
    
    $filePath = Join-Path $root $urlPath.TrimStart("/").Replace("/", "\")
    
    if (Test-Path $filePath -PathType Leaf) {
        try {
            $ext = [IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            $data = [IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $contentType
            $res.ContentLength64 = $data.Length
            $res.OutputStream.Write($data, 0, $data.Length)
        } catch {
            $res.StatusCode = 500
        }
    } else {
        $res.StatusCode = 404
    }
    $res.Close()
}
