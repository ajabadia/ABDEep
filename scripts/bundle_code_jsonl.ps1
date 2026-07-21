param(
    [string[]]$Exclude = @(),   # carpetas/rutas adicionales a excluir (relativas al root)
    [switch]$Compact            # modo compacto
)

# Script to bundle all source code into a JSONL file + metadata
# Usage examples:
#   .\bundle_code_jsonl.ps1
#   .\bundle_code_jsonl.ps1 -Exclude "tests","playground"
#   .\bundle_code_jsonl.ps1 -Compact
#   .\bundle_code_jsonl.ps1 -Exclude "tests","src/legacy" -Compact

# Determine root directory based on script location (now in scripts/)
$scriptDir = $PSScriptRoot
$rootDir = (Get-Item $scriptDir).Parent.FullName

$timestamp = Get-Date -Format "yyyyMMddHHmm"

# Ensure exports directory exists
$exportsDir = Join-Path $rootDir "exports"
if (-not (Test-Path $exportsDir)) {
    New-Item -ItemType Directory -Path $exportsDir | Out-Null
}

$jsonlFile   = Join-Path $exportsDir "project_bundle_$timestamp.jsonl"
$metaFile    = Join-Path $exportsDir "project_metadata_$timestamp.json"
$controlFile = Join-Path $exportsDir "CONTROL_FILESCODE_$timestamp.txt"

# Extensions to include
$includeExtensions = @(".ts", ".tsx", ".mjs", ".js", ".css", ".json", ".md", ".ps1", ".bat", ".yml", ".yaml", ".html", ".txt", ".h", ".hpp", ".cpp")
$specificFiles = @(
    "package.json",
    "package-lock.json",
    "CMakeLists.txt",
    "README.md",
    ".gitignore",
    ".env.example"
)

# Folders to explicitly INCLUDE (relative to root)
$foldersToProcess = @("Source", "WebUI")

# Directories to exclude (always ignore these)
$excludeDirsBase = @(
    "node_modules", ".git", ".vscode", "tmp", "out", "bin", "obj",
    "public", "coverage", "test-results", ".vercel", "dist", "build",
    ".idea", "JUCE", "logs", "docs", "build_ninja", "build_nmake",
    "build_standalone", "build_vs", ".agents", "vcpkg", "CMake",
    "exports", ".gemini", "assets"
)

# Combine base excludes with user-provided ones (normalized as paths starting from root)
$excludeDirs = New-Object System.Collections.Generic.List[string]
[string[]]$excludeDirsBase | ForEach-Object { $excludeDirs.Add($_) }

foreach ($ex in $Exclude) {
    if ([string]::IsNullOrWhiteSpace($ex)) { continue }
    $excludeDirs.Add($ex.Trim())
}

# Files considered "heavy" for Compact mode (by name)
$heavyFilesByName = @(
    "package-lock.json"
)

# Size threshold in bytes for "heavy" files in Compact mode (5 MB)
$compactSizeThresholdBytes = 5MB

# GLOBAL size threshold (safety limit for ANY file)
$globalSizeLimitBytes = 500KB

# Explicitly excluded extensions (even if matched by include filter)
$excludedExtensions = @(".png", ".jpg", ".jpeg", ".gif", ".pdf", ".ttf", ".woff", ".woff2", ".exe", ".dll", ".lib", ".obj", ".pdb")

# Files specifically excluded by name (large logs etc)
$specificallyExcludedNames = @()

Write-Host "Bundling code from $rootDir to $jsonlFile..."
Write-Host "Metadata file: $metaFile"
Write-Host "Control file:  $controlFile"
Write-Host "Compact mode:  $Compact"
if ($Exclude.Count -gt 0) {
    Write-Host "Additional excludes: $($Exclude -join ', ')"
}

# Helpers
function Get-LanguageFromExtension {
    param(
        [string]$Extension
    )

    switch ($Extension.ToLower()) {
        ".ts"   { "typescript" }
        ".tsx"  { "typescript" }
        ".mjs"  { "javascript" }
        ".js"   { "javascript" }
        ".html" { "html" }
        ".css"  { "css" }
        ".json" { "json" }
        ".md"   { "markdown" }
        ".ps1"  { "powershell" }
        ".bat"  { "batch" }
        ".yml"  { "yaml" }
        ".yaml" { "yaml" }
        ".h"    { "cpp" }
        ".hpp"  { "cpp" }
        ".cpp"  { "cpp" }
        default { "text" }
    }
}

function Is-InExcludedDir {
    param(
        [string]$RelativePath,
        [System.Collections.Generic.List[string]]$ExcludeList
    )

    foreach ($ex in $ExcludeList) {
        $exNorm = $ex -replace '/', '\'
        if ($RelativePath -like "*\$exNorm\*") { return $true }
        if ($RelativePath -like ".\$exNorm\*") { return $true }
        if ($RelativePath -like "$exNorm\*") { return $true }
    }

    return $false
}

function Get-ProjectName {
    param(
        [string]$RootDir
    )

    $pkgPath = Join-Path $RootDir "package.json"
    if (Test-Path $pkgPath) {
        try {
            $pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
            if ($pkgJson.name) {
                return $pkgJson.name
            }
        } catch {
            # ignore errors
        }
    }

    return (Split-Path $RootDir -Leaf)
}

function Get-GitInfo {
    param(
        [string]$RootDir
    )

    $gitInfo = [PSCustomObject]@{
        branch = $null
        commit = $null
        dirty  = $null
    }

    try {
        $gitDir = Join-Path $RootDir ".git"
        if (-not (Test-Path $gitDir)) {
            return $gitInfo
        }

        pushd $RootDir | Out-Null

        try {
            $branch = git rev-parse --abbrev-ref HEAD 2>$null
            $commit = git rev-parse HEAD 2>$null
            $status = git status --porcelain 2>$null

            if ($branch) { $gitInfo.branch = $branch.Trim() }
            if ($commit) { $gitInfo.commit = $commit.Trim() }
            if ($status -ne $null) {
                $gitInfo.dirty = -not [string]::IsNullOrWhiteSpace(($status -join "`n"))
            }
        } finally {
            popd | Out-Null
        }
    } catch {
        # ignore errors
    }

    return $gitInfo
}

# Create Writers
$jsonlWriter   = [System.IO.StreamWriter]::new($jsonlFile, $false, [System.Text.Encoding]::UTF8)
$controlWriter = [System.IO.StreamWriter]::new($controlFile, $false, [System.Text.Encoding]::UTF8)

# Global stats
$totalFiles       = 0
$totalBytes       = 0
$includedFiles    = 0
$includedBytes    = 0
$skippedCompact   = 0
$skippedExcluded  = 0
$skippedEmpty     = 0
$skippedErrors    = 0

try {
    # 1. Get files from explicitly included folders
    $allFiles = @()
    foreach ($folder in $foldersToProcess) {
        $folderPath = Join-Path $rootDir $folder
        if (Test-Path $folderPath) {
            $allFiles += Get-ChildItem -Path $folderPath -Recurse -File
        }
    }

    # 2. Get files from root
    $rootFiles = Get-ChildItem -Path $rootDir -Depth 0 -File | Where-Object { 
        $_.Extension -eq ".md" -or 
        $specificFiles -contains $_.Name 
    }
    $allFiles += $rootFiles

    # Distinct by path
    $allFiles = $allFiles | Sort-Object FullName -Unique

    foreach ($item in $allFiles) {
        $filePath     = $item.FullName
        $relativePath = Resolve-Path -Path $filePath -Relative

        $totalFiles++
        $totalBytes += $item.Length

        # A. Skip by excluded directories
        if (Is-InExcludedDir -RelativePath $relativePath -ExcludeList $excludeDirs) {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_EXCLUDED_DIR")
            continue
        }

        # B. Exclude output files and junk
        if ($item.Name -like "project_bundle_*") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_OUTPUT")
            continue
        }
        if ($item.Name -like "CONTROL_FILESCODE_*") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_OUTPUT")
            continue
        }
        if ($item.Name -like "*.log") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_LOG")
            continue
        }
        if ($item.Name -like "*.tmp") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_TMP")
            continue
        }
        if ($item.Name -like "*.bak") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_BAK")
            continue
        }
        if ($item.Name -eq ".DS_Store") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_DS_STORE")
            continue
        }
        if ($item.Name -eq "Thumbs.db") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_THUMBS_DB")
            continue
        }
        if ($item.Name -like ".env*" -and $item.Name -ne ".env.example") {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_ENV")
            continue
        }

        # C. Check extension OR specific filename
        $includeByExt  = $includeExtensions -contains $item.Extension.ToLower()
        $includeByName = $specificFiles -contains $item.Name

        if (-not ($includeByExt -or $includeByName)) {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_NOT_MATCHING_FILTER")
            continue
        }

        # D. Compact mode: check heavy files
        if ($Compact) {
            $isHeavyByName = $heavyFilesByName -contains $item.Name
            $isHeavyBySize = $item.Length -gt $compactSizeThresholdBytes

            if ($isHeavyByName -or $isHeavyBySize) {
                $skippedCompact++
                $controlWriter.WriteLine("$relativePath : SKIPPED_COMPACT")
                continue
            }
        }

        # E. Global Safety: check size and extension
        if ($item.Length -gt $globalSizeLimitBytes) {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_OVER_SIZE_LIMIT ($($item.Length))")
            continue
        }

        if ($excludedExtensions -contains $item.Extension.ToLower()) {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_EXCLUDED_EXTENSION")
            continue
        }

        if ($specificallyExcludedNames -contains $item.Name) {
            $skippedExcluded++
            $controlWriter.WriteLine("$relativePath : SKIPPED_SPECIFICLY_EXCLUDED")
            continue
        }

        # F. Read content and write JSONL
        try {
            $content = [System.IO.File]::ReadAllText($filePath)

            if ([string]::IsNullOrWhiteSpace($content)) {
                $skippedEmpty++
                $controlWriter.WriteLine("$relativePath : EMPTY")
                continue
            }

            $language = Get-LanguageFromExtension $item.Extension

            $obj = [PSCustomObject]@{
                type     = "file"
                path     = $relativePath
                language = $language
                size     = $item.Length
                content  = $content
            }

            $json = $obj | ConvertTo-Json -Depth 10 -Compress
            $jsonlWriter.WriteLine($json)

            $includedFiles++
            $includedBytes += $item.Length

            $controlWriter.WriteLine("$relativePath : OK")
            Write-Host "Added: $relativePath"
        }
        catch {
            $skippedErrors++
            $controlWriter.WriteLine("${relativePath} : ERROR $_")
            Write-Error "Failed to process ${relativePath}: $($_)"
        }
    }

    # ---- Global metadata ----
    $projectName = Get-ProjectName -RootDir $rootDir
    $gitInfo     = Get-GitInfo -RootDir $rootDir

    $meta = [PSCustomObject]@{
        projectName = $projectName
        rootDir     = $rootDir
        generatedAt = (Get-Date).ToString("o")
        compactMode = [bool]$Compact
        excludes    = $Exclude
        git         = $gitInfo
        stats       = [PSCustomObject]@{
            totalFiles      = $totalFiles
            totalBytes      = $totalBytes
            includedFiles   = $includedFiles
            includedBytes   = $includedBytes
            skippedExcluded = $skippedExcluded
            skippedCompact  = $skippedCompact
            skippedEmpty    = $skippedEmpty
            skippedErrors   = $skippedErrors
        }
    }

} finally {
    $jsonlWriter.Close()
    $jsonlWriter.Dispose()

    $controlWriter.Close()
    $controlWriter.Dispose()
}

# Prepend metadata line to JSONL
$existingLines = @()
if (Test-Path $jsonlFile) {
    $existingLines = Get-Content $jsonlFile
}

$metaJson = $meta | ConvertTo-Json -Depth 10 -Compress

$metaJson | Out-File -FilePath $jsonlFile -Encoding UTF8
if ($existingLines.Count -gt 0) {
    $existingLines | Out-File -FilePath $jsonlFile -Encoding UTF8 -Append
}

# Write metadata JSON separately
$meta | ConvertTo-Json -Depth 10 | Out-File -FilePath $metaFile -Encoding UTF8

Write-Host "Done!"
Write-Host "JSONL bundle: $jsonlFile"
Write-Host "Metadata:      $metaFile"
Write-Host "Control file:  $controlFile"
