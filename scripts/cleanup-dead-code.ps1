$root = Split-Path -Parent $PSScriptRoot
$targets = @(
  "frontend/src/components/Modal.examples.jsx",
  "frontend/src/hooks/useAuthQuery.js",
  "backend/middleware/requireAdmin.js",
  "backend/middleware/validate.js"
)

foreach ($relativePath in $targets) {
  $absolutePath = Join-Path $root $relativePath
  if (Test-Path $absolutePath) {
    Remove-Item -LiteralPath $absolutePath -Force
    Write-Output "Removed $relativePath"
  } else {
    Write-Output "Already clean $relativePath"
  }
}
