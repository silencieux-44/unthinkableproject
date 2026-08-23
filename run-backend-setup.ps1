
# Clean PowerShell script to run backend setup commands without injected path noise
Set-Location "c:\Users\Devad\Downloads\ticket-booking-system\backend"
Write-Host "Current directory: $(Get-Location)"
Write-Host "`n=== Installing dependencies ==="
npm install
Write-Host "`n=== Running Prisma migrations ==="
npx prisma migrate dev --name init
Write-Host "`n=== Seeding database ==="
npm run seed
Write-Host "`n=== Setup complete ==="