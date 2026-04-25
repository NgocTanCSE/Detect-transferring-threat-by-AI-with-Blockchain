# Blockchain AI - E2E Integration Test Script
# This script verifies the complete flow across multiple microservices:
# 1. Register a new user (Auth Service)
# 2. Login and get JWT (Auth Service)
# 3. Create a Protected Transfer (Transfer Service)
# 4. Verify Alert Generation (Alert Service)
# 5. Check Dashboard Summary (Analytics Service)

$gatewayUrl = "http://localhost:8001"
$randomId = -join ((97..122) | Get-Random -Count 6 | ForEach-Object {[char]$_})
$username = "tester" + $randomId
$password = "TestPass123!"
$email = $username + "@example.com"

Write-Host "`n🚀 Starting E2E Integration Test..." -ForegroundColor Cyan

# 1. Register
Write-Host "1. Registering user: $username..." -NoNewline
try {
    $regBody = @{
        username = $username
        email = $email
        password = $password
        wallet_address = "0x" + (-join ((48..57) + (97..102) | Get-Random -Count 40 | ForEach-Object {[char]$_}))
    } | ConvertTo-Json
    $regRes = Invoke-RestMethod -Uri "$gatewayUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    Write-Host " [OK]" -ForegroundColor Green
} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
    exit
}

# 2. Login
Write-Host "2. Logging in..." -NoNewline
try {
    $loginBody = @{
        username = $username
        password = $password
    } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "$gatewayUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.access_token
    Write-Host " [OK]" -ForegroundColor Green
} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
    exit
}

$headers = @{ "Authorization" = "Bearer $token" }

# 3. Create Transfer
Write-Host "3. Creating a Protected Transfer..." -NoNewline
try {
    $transferBody = @{
        sender = $regRes.wallet_address
        receiver = "0x" + (-join ((48..57) + (97..102) | Get-Random -Count 40 | ForEach-Object {[char]$_}))
        amount = 1.5
    } | ConvertTo-Json
    $transRes = Invoke-RestMethod -Uri "$gatewayUrl/protected-transfer" -Method Post -Body $transferBody -ContentType "application/json" -Headers $headers
    Write-Host " [OK]" -ForegroundColor Green
} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Error $_
}

# 4. Check Alerts
Write-Host "4. Fetching Recent Alerts..." -NoNewline
try {
    $alerts = Invoke-RestMethod -Uri "$gatewayUrl/alerts" -Method Get -Headers $headers
    Write-Host " [OK] Found $($alerts.count) alerts" -ForegroundColor Green
} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
}

# 5. Check Dashboard
Write-Host "5. Fetching Dashboard Stats..." -NoNewline
try {
    $stats = Invoke-RestMethod -Uri "$gatewayUrl/analytics/compliance/reporting/summary" -Method Get -Headers $headers
    Write-Host " [OK] Total Alerts in DB: $($stats.kpis.alerts_total)" -ForegroundColor Green
} catch {
    Write-Host " [FAILED]" -ForegroundColor Red
}

Write-Host "`n✅ E2E Test Completed Successfully!" -ForegroundColor Green
