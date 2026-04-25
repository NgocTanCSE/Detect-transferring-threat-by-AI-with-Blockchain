$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

Write-Host "[1/5] Starting services (postgres_main, auth-service, api-gateway)..."
docker compose up -d --no-deps postgres_main auth-service api-gateway

Write-Host "[2/5] Waiting for postgres and services..."
Start-Sleep -Seconds 8

Write-Host "[3/5] Applying auth migration..."
Get-Content "auth-service/migrations/001_create_users_table.sql" | docker exec -i blockchain_postgres_main psql -U blockchain -d blockchain_main

$registerBody = @{
  username = "phase2user"
  email = "phase2user@example.com"
  password = "SafePass123!"
} | ConvertTo-Json

Write-Host "[4/5] Register + Login through API Gateway..."
$register = Invoke-WebRequest -Uri "http://localhost:8001/auth/register" -Method POST -ContentType "application/json" -Body $registerBody -UseBasicParsing -ErrorAction SilentlyContinue
if (-not $register) {
  throw "Register request failed"
}
Write-Host "Register status: $($register.StatusCode)"

$loginBody = @{
  username = "phase2user"
  password = "SafePass123!"
} | ConvertTo-Json

$login = Invoke-WebRequest -Uri "http://localhost:8001/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginJson = $login.Content | ConvertFrom-Json
$token = $loginJson.access_token
if (-not $token) {
  throw "Login succeeded but no access token returned"
}
Write-Host "Login status: $($login.StatusCode)"

Write-Host "[5/5] Get profile through API Gateway..."
$headers = @{ Authorization = "Bearer $token" }
$profile = Invoke-WebRequest -Uri "http://localhost:8001/auth/profile" -Headers $headers -Method GET -UseBasicParsing
$profileJson = $profile.Content | ConvertFrom-Json

Write-Host "Profile status: $($profile.StatusCode)"
Write-Host "Profile username: $($profileJson.username)"
Write-Host "Profile email: $($profileJson.email)"
Write-Host "Phase 2 auth smoke test completed successfully."
