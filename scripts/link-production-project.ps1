$ErrorActionPreference = "Stop"
try {
  $securePassword = Read-Host "Production database password" -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    & npx supabase link --project-ref dynxjiqrdlhfhrjnhvgn --password $plainPassword
    if ($LASTEXITCODE -ne 0) { throw "Supabase production link failed with exit code $LASTEXITCODE." }
    Write-Host "Production project link completed. Leave this window open and tell Codex: done."
  } finally {
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    $plainPassword = $null
    $securePassword.Dispose()
  }
} catch {
  Write-Host "`nProduction link error:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Copy the non-secret error shown above and send it to Codex." -ForegroundColor Yellow
} finally {
  Read-Host "Press Enter to close"
}
