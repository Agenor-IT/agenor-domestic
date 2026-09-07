[CmdletBinding()]
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$ProjectId,
  [switch]$RequireRuntime,
  [ValidateSet('api', 'db', 'auth', 'storage', 'realtime', 'functions')]
  [string[]]$RequiredService,
  [ValidateRange(1, 30)]
  [int]$DockerTimeoutSeconds = 5
)

$ErrorActionPreference = 'Stop'
$startedAt = Get-Date
$root = (Resolve-Path -LiteralPath $RepoRoot).Path.TrimEnd('\', '/')
$projectName = Split-Path -Leaf $root
$issues = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Get-TomlValue {
  param(
    [Parameter(Mandatory)][string]$Text,
    [Parameter(Mandatory)][string]$Key,
    [string]$Section
  )

  $activeSection = ''
  foreach ($line in ($Text -split "`r?`n")) {
    if ($line -match '^\s*\[([^]]+)\]\s*$') {
      $activeSection = $Matches[1]
      continue
    }
    if ($Section -and $activeSection -ne $Section) { continue }
    if ($line -match ('^\s*' + [regex]::Escape($Key) + '\s*=\s*(.+?)\s*(?:#.*)?$')) {
      return $Matches[1].Trim().Trim('"', "'")
    }
  }
  return $null
}

function Get-ConfigInfo {
  param([Parameter(Mandatory)][string]$Path)

  $text = [IO.File]::ReadAllText($Path)
  $id = Get-TomlValue -Text $text -Key 'project_id'
  if (-not $id) { return $null }

  [pscustomobject]@{
    Path        = $Path
    ProjectId   = $id
    ApiPort     = Get-TomlValue -Text $text -Section 'api' -Key 'port'
    DbPort      = Get-TomlValue -Text $text -Section 'db' -Key 'port'
    StudioPort  = Get-TomlValue -Text $text -Section 'studio' -Key 'port'
    AuthEnabled = Get-TomlValue -Text $text -Section 'auth' -Key 'enabled'
  }
}

function Invoke-CapturedProcess {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$ArgumentList,
    [Parameter(Mandatory)][int]$TimeoutSeconds
  )

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($argument in $ArgumentList) { [void]$startInfo.ArgumentList.Add($argument) }

  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try { $process.Kill($true) } catch { }
    return [pscustomobject]@{ ExitCode = $null; TimedOut = $true; StdOut = ''; StdErr = 'timeout' }
  }

  [pscustomobject]@{
    ExitCode = $process.ExitCode
    TimedOut = $false
    StdOut   = $stdoutTask.GetAwaiter().GetResult()
    StdErr   = $stderrTask.GetAwaiter().GetResult()
  }
}

function Test-LocalPort {
  param([int]$Port)
  if ($Port -le 0) { return $false }

  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    return $task.Wait(1000) -and $client.Connected
  }
  catch { return $false }
  finally { $client.Dispose() }
}

$excludedDirectoryNames = @(
  '.git', '.codex-worktrees', '_codex_worktrees', 'node_modules', 'dist', 'build',
  'coverage', 'snapshots', 'backups', '_agenor_backups'
)

$candidateConfigPaths = [System.Collections.Generic.List[string]]::new()
foreach ($relative in @(
  'supabase\config.toml',
  'supabase-local\config.toml',
  'supabase-local\supabase\config.toml',
  'local-backend\supabase\config.toml',
  'frontend\supabase\config.toml',
  'backend\supabase\config.toml'
)) {
  $candidate = Join-Path $root $relative
  if (Test-Path -LiteralPath $candidate) { $candidateConfigPaths.Add($candidate) }
}

$topDirectories = @(Get-ChildItem -LiteralPath $root -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -notin $excludedDirectoryNames -and
  $_.Name -notmatch '^\.codex-validation|worktree|snapshot|backup|partial'
})

foreach ($directory in $topDirectories) {
  $candidate = Join-Path $directory.FullName 'supabase\config.toml'
  if (Test-Path -LiteralPath $candidate) { $candidateConfigPaths.Add($candidate) }
}

$configs = @($candidateConfigPaths | Sort-Object -Unique | ForEach-Object { Get-ConfigInfo -Path $_ } | Where-Object { $null -ne $_ })

$environmentRoots = [System.Collections.Generic.List[string]]::new()
$environmentRoots.Add($root)
foreach ($directory in $topDirectories) {
  if ($directory.Name -in @('frontend', 'web', 'client', 'app') -or (Test-Path -LiteralPath (Join-Path $directory.FullName 'package.json'))) {
    $environmentRoots.Add($directory.FullName)
  }
}

$environmentUrls = [System.Collections.Generic.List[object]]::new()
foreach ($environmentRoot in ($environmentRoots | Sort-Object -Unique)) {
  foreach ($fileName in @('.env.local', '.env.development.local', '.env.development', '.env')) {
    $path = Join-Path $environmentRoot $fileName
    if (-not (Test-Path -LiteralPath $path)) { continue }

    foreach ($line in Get-Content -LiteralPath $path -ErrorAction Stop) {
      if ($line -notmatch '^\s*([A-Za-z0-9_]*(?:SUPABASE_URL|API_URL|BASE_URL|DATABASE_URL))\s*=\s*(.+?)\s*$') { continue }
      $variable = $Matches[1]
      $rawValue = $Matches[2].Trim().Trim('"', "'")
      try {
        $uri = [uri]$rawValue
        $safeHost = if ($uri.IsLoopback) { $uri.Host } else { '<remote>' }
        $environmentUrls.Add([pscustomobject]@{
          File       = $path
          Variable   = $variable
          Endpoint   = ('{0}://{1}:{2}' -f $uri.Scheme, $safeHost, $uri.Port)
          Host       = $safeHost
          Port       = $uri.Port
          IsLoopback = $uri.IsLoopback
        })
      }
      catch {
        $environmentUrls.Add([pscustomobject]@{
          File       = $path
          Variable   = $variable
          Endpoint   = '<invalid-or-non-url>'
          Host       = $null
          Port       = $null
          IsLoopback = $false
        })
      }
    }
  }
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$allContainers = @()
if ($dockerCommand) {
  $format = '{{.ID}}|{{.Names}}|{{.Status}}|{{.Ports}}|{{.Label "com.supabase.cli.project"}}|{{.Label "com.supabase.cli.workdir"}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.working_dir"}}'
  $dockerResult = Invoke-CapturedProcess -FilePath $dockerCommand.Source -ArgumentList @('ps', '-a', '--format', $format) -TimeoutSeconds $DockerTimeoutSeconds
  if ($dockerResult.TimedOut) {
    $issues.Add("Docker no respondió en $DockerTimeoutSeconds segundos.")
  }
  elseif ($dockerResult.ExitCode -ne 0) {
    $issues.Add('Docker no está disponible o no responde correctamente.')
  }
  else {
    foreach ($line in ($dockerResult.StdOut -split "`r?`n")) {
      if (-not $line.Trim()) { continue }
      $parts = $line -split '\|', 8
      if ($parts.Count -lt 8) { continue }
      $allContainers += [pscustomobject]@{
        Id             = $parts[0]
        Name           = $parts[1]
        Status         = $parts[2]
        Ports          = $parts[3]
        SupabaseProject = $parts[4]
        SupabaseWorkdir = $parts[5]
        ComposeProject = $parts[6]
        ComposeWorkdir = $parts[7]
      }
    }
  }
}
elseif ($RequireRuntime -or $configs.Count -gt 0) {
  $issues.Add('Docker no está instalado o no está disponible en PATH.')
}

$candidateProjectIds = @(
  $configs.ProjectId
  $allContainers | ForEach-Object { $_.SupabaseProject; $_.ComposeProject } | Where-Object {
    $_ -and ($_ -eq $projectName -or $_ -like "$projectName-*")
  }
) | Where-Object { $_ } | Sort-Object -Unique

$selectedProjectId = $null
if ($ProjectId) {
  $selectedProjectId = $ProjectId
}
else {
  $localPorts = @($environmentUrls | Where-Object { $_.IsLoopback } | Select-Object -ExpandProperty Port -Unique)
  $matchingConfigs = @($configs | Where-Object { $_.ApiPort -and ([int]$_.ApiPort -in $localPorts) })
  $matchingIds = @($matchingConfigs.ProjectId | Sort-Object -Unique)
  if ($matchingIds.Count -eq 1) {
    $selectedProjectId = $matchingIds[0]
  }
  elseif (@($configs.ProjectId | Sort-Object -Unique).Count -eq 1) {
    $selectedProjectId = @($configs.ProjectId | Sort-Object -Unique)[0]
  }
  elseif ($candidateProjectIds.Count -eq 1) {
    $selectedProjectId = $candidateProjectIds[0]
  }
}

if (-not $selectedProjectId -and ($RequireRuntime -or $configs.Count -gt 0 -or $candidateProjectIds.Count -gt 0)) {
  $issues.Add('No se pudo seleccionar una única instancia local. Ejecutar nuevamente con -ProjectId usando uno de los candidatos informados.')
}

$selectedConfigs = @($configs | Where-Object { $_.ProjectId -eq $selectedProjectId })
$selectedConfig = $null
if ($selectedConfigs.Count -gt 0) {
  $localPorts = @($environmentUrls | Where-Object { $_.IsLoopback } | Select-Object -ExpandProperty Port -Unique)
  $selectedConfig = @($selectedConfigs | Where-Object { $_.ApiPort -and ([int]$_.ApiPort -in $localPorts) } | Select-Object -First 1)
  if (-not $selectedConfig) { $selectedConfig = $selectedConfigs[0] }
}

$selectedContainers = @($allContainers | Where-Object {
  $_.SupabaseProject -eq $selectedProjectId -or $_.ComposeProject -eq $selectedProjectId
})

if ($selectedProjectId -and $selectedContainers.Count -eq 0 -and ($RequireRuntime -or $configs.Count -gt 0)) {
  $issues.Add("No hay contenedores para la instancia local '$selectedProjectId'.")
}

function Get-ServiceRole {
  param([Parameter(Mandatory)][string]$ContainerName)
  if ($ContainerName -match '^supabase_(kong|envoy)_') { return 'api' }
  if ($ContainerName -match '^supabase_db_') { return 'db' }
  if ($ContainerName -match '^supabase_auth_') { return 'auth' }
  if ($ContainerName -match '^supabase_storage_') { return 'storage' }
  if ($ContainerName -match '^supabase_realtime_') { return 'realtime' }
  if ($ContainerName -match '^supabase_edge_runtime_') { return 'functions' }
  return 'other'
}

$requiredRoles = @($RequiredService | Where-Object { $_ } | Sort-Object -Unique)
if ($requiredRoles.Count -eq 0 -and ($RequireRuntime -or $selectedConfig)) {
  $requiredRoles = @('api', 'db')
  if (-not $selectedConfig -or $selectedConfig.AuthEnabled -ne 'false') { $requiredRoles += 'auth' }
}

foreach ($role in $requiredRoles) {
  if (@($selectedContainers | Where-Object { (Get-ServiceRole -ContainerName $_.Name) -eq $role }).Count -eq 0) {
    $issues.Add("Servicio local requerido ausente: $role.")
  }
}

foreach ($container in $selectedContainers) {
  if ($container.Status -notmatch '^Up\b' -or $container.Status -match 'unhealthy|Restarting') {
    $role = Get-ServiceRole -ContainerName $container.Name
    if ($role -in $requiredRoles) {
      $issues.Add("Contenedor requerido no saludable: $($container.Name) [$($container.Status)].")
    }
    else {
      $warnings.Add("Contenedor opcional no saludable: $($container.Name) [$($container.Status)].")
    }
  }
}

$apiPort = if ($selectedConfig -and $selectedConfig.ApiPort) { [int]$selectedConfig.ApiPort } else { $null }
$dbPort = if ($selectedConfig -and $selectedConfig.DbPort) { [int]$selectedConfig.DbPort } else { $null }

if (-not $apiPort) {
  $apiContainer = @($selectedContainers | Where-Object { $_.Name -match '^supabase_(kong|envoy)_' } | Select-Object -First 1)
  if ($apiContainer -and $apiContainer.Ports -match '(?:0\.0\.0\.0|\[::\]):(\d+)->(?:8000|8080)/tcp') {
    $apiPort = [int]$Matches[1]
  }
}
if (-not $dbPort) {
  $dbContainer = @($selectedContainers | Where-Object { $_.Name -match '^supabase_db_' } | Select-Object -First 1)
  if ($dbContainer -and $dbContainer.Ports -match '(?:0\.0\.0\.0|\[::\]):(\d+)->5432/tcp') {
    $dbPort = [int]$Matches[1]
  }
}

if ($apiPort -and -not (Test-LocalPort -Port $apiPort)) { $issues.Add("Puerto API local cerrado: $apiPort.") }
if ($dbPort -and -not (Test-LocalPort -Port $dbPort)) { $issues.Add("Puerto DB local cerrado: $dbPort.") }

if ($selectedProjectId -and $apiPort) {
  $matchingEnvironment = @($environmentUrls | Where-Object { $_.IsLoopback -and $_.Port -eq $apiPort })
  if ($matchingEnvironment.Count -eq 0) {
    $issues.Add("Ningún SUPABASE_URL/API_URL local conocido apunta al puerto API $apiPort de '$selectedProjectId'.")
  }
}

$status = 'PASS'
if ($issues.Count -gt 0) { $status = 'FAIL' }
elseif (-not $selectedProjectId -and $configs.Count -eq 0 -and $candidateProjectIds.Count -eq 0) { $status = 'NOT_APPLICABLE' }

$result = [ordered]@{
  Status              = $status
  ProjectRoot         = $root
  ProjectName         = $projectName
  SelectedProjectId   = $selectedProjectId
  CandidateProjectIds = @($candidateProjectIds)
  Configurations      = @($configs)
  EnvironmentBindings = @($environmentUrls)
  Containers          = @($selectedContainers)
  RequiredServices    = @($requiredRoles)
  Ports               = [ordered]@{
    Api      = $apiPort
    ApiOpen  = if ($apiPort) { Test-LocalPort -Port $apiPort } else { $null }
    Database = $dbPort
    DbOpen   = if ($dbPort) { Test-LocalPort -Port $dbPort } else { $null }
  }
  Issues              = @($issues)
  Warnings            = @($warnings)
  ReadOnly            = $true
  ElapsedMilliseconds = [int]((Get-Date) - $startedAt).TotalMilliseconds
}

$result | ConvertTo-Json -Depth 7
if ($status -eq 'FAIL') { exit 3 }
exit 0
