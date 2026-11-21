param(
  [ValidateSet('open', 'code', 'reset-devices', 'revoke-code')][string]$Action = 'open',
  [string]$Value,
  [string]$BaseUrl = 'https://yyphone-admin.pages.dev'
)
$ErrorActionPreference = 'Stop'
$credentialPath = Join-Path $PSScriptRoot '.private/admin-token.xml'
$protected = Import-Clixml -LiteralPath $credentialPath
$credential = New-Object System.Management.Automation.PSCredential('admin', $protected)
if ($Action -eq 'open') {
  Set-Clipboard -Value $credential.GetNetworkCredential().Password
  Start-Process "$BaseUrl/admin"
  Write-Output 'Admin page opened. Paste the management key from your clipboard to unlock.'
  return
}
$headers = @{ Authorization = 'Bearer ' + $credential.GetNetworkCredential().Password; Origin = $BaseUrl }
$endpoint = 'codes'
$payload = @{}
if ($Action -eq 'reset-devices') {
  if (!$Value) { throw 'Provide -Value username' }
  $endpoint = 'reset-devices'; $payload = @{ username = $Value }
}
if ($Action -eq 'revoke-code') {
  if (!$Value) { throw 'Provide -Value activation-code' }
  $endpoint = 'revoke-code'; $payload = @{ code = $Value }
}
Invoke-RestMethod "$BaseUrl/api/admin/$endpoint" -Method Post -Headers $headers -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Compress)
