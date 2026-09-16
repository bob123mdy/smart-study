# Install a logon-triggered scheduled task that starts the study server
# with automatic restart on failure. No admin required.
$ErrorActionPreference = "Stop"

$taskName = "smart-study-server"
$scriptPath = Join-Path $PSScriptRoot "start-server.cmd"

$action = New-ScheduledTaskAction -Execute $scriptPath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Smart Study server: start at logon, restart on failure" -Force

Write-Host "Installed scheduled task: $taskName"
