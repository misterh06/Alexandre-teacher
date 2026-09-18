$path = 'c:\Users\utilistaeur\Desktop\Alexandre teacher\script.js'
$lines = Get-Content -Path $path -Encoding UTF8
$idx = 429
if ($idx -lt $lines.Length) {
    $line = $lines[$idx]
    Write-Output "LINE $($idx+1):"
    Write-Output $line
    Write-Output "----- BYTES (UTF8) -----"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($line)
    $hex = $bytes | ForEach-Object { $_.ToString('X2') }
    Write-Output ($hex -join ' ')
} else {
    Write-Output 'Index out of range'
}
