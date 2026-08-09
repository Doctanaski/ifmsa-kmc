param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = 'Stop'

git add -A
if ($LASTEXITCODE -ne 0) { throw "git add failed" }

git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host "Pushed: $Message"