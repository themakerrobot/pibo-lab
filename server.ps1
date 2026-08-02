# Pibo Lab static server (for PCs without Python - uses built-in Windows PowerShell)
param([int]$Port = 50030)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".js"="text/javascript"; ".mjs"="text/javascript"; ".css"="text/css"
  ".json"="application/json"; ".xml"="application/xml"; ".urdf"="application/xml"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"
  ".wasm"="application/wasm"; ".stl"="application/octet-stream"
  ".txt"="text/plain; charset=utf-8"; ".md"="text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Write-Host "Cannot open port $Port. Server may already be running, or the port is in use."
  exit 1
}
Write-Host "Pibo Lab server - http://localhost:$Port  (close this window to stop)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq "") { $rel = "index.html" }
    $path = Join-Path $root $rel
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith($root)) { $res.StatusCode = 403 }
    elseif (Test-Path $full -PathType Container) { $full = Join-Path $full "index.html" }
    if ($res.StatusCode -ne 403 -and (Test-Path $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      if ($res.StatusCode -ne 403) { $res.StatusCode = 404 }
    }
  } catch { $res.StatusCode = 500 }
  $res.OutputStream.Close()
}
