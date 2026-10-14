param(
    [string]$OidcDirectory = 'C:\Users\sobooa7iqytvqheo\Documents\Codex\Orktoverdeiro-deploy-6bc8adb',
    [string]$PreviewUrl = 'https://orkto-staging-fl4uvx2qw-peixoto-s-projects1.vercel.app/',
    [string]$ExpectedSha = 'c1660be6081da10fa8eda4c2afb4baccb51ed4fa'
)
$ErrorActionPreference = 'Stop'
if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0' -or $env:ORKTO_E2E_ALLOW_RUNNER_CA -eq '1') {
    throw 'INSECURE_TLS_OVERRIDE_REJECTED'
}
if ($env:NODE_EXTRA_CA_CERTS -and (-not [IO.Path]::IsPathRooted($env:NODE_EXTRA_CA_CERTS) -or -not (Test-Path -LiteralPath $env:NODE_EXTRA_CA_CERTS -PathType Leaf))) {
    throw 'TRUSTED_CA_FILE_REQUIRED'
}
$candidateUrl = $PreviewUrl
$candidateSha = $ExpectedSha
if ($candidateSha -notmatch '^[a-f0-9]{40}$' -or $candidateUrl -notmatch '^https://orkto-staging-[a-z0-9-]+\.vercel\.app/?$') { throw 'EXACT_STAGING_CANDIDATE_REQUIRED' }
Write-Output ('STAGING_CANDIDATE_SHA=' + $candidateSha)
$projectId = 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc'
$stagingRef = 'ghrjongiodziasupakrk'
$link = Get-Content -LiteralPath (Join-Path $OidcDirectory '.vercel/project.json') -Raw | ConvertFrom-Json
if ($link.projectId -ne $projectId -or $link.projectName -ne 'orkto-staging') {
    throw 'STAGING_PROJECT_BOUNDARY_MISMATCH'
}
foreach ($name in @('.env', '.env.local', '.env.development', '.env.development.local')) {
    if (Test-Path -LiteralPath (Join-Path $OidcDirectory $name)) {
        throw 'OIDC_DIRECTORY_MUST_NOT_CONTAIN_LOCAL_ENV_FILES'
    }
}
$vercel = (Get-Command vercel.cmd -ErrorAction Stop).Source
$runner = Join-Path $PSScriptRoot 'validate-staging-auth.mjs'
$adminInput = Read-Host 'Supabase STAGING admin key (masked; never written to a file)' -AsSecureString
$publicInput = Read-Host 'Supabase STAGING publishable/anon key (masked)' -AsSecureString
function Convert-PrivateInput([Security.SecureString]$InputValue) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($InputValue)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function Get-PrivateFingerprint([string]$Value) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() }
    finally { $hasher.Dispose() }
}
$adminValue = Convert-PrivateInput $adminInput
$publicValue = Convert-PrivateInput $publicInput
try {
    # Keys enter only this child process. Do not inherit unrelated app/provider
    # credentials or old local OIDC tokens from the interactive owner's shell.
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $env:COMSPEC
    $start.Arguments = '/d /s /c ""' + $vercel + '" env run -- node "' + $runner + '" --browser-e2e"'
    $start.WorkingDirectory = $OidcDirectory
    $start.UseShellExecute = $false
    $start.EnvironmentVariables.Clear()
    foreach ($name in @('PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT')) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($value) { $start.EnvironmentVariables[$name] = $value }
    }
    $start.EnvironmentVariables['NODE_USE_SYSTEM_CA'] = '1'
    if ($env:NODE_EXTRA_CA_CERTS) { $start.EnvironmentVariables['NODE_EXTRA_CA_CERTS'] = $env:NODE_EXTRA_CA_CERTS }
    $start.EnvironmentVariables['ORKTO_STAGING_E2E'] = '1'
    $start.EnvironmentVariables['ORKTO_STAGING_PREVIEW_URL'] = $candidateUrl
    $start.EnvironmentVariables['ORKTO_STAGING_EXPECTED_SHA'] = $candidateSha
    $start.EnvironmentVariables['ORKTO_STAGING_VERCEL_PROJECT_ID'] = $projectId
    $start.EnvironmentVariables['ORKTO_STAGING_SUPABASE_REF'] = $stagingRef
    $start.EnvironmentVariables['ORKTO_STAGING_SUPABASE_URL'] = 'https://' + $stagingRef + '.supabase.co'
    $start.EnvironmentVariables['ORKTO_STAGING_SUPABASE_ADMIN_KEY'] = $adminValue
    $start.EnvironmentVariables['ORKTO_STAGING_SUPABASE_PUBLISHABLE_KEY'] = $publicValue
    $start.EnvironmentVariables['ORKTO_STAGING_ADMIN_KEY_SHA256'] = Get-PrivateFingerprint $adminValue
    $start.EnvironmentVariables['ORKTO_STAGING_PUBLISHABLE_KEY_SHA256'] = Get-PrivateFingerprint $publicValue
    $process = [Diagnostics.Process]::Start($start)
    $process.WaitForExit()
    $result = $process.ExitCode
    $process.Dispose()
    if ($result -ne 0) { throw "STAGING_AUTH_AB_RUN_FAILED_EXIT_$result" }
} finally {
    if ($start) { $start.EnvironmentVariables.Clear() }
    $adminValue = $null
    $publicValue = $null
    $adminInput.Dispose()
    $publicInput.Dispose()
}
