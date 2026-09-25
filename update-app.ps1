# Downloads the newest retreat-content-library.zip and copies it over this app.
# Keeps .env.local and node_modules. Deletes .next so the old page cannot stay on screen.
#
# One command, after this file is saved:
#   powershell -NoProfile -ExecutionPolicy Bypass -File update-app.ps1 -Url "PASTE_THE_LINK"

param(
  [string]$Url,
  [string]$ZipPath,
  [string]$AppDir
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Test-NewUploadZip {
  param([string]$Path)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $archive.Entries | Where-Object {
      ($_.FullName -replace "\\", "/") -eq "retreat-content-library/components/upload-form.tsx"
    } | Select-Object -First 1
    if (-not $entry) {
      return $false
    }
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    $reader.Dispose()
    $stream.Dispose()
    $hasButton = $text.Contains("Choose videos")
    $hasMultiple = $text.Contains("multiple")
    $oldButton = $text.Contains("Choose a file from this computer")
    return ($hasButton -and $hasMultiple -and -not $oldButton)
  } finally {
    $archive.Dispose()
  }
}

function Find-LatestZip {
  $roots = @(
    (Join-Path $env:USERPROFILE "Downloads"),
    (Join-Path $env:USERPROFILE ".cursor"),
    (Join-Path $env:LOCALAPPDATA "Cursor"),
    (Join-Path $env:USERPROFILE "Desktop\Cursor")
  )
  $found = @()
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) {
      continue
    }
    $found += Get-ChildItem -LiteralPath $root -Filter "retreat-content-library.zip" -Recurse -Depth 6 -ErrorAction SilentlyContinue
  }
  $found | Sort-Object LastWriteTime -Descending
}

function Pause-Window {
  Write-Host "Press Enter to close."
  [void](Read-Host)
}

$defaultApp = Join-Path $env:USERPROFILE "Desktop\Cursor\editor\retreat-content-library\retreat-content-library"
if (-not $AppDir) {
  $runningFromTemp = $PSScriptRoot -like (Join-Path $env:TEMP "*")
  $besideScript = Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")
  if ($runningFromTemp -or -not $besideScript) {
    $AppDir = $defaultApp
  } else {
    $AppDir = $PSScriptRoot
  }
}

if (-not (Test-Path -LiteralPath $AppDir)) {
  Write-Host "Could not find the app folder:"
  Write-Host $AppDir
  Pause-Window
  exit 1
}

$downloaded = Join-Path $env:TEMP "retreat-content-library.zip"
if ($Url) {
  Write-Host "Downloading the newest app..."
  if (Test-Path -LiteralPath $downloaded) {
    Remove-Item -LiteralPath $downloaded -Force
  }
  try {
    Invoke-WebRequest -Uri $Url -OutFile $downloaded -UseBasicParsing
  } catch {
    Write-Host "Could not download the app. Check the link, then try again."
    Pause-Window
    exit 1
  }
  $ZipPath = $downloaded
}

$candidates = @()
if ($ZipPath) {
  if (-not (Test-Path -LiteralPath $ZipPath)) {
    Write-Host "Could not find the zip:"
    Write-Host $ZipPath
    Pause-Window
    exit 1
  }
  $candidates = @(Get-Item -LiteralPath $ZipPath)
} else {
  $candidates = @(Find-LatestZip)
}

$chosen = $null
foreach ($item in $candidates) {
  if (-not $item) {
    continue
  }
  if (Test-NewUploadZip $item.FullName) {
    $chosen = $item.FullName
    break
  }
}

if (-not $chosen) {
  Write-Host "This download is not the new app. It does not contain Choose videos."
  Write-Host "Use the latest link, then run this again."
  Pause-Window
  exit 1
}

Write-Host "Using zip:"
Write-Host $chosen

$stage = Join-Path $env:TEMP "retreat-update"
if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
Expand-Archive -LiteralPath $chosen -DestinationPath $stage -Force

$source = Join-Path $stage "retreat-content-library"
if (-not (Test-Path -LiteralPath (Join-Path $source "package.json"))) {
  Write-Host "The zip did not contain the app folder. Nothing was changed."
  Pause-Window
  exit 1
}

Get-ChildItem -LiteralPath $source -Force | Where-Object {
  $_.Name -ne ".env.local" -and $_.Name -ne "node_modules" -and $_.Name -ne ".next"
} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $AppDir -Recurse -Force
}

$nextDir = Join-Path $AppDir ".next"
if (Test-Path -LiteralPath $nextDir) {
  try {
    Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop
  } catch {
    Write-Host "The old page is still cached. Click the terminal where the app is running and press Ctrl+C, then run this again."
    Pause-Window
    exit 1
  }
}

Write-Host "Done. Now run: npm run dev"
Write-Host "Folder: $AppDir"
Write-Host "Then open http://localhost:43123/upload"
Write-Host "The button must say Choose videos. If it says Choose a file from this computer, this update did not land."
Pause-Window
