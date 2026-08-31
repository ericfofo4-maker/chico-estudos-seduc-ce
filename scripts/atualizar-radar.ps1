$ErrorActionPreference = "Stop"

Write-Host "============================================================"
Write-Host "       CHICO ESTUDOS - MONITOR SEDUC-CE 2026"
Write-Host "============================================================"
Write-Host ""

$Raiz = Split-Path $PSScriptRoot -Parent

$NoticiasPath = Join-Path $Raiz "dados\noticias.json"
$MonitorPath  = Join-Path $Raiz "dados\monitor-seduc.json"

$FonteUrl = "https://www.cev.uece.br/concursoseduc2026/"

if (-not (Test-Path -LiteralPath $NoticiasPath)) {
    throw "dados/noticias.json nao encontrado."
}

Write-Host "Consultando fonte oficial:"
Write-Host $FonteUrl
Write-Host ""

$Resposta = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $FonteUrl `
    -Headers @{
        "User-Agent" = "CHICO-Estudos-Radar/1.0"
    } `
    -TimeoutSec 40

if ($Resposta.StatusCode -ne 200) {
    throw "A CEV/UECE respondeu HTTP $($Resposta.StatusCode)."
}

$Html = $Resposta.Content

$RegexLinks = [regex]::Matches(
    $Html,
    '<a\b[^>]*href=["''](?<href>[^"'']+)["''][^>]*>(?<texto>.*?)</a>',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
    -bor `
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$BaseUri = [Uri]$FonteUrl

$Publicacoes = @()

foreach ($Match in $RegexLinks) {

    $Href = $Match.Groups["href"].Value
    $Texto = $Match.Groups["texto"].Value

    $Texto = [regex]::Replace(
        $Texto,
        '<[^>]+>',
        ' '
    )

    $Texto = [System.Net.WebUtility]::HtmlDecode($Texto)

    $Texto = $Texto -replace '\s+', ' '
    $Texto = $Texto.Trim()

    if ($Texto -notmatch '\d{2}/\d{2}/\d{4}') {
        continue
    }

    try {
        $UrlAbsoluta = [Uri]::new(
            $BaseUri,
            $Href
        ).AbsoluteUri
    }
    catch {
        continue
    }

    $Publicacoes += [PSCustomObject]@{
        texto = $Texto
        url   = $UrlAbsoluta
    }
}

$Publicacoes = @(
    $Publicacoes |
    Sort-Object -Property texto,url -Unique
)

if ($Publicacoes.Count -eq 0) {
    throw "Nenhuma publicacao oficial foi identificada. O Radar nao sera alterado."
}

Write-Host "Publicacoes oficiais detectadas:" $Publicacoes.Count
Write-Host ""

$Publicacoes |
    Select-Object texto,url |
    Format-Table -Wrap


# ============================================================
# CRIAR IMPRESSAO DIGITAL DA PAGINA
# ============================================================

$Fingerprint = (
    $Publicacoes |
    ForEach-Object {
        "$($_.texto)|$($_.url)"
    }
) -join "`n"

$SHA = [System.Security.Cryptography.SHA256]::Create()

$Bytes = [System.Text.Encoding]::UTF8.GetBytes(
    $Fingerprint
)

$Hash = [BitConverter]::ToString(
    $SHA.ComputeHash($Bytes)
).Replace(
    "-",
    ""
).ToLowerInvariant()

$Agora = [DateTimeOffset]::UtcNow.ToOffset(
    [TimeSpan]::FromHours(-3)
)

$Utf8 = New-Object System.Text.UTF8Encoding($false)


# ============================================================
# PRIMEIRA EXECUCAO = CRIA A REFERENCIA
# ============================================================

if (-not (Test-Path -LiteralPath $MonitorPath)) {

    $EstadoInicial = [PSCustomObject]@{
        fonte         = "CEV/UECE"
        concurso      = "SEDUC-CE 2026"
        url           = $FonteUrl
        criado_em     = $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")
        hash          = $Hash
        quantidade    = $Publicacoes.Count
        publicacoes   = $Publicacoes
    }

    $JsonInicial = $EstadoInicial |
        ConvertTo-Json -Depth 10

    [System.IO.File]::WriteAllText(
        $MonitorPath,
        $JsonInicial,
        $Utf8
    )

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "         BASELINE DA SEDUC CRIADA"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "Nenhum alerta foi criado."
    Write-Host "O CHICO agora conhece o estado atual da pagina oficial."
    Write-Host ""

    exit 0
}


# ============================================================
# COMPARAR COM ESTADO ANTERIOR
# ============================================================

$EstadoAnterior = Get-Content `
    -LiteralPath $MonitorPath `
    -Raw |
    ConvertFrom-Json

if ($EstadoAnterior.hash -eq $Hash) {

    Write-Host ""
    Write-Host "Nenhuma nova publicacao detectada."
    Write-Host "Radar permanece inalterado."
    Write-Host ""

    exit 0
}


# ============================================================
# ALTERACAO DETECTADA
# ============================================================

Write-Host ""
Write-Host "ATENCAO: ALTERACAO DETECTADA NA PAGINA OFICIAL."
Write-Host ""

$Banco = Get-Content `
    -LiteralPath $NoticiasPath `
    -Raw |
    ConvertFrom-Json

$Noticias = @($Banco.noticias)

$NovoAlerta = [PSCustomObject]@{
    id        = "seduc-atualizacao-detectada"
    tipo      = "seduc"
    municipio = $null
    titulo    = "Nova atualizaÃ§Ã£o detectada na pÃ¡gina oficial da SEDUC-CE 2026"
    resumo    = "O Radar CHICO identificou mudanÃ§a nas publicaÃ§Ãµes oficiais da CEV/UECE. Consulte a pÃ¡gina oficial para verificar o novo documento ou comunicado."
    data      = $Agora.ToString("yyyy-MM-dd")
    situacao  = "NOVA PUBLICAÃ‡ÃƒO"
    fonte     = "CEV/UECE"
    url       = $FonteUrl
    urgente   = $true
    ativo     = $true
}

$EncontrouAlerta = $false

for ($i = 0; $i -lt $Noticias.Count; $i++) {

    if ($Noticias[$i].id -eq "seduc-atualizacao-detectada") {

        $Noticias[$i] = $NovoAlerta
        $EncontrouAlerta = $true
        break
    }
}

if (-not $EncontrouAlerta) {
    $Noticias += $NovoAlerta
}

$Banco.noticias = $Noticias

$Banco.atualizado_em =
    $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")

$NovoJson = $Banco |
    ConvertTo-Json -Depth 15

[System.IO.File]::WriteAllText(
    $NoticiasPath,
    $NovoJson,
    $Utf8
)


# ============================================================
# ATUALIZAR BASELINE
# ============================================================

$NovoEstado = [PSCustomObject]@{
    fonte         = "CEV/UECE"
    concurso      = "SEDUC-CE 2026"
    url           = $FonteUrl
    atualizado_em = $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")
    hash          = $Hash
    quantidade    = $Publicacoes.Count
    publicacoes   = $Publicacoes
}

$NovoEstadoJson = $NovoEstado |
    ConvertTo-Json -Depth 10

[System.IO.File]::WriteAllText(
    $MonitorPath,
    $NovoEstadoJson,
    $Utf8
)

Write-Host ""
Write-Host "============================================================"
Write-Host "       RADAR SEDUC ATUALIZADO"
Write-Host "============================================================"
Write-Host ""
Write-Host "Uma mudanca oficial foi detectada."
Write-Host "O ALERTA CHICO recebera a notificacao."
Write-Host ""
