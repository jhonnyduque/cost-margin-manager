# BETO OS — DRIFT DETECTOR (v2.0 INTELLIGENT)

$ErrorActionPreference = "Stop"

Write-Host "🧠 BETO OS Drift Detector v2 — Running..." -ForegroundColor Cyan

# ---------- Scan roots (only likely backend locations) ----------
$scanRoots = @(
  "..\..\src",
  "..\..\server",
  "..\..\api",
  "..\..\supabase\functions"
) | Where-Object { Test-Path $_ }

if ($scanRoots.Count -eq 0) {
  Write-Host "⚠ No backend directories found." -ForegroundColor Yellow
  exit 0
}

# ---------- Ignore folders ----------
$ignorePatterns = @(
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git"
)

# ---------- Extensions ----------
$extensions = @("*.ts","*.js","*.sql")

# ---------- Signals ----------
$dbSignals = @("supabase.from(",".from(")
$tenantSignal = "company_id"

$billingSignals = @("stripe","subscription","plan")
$seatSignal = "seat_limit_effective"

$endpointSignals = @("app.get(","app.post(","router.get(","router.post(")
$authSignals = @("requireAuth","auth","jwt")

# ---------- Helpers ----------
function ShouldIgnore($path) {
    foreach ($pattern in $ignorePatterns) {
        if ($path -like "*$pattern*") { return $true }
    }
    return $false
}

function ContainsLiteral($text, $signal) {
    return $text.Contains($signal)
}

# ---------- Scan ----------
$issues = @()
$filesScanned = 0

foreach ($root in $scanRoots) {
    foreach ($ext in $extensions) {
        $files = Get-ChildItem $root -Recurse -Filter $ext -File -ErrorAction SilentlyContinue
        foreach ($file in $files) {

            if (ShouldIgnore $file.FullName) { continue }

            $filesScanned++
            $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content) { continue }

            # Tenant isolation check
            foreach ($db in $dbSignals) {
                if (ContainsLiteral $content $db) {
                    if (-not (ContainsLiteral $content $tenantSignal)) {
                        $issues += "TENANT_SCOPE_MISSING :: $($file.FullName)"
                    }
                }
            }

            # Billing guard check
            foreach ($bill in $billingSignals) {
                if (ContainsLiteral $content $bill) {
                    if (-not (ContainsLiteral $content $seatSignal)) {
                        $issues += "BILLING_WITHOUT_SEAT_GUARD :: $($file.FullName)"
                    }
                }
            }

            # Endpoint auth check
            foreach ($ep in $endpointSignals) {
                if (ContainsLiteral $content $ep) {
                    $authFound = $false
                    foreach ($auth in $authSignals) {
                        if (ContainsLiteral $content $auth) {
                            $authFound = $true
                        }
                    }
                    if (-not $authFound) {
                        $issues += "ENDPOINT_WITHOUT_AUTH :: $($file.FullName)"
                    }
                }
            }

        }
    }
}

Write-Host "Files scanned: $filesScanned" -ForegroundColor DarkGray

# ---------- Report ----------
$reportPath = ".\DRIFT_REPORT.txt"

if ($issues.Count -eq 0) {
    "OK — No drift detected." | Set-Content $reportPath -Encoding UTF8
    Write-Host "✅ No drift detected." -ForegroundColor Green
    exit 0
}

@"
BETO OS — DRIFT REPORT (v2)
Generated: $(Get-Date)

Issues:
$($issues | Sort-Object | Get-Unique -AsString)
"@ | Set-Content $reportPath -Encoding UTF8

Write-Host "❌ Drift detected: $($issues.Count)" -ForegroundColor Red
Write-Host "Report saved to DRIFT_REPORT.txt" -ForegroundColor Yellow
exit 1
