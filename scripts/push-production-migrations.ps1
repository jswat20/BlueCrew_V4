$ErrorActionPreference = "Stop"
try {
  $securePassword = Read-Host "Production database password" -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $databaseUrl = "postgresql://postgres.dynxjiqrdlhfhrjnhvgn:$encodedPassword@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
    Write-Host "Checking production migration history..."
    & npx supabase migration list --db-url $databaseUrl
    if ($LASTEXITCODE -ne 0) { throw "Production migration history check failed with exit code $LASTEXITCODE." }
    Write-Host "Applying pending production migrations..."
    & npx supabase db push --db-url $databaseUrl
    if ($LASTEXITCODE -ne 0) { throw "Production migration push failed with exit code $LASTEXITCODE." }
    Write-Host "Production migration push completed. Leave this window open and tell Codex: done."
  } finally {
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    $plainPassword = $null
    $encodedPassword = $null
    $databaseUrl = $null
    $securePassword.Dispose()
  }
} catch {
  Write-Host "`nProduction database operation error:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Copy the non-secret error shown above and send it to Codex." -ForegroundColor Yellow
} finally {
  Read-Host "Press Enter to close"
}
