# Sultan Arab App Watchdog Script
$ServiceName = "SultanArabApp"
$Port = 3000

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc -or $svc.Status -ne "Running") {
    Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    exit
}

try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(2000, $false)
    if ($client.Connected) {
        $client.EndConnect($iar)
    }
    $client.Close()
    if (-not $success) {
        Restart-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    }
} catch {
    Restart-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}
