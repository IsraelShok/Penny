# Install, start or update Penny in Docker (Windows). Works on its own, in PowerShell:
#   irm https://raw.githubusercontent.com/Sergey-Bar/Penny/main/install-docker.ps1 | iex
# 1. checks that Docker Desktop is installed and running, 2. downloads the newest release into ~\Penny (or $env:PENNY_DIR),
# 3. if Penny is already there and a newer release exists, offers to update (backup + rollback via Penny-update.ps1),
# 4. builds, starts and opens http://127.0.0.1:41234. Your data lives in a Docker volume, never in the code folder.
# Inside a function, so "return" ends the install without closing a window opened for "irm | iex".
function Install-Penny {
    $ErrorActionPreference = "Stop"
    $ProgressPreference = "SilentlyContinue"
    $repo = "Sergey-Bar/Penny"
    $dir = if ($env:PENNY_DIR) { $env:PENNY_DIR } else { Join-Path $HOME "Penny" }

    function Confirm-Step($question) {
        $reply = Read-Host "$question [Y/n]"
        return -not ($reply -match '^[nN]')
    }

    # 1. Docker installed?
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "Docker Desktop is not installed."
        if ((Get-Command winget -ErrorAction SilentlyContinue) -and (Confirm-Step "Install Docker Desktop with winget now?")) {
            winget install -e --id Docker.DockerDesktop --accept-package-agreements
            Write-Host "Docker Desktop is installed. Restart Windows if it asks, open Docker Desktop once, then run this again."
        } else {
            Write-Host "Install it from https://www.docker.com/products/docker-desktop/ and run this again."
        }
        return
    }

    # Docker running? Start Docker Desktop and wait for it.
    docker version *> $null
    if ($LASTEXITCODE -ne 0) {
        $desktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
        if (Test-Path $desktop) {
            Write-Host "Starting Docker Desktop..."
            Start-Process $desktop
            for ($i = 0; $i -lt 60; $i++) { docker version *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 2 }
        }
        docker version *> $null
        if ($LASTEXITCODE -ne 0) { Write-Host "Docker is installed but not running. Start Docker Desktop and run this again."; return }
    }

    # 2. Newest release.
    $latest = $null
    try { $latest = (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest").tag_name } catch { }
    if (-not $latest) {
        Write-Host "Could not reach GitHub to find the newest release."
        if (-not (Test-Path $dir)) { return }
    }

    # Replaces the code in $dir with a release, keeping imports\ and .env.
    function Get-Release($tag) {
        $tmp = Join-Path ([IO.Path]::GetTempPath()) ("penny-" + [guid]::NewGuid())
        New-Item -ItemType Directory $tmp | Out-Null
        $zip = Join-Path $tmp "src.zip"
        Invoke-WebRequest "https://github.com/$repo/archive/refs/tags/$tag.zip" -OutFile $zip
        Expand-Archive $zip -DestinationPath $tmp
        $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
        New-Item -ItemType Directory -Force $dir | Out-Null
        Get-ChildItem $dir -Force | Where-Object { $_.Name -notin @("imports", ".env") } | Remove-Item -Recurse -Force
        Copy-Item (Join-Path $src.FullName "*") $dir -Recurse -Force
        Remove-Item $tmp -Recurse -Force
        Set-Content (Join-Path $dir ".penny-version") $tag
    }

    function Get-InstalledVersion {
        if (Test-Path (Join-Path $dir ".git")) {
            $v = git -C $dir describe --tags --exact-match 2>$null
            if (-not $v) { $v = git -C $dir rev-parse --short HEAD 2>$null }
            return $v
        }
        $f = Join-Path $dir ".penny-version"
        if (Test-Path $f) { return (Get-Content $f -Raw).Trim() }
        return $null
    }

    $start = Join-Path $dir "Penny-docker.ps1"
    $update = Join-Path $dir "Penny-update.ps1"

    if (-not (Test-Path (Join-Path $dir "docker-compose.yml"))) {
        Write-Host "Downloading Penny $latest into $dir..."
        if (Get-Command git -ErrorAction SilentlyContinue) {
            git -c advice.detachedHead=false clone --quiet --branch $latest "https://github.com/$repo.git" $dir
            if ($LASTEXITCODE -ne 0) { Write-Host "Download failed."; return }
        } else {
            Get-Release $latest
        }
        & powershell -NoProfile -ExecutionPolicy Bypass -File $start
        return
    }

    # 3. Already installed: update if a newer release exists.
    $have = Get-InstalledVersion
    if ($latest -and $have -ne $latest) {
        if (Confirm-Step "Penny $(if ($have) { $have } else { '(unknown version)' }) is installed. Update to $($latest)? Your data is backed up first.") {
            if (-not (Test-Path (Join-Path $dir ".git"))) { Get-Release $latest }
            & powershell -NoProfile -ExecutionPolicy Bypass -File $update
            return
        }
    } else {
        Write-Host "Penny $have is up to date."
    }

    # 4. Start (or restart) what is installed.
    & powershell -NoProfile -ExecutionPolicy Bypass -File $start
    return
}
Install-Penny
