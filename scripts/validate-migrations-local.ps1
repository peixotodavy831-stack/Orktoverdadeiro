[CmdletBinding()]
param(
  [string]$EvidenceDirectory,
  [ValidateRange(1, 100)][int]$ExpectedMigrationCount = 32
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runId = 'migration-replay-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
if ([string]::IsNullOrWhiteSpace($localAppData)) { throw 'Windows LocalApplicationData could not be resolved.' }
$tempParent = [System.IO.Path]::GetFullPath((Join-Path $localAppData 'Temp'))
$clusterRoot = Join-Path $tempParent ('orkto-disposable-' + $runId)
$clusterData = Join-Path $clusterRoot 'data'
$clusterMarker = Join-Path $clusterRoot '.orkto-disposable-postgres'
$serverLog = Join-Path $clusterRoot 'postgres-server.log'
$evidenceBase = if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
  Join-Path $localAppData 'ORKTO\production-readiness\migration-replays'
} else {
  [System.IO.Path]::GetFullPath($EvidenceDirectory)
}
$evidenceRun = Join-Path $evidenceBase $runId
$wrapperLog = Join-Path $evidenceRun 'local-runner.log'
$wrapperResult = Join-Path $evidenceRun 'local-runner.json'
$createdCluster = $false
$serverStarted = $false
$serverStopped = $false
$serverLogCopied = $false
$clusterRemoved = $false
$status = 'BLOCKED_ENVIRONMENT'
$failure = $null
$phase = 'POSTGRES_PREFLIGHT'
$pgBin = $null
$postgresVersion = $null
$port = $null
$coreExitCode = $null

New-Item -ItemType Directory -Path $evidenceRun -Force | Out-Null
Set-Content -LiteralPath $wrapperLog -Value ("Local wrapper started {0}; {1}" -f [DateTime]::UtcNow.ToString('o'), $runId) -Encoding UTF8

function Write-RunLog([string]$Message) {
  $line = '[{0}] {1}' -f [DateTime]::UtcNow.ToString('o'), $Message
  Add-Content -LiteralPath $wrapperLog -Value $line -Encoding UTF8
  Write-Host $line
}

function Find-PostgresBin {
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($env:ORKTO_POSTGRES_BIN)) { $candidates += $env:ORKTO_POSTGRES_BIN }
  foreach ($commandName in @('initdb.exe', 'pg_ctl.exe', 'psql.exe', 'postgres.exe')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and $command.Source) { $candidates += (Split-Path -Parent $command.Source) }
  }
  $defaultRoot = 'C:\Program Files\PostgreSQL'
  if (Test-Path -LiteralPath $defaultRoot -PathType Container) {
    $candidates += @(Get-ChildItem -LiteralPath $defaultRoot -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' })
  }
  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    $fullCandidate = [System.IO.Path]::GetFullPath($candidate)
    $required = @('initdb.exe', 'pg_ctl.exe', 'psql.exe', 'postgres.exe')
    if (@($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $fullCandidate $_) -PathType Leaf) }).Count -eq 0) { return $fullCandidate }
  }
  throw 'PostgreSQL 17 bin completo não encontrado. A execução deve ocorrer no CI PostgreSQL 17 ou em Windows com PostgreSQL 17 local; nenhum SQL foi executado.'
}

function Invoke-LoggedProcess([string]$Executable, [string[]]$Arguments, [string]$Label) {
  Write-RunLog ("BEGIN {0}: {1}" -f $Label, $Executable)
  $outputLines = @(& $Executable @Arguments 2>&1)
  $exitCode = $LASTEXITCODE
  foreach ($outputLine in $outputLines) { Write-RunLog ([string]$outputLine) }
  Write-RunLog ("END {0}: exit={1}" -f $Label, $exitCode)
  if ($null -eq $exitCode -or $exitCode -ne 0) { throw ("{0} terminou com código {1}. Veja {2}" -f $Label, $exitCode, $wrapperLog) }
  return ,$outputLines
}

function Write-WrapperResult {
  $result = [ordered]@{
    runId = $runId
    status = $status
    phase = $phase
    startedAtUtc = $script:startedAtUtc
    endedAtUtc = [DateTime]::UtcNow.ToString('o')
    postgresBin = $pgBin
    postgresVersion = $postgresVersion
    coreExitCode = $coreExitCode
    coreReport = if (Test-Path -LiteralPath (Join-Path $evidenceRun 'result.json')) { 'result.json' } else { $null }
    cluster = [ordered]@{
      path = $clusterRoot
      createdByThisRun = $createdCluster
      started = $serverStarted
      stopped = $serverStopped
      serverLogCopied = $serverLogCopied
      removed = $clusterRemoved
    }
    failure = $failure
  }
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $wrapperResult -Encoding UTF8
}

$script:startedAtUtc = [DateTime]::UtcNow.ToString('o')
try {
  $phase = 'POSTGRES_PREFLIGHT'
  $pgBin = Find-PostgresBin
  $initdb = Join-Path $pgBin 'initdb.exe'
  $pgCtl = Join-Path $pgBin 'pg_ctl.exe'
  $psql = Join-Path $pgBin 'psql.exe'
  $postgres = Join-Path $pgBin 'postgres.exe'
  $versionLines = Invoke-LoggedProcess $postgres @('--version') 'PostgreSQL version check'
  $postgresVersion = (($versionLines | ForEach-Object { [string]$_ }) -join ' ').Trim()
  if ($postgresVersion -notmatch 'PostgreSQL\s+17\.') { throw "PostgreSQL 17 is required; found $postgresVersion" }

  if (Test-Path -LiteralPath $clusterRoot) { throw "Refusing to reuse existing unique temporary path: $clusterRoot" }
  New-Item -ItemType Directory -Path $clusterRoot -ErrorAction Stop | Out-Null
  $createdCluster = $true
  Set-Content -LiteralPath $clusterMarker -Value "Created exclusively by $runId" -NoNewline -Encoding UTF8

  $phase = 'TEMPORARY_CLUSTER_INIT'
  Invoke-LoggedProcess $initdb @('-D', $clusterData, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale') 'init disposable PostgreSQL 17 cluster' | Out-Null

  $tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $tcpListener.Start()
  $port = $tcpListener.LocalEndpoint.Port
  $tcpListener.Stop()
  $phase = 'TEMPORARY_CLUSTER_START'
  Invoke-LoggedProcess $pgCtl @('-D', $clusterData, '-l', $serverLog, '-o', "-h 127.0.0.1 -p $port -c listen_addresses=127.0.0.1", '-w', 'start') 'start disposable PostgreSQL 17 cluster' | Out-Null
  $serverStarted = $true

  $phase = 'SHARED_MIGRATION_VALIDATOR'
  $environmentNames = @('PGHOST','PGPORT','PGUSER','PGDATABASE','PGPASSWORD','PGSSLMODE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','ORKTO_PSQL_BIN','ORKTO_MIGRATION_TARGET','ORKTO_MIGRATION_EVIDENCE_DIR','ORKTO_EXPECTED_MIGRATION_COUNT','ORKTO_DATABASE_URL','DATABASE_URL')
  $previousEnvironment = @{}
  foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
  try {
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = [string]$port
    $env:PGUSER = 'postgres'
    $env:PGDATABASE = 'postgres'
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
    Remove-Item Env:PGSERVICE -ErrorAction SilentlyContinue
    Remove-Item Env:PGSERVICEFILE -ErrorAction SilentlyContinue
    Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
    $env:ORKTO_PSQL_BIN = $psql
    $env:ORKTO_MIGRATION_TARGET = 'local'
    $env:ORKTO_MIGRATION_EVIDENCE_DIR = $evidenceRun
    $env:ORKTO_EXPECTED_MIGRATION_COUNT = [string]$ExpectedMigrationCount
    Remove-Item Env:ORKTO_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

    $phase = 'NODE_PREFLIGHT'
    $nodeCommand = Get-Command node -ErrorAction Stop | Select-Object -First 1
    $nodeVersion = (& $nodeCommand.Source --version 2>&1 | Out-String).Trim()
    if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) { throw "Node.js 22+ is required for the shared validator; found $nodeVersion" }
    $validator = Join-Path $repoRoot 'scripts\validate-migrations.mjs'
    $phase = 'SHARED_MIGRATION_VALIDATOR'
    Write-RunLog ("BEGIN shared migration validator ($nodeVersion): {0}" -f $nodeCommand.Source)
    $validatorOutput = @(& $nodeCommand.Source $validator '--target' 'local' '--evidence-dir' $evidenceRun '--expected-count' ([string]$ExpectedMigrationCount) 2>&1)
    $coreExitCode = $LASTEXITCODE
    foreach ($outputLine in $validatorOutput) { Write-RunLog ([string]$outputLine) }
    Write-RunLog ("END shared migration validator: exit={0}" -f $coreExitCode)
    if ($coreExitCode -eq 0) {
      $status = 'PASS'
    } else {
      $coreResultPath = Join-Path $evidenceRun 'result.json'
      $coreResult = if (Test-Path -LiteralPath $coreResultPath -PathType Leaf) { Get-Content -Raw -LiteralPath $coreResultPath | ConvertFrom-Json } else { $null }
      if ($coreResult -and $coreResult.status -eq 'BLOCKED_ENVIRONMENT') {
        $status = 'BLOCKED_ENVIRONMENT'
        $phase = $coreResult.phase
        $failure = $coreResult.failure
        Write-RunLog ("BLOCKED_ENVIRONMENT at {0}: {1}" -f $phase, $failure)
      } else {
        $status = 'FAIL'
        $failure = if ($coreResult) { $coreResult.failure } else { "Shared validator exited $coreExitCode without a result.json." }
        throw ("Shared migration validator failed with exit code {0}: {1}" -f $coreExitCode, $failure)
      }
    }
  } finally {
    foreach ($name in $environmentNames) {
      $value = $previousEnvironment[$name]
      if ($null -eq $value) { Remove-Item ("Env:{0}" -f $name) -ErrorAction SilentlyContinue }
      else { [Environment]::SetEnvironmentVariable($name, $value, 'Process') }
    }
  }
} catch {
  $failure = $_.Exception.Message
  if ($phase -in @('POSTGRES_PREFLIGHT','TEMPORARY_CLUSTER_INIT','TEMPORARY_CLUSTER_START','NODE_PREFLIGHT')) { $status = 'BLOCKED_ENVIRONMENT' }
  else { $status = 'FAIL' }
  Write-RunLog ("{0} at {1}: {2}" -f $status, $phase, $failure)
} finally {
  if ($serverStarted) {
    try {
      Invoke-LoggedProcess $pgCtl @('-D', $clusterData, '-m', 'fast', '-w', 'stop') 'stop disposable PostgreSQL 17 cluster' | Out-Null
      $serverStopped = $true
    } catch {
      $status = 'FAIL'
      $failure = if ($failure) { $failure + ' | ' + $_.Exception.Message } else { $_.Exception.Message }
      Write-RunLog ("WARNING: server stop was not confirmed: {0}" -f $_.Exception.Message)
    }
  } elseif (-not $createdCluster -or -not (Test-Path -LiteralPath (Join-Path $clusterData 'postmaster.pid'))) {
    $serverStopped = $true
  }

  if (Test-Path -LiteralPath $serverLog -PathType Leaf) {
    try {
      Copy-Item -LiteralPath $serverLog -Destination (Join-Path $evidenceRun 'postgres-server.log') -Force
      $serverLogCopied = $true
    } catch {
      $status = 'FAIL'
      $failure = if ($failure) { $failure + ' | server log copy failed: ' + $_.Exception.Message } else { 'Server log copy failed: ' + $_.Exception.Message }
    }
  } elseif ($createdCluster -and -not $serverStarted -and -not (Test-Path -LiteralPath (Join-Path $clusterData 'postmaster.pid'))) {
    Set-Content -LiteralPath (Join-Path $evidenceRun 'postgres-server.log') -Value 'PostgreSQL did not reach server startup; see local-runner.log for initdb/pg_ctl output.' -Encoding UTF8
    $serverLogCopied = $true
  }

  if ($createdCluster -and $serverStopped -and $serverLogCopied) {
    $resolvedParent = [System.IO.Path]::GetFullPath($tempParent).TrimEnd('\') + '\'
    $resolvedCluster = [System.IO.Path]::GetFullPath($clusterRoot)
    $markerMatches = (Test-Path -LiteralPath $clusterMarker -PathType Leaf) -and ((Get-Content -Raw -LiteralPath $clusterMarker).Trim() -eq "Created exclusively by $runId")
    $item = if (Test-Path -LiteralPath $resolvedCluster) { Get-Item -LiteralPath $resolvedCluster -Force } else { $null }
    $safeOwnedCluster = $resolvedCluster.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedCluster).StartsWith('orkto-disposable-migration-replay-', [System.StringComparison]::OrdinalIgnoreCase) -and
      $markerMatches -and $null -ne $item -and -not $item.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint) -and
      -not (Test-Path -LiteralPath (Join-Path $clusterData 'postmaster.pid'))
    if ($safeOwnedCluster) {
      Remove-Item -LiteralPath $resolvedCluster -Recurse -Force
      $clusterRemoved = $true
      Write-RunLog 'Removed only the uniquely named, marker-verified, stopped cluster created by this run.'
    } else {
      $status = 'FAIL'
      $failure = if ($failure) { $failure + ' | cluster cleanup safety check failed' } else { 'Cluster cleanup safety check failed; directory retained.' }
      Write-RunLog "Refusing cluster cleanup: ownership/path/stop check did not match: $resolvedCluster"
    }
  }

  if ($status -eq 'PASS' -and (-not $clusterRemoved -or -not $serverStopped)) {
    $status = 'FAIL'
    $failure = 'Shared validation passed, but safe PostgreSQL shutdown/removal was not confirmed.'
  }
  Write-WrapperResult
}

Write-Host ''
Write-Host ("{0}: {1}" -f $status, $evidenceRun)
if ($status -ne 'PASS') { exit 1 }
