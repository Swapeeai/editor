# Replaces the app files from the latest retreat-content-library.zip.
# Keeps .env.local and node_modules. Deletes .next so the old page cannot stay on screen.
# Double-click this file, or run it from PowerShell.

param(
  [string]$ZipPath,
  [string]$AppDir
)

$ErrorActionPreference = "Stop"

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
  Write-Host "Press Enter to close."
  [void](Read-Host)
  exit 1
}

$candidates = @()
if ($ZipPath) {
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
  Write-Host "The zip that was found is the old app. It does not contain Choose videos."
  Write-Host "Save the latest retreat-content-library.zip into Downloads, replacing the old file, then run this again."
  if ($candidates) {
    Write-Host "Looked at:"
    foreach ($item in $candidates) {
      if ($item) {
        Write-Host $item.FullName
      }
    }
  }
  Write-Host "Press Enter to close."
  [void](Read-Host)
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
  Write-Host "Press Enter to close."
  [void](Read-Host)
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
    Write-Host "Press Enter to close."
    [void](Read-Host)
    exit 1
  }
}

Write-Host "Done. Now run: npm run dev"
Write-Host "Folder: $AppDir"
Write-Host "Then open http://localhost:43123/upload"
Write-Host "The button must say Choose videos. If it says Choose a file from this computer, this update did not land."
Write-Host "Press Enter to close."
[void](Read-Host)
