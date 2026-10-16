$ErrorActionPreference = 'Stop'
$geminiRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$geminiNames = @('GEMINI_API_KEY','APP_ENV','ORKTO_STAGING_SUPABASE_REF','WIA_STAGING_GEMINI_TESTS','WIA_MODEL_PROVIDER','NODE_USE_SYSTEM_CA')
$geminiPrevious = @{}
foreach ($geminiName in $geminiNames) { $geminiPrevious[$geminiName] = [Environment]::GetEnvironmentVariable($geminiName,'Process') }
$geminiSecret = $null
$geminiPointer = [IntPtr]::Zero
try {
  $geminiSecret = Read-Host 'Gemini TEST key (masked; one synthetic request; never saved)' -AsSecureString
  $geminiPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($geminiSecret)
  $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($geminiPointer)
  $env:APP_ENV = 'staging'
  $env:ORKTO_STAGING_SUPABASE_REF = 'ghrjongiodziasupakrk'
  $env:WIA_STAGING_GEMINI_TESTS = 'ON'
  $env:WIA_MODEL_PROVIDER = 'gemini'
  $env:NODE_USE_SYSTEM_CA = '1'
  Push-Location $geminiRoot
  try { & node --import tsx scripts/readiness/probe-gemini.ts; $geminiExit=$LASTEXITCODE } finally { Pop-Location }
  if ($geminiExit -ne 0) { throw 'GEMINI_TEST_NOT_PASSED' }
} finally {
  if ($geminiPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($geminiPointer) }
  if ($geminiSecret) { $geminiSecret.Dispose() }
  foreach ($geminiName in $geminiNames) { [Environment]::SetEnvironmentVariable($geminiName,$geminiPrevious[$geminiName],'Process') }
}
