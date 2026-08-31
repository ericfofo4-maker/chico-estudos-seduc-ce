$ErrorActionPreference = "Stop"

Write-Host "============================================================"
Write-Host "    CHICO ESTUDOS - MONITOR URUBURETAMA 2026"
Write-Host "============================================================"
Write-Host ""

$Raiz = Split-Path $PSScriptRoot -Parent

$NoticiasPath = Join-Path $Raiz "dados\noticias.json"
$MonitorPath  = Join-Path $Raiz "dados\monitor-uruburetama.json"

$FonteUrl = "https://concurso.idib.org.br/Concurso.aspx?ID=354"

if (-not (Test-Path -LiteralPath $NoticiasPath)) {
    throw "dados/noticias.json nao encontrado."
}

Write-Host "Consultando banca responsavel:"
Write-Host $FonteUrl
Write-Host ""

$Resposta = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $FonteUrl `
    -Headers @{
        "User-Agent" = "CHICO-Estudos-Radar/1.0"
    } `
    -TimeoutSec 45

if ($Resposta.StatusCode -ne 200) {
    throw "IDIB respondeu HTTP $($Resposta.StatusCode)."
}

$Html = $Resposta.Content

# ============================================================
# TRANSFORMAR HTML EM TEXTO
# ============================================================

$TextoPagina = [regex]::Replace(
    $Html,
    '<script\b[^>]*>.*?</script>',
    ' ',
    [System.Text.RegularExpressions.RegexOptions]::Singleline `
    -bor `
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$TextoPagina = [regex]::Replace(
    $TextoPagina,
    '<style\b[^>]*>.*?</style>',
    ' ',
    [System.Text.RegularExpressions.RegexOptions]::Singleline `
    -bor `
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$TextoPagina = [regex]::Replace(
    $TextoPagina,
    '<[^>]+>',
    ' '
)

$TextoPagina = [System.Net.WebUtility]::HtmlDecode(
    $TextoPagina
)

$TextoPagina = $TextoPagina -replace '\s+', ' '

# ============================================================
# PERIODO DE INSCRICOES
# ============================================================

$Inscricoes = ""

$MatchInscricao = [regex]::Match(
    $TextoPagina,
    'inscri.{0,60}?(\d{2}/\d{2}/\d{4}).{0,40}?(\d{2}/\d{2}/\d{4})',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

if (-not $MatchInscricao.Success) {

    $MatchInscricao = [regex]::Match(
        $Html,
        'inscri.{0,250}?(\d{2}/\d{2}/\d{4}).{0,120}?(\d{2}/\d{2}/\d{4})',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
        -bor `
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
}

if ($MatchInscricao.Success) {

    $Inscricoes =
        $MatchInscricao.Groups[1].Value +
        " a " +
        $MatchInscricao.Groups[2].Value
}

Write-Host "Periodo de inscricoes:"
Write-Host $Inscricoes
Write-Host ""

# ============================================================
# LOCALIZAR DOCUMENTOS RELEVANTES
# ============================================================

$RegexLinks = [regex]::Matches(
    $Html,
    '<a\b[^>]*href=["''](?<href>[^"'']+)["''][^>]*>(?<texto>.*?)</a>',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
    -bor `
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$BaseUri = [Uri]$FonteUrl
$Documentos = @()

foreach ($Match in $RegexLinks) {

    $Href = $Match.Groups["href"].Value
    $Texto = $Match.Groups["texto"].Value

    $Texto = [regex]::Replace(
        $Texto,
        '<[^>]+>',
        ' '
    )

    $Texto = [System.Net.WebUtility]::HtmlDecode(
        $Texto
    )

    $Texto = $Texto -replace '\s+', ' '
    $Texto = $Texto.Trim()

    if ([string]::IsNullOrWhiteSpace($Texto)) {
        continue
    }

    $Relevante = $Texto -match `
        '(EDITAL|RETIFICA|RESULTADO|ISEN.CAO|IMPUGNA|GABARITO|PROVA|COMUNICADO|CONVOCA|RESULTADOS)'

    if (-not $Relevante) {
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

    $Documentos += [PSCustomObject]@{
        texto = $Texto
        url   = $UrlAbsoluta
    }
}

$Documentos = @(
    $Documentos |
    Sort-Object -Property texto,url -Unique
)

if ($Documentos.Count -eq 0) {

    throw "Nenhum documento do concurso foi identificado. Radar nao alterado."
}

Write-Host "Documentos relevantes encontrados:" $Documentos.Count
Write-Host ""

$Documentos |
    Select-Object texto |
    Format-Table -Wrap

# ============================================================
# FINGERPRINT ESTAVEL
#
# Nao usamos data, IP ou outros elementos dinamicos da pagina.
# ============================================================

$FingerprintPartes = @()

$FingerprintPartes += "INSCRICOES|$Inscricoes"

foreach ($Documento in $Documentos) {

    $FingerprintPartes +=
        "$($Documento.texto)|$($Documento.url)"
}

$Fingerprint = $FingerprintPartes -join "`n"

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
# PRIMEIRA EXECUCAO
# ============================================================

if (-not (Test-Path -LiteralPath $MonitorPath)) {

    $Baseline = [PSCustomObject]@{
        fonte       = "IDIB"
        municipio   = "Uruburetama"
        uf          = "CE"
        concurso    = "Edital 01/2026"
        url         = $FonteUrl
        criado_em   = $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")
        inscricoes  = $Inscricoes
        hash        = $Hash
        quantidade  = $Documentos.Count
        documentos  = $Documentos
    }

    $BaselineJson = $Baseline |
        ConvertTo-Json -Depth 12

    [System.IO.File]::WriteAllText(
        $MonitorPath,
        $BaselineJson,
        $Utf8
    )

    Write-Host ""
    Write-Host "============================================================"
    Write-Host "     BASELINE DE URUBURETAMA CRIADA"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "Nenhum alerta foi criado."
    Write-Host "O CHICO agora conhece o estado atual do concurso."
    Write-Host ""

    exit 0
}

# ============================================================
# COMPARACAO
# ============================================================

$Anterior = Get-Content `
    -LiteralPath $MonitorPath `
    -Raw |
    ConvertFrom-Json

if ($Anterior.hash -eq $Hash) {

    Write-Host ""
    Write-Host "Nenhuma nova publicacao detectada em Uruburetama."
    Write-Host "Radar municipal permanece inalterado."
    Write-Host ""

    exit 0
}

# ============================================================
# ALTERACAO DETECTADA
# ============================================================

Write-Host ""
Write-Host "ATENCAO: ALTERACAO OFICIAL DETECTADA EM URUBURETAMA."
Write-Host ""

$Banco = Get-Content `
    -LiteralPath $NoticiasPath `
    -Raw |
    ConvertFrom-Json

$AlertId = "uruburetama-atualizacao-detectada"

$Noticias = @(
    $Banco.noticias |
    Where-Object {
        $_.id -ne $AlertId
    }
)

$NovoAlerta = [PSCustomObject]@{
    id        = $AlertId
    tipo      = "municipio"
    municipio = "Uruburetama"
    uf        = "CE"
    titulo    = "Nova atualização detectada no concurso de Uruburetama"
    resumo    = "O Radar CHICO identificou alteração na página oficial do concurso. Consulte a banca IDIB para verificar o novo edital, retificação, resultado ou comunicado."
    data      = $Agora.ToString("yyyy-MM-dd")
    situacao  = "NOVA PUBLICAÇÃO"
    banca     = "IDIB"
    fonte     = "IDIB"
    url       = $FonteUrl
    urgente   = $true
    ativo     = $true
}

$Noticias += $NovoAlerta

$Banco.noticias = $Noticias

$Banco.atualizado_em =
    $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")

$BancoJson = $Banco |
    ConvertTo-Json -Depth 15

[System.IO.File]::WriteAllText(
    $NoticiasPath,
    $BancoJson,
    $Utf8
)

# ============================================================
# ATUALIZAR BASELINE
# ============================================================

$NovoEstado = [PSCustomObject]@{
    fonte         = "IDIB"
    municipio     = "Uruburetama"
    uf            = "CE"
    concurso      = "Edital 01/2026"
    url           = $FonteUrl
    atualizado_em = $Agora.ToString("yyyy-MM-ddTHH:mm:sszzz")
    inscricoes    = $Inscricoes
    hash          = $Hash
    quantidade    = $Documentos.Count
    documentos    = $Documentos
}

$NovoEstadoJson = $NovoEstado |
    ConvertTo-Json -Depth 12

[System.IO.File]::WriteAllText(
    $MonitorPath,
    $NovoEstadoJson,
    $Utf8
)

Write-Host ""
Write-Host "============================================================"
Write-Host "       RADAR URUBURETAMA ATUALIZADO"
Write-Host "============================================================"
Write-Host ""
Write-Host "Mudanca oficial detectada."
Write-Host "ALERTA CHICO recebera a atualizacao."
Write-Host ""