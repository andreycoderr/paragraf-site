# Local preview for the "Paragraf" static site (no Node required).
# Run:  right-click -> "Run with PowerShell"
#   or: powershell -ExecutionPolicy Bypass -File .\serve.ps1
# Opens http://localhost:8080  (Ctrl+C to stop)
# Flag -NoOpen : do not auto-open the browser.
#
# Uses a raw TcpListener (not HttpListener) so the socket is owned by THIS
# process - works reliably under tooling that tracks the launched process.
# ASCII-only on purpose so Windows PowerShell 5.1 parses it regardless of file encoding.
param([switch]$NoOpen)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$port = 8080

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".svg"="image/svg+xml";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
  ".webp"="image/webp"; ".ico"="image/x-icon"; ".json"="application/json";
  ".pdf"="application/pdf"; ".woff2"="font/woff2"; ".xml"="application/xml"; ".txt"="text/plain; charset=utf-8"
}

Add-Type -AssemblyName System.Web | Out-Null
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host ""
Write-Host "  PARAGRAF - local server" -ForegroundColor Yellow
Write-Host "  http://localhost:$port/" -ForegroundColor Cyan
Write-Host "  Root: $root"
Write-Host "  Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""
if (-not $NoOpen) { Start-Process "http://localhost:$port/" }

function Send-Response($stream, $status, $contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $hbytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($hbytes, 0, $hbytes.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
      $requestLine = $reader.ReadLine()
      if (-not [string]::IsNullOrWhiteSpace($requestLine)) {
        # drain remaining request headers
        while ($true) { $line = $reader.ReadLine(); if ($null -eq $line -or $line -eq "") { break } }

        $rawPath = ($requestLine -split " ")[1]
        if ($rawPath) { $rawPath = ($rawPath -split "\?")[0] }
        $rel = [System.Web.HttpUtility]::UrlDecode($rawPath).TrimStart("/")
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
        $path = Join-Path $root $rel

        if ((Test-Path $path) -and -not (Get-Item $path).PSIsContainer) {
          $ext = [System.IO.Path]::GetExtension($path).ToLower()
          $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
          $bytes = [System.IO.File]::ReadAllBytes($path)
          Send-Response $stream "200 OK" $ct $bytes
        } else {
          $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
          Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" $body
        }
      }
    } catch {
      # ignore a single bad/aborted connection and keep serving
    } finally {
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
}
