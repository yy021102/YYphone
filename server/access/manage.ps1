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
  $ownerHeaders = @{ Authorization = 'Bearer ' + $credential.GetNetworkCredential().Password; Origin = $BaseUrl }
  $ownerLink = Invoke-RestMethod "$BaseUrl/api/admin/bootstrap/create" -Method Post -Headers $ownerHeaders -ContentType 'application/json' -Body '{}'
  Start-Process $ownerLink.url
  Write-Output 'Owner login page opened. This browser will remember your login.'
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
