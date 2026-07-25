# actualizar.ps1
$lnkPath = Join-Path $PSScriptRoot "FC26.xlsx - Acceso directo.lnk"
$destJson = Join-Path $PSScriptRoot "data.json"
$destJs = Join-Path $PSScriptRoot "data.js"

Write-Host "Iniciando actualización de datos desde Excel..." -ForegroundColor Cyan

# 1. Resolve target Excel path (Check local directory first, then shortcut, then Desktop)
try {
    $localExcel = Join-Path $PSScriptRoot "FC26.xlsx"
    if (Test-Path $localExcel) {
        $excelPath = $localExcel
    } elseif (Test-Path $lnkPath) {
        $sh = New-Object -ComObject WScript.Shell
        $excelPath = $sh.CreateShortcut($lnkPath).TargetPath
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sh) | Out-Null
    }
    
    # Fallback to Desktop if not resolved yet or doesn't exist
    if (-not $excelPath -or -not (Test-Path $excelPath)) {
        $excelPath = "C:\Users\lucas\Desktop\FC26.xlsx"
    }
    
    if (-not (Test-Path $excelPath)) {
        throw "No se encontró el archivo de Excel en: `n- Carpeta local ($localExcel)`n- Acceso directo`n- Escritorio ($excelPath)"
    }
    
    Write-Host "Archivo Excel detectado en: $excelPath" -ForegroundColor Green
} catch {
    Write-Error "Error buscando el archivo de Excel: $_"
    exit 1
}

# 2. Extract Excel data using Excel COM
try {
    Write-Host "Abriendo Excel (esto puede tomar unos segundos)..." -ForegroundColor Yellow
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    $workbook = $excel.Workbooks.Open($excelPath)
    $result = @{}
    
    foreach ($sheet in $workbook.Worksheets) {
        $sheetName = $sheet.Name
        $usedRange = $sheet.UsedRange
        $rowCount = $usedRange.Rows.Count
        $colCount = $usedRange.Columns.Count
        
        Write-Host "Procesando pestaña: $sheetName ($rowCount filas, $colCount columnas)" -ForegroundColor Gray
        
        $rows = @()
        for ($r = 1; $r -le $rowCount; $r++) {
            $rowValues = @()
            for ($c = 1; $c -le $colCount; $c++) {
                $val = $usedRange.Cells.Item($r, $c).Text
                $rowValues += $val
            }
            $rows += ,$rowValues
        }
        $result[$sheetName] = $rows
    }
    
    $workbook.Close($false)
    $excel.Quit()
    
    # Release COM objects
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    # 3. Export to JSON and JS
    $jsonContent = $result | ConvertTo-Json -Depth 5
    $jsonContent | Out-File -FilePath $destJson -Encoding utf8 -Force
    
    $jsContent = "const FIFA_DATA = $jsonContent;"
    $jsContent | Out-File -FilePath $destJs -Encoding utf8 -Force
    
    Write-Host "`n¡Datos locales actualizados con éxito!" -ForegroundColor Green
    
    # 4. Git synchronization (Optional / if git repository is initialized)
    if (Test-Path (Join-Path $PSScriptRoot ".git")) {
        Write-Host "`nSincronizando con GitHub..." -ForegroundColor Cyan
        try {
            $gitStatus = git status --porcelain data.js data.json
            if ($gitStatus) {
                Write-Host "Subiendo cambios a la web..." -ForegroundColor Yellow
                git add data.js data.json
                git commit -m "Auto-update data from Excel" | Out-Null
                
                $pushResult = git push 2>&1
                if ($LastExitCode -eq 0) {
                    Write-Host "¡Sincronización web completada con éxito!" -ForegroundColor Green
                } else {
                    Write-Warning "No se pudo subir a GitHub: $pushResult"
                }
            } else {
                Write-Host "No hay nuevos cambios para subir a la web." -ForegroundColor Gray
            }
        } catch {
            Write-Warning "Ocurrió un error al sincronizar con Git: $_"
        }
    } else {
        Write-Host "`nNota: No se detectó repositorio Git. Solo se actualizaron los datos locales." -ForegroundColor Yellow
    }
    
    Write-Host "`nRecarga la página (F5) para ver las estadísticas actualizadas." -ForegroundColor Green
} catch {
    Write-Error "Error leyendo los datos de Excel: $_"
    if ($excel) {
        $excel.Quit()
    }
    exit 1
}
