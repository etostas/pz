param(
  [int]$Port = 8788
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $Root "data"
$CompanyRegistryPath = Join-Path $DataDir "company_registry.json"

function Get-ReasonPhrase {
  param([int]$StatusCode)
  switch ($StatusCode) {
    200 { "OK" }
    400 { "Bad Request" }
    403 { "Forbidden" }
    404 { "Not Found" }
    500 { "Internal Server Error" }
    default { "OK" }
  }
}

function Send-Bytes {
  param($Stream, [byte[]]$Bytes, [string]$ContentType, [int]$StatusCode = 200)
  $reason = Get-ReasonPhrase $StatusCode
  $headers = "HTTP/1.1 $StatusCode $reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Bytes.Length -gt 0) {
    $Stream.Write($Bytes, 0, $Bytes.Length)
  }
}

function Send-Text {
  param($Stream, [string]$Text, [string]$ContentType = "text/plain; charset=utf-8", [int]$StatusCode = 200)
  Send-Bytes $Stream ([System.Text.Encoding]::UTF8.GetBytes($Text)) $ContentType $StatusCode
}

function Get-ContentType {
  param([string]$Path)
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".svg" { "image/svg+xml" }
    ".json" { "application/json; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

function Get-QueryParam {
  param([string]$Query, [string]$Name)
  $clean = $Query.TrimStart("?")
  foreach ($part in $clean -split "&") {
    if ([string]::IsNullOrWhiteSpace($part)) { continue }
    $pair = $part -split "=", 2
    $key = [System.Uri]::UnescapeDataString($pair[0])
    if ($key -eq $Name) {
      if ($pair.Count -lt 2) { return "" }
      return [System.Uri]::UnescapeDataString(($pair[1] -replace "\+", " "))
    }
  }
  return $null
}

function Read-HttpRequest {
  param($Stream)
  $buffer = New-Object byte[] 8192
  $memory = [System.IO.MemoryStream]::new()
  do {
    $read = $Stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) { break }
    $memory.Write($buffer, 0, $read)
    $text = [System.Text.Encoding]::ASCII.GetString($memory.ToArray())
  } while ($text.IndexOf("`r`n`r`n") -lt 0 -and $memory.Length -lt 1048576)

  if ($memory.Length -eq 0) { return $null }
  $requestText = [System.Text.Encoding]::ASCII.GetString($memory.ToArray())
  $headerEnd = $requestText.IndexOf("`r`n`r`n")
  $headersText = if ($headerEnd -ge 0) { $requestText.Substring(0, $headerEnd) } else { $requestText }
  $contentLength = 0
  foreach ($line in ($headersText -split "`r`n" | Select-Object -Skip 1)) {
    $headerPair = $line -split ":", 2
    if ($headerPair.Count -eq 2 -and $headerPair[0].Trim().Equals("Content-Length", [System.StringComparison]::OrdinalIgnoreCase)) {
      [int]::TryParse($headerPair[1].Trim(), [ref]$contentLength) | Out-Null
    }
  }
  $bodyBytes = @()
  if ($contentLength -gt 0) {
    $alreadyRead = [Math]::Max(0, $memory.Length - ($headerEnd + 4))
    while ($alreadyRead -lt $contentLength) {
      $read = $Stream.Read($buffer, 0, [Math]::Min($buffer.Length, $contentLength - $alreadyRead))
      if ($read -le 0) { break }
      $memory.Write($buffer, 0, $read)
      $alreadyRead += $read
    }
    $allBytes = $memory.ToArray()
    $bodyBytes = $allBytes[($headerEnd + 4)..([Math]::Min($allBytes.Length - 1, $headerEnd + 3 + $contentLength))]
  }
  $firstLine = ($requestText -split "`r`n", 2)[0]
  $parts = $firstLine -split " "
  if ($parts.Count -lt 2) { return $null }
  $target = $parts[1]
  $question = $target.IndexOf("?")
  if ($question -ge 0) {
    $path = $target.Substring(0, $question)
    $query = $target.Substring($question)
  }
  else {
    $path = $target
    $query = ""
  }
  return [pscustomobject]@{
    Method = $parts[0]
    Path = [System.Uri]::UnescapeDataString($path)
    Query = $query
    Body = if ($bodyBytes.Count -gt 0) { [System.Text.Encoding]::UTF8.GetString($bodyBytes) } else { "" }
  }
}

function Get-SourceByCode {
  param($Report, [string]$Code)
  foreach ($source in @($Report.sources)) {
    if ($source.code -eq $Code) { return $source }
  }
  return $null
}

function ConvertTo-PlainHashtable {
  param($Value)
  if ($null -eq $Value) { return $null }
  if ($Value -is [System.Collections.IDictionary]) {
    $result = [hashtable]::new([System.StringComparer]::Ordinal)
    foreach ($key in $Value.Keys) {
      $result[$key] = ConvertTo-PlainHashtable $Value[$key]
    }
    return $result
  }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += ,(ConvertTo-PlainHashtable $item)
    }
    return $items
  }
  if ($Value -is [pscustomobject]) {
    $result = [hashtable]::new([System.StringComparer]::Ordinal)
    foreach ($property in $Value.PSObject.Properties) {
      $result[$property.Name] = ConvertTo-PlainHashtable $property.Value
    }
    return $result
  }
  return $Value
}

function Write-JsonFileWithRetry {
  param(
    [string]$Path,
    [string]$Json
  )
  $dir = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $tmp = Join-Path $dir ("." + [IO.Path]::GetFileName($Path) + "." + [guid]::NewGuid().ToString("N") + ".tmp")
  $lastError = $null
  for ($i = 0; $i -lt 5; $i++) {
    try {
      [System.IO.File]::WriteAllText($tmp, $Json, [System.Text.UTF8Encoding]::new($false))
      Move-Item -LiteralPath $tmp -Destination $Path -Force
      return
    }
    catch {
      $lastError = $_.Exception
      Start-Sleep -Milliseconds (150 * ($i + 1))
    }
  }
  if (Test-Path $tmp -PathType Leaf) {
    try { Remove-Item -LiteralPath $tmp -Force } catch {}
  }
  throw $lastError
}

function Save-CompanyReport {
  param($Report)
  New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
  if (Test-Path $CompanyRegistryPath -PathType Leaf) {
    try {
      $registry = ConvertTo-PlainHashtable (Get-Content $CompanyRegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
      $registry = @{ companies = @{} }
    }
  }
  else {
    $registry = @{ companies = @{} }
  }
  if (-not $registry.ContainsKey("companies") -or $null -eq $registry.companies) {
    $registry.companies = @{}
  }

  $inn = [string]$Report.inn
  $checko = Get-SourceByCode $Report "checko_company_card"
  $dreamjob = Get-SourceByCode $Report "dreamjob_reviews"
  $company = $registry.companies[$inn]
  if ($null -eq $company) {
    $company = [ordered]@{
      inn = $inn
      created_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      reports = @()
    }
  }
  $company.updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $company.name = if ($checko -and $checko.collected.name) { $checko.collected.name } else { $company.name }
  $company.ogrn = if ($checko -and $checko.collected.ogrn) { $checko.collected.ogrn } else { $company.ogrn }
  $company.director = if ($checko -and $checko.collected.director) { $checko.collected.director } else { $company.director }
  $company.staff_count = if ($checko -and $checko.collected.staff_count) { $checko.collected.staff_count } else { $company.staff_count }
  $company.revenue = if ($checko -and $checko.collected.revenue) { $checko.collected.revenue } else { $company.revenue }
  $company.net_profit = if ($checko -and $checko.collected.net_profit) { $checko.collected.net_profit } else { $company.net_profit }
  $company.dreamjob_reviews = if ($dreamjob -and $dreamjob.collected.review_count) { $dreamjob.collected.review_count } else { $company.dreamjob_reviews }
  $company.latest_report = $Report
  $company.reports = @($company.reports | Select-Object -Last 9)
  $company.reports += [ordered]@{
    generated_at = $Report.generated_at
    platform_status = $Report.platform_status
    risk_score = $Report.risk_score
    source_count = @($Report.sources).Count
  }
  $registry.companies[$inn] = $company
  $registry.updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  Write-JsonFileWithRetry $CompanyRegistryPath ($registry | ConvertTo-Json -Depth 40)
  return $company
}

function Normalize-ReviewText {
  param([string]$Text)
  if (-not $Text) { return "" }
  $clean = ($Text -replace '<script[\s\S]*?</script>', ' ') -replace '<style[\s\S]*?</style>', ' ' -replace '<noscript[\s\S]*?</noscript>', ' '
  $clean = ($clean -replace "<[^>]+>", " ") -replace "\s+", " "
  return ([System.Net.WebUtility]::HtmlDecode($clean)).Trim()
}

function Clean-ReviewServiceText {
  param([string]$Text)
  $clean = Normalize-ReviewText $Text
  $servicePhrases = @(
    "Оставить отзыв",
    "Открыть отзывы",
    "Пожаловаться",
    "Полезный отзыв",
    "Это полезный отзыв",
    "Ссылка на отзыв",
    "Этот отзыв без ответа",
    "Ответить от лица компании",
    "Читать полностью",
    "Читать целиком"
  )
  foreach ($phrase in $servicePhrases) {
    $clean = $clean -replace [regex]::Escape($phrase), " "
  }
  $clean = $clean -replace "\s+", " "
  return $clean.Trim()
}

function Add-ReviewItem {
  param(
    [System.Collections.ArrayList]$Items,
    [string]$Text,
    [string]$Author = "",
    [string]$Date = "",
    [string]$Rating = "",
    [string]$Url = "",
    [string]$VerificationStatus = ""
  )
  $clean = Clean-ReviewServiceText $Text
  if ($clean -match '(?i)\b(var|window|function|Fingerprint2|select2|centrifugoOptions|Google Tag Manager|dataLayer)\b') { return }
  if ($clean.Length -lt 10) { return }
  foreach ($item in $Items) {
    if ($item.text -eq $clean) { return }
  }
  [void]$Items.Add([ordered]@{
    text = $clean
    author = Normalize-ReviewText $Author
    date = Normalize-ReviewText $Date
    rating = Normalize-ReviewText $Rating
    verification_status = Normalize-ReviewText $VerificationStatus
    url = $Url
    collected_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  })
}

function Get-2GisReviewTextFromCard {
  param([string]$CardHtml, [string]$Author)
  $text = Get-RegexValueLocal $CardHtml '<(?:a|div)[^>]+class="_oxthv5"[^>]*>(.*?)</(?:a|div)>'
  if ($text) { return $text }
  $plain = Normalize-ReviewText $CardHtml
  if ($Author) {
    $pattern = [regex]::Escape((Normalize-ReviewText $Author)) + '\s+\d+\s+\S+\s+(.*?)(?:\s+\S+\s+\S+)?\s+\S+\s+\d+\b'
    $match = [regex]::Match($plain, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
  }
  $fallback = [regex]::Match($plain, '\d+\s+\S+\s+(.*?)(?:\s+\S+\s+\S+)?\s+\S+\s+\d+\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($fallback.Success) { return $fallback.Groups[1].Value.Trim() }
  return ""
}

function Get-2GisReviewMetaFromHtml {
  param([string]$Html, [int]$CardCount)
  $plain = Normalize-ReviewText (($Html -replace '<script.*?</script>', ' ') -replace '<style.*?</style>', ' ')
  $rating = ""
  $ratingCount = ""
  $reviewCount = ""

  $ratingMatch = [regex]::Match($plain, '(?<!\d)(\d+(?:[,.]\d+)?)\s+(\d+)\s+\S*цен\S*\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($ratingMatch.Success) {
    $rating = $ratingMatch.Groups[1].Value -replace ',', '.'
    $ratingCount = $ratingMatch.Groups[2].Value
  }

  $tabMatch = [regex]::Match($plain, '\b\S*тзыв\S*\s+(\d+)\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($tabMatch.Success) { $reviewCount = $tabMatch.Groups[1].Value }
  if (-not $reviewCount -and $CardCount -gt 0) { $reviewCount = "$CardCount" }

  return [ordered]@{
    rating = $rating
    rating_text = $(if ($rating) { "$rating из 5" } else { "" })
    rating_count = $ratingCount
    rating_count_text = $(if ($ratingCount) { "$ratingCount оценок" } else { "" })
    review_count = $(if ($reviewCount) { [int]$reviewCount } else { $CardCount })
    review_count_text = $(if ($reviewCount) { "$reviewCount отзывов" } elseif ($CardCount -gt 0) { "$CardCount отзывов" } else { "" })
  }
}

function Collect-DreamJobReviewsFromHtml {
  param(
    [string]$Html,
    [System.Collections.ArrayList]$Items,
    [string]$Url
  )
  $plain = Normalize-ReviewText $Html
  $rating = ""
  $ratingMatch = [regex]::Match($plain, 'Оценка компании\s+(\d+[,.]\d+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($ratingMatch.Success) { $rating = $ratingMatch.Groups[1].Value -replace ',', '.' }
  $reviewCount = ""
  $countMatch = [regex]::Match($plain, 'Оценка компании\s+\d+[,.]\d+.*?(\d+)\s+отзыв', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($countMatch.Success) { $reviewCount = $countMatch.Groups[1].Value }

  $blocks = [regex]::Matches($plain, '([А-ЯЁ][А-Яа-яЁё\-\s]+,\s+[А-Яа-яЁё]+\s*\d{4}.*?Что нравится\?.*?)(?=Полезный отзыв)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($block in $blocks) {
    $rawBlockText = Normalize-ReviewText $block.Groups[1].Value
    $blockText = Clean-ReviewServiceText $block.Groups[1].Value
    if ($blockText -notmatch 'Что нравится\?') { continue }
    $cardMatches = [regex]::Matches($rawBlockText, '([А-ЯЁ][А-Яа-яЁё\-\s]+),\s+([А-Яа-яЁё]+\s*\d{4})\s+(.{3,120}?)\s+\.\.\.\s+Пожаловаться', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $headMatch = if ($cardMatches.Count -gt 0) { $cardMatches[$cardMatches.Count - 1] } else { $null }
    $workMatch = [regex]::Match($rawBlockText, 'Пожаловаться\s+((?:Работаю меньше года|Работаю [^А-ЯЁ,]{1,40}|Работал \d+\-\d+ (?:год|года|лет)|Работал меньше года|Работал больше [^А-ЯЁ,]{1,30}))\s+([А-ЯЁ][А-Яа-яЁё\-\s]+),\s+([а-яё]+\s*\d{4})\s+(\d+[,.]\d+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $city = ""
    $period = ""
    $role = "сотрудник"
    $employment = ""
    $itemRating = ""
    if ($headMatch -and $headMatch.Success) {
      $city = $headMatch.Groups[1].Value.Trim()
      if ($city -match 'Выбрать\s+(.+)$') { $city = $Matches[1].Trim() }
      $period = $headMatch.Groups[2].Value.Trim()
      $role = $headMatch.Groups[3].Value.Trim()
    }
    if ($workMatch.Success) {
      $employment = $workMatch.Groups[1].Value.Trim()
      $city = $workMatch.Groups[2].Value.Trim()
      $period = $workMatch.Groups[3].Value.Trim()
      $itemRating = $workMatch.Groups[4].Value -replace ',', '.'
    }
    $likes = ""
    $improve = ""
    $likesMatch = [regex]::Match($blockText, 'Что нравится\?\s+(.*?)(?=Что можно улучшить\?|Преимущества и льготы|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($likesMatch.Success) { $likes = $likesMatch.Groups[1].Value.Trim() }
    $improveMatch = [regex]::Match($blockText, 'Что можно улучшить\?\s+(.*?)(?=Преимущества и льготы|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($improveMatch.Success) { $improve = $improveMatch.Groups[1].Value.Trim() }
    $reviewTextParts = @()
    if ($likes) { $reviewTextParts += "Что нравится: $likes" }
    if ($improve) { $reviewTextParts += "Что можно улучшить: $improve" }
    $authorParts = @($role, $city, $period, $employment) | Where-Object { $_ }
    Add-ReviewItem $Items ($reviewTextParts -join " ") ($authorParts -join ", ") "" $itemRating $Url ""
  }

  return [ordered]@{
    rating = $rating
    rating_text = $(if ($rating) { "$rating из 5" } else { "" })
    review_count = $(if ($reviewCount) { [int]$reviewCount } else { $Items.Count })
    review_count_text = $(if ($reviewCount) { "$reviewCount отзывов" } elseif ($Items.Count -gt 0) { "$($Items.Count) отзывов" } else { "" })
  }
}

function Collect-AntijobReviewsFromHtml {
  param(
    [string]$Html,
    [System.Collections.ArrayList]$Items,
    [string]$Url
  )
  $plain = Normalize-ReviewText $Html
  $reviewCount = ""
  $countMatch = [regex]::Match($plain, '(\d+)\s+отзыв[а-я]*\s+о работодателе', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($countMatch.Success) { $reviewCount = $countMatch.Groups[1].Value }
  $sectionMatch = [regex]::Match($plain, 'Отзывы сотрудников о работе.*?(?=Бесплатная консультация|Русский English|Copyleft|$)', [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $section = if ($sectionMatch.Success) { $sectionMatch.Value } else { $plain }
  $pattern = '(?<company>.{2,90}?)\s+(?<author>Анонимный|Доверительный)\s+(?<text>.*?)(?:Показать полностью)\s+(?<city>[^•]{2,60})\s+•\s+(?<date>\d{2}\.\d{2}\.\d{4})\s+\d+\s+•\s+\d+'
  $matches = [regex]::Matches($section, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($match in $matches) {
    $company = Clean-ReviewServiceText $match.Groups["company"].Value
    if ($company -match 'Только\s+\S+\s+(.+)$') { $company = $Matches[1].Trim() }
    $author = Clean-ReviewServiceText $match.Groups["author"].Value
    $city = Clean-ReviewServiceText $match.Groups["city"].Value
    $date = Clean-ReviewServiceText $match.Groups["date"].Value
    $text = Clean-ReviewServiceText $match.Groups["text"].Value
    $text = $text -replace '\s*Пр\.\.\.\s*$', ''
    $text = "$text [фрагмент со страницы списка Antijob]"
    Add-ReviewItem $Items $text "$author, $company, $city" $date "" $Url ""
  }
  return [ordered]@{
    review_count = $(if ($reviewCount) { [int]$reviewCount } else { $Items.Count })
    review_count_text = $(if ($reviewCount) { "$reviewCount отзывов" } elseif ($Items.Count -gt 0) { "$($Items.Count) отзывов" } else { "" })
  }
}

function Split-ManualReviews {
  param([string]$Text)
  $items = @()
  $blocks = $Text -split "(\r?\n){2,}"
  foreach ($block in $blocks) {
    $clean = ($block -replace "\s+", " ").Trim()
    if ($clean.Length -ge 3) {
      $items += [ordered]@{
        text = $clean
        added_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
      }
    }
  }
  return $items
}

function ConvertTo-ReviewCandidates {
  param($Value, [System.Collections.ArrayList]$Items, [string]$Url)
  if ($null -eq $Value) { return }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string]) -and -not ($Value -is [System.Collections.IDictionary]) -and -not ($Value -is [pscustomobject])) {
    foreach ($item in $Value) { ConvertTo-ReviewCandidates $item $Items $Url }
    return
  }
  $props = @{}
  if ($Value -is [System.Collections.IDictionary]) {
    foreach ($key in $Value.Keys) { $props[$key] = $Value[$key] }
  }
  elseif ($Value -is [pscustomobject]) {
    foreach ($property in $Value.PSObject.Properties) { $props[$property.Name] = $property.Value }
  }
  else {
    return
  }
  $type = "$($props['@type'])"
  $text = $props.reviewBody
  if (-not $text) { $text = $props.text }
  if (-not $text) { $text = $props.comment }
  if (-not $text) { $text = $props.description }
  $author = ""
  if ($props.author) {
    if ($props.author.name) { $author = $props.author.name } else { $author = "$($props.author)" }
  }
  $date = if ($props.datePublished) { $props.datePublished } elseif ($props.createdAt) { $props.createdAt } else { "" }
  $rating = ""
  if ($props.reviewRating) {
    if ($props.reviewRating.ratingValue) { $rating = $props.reviewRating.ratingValue } else { $rating = "$($props.reviewRating)" }
  }
  elseif ($props.rating) { $rating = "$($props.rating)" }
  if ($type -match "Review|Answer|Comment" -or $text) {
    Add-ReviewItem $Items "$text" "$author" "$date" "$rating" $Url
  }
  foreach ($key in $props.Keys) {
    if ($key -in @("author", "reviewRating")) { continue }
    ConvertTo-ReviewCandidates $props[$key] $Items $Url
  }
}

function Collect-ReviewsFromUrl {
  param([string]$Source, [string]$Url)
  if (-not $Url -or $Url -notmatch '^https?://') { throw "Укажите корректную ссылку http/https." }
  $headers = @{
    "User-Agent" = "Mozilla/5.0 PlusZvenoReviewCollector/0.1"
    "Accept" = "text/html,application/xhtml+xml,application/json,text/plain,*/*"
  }
  $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $headers -MaximumRedirection 5 -TimeoutSec 90
  $html = $response.Content
  $finalUrl = if ($response.BaseResponse.ResponseUri) { $response.BaseResponse.ResponseUri.AbsoluteUri } else { $Url }
  $items = [System.Collections.ArrayList]::new()
  $meta = [ordered]@{}

  if ($Source -eq "2gis" -or $finalUrl -match "2gis\.ru|go\.2gis\.com") {
    $meta = Collect-2GisReviewsFromHtml $html $items $finalUrl
  }
  elseif ($Source -eq "dreamjob" -or $finalUrl -match "dreamjob\.ru") {
    $meta = Collect-DreamJobReviewsFromHtml $html $items $finalUrl
  }
  elseif ($Source -eq "antijob" -or $finalUrl -match "antijob\.net") {
    $meta = Collect-AntijobReviewsFromHtml $html $items $finalUrl
  }
  elseif ($Source -eq "yandex" -or $finalUrl -match "yandex\.ru/(maps|profile|org)") {
    throw "Яндекс.Карты не отдали отзывы в статическом HTML. Нужен отдельный адаптер Яндекс.Карт: сейчас сохраните корректную ссылку, сбор текстов подключим следующим шагом."
  }

  if ($items.Count -eq 0) {
    $jsonLdMatches = [regex]::Matches($html, '<script[^>]+type=["'']application/ld\+json["''][^>]*>(.*?)</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($match in $jsonLdMatches) {
      try {
        $json = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value) | ConvertFrom-Json
        ConvertTo-ReviewCandidates $json $items $finalUrl
      } catch {}
    }

    $nextData = [regex]::Match($html, '<script[^>]+id=["'']__NEXT_DATA__["''][^>]*>(.*?)</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($nextData.Success) {
      try {
        $json = [System.Net.WebUtility]::HtmlDecode($nextData.Groups[1].Value) | ConvertFrom-Json
        ConvertTo-ReviewCandidates $json $items $finalUrl
      } catch {}
    }
  }

  if ($items.Count -eq 0) {
    $safeHtml = ($html -replace '<script[\s\S]*?</script>', ' ') -replace '<style[\s\S]*?</style>', ' ' -replace '<noscript[\s\S]*?</noscript>', ' '
    $reviewBlocks = [regex]::Matches($safeHtml, '<[^>]*(?:review|comment|bloko)[^>]*>.*?</(?:article|div|li)>', [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($block in ($reviewBlocks | Select-Object -First 80)) {
      $text = Normalize-ReviewText $block.Value
      if ($text.Length -ge 40 -and $text.Length -le 4000 -and $text -match "[А-Яа-яA-Za-z]") {
        Add-ReviewItem $items $text "" "" "" $finalUrl ""
      }
    }
  }

  if ($items.Count -eq 0) {
    throw "Страница не отдала тексты отзывов в HTML/JSON. Проверьте, что ссылка ведет на страницу отзывов, а не на динамическую карточку без серверной разметки."
  }
  if (-not $meta.review_count) { $meta.review_count = $items.Count }
  if (-not $meta.review_count_text) { $meta.review_count_text = "$($items.Count) отзывов" }
  return [ordered]@{
    reviews = @($items | Select-Object -First 50)
    meta = $meta
    final_url = $finalUrl
  }
}

function Collect-2GisReviewsFromHtml {
  param(
    [string]$Html,
    [System.Collections.ArrayList]$Items,
    [string]$Url
  )
  $cards = [regex]::Matches($Html, '<div class="_1rowqpjv">(.*?)(?=<div class="_1rowqpjv"|<div class="_nj2x2r"|</body>)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($card in $cards) {
    $cardHtml = $card.Groups[1].Value
    $author = Get-RegexValueLocal $cardHtml '<span[^>]+class="_19h0cqe"[^>]*>(.*?)</span>'
    if (-not $author) { $author = Get-RegexValueLocal $cardHtml '<span[^>]+class="_19h0cqe"[^>]+title="([^"]+)"' }
    if (-not $author) {
      $plain = Normalize-ReviewText $cardHtml
      $authorMatch = [regex]::Match($plain, '^(?:\S{1,3}\s+)?(.+?)\s+\d+\s+\S+\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($authorMatch.Success) { $author = $authorMatch.Groups[1].Value.Trim() }
    }
    $text = Get-2GisReviewTextFromCard $cardHtml $author
    if (-not $text) { continue }
    $date = Get-RegexValueLocal $cardHtml '<span[^>]+class="_i486tw"[^>]*>(.*?)</span>'
    $rating = ([regex]::Matches($cardHtml, 'color="#ffb81c"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
    if ($rating -gt 5) { $rating = 5 }
    $verificationStatus = ""
    if ((Normalize-ReviewText $cardHtml) -match '\b\S*твержд\S*\b') { $verificationStatus = "подтвержден" } else { $verificationStatus = "нет отметки подтверждения" }
    Add-ReviewItem $Items $text $author $date $(if ($rating -gt 0) { "$rating" } else { "" }) $Url $verificationStatus
  }
  return Get-2GisReviewMetaFromHtml $Html $cards.Count
}

function Get-RegexValueLocal {
  param([string]$Text, [string]$Pattern)
  $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success) { return [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value) }
  return ""
}

function Get-ManualReviewTitle {
  param([string]$Source)
  switch ($Source) {
    "2gis" { "2GIS отзывы" }
    "yandex" { "Яндекс Карты отзывы" }
    "hh" { "HH отзывы" }
    "dreamjob" { "DreamJob отзывы" }
    "antijob" { "Antijob отзывы" }
    "avito" { "Avito отзывы" }
    default { "Ручные отзывы" }
  }
}

function Add-ManualReviewsToCompany {
  param(
    [string]$Inn,
    [string]$Source,
    [string]$Url
  )
  if (-not (Test-Path $CompanyRegistryPath -PathType Leaf)) {
    throw "Сначала соберите первичный отчет по компании."
  }
  $registry = ConvertTo-PlainHashtable (Get-Content $CompanyRegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
  if (-not $registry.companies.ContainsKey($Inn)) {
    throw "Компания не найдена в локальном справочнике. Сначала соберите первичный отчет."
  }
  $company = $registry.companies[$Inn]
  $collection = Collect-ReviewsFromUrl $Source $Url
  $reviews = @($collection.reviews)
  $meta = $collection.meta
  $entry = [ordered]@{
    source = $Source
    title = Get-ManualReviewTitle $Source
    url = $collection.final_url
    rating = $meta.rating
    rating_text = $meta.rating_text
    rating_count = $meta.rating_count
    rating_count_text = $meta.rating_count_text
    review_count = $(if ($meta.review_count) { $meta.review_count } else { $reviews.Count })
    review_count_text = $(if ($meta.review_count_text) { $meta.review_count_text } else { "$($reviews.Count) отзывов" })
    reviews = $reviews
    added_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  }
  if ($null -eq $company.manual_review_sources) { $company.manual_review_sources = @() }
  $company.manual_review_sources = @($company.manual_review_sources) + (, $entry)
  if ($company.latest_report) {
    $sourceCode = "manual_$($Source)_reviews"
    $company.latest_report.sources = @($company.latest_report.sources | Where-Object { $_.code -ne $sourceCode })
    $company.latest_report.sources += [ordered]@{
      code = $sourceCode
      title = $entry.title
      status = "ok"
      url = $entry.url
      collected = [ordered]@{
        rating = $entry.rating
        rating_text = $entry.rating_text
        rating_count = $entry.rating_count
        rating_count_text = $entry.rating_count_text
        review_count = $entry.review_count
        review_count_text = $entry.review_count_text
        sample_reviews = $reviews
        collection_mode = "url_review_collector"
      }
      signals = @()
      errors = @()
      # TODO AI: add deterministic non-LLM classification for "риски работы" in collected reviews:
      # salary delays, unpaid work, unsafe conditions, bad housing, documents/contracts, management pressure and travel issues.
      next_actions = @('Classify manual reviews by payroll, conditions, management, housing, safety and paperwork.')
    }
  }
  $company.updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $registry.companies[$Inn] = $company
  $registry.updated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  Write-JsonFileWithRetry $CompanyRegistryPath ($registry | ConvertTo-Json -Depth 60)
  return $company
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host "PlusZveno admin server: http://localhost:$Port/"
Write-Host "Admin login: +7 000 00 00 000, any 4 SMS digits"
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $request = Read-HttpRequest $stream
    if ($null -eq $request) {
      Send-Text $stream "Bad request" "text/plain; charset=utf-8" 400
      continue
    }

    if ($request.Path -eq "/api/company-check") {
      $inn = ((Get-QueryParam $request.Query "inn") -replace "\D+", "")
      if ($inn.Length -notin @(10, 12, 13, 15)) {
        Send-Text $stream '{"error":"Identifier must contain 10/12/13/15 digits"}' "application/json; charset=utf-8" 400
        continue
      }
      $script = Join-Path $Root "company_check\company_check.ps1"
      $json = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -Inn $inn -JsonOnly -NoSave 2>&1
      if ($LASTEXITCODE -ne 0) {
        $escaped = (($json | Out-String) -replace "\\", "\\") -replace '"', '\"'
        Send-Text $stream "{`"error`":`"$escaped`"}" "application/json; charset=utf-8" 500
        continue
      }
      $report = ($json | Out-String) | ConvertFrom-Json
      $saved = $true
      $saveError = ""
      $company = $null
      try {
        $company = Save-CompanyReport $report
      }
      catch {
        $saved = $false
        $saveError = $_.Exception.Message
      }
      $payload = [ordered]@{
        report = $report
        company_profile = $company
        saved = $saved
        save_error = $saveError
        registry_path = $CompanyRegistryPath
      } | ConvertTo-Json -Depth 50
      Send-Text $stream $payload "application/json; charset=utf-8"
      continue
    }

    if ($request.Path -like "*company-manual-reviews*" -and $request.Method.Equals("POST", [System.StringComparison]::OrdinalIgnoreCase)) {
      try {
        $body = $request.Body | ConvertFrom-Json
        $inn = ([string]$body.inn -replace "\D+", "")
        if ($inn.Length -notin @(10, 12, 13, 15)) {
          Send-Text $stream '{"error":"Identifier must contain 10/12/13/15 digits"}' "application/json; charset=utf-8" 400
          continue
        }
        $company = Add-ManualReviewsToCompany $inn ([string]$body.source) ([string]$body.url)
        $payload = [ordered]@{
          saved = $true
          company_profile = $company
          report = $company.latest_report
        } | ConvertTo-Json -Depth 60
        Send-Text $stream $payload "application/json; charset=utf-8"
      }
      catch {
        $escaped = ($_.Exception.Message -replace "\\", "\\") -replace '"', '\"'
        Send-Text $stream "{`"error`":`"$escaped`"}" "application/json; charset=utf-8" 400
      }
      continue
    }

    if ($request.Path -like "/api/companies/*") {
      $inn = (($request.Path -replace "^/api/companies/", "") -replace "\D+", "")
      if (-not (Test-Path $CompanyRegistryPath -PathType Leaf)) {
        Send-Text $stream '{"error":"company registry is empty"}' "application/json; charset=utf-8" 404
        continue
      }
      $registry = ConvertTo-PlainHashtable (Get-Content $CompanyRegistryPath -Raw -Encoding UTF8 | ConvertFrom-Json)
      if (-not $registry.companies.ContainsKey($inn)) {
        Send-Text $stream '{"error":"company not found"}' "application/json; charset=utf-8" 404
        continue
      }
      Send-Text $stream ($registry.companies[$inn] | ConvertTo-Json -Depth 50) "application/json; charset=utf-8"
      continue
    }

    $relative = $request.Path.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
    $relative = $relative -replace "/", "\"
    $path = Join-Path $Root $relative
    $resolvedRoot = [IO.Path]::GetFullPath($Root)
    $resolvedPath = [IO.Path]::GetFullPath($path)
    if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Text $stream "Forbidden" "text/plain; charset=utf-8" 403
      continue
    }
    if (-not (Test-Path $resolvedPath -PathType Leaf)) {
      Send-Text $stream "Not found" "text/plain; charset=utf-8" 404
      continue
    }
    Send-Bytes $stream ([IO.File]::ReadAllBytes($resolvedPath)) (Get-ContentType $resolvedPath)
  }
  catch {
    try {
      if ($request -and $request.Path -like "/api/*") {
        $escaped = ($_.Exception.Message -replace "\\", "\\") -replace '"', '\"'
        Send-Text $stream "{`"error`":`"$escaped`"}" "application/json; charset=utf-8" 500
      }
      else {
        Send-Text $stream $_.Exception.Message "text/plain; charset=utf-8" 500
      }
    } catch {}
  }
  finally {
    $client.Close()
  }
}

