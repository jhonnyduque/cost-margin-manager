# BETO OS — AI SYSTEM VALIDATOR (v1.0)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Validating BETO OS AI System..." -ForegroundColor Cyan

$requiredFolders = @(
    "00_SYSTEM",
    "01_SKILLS",
    "02_AI_RUNTIME",
    "03_ARCHITECTURE_MEMORY",
    "04_PLAYBOOKS",
    "05_GOVERNANCE",
    "06_TEMPLATES"
)

$requiredFiles = @(
    "00_SYSTEM\BETO_OS_MASTER_SYSTEM_SKILL.md",
    "01_SKILLS\BETO_OS_BACKEND_SKILL.md",
    "01_SKILLS\BETO_OS_FRONTEND_SKILL.md",
    "01_SKILLS\BETO_OS_PRODUCT_SKILL.md",
    "01_SKILLS\BETO_OS_MARKETING_SKILL.md",
    "02_AI_RUNTIME\BETO_OS_AI_BOOTLOADER_PROMPT.md",
    "02_AI_RUNTIME\BETO_OS_AGENT_RULES.md",
    "02_AI_RUNTIME\BETO_OS_CONTEXT_LOADING.md",
    "05_GOVERNANCE\BETO_OS_AI_TEAM_ORCHESTRATOR.md",
    "05_GOVERNANCE\BETO_OS_SELF_GOVERNANCE_RULES.md",
    "06_TEMPLATES\ADR_TEMPLATE.md",
    "06_TEMPLATES\PR_TEMPLATE.md",
    "MASTER_PROMPT.md"
)

# Validate folders
foreach ($folder in $requiredFolders) {
    if (-not (Test-Path $folder)) {
        Write-Host "❌ Missing folder: $folder" -ForegroundColor Red
        exit 1
    }
}

# Validate files
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Missing file: $file" -ForegroundColor Red
        exit 1
    }

    $size = (Get-Item $file).Length
    if ($size -lt 100) {
        Write-Host "❌ File too small or empty: $file ($size bytes)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ BETO OS AI System is structurally valid." -ForegroundColor Green
