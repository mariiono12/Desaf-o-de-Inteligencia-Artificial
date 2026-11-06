$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd('\') + '\'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8000/')

try {
    $listener.Start()
} catch {
    Write-Error "No se pudo iniciar Ritmo en http://localhost:8000. Cierra otro servidor que use ese puerto e inténtalo de nuevo. Detalle: $($_.Exception.Message)"
    exit 1
}

Write-Host 'Ritmo está disponible en http://localhost:8000' -ForegroundColor Cyan
Write-Host 'Deja esta ventana abierta mientras juegas. Pulsa Ctrl+C para detener el servidor.' -ForegroundColor Gray
Start-Process 'http://localhost:8000/'

$contentTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg' = 'image/svg+xml'
    '.png' = 'image/png'
    '.jpg' = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.ico' = 'image/x-icon'
}

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        } catch [System.Net.HttpListenerException] {
            break
        }

        try {
            if ($context.Request.HttpMethod -notin @('GET', 'HEAD')) {
                $context.Response.StatusCode = 405
                $context.Response.Headers['Allow'] = 'GET, HEAD'
            } else {
                $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
                if (-not $relativePath) {
                    $relativePath = 'index.html'
                }

                $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
                if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or $filePath -match '[\\/]\.git([\\/]|$)') {
                    $context.Response.StatusCode = 404
                } elseif (-not [System.IO.File]::Exists($filePath)) {
                    $context.Response.StatusCode = 404
                } else {
                    $bytes = [System.IO.File]::ReadAllBytes($filePath)
                    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                    $contentType = $contentTypes[$extension]
                    if (-not $contentType) {
                        $contentType = 'application/octet-stream'
                    }

                    $context.Response.ContentType = $contentType
                    $context.Response.ContentLength64 = $bytes.Length
                    if ($context.Request.HttpMethod -eq 'GET') {
                        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
                    }
                }
            }
        } catch {
            Write-Warning "Error sirviendo una solicitud local: $($_.Exception.Message)"
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
