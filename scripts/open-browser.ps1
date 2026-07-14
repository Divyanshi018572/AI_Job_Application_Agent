param(
    [ValidateSet("edge", "chrome", "auto")]
    [string]$Browser = "auto",
    [ValidateSet("dev", "start", "open")]
    [string]$Mode = "open",
    [string]$Url = "http://localhost:3000"
)

$browserPaths = @{
    edge   = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )
    chrome = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    )
}

function Get-BrowserPath {
    param([string]$Name)

    foreach ($path in $browserPaths[$Name]) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Resolve-Browser {
    param([string]$Preference)

    if ($Preference -ne "auto") {
        $path = Get-BrowserPath -Name $Preference
        if ($path) {
            return $path
        }

        throw "Could not find $Preference. Install it or use -Browser auto."
    }

    foreach ($name in @("edge", "chrome")) {
        $path = Get-BrowserPath -Name $name
        if ($path) {
            return $path
        }
    }

    throw "Could not find Microsoft Edge or Google Chrome."
}

function Wait-ForServer {
    param([string]$TargetUrl)

    for ($i = 0; $i -lt 60; $i++) {
        try {
            Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
            return
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    throw "Server did not become ready at $TargetUrl"
}

function Open-FullscreenBrowser {
    param(
        [string]$Executable,
        [string]$TargetUrl
    )

    Start-Process -FilePath $Executable -ArgumentList @(
        "--start-fullscreen",
        "--new-window",
        $TargetUrl
    )
}

$browserExe = Resolve-Browser -Preference $Browser

if ($Mode -eq "open") {
    Wait-ForServer -TargetUrl $Url
    Open-FullscreenBrowser -Executable $browserExe -TargetUrl $Url
    exit 0
}

$serverJob = Start-Job -ScriptBlock {
    param($RunMode)

    Set-Location $using:PWD
    npm run $RunMode 2>&1
} -ArgumentList $Mode

try {
    Wait-ForServer -TargetUrl $Url
    Open-FullscreenBrowser -Executable $browserExe -TargetUrl $Url

    while ($serverJob.State -eq "Running") {
        Receive-Job -Job $serverJob
        Start-Sleep -Milliseconds 250
    }

    Receive-Job -Job $serverJob
    if ($serverJob.ChildJobs[0].JobStateInfo.Reason) {
        throw $serverJob.ChildJobs[0].JobStateInfo.Reason
    }
} finally {
    if ($serverJob.State -eq "Running") {
        Stop-Job -Job $serverJob
    }

    Remove-Job -Job $serverJob -Force
}
