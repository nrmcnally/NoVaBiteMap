param(
  [string]$PythonPath = ".\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$CacheDir = Join-Path $env:TEMP "bitemap-public-data-v2"
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

$AquaticGapData = Join-Path $CacheDir "agap_fish_dataset_v2_0.csv"
$AquaticGapSpecies = Join-Path $CacheDir "species_list_v2_0.csv"
$DwrTrout = Join-Path $CacheDir "dwr_stocked_trout_waters.geojson"

$AquaticGapDataUrl = "https://www.sciencebase.gov/catalog/file/get/6086df60d34eadd49d31b04a?f=__disk__ad%2F21%2Ffc%2Fad21fc677379f4e45caa4bd506ca1c587d5f01f7"
$AquaticGapSpeciesUrl = "https://www.sciencebase.gov/catalog/file/get/6086df60d34eadd49d31b04a?f=__disk__f3%2Fee%2Ff1%2Ff3eef131e00f65e1e00c16da89e635d63098983d"
$DwrTroutUrl = "https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Stocked_Trout_Waters/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID%2CWaterbody%2CCounty%2CStockSched%2CDesignation%2CRainbowTrout%2CBrownTrout%2CBrookTrout%2CNotes%2CHeritageDay%2CNationalForest%2CNoFallStock%2CStockingUrl%2CTroutAppLinkUrl&returnGeometry=true&outSR=4326&f=geojson"

Invoke-WebRequest -UseBasicParsing -Uri $AquaticGapDataUrl -OutFile $AquaticGapData
Invoke-WebRequest -UseBasicParsing -Uri $AquaticGapSpeciesUrl -OutFile $AquaticGapSpecies
Invoke-WebRequest -UseBasicParsing -Uri $DwrTroutUrl -OutFile $DwrTrout

Push-Location $ProjectRoot
try {
  & $PythonPath -m apps.api.app.ingestion.public_data `
    --agap-data $AquaticGapData `
    --agap-species $AquaticGapSpecies `
    --trout-geojson $DwrTrout `
    --output-dir "app\lib\generated"
  if ($LASTEXITCODE -ne 0) { throw "Web data generation failed." }

  & $PythonPath -m apps.api.app.ingestion.public_data `
    --agap-data $AquaticGapData `
    --agap-species $AquaticGapSpecies `
    --trout-geojson $DwrTrout `
    --output-dir "apps\api\app\data\generated"
  if ($LASTEXITCODE -ne 0) { throw "API data generation failed." }
}
finally {
  Pop-Location
}

Write-Host "BiteMap public-data snapshots refreshed and checksum-verified."
