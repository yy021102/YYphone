param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9]{17,20}$')][string]$ClientId)
$ErrorActionPreference = 'Stop'
$phoneRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$phoneConfigPath = Join-Path $phoneRoot 'wrangler.jsonc'
$phoneConfig = Get-Content -LiteralPath $phoneConfigPath -Raw | ConvertFrom-Json
$phoneConfig.vars | Add-Member -NotePropertyName DISCORD_CLIENT_ID -NotePropertyValue $ClientId -Force
[IO.File]::WriteAllText($phoneConfigPath, ($phoneConfig | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
$phoneSecret = Read-Host 'Discord Client Secret (hidden input)' -AsSecureString
$phoneCredential = New-Object System.Management.Automation.PSCredential('discord', $phoneSecret)
Push-Location $phoneRoot
try {
  $phoneWrangler = Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js'
  if (Test-Path -LiteralPath $phoneWrangler) {
    $phoneCredential.GetNetworkCredential().Password | & node $phoneWrangler pages secret put DISCORD_CLIENT_SECRET --project-name yyphone
  } else {
    $phoneCredential.GetNetworkCredential().Password | npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name yyphone
  }
  if ($LASTEXITCODE -ne 0) { throw 'Secret upload did not complete.' }
  Write-Output 'Discord configuration saved. The phone site has NOT been deployed.'
  $phoneStatusPath = Join-Path $PSScriptRoot '.private/discord-secret-configured.txt'
  [IO.File]::WriteAllText($phoneStatusPath, (Get-Date).ToString('o'))
} finally { Pop-Location }
