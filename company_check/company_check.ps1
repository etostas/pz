param(
  [Parameter(Mandatory = $true)]
  [string]$Inn,

  [string]$Out = "",

  [string]$CheckoApiKey = "",

  [string]$DgisApiKey = "",

  [string]$SearchQuery = "",

  [switch]$JsonOnly,

  [switch]$NoSave,

  [switch]$QuickOnly
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$SourceTimings = [System.Collections.ArrayList]::new()

function Add-TimedSource {
  param(
    [System.Collections.ArrayList]$Target,
    [string]$Name,
    [scriptblock]$Block
  )
  $startedAt = Get-Date
  Write-Verbose "Start source: $Name"
  try {
    $result = & $Block
    if ($null -ne $result) { [void]$Target.Add($result) }
  }
  finally {
    $elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
    [void]$script:SourceTimings.Add([ordered]@{ source = $Name; seconds = $elapsed })
    Write-Verbose "Finish source: $Name, ${elapsed}s"
  }
}

if ([string]::IsNullOrWhiteSpace($CheckoApiKey)) {
  foreach ($target in @("Process", "User", "Machine")) {
    $value = [Environment]::GetEnvironmentVariable("CHECKO_API_KEY", $target)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $CheckoApiKey = $value
      break
    }
  }
}

if ([string]::IsNullOrWhiteSpace($DgisApiKey)) {
  foreach ($target in @("Process", "User", "Machine")) {
    $value = [Environment]::GetEnvironmentVariable("DGIS_API_KEY", $target)
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $DgisApiKey = $value
      break
    }
  }
}

if (-not $Out) {
  $Out = $PSScriptRoot
}

function Normalize-Inn {
  param([string]$Value)
  $digits = ($Value -replace "\D+", "")
  if ($digits.Length -notin @(10, 12, 13, 15)) {
    throw "Identifier must contain 10/12 digits for INN, 13 digits for OGRN or 15 digits for OGRNIP."
  }
  return $digits
}

function New-SourceResult {
  param(
    [string]$Code,
    [string]$Title,
    [string]$Status,
    [string]$Url,
    [hashtable]$Collected = @{},
    [array]$Signals = @(),
    [array]$Errors = @(),
    [array]$NextActions = @()
  )
  [ordered]@{
    code = $Code
    title = $Title
    status = $Status
    url = $Url
    collected = $Collected
    signals = $Signals
    errors = $Errors
    next_actions = $NextActions
  }
}

function ConvertFrom-Mojibake {
  param($Value)
  if ($null -eq $Value) { return "" }
  $text = "$Value"
  if ($text -notmatch "Ð|Ñ") { return $text }
  try {
    return [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::GetEncoding(28591).GetBytes($text))
  }
  catch {
    return $text
  }
}

function Invoke-FnsEgrul {
  param([string]$Inn)
  $baseUrl = "https://egrul.nalog.ru/"
  $pageUrl = "https://egrul.nalog.ru/index.html"
  $next = @(
    "Verify legal name, status, OGRN, KPP, address and director.",
    "If automatic FNS collection fails, attach an EGRUL extract manually."
  )
  try {
    $oldProxyVars = @{
      HTTP_PROXY = $env:HTTP_PROXY
      HTTPS_PROXY = $env:HTTPS_PROXY
      ALL_PROXY = $env:ALL_PROXY
    }
    $env:HTTP_PROXY = ""
    $env:HTTPS_PROXY = ""
    $env:ALL_PROXY = ""
    $search = Invoke-RestMethod -Uri "https://egrul.nalog.ru/" -Method Post -Body @{ query = $Inn } -Headers @{
      "User-Agent" = "PlusZvenoCompanyCheck/0.1 contact: check@pluszveno.local"
      "Accept" = "application/json,text/plain,*/*"
    } -TimeoutSec 20

    if (-not $search.t) {
      return New-SourceResult -Code "fns_egrul" -Title "FNS EGRUL/EGRIP" -Status "error" -Url $baseUrl -Errors @("FNS did not return a search token.") -NextActions $next
    }

    Start-Sleep -Milliseconds 600
    $resultUrl = "${baseUrl}search-result/$($search.t)"
    $data = Invoke-RestMethod -Uri $resultUrl -Method Get -Headers @{
      "User-Agent" = "PlusZvenoCompanyCheck/0.1 contact: check@pluszveno.local"
      "Accept" = "application/json,text/plain,*/*"
    } -TimeoutSec 20

    if (-not $data.rows -or $data.rows.Count -eq 0) {
      return New-SourceResult -Code "fns_egrul" -Title "FNS EGRUL/EGRIP" -Status "ok" -Url $resultUrl -Signals @(
        @{ level = "warning"; message = "No FNS rows found for this INN." }
      ) -NextActions $next
    }

    $row = $data.rows[0]
    $card = [ordered]@{
      name = ConvertFrom-Mojibake $row.n
      ogrn = $row.o
      inn = $row.i
      kpp = $row.p
      address = ConvertFrom-Mojibake $row.a
      director = ConvertFrom-Mojibake $row.g
      status = if ($row.e) { ConvertFrom-Mojibake $row.e } else { ConvertFrom-Mojibake $row.r }
      registration_date = $row.d
      entity_type = ConvertFrom-Mojibake $row.k
    }
    $signals = @()
    $statusText = "$($card.status)".ToLowerInvariant()
    if ($statusText -match "likvid|prekrash|nedey") {
      $signals += @{ level = "critical"; message = "FNS status may indicate inactive or terminated company." }
    }
    return New-SourceResult -Code "fns_egrul" -Title "FNS EGRUL/EGRIP" -Status "ok" -Url $resultUrl -Collected $card -Signals $signals -NextActions $next
  }
  catch {
    $next += "Откройте egrul.nalog.ru вручную и проверьте карточку по ИНН."
    return New-SourceResult -Code "fns_egrul" -Title "ФНС ЕГРЮЛ/ЕГРИП" -Status "manual_review" -Url $pageUrl -Collected @{
      searched_inn = $Inn
      manual_reason = "Публичная страница ФНС доступна вручную, автоматический endpoint может отвечать нестабильно."
    } -NextActions $next
  }
  finally {
    if ($oldProxyVars) {
      $env:HTTP_PROXY = $oldProxyVars.HTTP_PROXY
      $env:HTTPS_PROXY = $oldProxyVars.HTTPS_PROXY
      $env:ALL_PROXY = $oldProxyVars.ALL_PROXY
    }
  }
}

function New-ManualSource {
  param(
    [string]$Code,
    [string]$Title,
    [string]$Url,
    [array]$Fields
  )
  return New-SourceResult -Code $Code -Title $Title -Status "manual_review" -Url $Url -Collected @{
    planned_fields = $Fields
  } -NextActions @(
    "Open the source and save the check result in the company card.",
    "Replace this manual source with an automatic adapter when a stable API/feed is available."
  )
}

function New-CheckoContactsSource {
  param($CheckoResult)
  $collected = [ordered]@{
    official_site = $CheckoResult.collected.official_site
    official_email = $CheckoResult.collected.official_email
    official_phone = $CheckoResult.collected.official_phone
    legal_address = $CheckoResult.collected.address
  }
  $hasContacts = $collected.official_site -or $collected.official_email -or $collected.official_phone -or $collected.legal_address
  return New-SourceResult -Code "contacts_public" -Title "Official company contacts from Checko" -Status $(if ($hasContacts) { "ok" } else { "not_found" }) -Url $CheckoResult.url -Collected $collected -NextActions @(
    "Confirm the contact channel before sending a code or accepting representative access."
  )
}

function New-BoNalogSource {
  param(
    [string]$Inn,
    $CheckoResult
  )
  $collected = [ordered]@{
    inn = $Inn
    revenue = $CheckoResult.collected.revenue
    net_profit = $CheckoResult.collected.net_profit
    assets = $CheckoResult.collected.assets
    reporting_source = "bo.nalog.gov.ru"
  }
  $hasAccounting = $collected.revenue -or $collected.net_profit -or $collected.assets
  return New-SourceResult -Code "bo_nalog" -Title "FNS accounting reports" -Status $(if ($hasAccounting) { "ok" } else { "manual_review" }) -Url "https://bo.nalog.gov.ru/search?query=$([System.Uri]::EscapeDataString($Inn))" -Collected $collected -NextActions @(
    "Open the organization card on bo.nalog.gov.ru and verify revenue, profit and assets for the latest year."
  )
}

function New-KadArbitrSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    $CheckoResult = $null
  )
  $query = if ($CompanyName) { $CompanyName } else { $Inn }
  $checkoArbitration = if ($CheckoResult -and $CheckoResult.collected) { $CheckoResult.collected.arbitration } else { $null }
  $hasCheckoCases = $false
  if ($CheckoResult -and $CheckoResult.collected) {
    $hasCheckoCases = ($CheckoResult.collected.arbitration_plaintiff_summary -and $CheckoResult.collected.arbitration_plaintiff_summary -notmatch "количество не найдено|нет данных") -or
      ($CheckoResult.collected.arbitration_defendant_summary -and $CheckoResult.collected.arbitration_defendant_summary -notmatch "количество не найдено|нет данных")
  }
  $collected = [ordered]@{
    search_inn = $Inn
    search_company_name = $CompanyName
    search_query = $query
    plaintiff_summary = if ($CheckoResult -and $CheckoResult.collected) { $CheckoResult.collected.arbitration_plaintiff_summary } else { "" }
    defendant_summary = if ($CheckoResult -and $CheckoResult.collected) { $CheckoResult.collected.arbitration_defendant_summary } else { "" }
    plaintiff_last_year_summary = if ($CheckoResult -and $CheckoResult.collected) { $CheckoResult.collected.arbitration_plaintiff_last_year_summary } else { "" }
    defendant_last_year_summary = if ($CheckoResult -and $CheckoResult.collected) { $CheckoResult.collected.arbitration_defendant_last_year_summary } else { "" }
    source_note = if ($hasCheckoCases) { "Данные взяты из карточки Checko со ссылкой на Картотеку арбитражных дел." } else { "Автоматически не найдено в агрегированных данных Checko." }
  }
  if ($checkoArbitration) { $collected.raw_checko_arbitration = $checkoArbitration }
  $status = if ($hasCheckoCases) { "ok" } else { "not_found" }
  return New-SourceResult -Code "kad_arbitr" -Title "Арбитражные дела" -Status $status -Url "https://kad.arbitr.ru/" -Collected $collected -NextActions @(
    "Для спорных случаев открыть kad.arbitr.ru и сверить участников, суммы и статус дела.",
    "В отчете показывать роли компании: истец, ответчик, суммы и период."
  )
}

function ConvertFrom-HtmlText {
  param([string]$Value)
  if (-not $Value) { return "" }
  $decoded = [System.Net.WebUtility]::HtmlDecode($Value)
  $decoded = $decoded -replace "<[^>]+>", " "
  $decoded = $decoded -replace "\s+", " "
  return $decoded.Trim()
}

function Get-RegexValue {
  param(
    [string]$Text,
    [string]$Pattern
  )
  $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($match.Success -and $match.Groups.Count -gt 1) {
    return (ConvertFrom-HtmlText $match.Groups[1].Value)
  }
  return ""
}

function Get-PlainText {
  param([string]$Html)
  return ConvertFrom-HtmlText $Html
}

function ConvertFrom-JsHtmlText {
  param([string]$Value)
  if (-not $Value) { return "" }
  $value = $Value -replace "\\u0026", "&"
  $value = $value -replace "\\u003c", "<"
  $value = $value -replace "\\u003e", ">"
  return ConvertFrom-HtmlText $value
}

function Get-CheckoFinance {
  param([string]$Html)
  $result = [ordered]@{
    year = ""
    revenue = ""
    revenue_change_percent = ""
    net_profit = ""
    net_profit_change_percent = ""
    capital = ""
    capital_change_percent = ""
  }
  $yearMatch = [regex]::Match($Html, 'window\.FS_HUGE=\{.*?last_year:"([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($yearMatch.Success) { $result.year = $yearMatch.Groups[1].Value }
  $rowMatch = [regex]::Match($Html, 'window\.FS_HUGE=\{.*rows:\[.*\[(\d+),(-?\d+|null),"([^"]*)",(\d+),(-?\d+|null),"([^"]*)",(\d+),(-?\d+|null),"([^"]*)"\]\]\};', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($rowMatch.Success) {
    $result.revenue = ConvertFrom-JsHtmlText $rowMatch.Groups[3].Value
    $result.revenue_change_percent = $rowMatch.Groups[2].Value
    $result.net_profit = ConvertFrom-JsHtmlText $rowMatch.Groups[6].Value
    $result.net_profit_change_percent = $rowMatch.Groups[5].Value
    $result.capital = ConvertFrom-JsHtmlText $rowMatch.Groups[9].Value
    $result.capital_change_percent = $rowMatch.Groups[8].Value
  }
  return $result
}

function Get-CheckoFinanceHistory {
  param([string]$Html)
  $items = @()
  $match = [regex]::Match($Html, 'window\.FS_HUGE=\{years:\[(.*?)\],last_year:"([^"]*)",rows:\[(.*?)\]\};', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $match.Success) { return $items }
  $years = @([regex]::Matches($match.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
  $rowMatches = [regex]::Matches($match.Groups[3].Value, '\[(\d+|null),(-?\d+|null),"([^"]*)",(\d+|null),(-?\d+|null),"([^"]*)",(\d+|null),(-?\d+|null),"([^"]*)"\]', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  for ($i = 0; $i -lt [Math]::Min($years.Count, $rowMatches.Count); $i++) {
    $row = $rowMatches[$i]
    $items += [ordered]@{
      year = $years[$i]
      revenue = ConvertFrom-JsHtmlText $row.Groups[3].Value
      revenue_change_percent = if ($row.Groups[2].Value -ne "null") { $row.Groups[2].Value } else { "" }
      net_profit = ConvertFrom-JsHtmlText $row.Groups[6].Value
      net_profit_change_percent = if ($row.Groups[5].Value -ne "null") { $row.Groups[5].Value } else { "" }
      capital = ConvertFrom-JsHtmlText $row.Groups[9].Value
      capital_change_percent = if ($row.Groups[8].Value -ne "null") { $row.Groups[8].Value } else { "" }
    }
  }
  return $items
}

function Format-CheckoFinanceHistory {
  param([array]$Items)
  if (-not $Items -or $Items.Count -eq 0) { return "" }
  return (($Items | ForEach-Object {
    $parts = @()
    if ($_.revenue) { $parts += "выручка $($_.revenue)" }
    if ($_.net_profit) { $parts += "прибыль $($_.net_profit)" }
    if ($_.capital) { $parts += "капитал $($_.capital)" }
    "$($_.year): $($parts -join ', ')"
  }) -join "; ")
}

function Get-CheckoStaffHistory {
  param([string]$Html)
  $items = @()
  $section = Get-SectionHtml $Html "staff"
  if (-not $section) { return $items }
  $matches = [regex]::Matches($section, '<tr>\s*<td[^>]*>(\d{4})\s*г\.</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($match in $matches) {
    $items += [ordered]@{
      year = $match.Groups[1].Value
      staff_count = ConvertFrom-HtmlText $match.Groups[2].Value
      average_monthly_salary = ConvertFrom-HtmlText $match.Groups[3].Value
    }
  }
  return $items
}

function Format-CheckoStaffHistory {
  param([array]$Items)
  if (-not $Items -or $Items.Count -eq 0) { return "" }
  return (($Items | ForEach-Object { "$($_.year): $($_.staff_count), средняя зарплата $($_.average_monthly_salary)" }) -join "; ")
}

function Get-CheckoEnforcementText {
  param(
    [string]$Html,
    [string]$CompanyName
  )
  $section = Get-SectionHtml $Html "enforcements"
  if (-not $section) { return "Секция исполнительных производств на карточке Checko не найдена." }
  $text = (ConvertFrom-HtmlText $section) -replace "\s+", " "
  $text = $text.Trim()
  if ($text -match "Нет сведений[^\.]*исполнительных производствах") {
    $name = if ($CompanyName) { $CompanyName } else { "компании" }
    return "Нет сведений об открытых в отношении $name исполнительных производствах."
  }
  return $text -replace "^Исполнительные производства\s*", ""
}

function Get-CheckoSuccessorText {
  param([string]$PlainText, [string]$CurrentInn = "")
  if (-not $PlainText) { return "" }
  $patterns = @(
    'правопреемник(?:ом)?\s*[:\-]?\s*(ООО\s+"[^"]+"(?:\s*"[^"]+")?|АО\s+"[^"]+"|ПАО\s+"[^"]+"|ЗАО\s+"[^"]+"|ОБЩЕСТВО\s+С\s+ОГРАНИЧЕННОЙ\s+ОТВЕТСТВЕННОСТЬЮ\s+"[^"]+")',
    'правопреемник(?:ом)?[^А-ЯЁ]{0,80}([А-ЯЁA-Z]{2,}\s+"[^"]+"(?:\s*"[^"]+")?)',
    'приемник(?:ом)?\s*[:\-]?\s*(ООО\s+"[^"]+"(?:\s*"[^"]+")?)'
  )
  foreach ($pattern in $patterns) {
    $match = [regex]::Match($PlainText, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $name = (ConvertFrom-HtmlText $match.Groups[1].Value).Trim()
      $tailLength = [Math]::Min(220, $PlainText.Length - $match.Index)
      $tail = if ($tailLength -gt 0) { $PlainText.Substring($match.Index, $tailLength) } else { "" }
      $innMatch = [regex]::Match($tail, 'ИНН\s*([0-9]{10,12})', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($innMatch.Success -and $name -notmatch 'ИНН' -and $innMatch.Groups[1].Value -ne $CurrentInn) { return "$name (ИНН $($innMatch.Groups[1].Value))" }
      return $name
    }
  }
  return ""
}

function Format-RelatedCompaniesList {
  param($RelatedCompanies)
  if (-not $RelatedCompanies -or -not $RelatedCompanies.all_companies) { return "" }
  $items = @()
  foreach ($company in @($RelatedCompanies.all_companies | Where-Object { -not $_.is_current_company -and $_.is_construction_smr } | Select-Object -First 20)) {
    $label = ConvertFrom-HtmlText $company.name
    if ($company.inn) { $label = "$label (ИНН $($company.inn))" }
    if ($label) { $items += $label }
  }
  if ($items.Count -eq 0 -and @($RelatedCompanies.all_companies).Count -gt 0) {
    return "Действующие связанные компании строительной отрасли / СМР не найдены."
  }
  return ($items -join ", ")
}

function Test-ConstructionSmrOkved {
  param([string]$Code)
  if (-not $Code) { return $false }
  # Строительная отрасль / СМР: строительство зданий, инженерных сооружений и специализированные строительные работы.
  return $Code -match '^(41|42|43)(\.|$)'
}

function Get-CheckoCompanyActivity {
  param(
    [string]$Url,
    [string]$FallbackStatus = ""
  )
  $result = [ordered]@{
    okved_code = ""
    okved_name = ""
    is_active = ($FallbackStatus -ne "has_warning_or_inactive")
    is_construction_smr = $false
    excluded_reason = ""
  }
  if (-not $Url) {
    $result.excluded_reason = "нет ссылки Checko"
    return $result
  }
  try {
    Start-Sleep -Milliseconds 350
    $page = Invoke-WebText $Url
    $html = $page.Content
    $plain = (Get-PlainText $html) -replace "\s+", " "
    if ($plain -match "ликвид|исключен|прекратил|недействующ") {
      $result.is_active = $false
      $result.excluded_reason = "ликвидирована/недействующая"
    }
    $activityMatch = [regex]::Match($html, '<div class="fw-700">Вид деятельности</div>\s*<div><a[^>]*>(.*?)</a>.*?<span[^>]*>([0-9]{2}(?:\.[0-9]{1,2}){0,3})</span>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($activityMatch.Success) {
      $result.okved_name = (ConvertFrom-HtmlText $activityMatch.Groups[1].Value).Trim()
      $result.okved_code = $activityMatch.Groups[2].Value
    }
    else {
      $activitySection = Get-SectionHtml $html "activity"
      $rowMatch = [regex]::Match($activitySection, '<tr>\s*<td[^>]*>([0-9]{2}(?:\.[0-9]{1,2}){0,3})</td>\s*<td[^>]*>(.*?)</td>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
      if ($rowMatch.Success) {
        $result.okved_code = $rowMatch.Groups[1].Value
        $result.okved_name = (ConvertFrom-HtmlText $rowMatch.Groups[2].Value).Trim()
      }
    }
    $result.is_construction_smr = Test-ConstructionSmrOkved $result.okved_code
    if ($result.is_active -and -not $result.is_construction_smr) {
      $result.excluded_reason = if ($result.okved_code) { "ОКВЭД не СМР/строительство" } else { "ОКВЭД не найден" }
    }
  }
  catch {
    $result.excluded_reason = "не удалось проверить ОКВЭД: $($_.Exception.Message)"
  }
  return $result
}

function Get-SectionHtml {
  param(
    [string]$Html,
    [string]$Id
  )
  $pattern = '<section id="' + [regex]::Escape($Id) + '".*?</section>'
  $match = [regex]::Match($Html, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($match.Success) { return $match.Value }
  return ""
}

function Get-FirstNumberAfter {
  param(
    [string]$Html,
    [string]$Marker
  )
  $markerIndex = $Html.IndexOf($Marker)
  if ($markerIndex -lt 0) { return "" }
  $chunk = $Html.Substring($markerIndex, [Math]::Min(1500, $Html.Length - $markerIndex))
  return Get-RegexValue $chunk '<div class="text-huge[^>]*>.*?<a[^>]*>(.*?)</a>'
}

function Get-FirstMoneyAfter {
  param(
    [string]$Html,
    [string]$Marker
  )
  $markerIndex = $Html.IndexOf($Marker)
  if ($markerIndex -lt 0) { return "" }
  $chunk = $Html.Substring($markerIndex, [Math]::Min(1800, $Html.Length - $markerIndex))
  return Get-RegexValue $chunk '<div class="mt-2">(.*?)<span'
}

function Get-CheckoLastYearCaseMetric {
  param(
    [string]$Html,
    [string]$Role,
    [string]$Metric
  )
  $roleIndex = $Html.IndexOf("role=$Role")
  if ($roleIndex -lt 0) { return "" }
  $chunk = $Html.Substring($roleIndex, [Math]::Min(6000, $Html.Length - $roleIndex))
  $lastYearIndex = $chunk.IndexOf("последн")
  if ($lastYearIndex -lt 0) { $lastYearIndex = $chunk.IndexOf("last") }
  if ($lastYearIndex -lt 0) { return "" }
  $lastYearChunk = $chunk.Substring($lastYearIndex, [Math]::Min(1800, $chunk.Length - $lastYearIndex))
  if ($Metric -eq "amount") {
    $amount = Get-RegexValue $lastYearChunk '<div class="mt-2">(.*?)<span'
    if (-not $amount) { $amount = Get-RegexValue $lastYearChunk '([0-9][0-9\s.,]*(?:тыс\.|млн|млрд)?\s*руб\.?)' }
    return ConvertFrom-HtmlText $amount
  }
  $count = Get-RegexValue $lastYearChunk '<a[^>]*>([0-9][0-9\s]*)</a>'
  if (-not $count) { $count = Get-RegexValue $lastYearChunk '([0-9][0-9\s]*)\s*(?:дел|дело|дела)' }
  return ConvertFrom-HtmlText $count
}

function Format-CheckoCaseSummary {
  param(
    [string]$Cases,
    [string]$Amount
  )
  $casesText = if ($Cases) { "$Cases шт." } else { "количество не найдено" }
  if ($Amount) { return "$casesText на сумму $Amount" }
  return $casesText
}

function Get-CheckoProcurementText {
  param(
    [string]$CompanyName,
    [string]$ProcurementCount
  )
  if ($ProcurementCount) {
    return "Найдены сведения об участии в госзакупках: $ProcurementCount. Смотреть карточку Checko."
  }
  $name = if ($CompanyName) { $CompanyName } else { "компании" }
  return "Сведения об участии $name в госзакупках в качестве поставщика или заказчика по 94-ФЗ, 44-ФЗ или 223-ФЗ отсутствуют. Согласно данным Федерального казначейства."
}

function Get-CheckoRnpText {
  param([string]$PlainText)
  if ($PlainText -match "не входит[^\.]{0,120}реестр недобросовестных поставщиков") {
    return "Не входит в реестр недобросовестных поставщиков."
  }
  if ($PlainText -match "реестр недобросовестных поставщиков") {
    return "Есть упоминание реестра недобросовестных поставщиков на Checko; требуется просмотр карточки."
  }
  return "Нет данных Checko по реестру недобросовестных поставщиков."
}

function Get-CheckoFacts {
  param([string]$Html)
  $facts = [ordered]@{ positive = @(); attention = @(); negative = @() }
  foreach ($pair in @(
    @{ key = "positive"; id = "green-facts" },
    @{ key = "attention"; id = "yellow-facts" },
    @{ key = "negative"; id = "red-facts" }
  )) {
    $block = Get-RegexValue $Html ('<ul class="tab-pane[^"]*" id="' + $pair.id + '".*?>(.*?)</ul>')
    if ($block) {
      $matches = [regex]::Matches($block, '<li>(.*?)</li>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
      foreach ($match in $matches) {
        $facts[$pair.key] += ConvertFrom-HtmlText $match.Groups[1].Value
      }
    }
  }
  return $facts
}

function Get-CheckoRatios {
  param([string]$Html)
  $result = [ordered]@{}
  $matches = [regex]::Matches($Html, '<span class="fcm [^"]+" data-bs-toggle="tooltip"[^>]*data-bs-title="([^"]*?=\s*(-?[0-9]+(?:\.[0-9]+)?%?)[^"]*?)"[^>]*>([^<]+)</span>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($match in $matches) {
    $code = (ConvertFrom-HtmlText $match.Groups[3].Value).Trim().ToLowerInvariant()
    $value = $match.Groups[2].Value
    $title = ConvertFrom-HtmlText $match.Groups[1].Value
    if ($code -in @("кфн", "кос", "днв", "ктл", "кбл", "кал", "рп", "рд", "ра")) {
      $latinKey = switch ($code) {
        "кфн" { "kfn" }
        "кос" { "kos" }
        "днв" { "dnv" }
        "ктл" { "ktl" }
        "кбл" { "kbl" }
        "кал" { "kal" }
        "рп" { "rp" }
        "рд" { "rd" }
        "ра" { "ra" }
      }
      $result[$latinKey] = $value
      $result["$($latinKey)_description"] = ($title -replace "\s+", " ").Trim()
    }
  }
  return $result
}

function Get-CheckoTimeline {
  param([string]$Html)
  $items = @()
  $matches = [regex]::Matches($Html, '<div class="timeline-event d-flex">(.*?)</div>\s*</div>\s*</div>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach ($match in ($matches | Select-Object -First 8)) {
    $eventHtml = $match.Groups[1].Value
    $date = Get-RegexValue $eventHtml '<div class="timeline-date">(.*?)</div>'
    $text = ConvertFrom-HtmlText $eventHtml
    if ($date -or $text) {
      $items += [ordered]@{ date = $date; text = $text }
    }
  }
  return $items
}

function Get-CheckoPersonCompanies {
  param(
    [string]$PersonUrl,
    [string]$CurrentInn
  )
  $result = [ordered]@{
    person_url = $PersonUrl
    leader_companies = @()
    founder_companies = @()
    all_companies = @()
    errors = @()
  }
  if (-not $PersonUrl) { return $result }
  try {
    $page = Invoke-WebText $PersonUrl
    $html = $page.Content
    foreach ($sectionInfo in @(
      @{ id = "leader"; key = "leader_companies"; role = "leader" },
      @{ id = "founder"; key = "founder_companies"; role = "founder" }
    )) {
      $section = Get-SectionHtml $html $sectionInfo.id
      if (-not $section) { continue }
      $rows = [regex]::Split($section, '<tr>')
      foreach ($row in ($rows | Select-Object -Skip 1)) {
        $endIndex = $row.IndexOf('</tr>')
        if ($endIndex -lt 0) { continue }
        $rowHtml = $row.Substring(0, $endIndex)
        $url = Get-RegexValue $rowHtml '<a[^>]*class="link fw-700 d-block"[^>]*href="([^"]+)"'
        $name = Get-RegexValue $rowHtml '<a[^>]*class="link fw-700 d-block"[^>]*>(.*?)</a>'
        $ogrn = Get-RegexValue $rowHtml '>([0-9]{13,15})</span>'
        $inn = ""
        $numbers = [regex]::Matches($rowHtml, '>([0-9]{10,12})</span>')
        foreach ($number in $numbers) {
          $candidate = $number.Groups[1].Value
          if ($candidate -ne $ogrn) {
            $inn = $candidate
            break
          }
        }
        $status = if ($rowHtml -match 'text-danger') { "has_warning_or_inactive" } elseif ($rowHtml -match 'check-icon') { "active" } else { "unknown" }
        $revenue = Get-RegexValue $rowHtml '<div class="fw-700 mt-2 text-nowrap">.*?</div>\s*<div class="text-nowrap">(.*?)</div>'
        $company = [ordered]@{
          role = $sectionInfo.role
          name = $name
          inn = $inn
          ogrn = $ogrn
          status = $status
          revenue_or_capital_first_metric = $revenue
          url = if ($url) { "https://checko.ru$url" } else { "" }
          is_current_company = ($inn -eq $CurrentInn)
        }
        $result[$sectionInfo.key] += $company
      }
    }
    $seen = @{}
    $enrichedCount = 0
    foreach ($company in @($result.leader_companies + $result.founder_companies)) {
      $key = if ($company.inn) { $company.inn } else { $company.url }
      if ($key -and -not $seen.ContainsKey($key)) {
        $seen[$key] = $true
        if ($enrichedCount -lt 12) {
          $activity = Get-CheckoCompanyActivity $company.url $company.status
          $company["okved_code"] = $activity.okved_code
          $company["okved_name"] = $activity.okved_name
          $company["is_active"] = $activity.is_active
          $company["is_construction_smr"] = $activity.is_construction_smr
          $company["excluded_reason"] = $activity.excluded_reason
          $enrichedCount += 1
        }
        else {
          $company["is_active"] = ($company.status -ne "has_warning_or_inactive")
          $company["is_construction_smr"] = $false
          $company["excluded_reason"] = "не проверено: превышен лимит связанных компаний за один отчет"
        }
        $result.all_companies += $company
      }
    }
  }
  catch {
    $result.errors += $_.Exception.Message
  }
  return $result
}

function Normalize-CompanyQuery {
  param([string]$Name)
  if (-not $Name) { return "" }
  $value = [System.Net.WebUtility]::HtmlDecode($Name)
  $value = $value -replace "[^\p{L}\p{N}]+", " "
  $value = $value -replace "\s+", " "
  return $value.Trim()
}

function Select-UniqueTextPreserveOrder {
  param([array]$Values)
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($Values)) {
    $text = "$value"
    if (-not $text) { continue }
    if ($seen.Add($text)) { $result.Add($text) }
  }
  return @($result)
}

function Get-CompanyLegalStopWords {
  return @(
    "ooo", "ооо", "zao", "зао", "pao", "пао", "ao", "ао", "nao", "нао", "ip", "ип",
    "общество", "ограниченной", "ответственностью", "акционерное", "непубличное",
    "публичное", "закрытое", "индивидуальный", "предприниматель", "компания"
  )
}

function Get-CompanyQuotedNames {
  param([string]$CompanyName)
  $result = New-Object System.Collections.Generic.List[string]
  if (-not $CompanyName) { return $result }
  $matches = [regex]::Matches($CompanyName, '["«]([^"»]+)["»]?')
  foreach ($match in $matches) {
    $value = Normalize-CompanyQuery $match.Groups[1].Value
    if ($value -and -not $result.Contains($value)) { $result.Add($value) }
  }
  return $result
}

function Remove-CompanyLegalForm {
  param([string]$CompanyName)
  $clean = Normalize-CompanyQuery $CompanyName
  if (-not $clean) { return "" }
  $quoted = @(Get-CompanyQuotedNames $CompanyName)
  if ($quoted.Count -gt 0) { return $quoted[0] }
  $patterns = @(
    '^(?:непубличное\s+акционерное\s+общество|публичное\s+акционерное\s+общество|закрытое\s+акционерное\s+общество|акционерное\s+общество)\s+',
    '^(?:общество\s+с\s+ограниченной\s+ответственностью)\s+',
    '^(?:индивидуальный\s+предприниматель)\s+',
    '^(?:ооо|ао|пао|зао|нао|ип)\s+'
  )
  foreach ($pattern in $patterns) {
    $clean = [regex]::Replace($clean, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  }
  $words = @($clean -split "\s+" | Where-Object {
    $_.Length -ge 2 -and $_.ToLowerInvariant() -notin (Get-CompanyLegalStopWords)
  })
  return (($words -join " ") -replace "\s+", " ").Trim()
}

function Test-ShortLegalCompanyName {
  param([string]$CompanyName)
  $clean = Normalize-CompanyQuery $CompanyName
  if (-not $clean) { return $false }
  return $clean -match '^(ооо|ао|пао|зао|нао|ип)\s+' -or $clean -match '^(ooo|ao|pao|zao|nao|ip)\s+'
}

function Get-GenericCompanyAbbreviationWords {
  # Generic construction abbreviations must not be used as standalone search keys.
  # Example: СМК usually means "строительно-монтажная компания" and may point to unrelated companies.
  return @("sk", "ск", "smk", "смк", "smu", "сму")
}

function Get-CompanyAbbreviationExpansions {
  return @{
    "спс" = @("сибпромстрой")
    "sps" = @("sibpromstroi")
  }
}

$script:RussianCityNames = $null

function Get-RussianCityNames {
  if ($null -ne $script:RussianCityNames) { return $script:RussianCityNames }
  $script:RussianCityNames = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $fallback = @("Уфа", "Челябинск", "Москва", "Санкт-Петербург", "Екатеринбург", "Новосибирск", "Казань", "Нижний Новгород", "Краснодар", "Пермь", "Тюмень")
  foreach ($city in $fallback) { [void]$script:RussianCityNames.Add((Normalize-CompanyQuery $city).ToLowerInvariant()) }
  $citiesPath = Join-Path (Split-Path -Parent $PSScriptRoot) "data\russian_cities.json"
  if (Test-Path $citiesPath -PathType Leaf) {
    try {
      $cities = Get-Content $citiesPath -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach ($city in @($cities)) {
        if ($city.name) { [void]$script:RussianCityNames.Add((Normalize-CompanyQuery $city.name).ToLowerInvariant()) }
      }
    }
    catch {}
  }
  return $script:RussianCityNames
}

function Normalize-CityName {
  param([string]$Value)
  $clean = Normalize-CompanyQuery $Value
  if (-not $clean) { return "" }
  $clean = $clean -replace '^(о|округ|город|городской|муниципальный)\s+', ''
  $clean = $clean -replace '^город\s+', ''
  $clean = ($clean -replace "\s+", " ").Trim()
  $cities = Get-RussianCityNames
  $lower = $clean.ToLowerInvariant()
  if ($cities.Contains($lower)) { return (Get-Culture).TextInfo.ToTitleCase($lower) }
  $tokens = @($clean -split "\s+" | Where-Object { $_ })
  for ($i = 0; $i -lt $tokens.Count; $i++) {
    for ($len = [Math]::Min(3, $tokens.Count - $i); $len -ge 1; $len--) {
      $candidate = (($tokens | Select-Object -Skip $i -First $len) -join " ").ToLowerInvariant()
      if ($cities.Contains($candidate)) { return (Get-Culture).TextInfo.ToTitleCase($candidate) }
    }
  }
  return $clean
}

function Get-MeaningfulCompanyWords {
  param([string]$CompanyName)
  $legalStop = Get-CompanyLegalStopWords
  $genericStop = Get-GenericCompanyAbbreviationWords
  $words = @((Normalize-CompanyQuery $CompanyName) -split "\s+" | Where-Object {
    $_.Length -ge 2 -and $_.ToLowerInvariant() -notin $legalStop
  })
  $hasNonGeneric = @($words | Where-Object { $_.ToLowerInvariant() -notin $genericStop }).Count -gt 0
  return $words | Where-Object {
    $lower = $_.ToLowerInvariant()
    $lower -notin $genericStop -or $hasNonGeneric
  }
}

function Get-CityFromAddress {
  param([string]$Address)
  if (-not $Address) { return "" }
  $cityMatches = [regex]::Matches($Address, '(?:^|,\s*)(?:г\.|г\s+|город\s+)\s*(?!о\.)([А-Яа-яЁёA-Za-z\-\s]+?)(?:,|$)')
  foreach ($matchItem in $cityMatches) {
    $city = Normalize-CityName $matchItem.Groups[1].Value
    if ($city -and (Get-RussianCityNames).Contains((Normalize-CompanyQuery $city).ToLowerInvariant())) { return $city }
  }
  $districtMatch = [regex]::Match($Address, 'г\.\s*о\.\s*(?:город\s*)?([А-Яа-яЁёA-Za-z\-\s]+?)(?:,|$)')
  if ($districtMatch.Success) {
    $city = Normalize-CityName $districtMatch.Groups[1].Value
    if ($city) { return $city }
  }
  $match = [regex]::Match($Address, 'город\s*([А-Яа-яЁёA-Za-z\-\s]+?)(?:,|$)')
  if ($match.Success) { return Normalize-CityName $match.Groups[1].Value }
  return ""
}

function Get-AddressParts {
  param([string]$Address)
  $city = Get-CityFromAddress $Address
  $street = ""
  $house = ""
  if ($Address) {
    $streetMatch = [regex]::Match($Address, '(?:ул\.|улица|пр-кт|проспект|пер\.|переулок|ш\.|шоссе|наб\.|набережная|б-р|бульвар)\s*([А-Яа-яЁёA-Za-z0-9\-\s]+?)(?:,|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($streetMatch.Success) { $street = Normalize-CompanyQuery $streetMatch.Groups[1].Value }
    $houseMatch = [regex]::Match($Address, '(?:д\.|дом|здание|зд\.)\s*([0-9]+[А-Яа-яA-Za-z0-9\/\-]*)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($houseMatch.Success) { $house = (Normalize-CompanyQuery $houseMatch.Groups[1].Value).ToLowerInvariant() }
    if (-not $house) {
      $fallbackHouse = [regex]::Match($Address, ',\s*([0-9]+[А-Яа-яA-Za-z0-9\/\-]*)\s*(?:,|$)')
      if ($fallbackHouse.Success) { $house = (Normalize-CompanyQuery $fallbackHouse.Groups[1].Value).ToLowerInvariant() }
    }
  }
  return [ordered]@{
    city = $city
    street = $street
    house = $house
  }
}

function Get-FinanceHistoryItemValue {
  param(
    [array]$FinanceHistory,
    [string]$Year,
    [string]$Field
  )
  if (-not $FinanceHistory -or -not $Year -or -not $Field) { return "" }
  $item = @($FinanceHistory | Where-Object { "$($_.year)" -eq "$Year" } | Select-Object -First 1)
  if ($item.Count -eq 0) { return "" }
  return $item[0].$Field
}

function Get-2GisCitySlug {
  param([string]$City)
  $normalized = (Normalize-CompanyQuery $City).ToLowerInvariant()
  $map = @{
    "челябинск" = "chelyabinsk"
    "москва" = "moscow"
    "санкт петербург" = "spb"
    "екатеринбург" = "ekaterinburg"
    "новосибирск" = "novosibirsk"
    "казань" = "kazan"
    "нижний новгород" = "n_novgorod"
    "краснодар" = "krasnodar"
    "уфа" = "ufa"
    "пермь" = "perm"
    "тюмень" = "tyumen"
  }
  if ($map.ContainsKey($normalized)) { return $map[$normalized] }
  return ""
}

function Get-2GisCityPoint {
  param([string]$City)
  $normalized = (Normalize-CompanyQuery $City).ToLowerInvariant()
  $map = @{
    "челябинск" = "61.4026,55.1599"
    "москва" = "37.6173,55.7558"
    "санкт петербург" = "30.3159,59.9391"
    "екатеринбург" = "60.6057,56.8389"
    "новосибирск" = "82.9204,55.0302"
    "казань" = "49.1221,55.7887"
    "нижний новгород" = "44.0059,56.3269"
    "краснодар" = "38.9753,45.0355"
    "уфа" = "55.9587,54.7351"
    "пермь" = "56.2294,58.0105"
    "тюмень" = "65.5343,57.1530"
  }
  if ($map.ContainsKey($normalized)) { return $map[$normalized] }
  return ""
}

function Get-YandexCityPath {
  param([string]$City)
  $normalized = (Normalize-CompanyQuery $City).ToLowerInvariant()
  $map = @{
    "челябинск" = "56/chelyabinsk"
    "москва" = "213/moscow"
    "санкт петербург" = "2/saint-petersburg"
    "екатеринбург" = "54/yekaterinburg"
    "новосибирск" = "65/novosibirsk"
    "казань" = "43/kazan"
    "нижний новгород" = "47/nizhny-novgorod"
    "краснодар" = "35/krasnodar"
    "уфа" = "172/ufa"
    "пермь" = "50/perm"
    "тюмень" = "55/tyumen"
  }
  if ($map.ContainsKey($normalized)) { return $map[$normalized] }
  return ""
}

function Get-MapCompanySearchName {
  param([string]$CompanyName)
  $clean = Normalize-CompanyQuery $CompanyName
  $withoutLegalForm = Remove-CompanyLegalForm $CompanyName
  if ($withoutLegalForm) { return $withoutLegalForm }
  $words = @($clean -split "\s+" | Where-Object { $_.Length -ge 2 -and $_.ToLowerInvariant() -notin (Get-CompanyLegalStopWords) })
  if ($words.Count -gt 0) { return (($words | Select-Object -First 4) -join " ") }
  return $clean
}

function Get-MapCompanySearchQueries {
  param([string]$CompanyName)
  $queries = New-Object System.Collections.Generic.List[string]
  $add = {
    param([string]$Value)
    $text = Normalize-CompanyQuery $Value
    if ($text -and -not $queries.Contains($text)) { $queries.Add($text) }
  }
  $clean = Normalize-CompanyQuery $CompanyName
  foreach ($quotedName in @(Get-CompanyQuotedNames $CompanyName)) {
    & $add $quotedName
  }
  & $add (Remove-CompanyLegalForm $CompanyName)
  if (Test-ShortLegalCompanyName $CompanyName) { & $add $clean }
  $meaningful = Get-MeaningfulCompanyWords $CompanyName
  if ($meaningful.Count -gt 0) {
    & $add (($meaningful | Select-Object -First 4) -join " ")
  }
  $brandTrigger = $clean -match '(констракшн|construction|инжиниринг|engineering|строй|строительство)'
  if ($brandTrigger) {
    $brandWords = @($meaningful | Where-Object { $_ -notmatch '^(констракшн|construction|инжиниринг|engineering|строй|строительство)$' })
    if ($brandWords.Count -gt 0) { & $add $brandWords[0] }
  }
  return $queries
}

function Test-MapAddressMatch {
  param(
    [string]$ExpectedAddress,
    [string]$FoundAddress
  )
  if (-not $ExpectedAddress -or -not $FoundAddress) { return $false }
  $expectedParts = Get-AddressParts $ExpectedAddress
  $foundParts = Get-AddressParts $FoundAddress
  $expectedCity = Normalize-CompanyQuery $expectedParts.city
  $foundCity = Normalize-CompanyQuery $foundParts.city
  $cityMatches = $false
  if ($expectedCity) {
    $foundAddressNormalized = (Normalize-CompanyQuery $FoundAddress).ToLowerInvariant()
    $cityMatches = $foundCity.ToLowerInvariant() -eq $expectedCity.ToLowerInvariant() -or $foundAddressNormalized -like "*$($expectedCity.ToLowerInvariant())*"
  }
  $streetMatches = $false
  if ($expectedParts.street) {
    $expectedStreetTokens = @((Normalize-CompanyQuery $expectedParts.street).ToLowerInvariant() -split "\s+" | Where-Object { $_.Length -ge 4 })
    $foundAddressNormalized = (Normalize-CompanyQuery $FoundAddress).ToLowerInvariant()
    foreach ($token in $expectedStreetTokens) {
      if ($foundAddressNormalized -like "*$token*") { $streetMatches = $true; break }
    }
  }
  $houseMatches = $false
  if ($expectedParts.house) {
    $foundAddressNormalized = (Normalize-CompanyQuery $FoundAddress).ToLowerInvariant()
    $houseMatches = $foundAddressNormalized -match "(^|\s)$([regex]::Escape($expectedParts.house))(\s|$)"
  }
  if ($expectedCity -and $expectedParts.street -and $expectedParts.house) {
    return $cityMatches -and $streetMatches -and $houseMatches
  }
  $expected = (Normalize-CompanyQuery $ExpectedAddress).ToLowerInvariant()
  $found = (Normalize-CompanyQuery $FoundAddress).ToLowerInvariant()
  $expectedTokens = @($expected -split "\s+" | Where-Object { $_.Length -ge 2 -and $_ -match '\d|[а-яёa-z]{4,}' })
  if ($expectedTokens.Count -eq 0) { return $false }
  $expectedNumbers = @($expectedTokens | Where-Object { $_ -match '^\d+[а-яёa-z]?$' })
  $expectedStreetWords = @($expectedTokens | Where-Object { $_ -match '^[а-яёa-z]{5,}$' -and $_ -notin @("область", "город", "округ", "помещ", "помещение", "офис", "улица") })
  $numberMatches = $false
  foreach ($token in $expectedNumbers) {
    if ($found -like "*$token*") { $numberMatches = $true; break }
  }
  $streetMatches = $false
  foreach ($token in $expectedStreetWords) {
    if ($found -like "*$token*") { $streetMatches = $true; break }
  }
  if ($numberMatches -and $streetMatches) { return $true }
  $matched = 0
  foreach ($token in $expectedTokens) {
    if ($found -like "*$token*") { $matched++ }
  }
  return $matched -ge [Math]::Min(4, [Math]::Max(2, [int][Math]::Ceiling($expectedTokens.Count * 0.45)))
}

function Test-2GisCandidateMatch {
  param(
    $Item,
    [string]$CompanyName,
    [string]$Address,
    [string]$City,
    [string]$QueryMode
  )
  if ($null -eq $Item) { return $false }
  $foundName = Normalize-CompanyQuery "$($Item.name) $($Item.org.name)"
  $foundAddress = Normalize-CompanyQuery "$($Item.address_name) $($Item.address_comment)"
  $nameTokens = @(Get-MeaningfulCompanyWords $CompanyName | Where-Object { $_.Length -ge 3 })
  $matchedNameTokens = 0
  foreach ($token in $nameTokens) {
    if ($foundName.ToLowerInvariant() -like "*$($token.ToLowerInvariant())*") { $matchedNameTokens++ }
  }
  $nameMatches = $nameTokens.Count -ge 2 -and $matchedNameTokens -ge [Math]::Min(2, $nameTokens.Count)
  if (-not $nameMatches -and $nameTokens.Count -eq 1 -and $nameTokens[0].Length -ge 6) {
    $nameMatches = $foundName.ToLowerInvariant() -like "*$($nameTokens[0].ToLowerInvariant())*"
  }
  $companyNameNormalized = (Normalize-CompanyQuery $CompanyName).ToLowerInvariant()
  $foundNameNormalized = $foundName.ToLowerInvariant()
  if (-not $nameMatches -and $companyNameNormalized -match '(^|\s)смк(\s|$)' -and $foundNameNormalized -match 'строительн' -and $foundNameNormalized -match 'монтаж') {
    $nameMatches = $matchedNameTokens -ge 1
  }
  $addressMatches = Test-MapAddressMatch $Address $foundAddress
  $cityMatches = $true
  if ($City) {
    $cityMatches = (Normalize-CompanyQuery "$foundAddress $($Item.address_name)").ToLowerInvariant() -like "*$((Normalize-CompanyQuery $City).ToLowerInvariant())*"
    if (-not $cityMatches -and $QueryMode -match "city|address") {
      $cityMatches = $true
    }
  }
  if ($QueryMode -eq "inn") { return $addressMatches -and $nameMatches }
  return ($addressMatches -and $nameMatches) -or ($nameMatches -and $cityMatches)
}

function Invoke-WebText {
  param(
    [string]$Url,
    [hashtable]$ExtraHeaders = @{}
  )
  $headers = @{
    "User-Agent" = "Mozilla/5.0 PlusZvenoCompanyCheck/0.2"
    "Accept" = "text/html,application/xhtml+xml,application/json,text/plain,*/*"
  }
  foreach ($key in $ExtraHeaders.Keys) {
    $headers[$key] = $ExtraHeaders[$key]
  }
  return Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $headers -MaximumRedirection 5 -TimeoutSec 25
}

function Find-JsonValue {
  param(
    $Value,
    [string[]]$Names,
    [int]$Depth = 0
  )
  if ($null -eq $Value -or $Depth -gt 8) { return $null }
  if ($Value -is [string] -or $Value -is [ValueType]) { return $null }

  if ($Value -is [System.Collections.IDictionary]) {
    foreach ($name in $Names) {
      if ($Value.Contains($name) -and $null -ne $Value[$name] -and "$($Value[$name])" -ne "") {
        return $Value[$name]
      }
    }
    foreach ($key in $Value.Keys) {
      $found = Find-JsonValue $Value[$key] $Names ($Depth + 1)
      if ($null -ne $found -and "$found" -ne "") { return $found }
    }
    return $null
  }

  if ($Value -is [System.Collections.IEnumerable]) {
    foreach ($item in $Value) {
      $found = Find-JsonValue $item $Names ($Depth + 1)
      if ($null -ne $found -and "$found" -ne "") { return $found }
    }
    return $null
  }

  foreach ($name in $Names) {
    $property = $Value.PSObject.Properties[$name]
    if ($property -and $null -ne $property.Value -and "$($property.Value)" -ne "") {
      return $property.Value
    }
  }
  foreach ($property in $Value.PSObject.Properties) {
    $found = Find-JsonValue $property.Value $Names ($Depth + 1)
    if ($null -ne $found -and "$found" -ne "") { return $found }
  }
  return $null
}

function ConvertTo-CompactText {
  param($Value)
  if ($null -eq $Value) { return "" }
  if ($Value -is [string] -or $Value -is [ValueType]) { return "$Value" }
  try {
    return ($Value | ConvertTo-Json -Depth 8 -Compress)
  }
  catch {
    return "$Value"
  }
}

function U {
  param([int[]]$Codes)
  return (-join ($Codes | ForEach-Object { [char]$_ }))
}

function Get-FirstJsonValue {
  param($Value, [string[]]$Names)
  $found = Find-JsonValue $Value $Names
  if ($found -is [System.Collections.IEnumerable] -and -not ($found -is [string]) -and -not ($found -is [System.Collections.IDictionary]) -and -not ($found -is [pscustomobject])) {
    foreach ($item in $found) { return $item }
  }
  return $found
}

function Get-NamedJsonText {
  param($Value)
  $name = Find-JsonValue $Value @((U @(1053,1072,1080,1084)), "name")
  if ($null -ne $name -and "$name" -ne "") { return ConvertTo-CompactText $name }
  return ConvertTo-CompactText $Value
}

function Merge-CollectedValue {
  param($Primary, $Fallback)
  if ($null -ne $Primary -and "$Primary" -ne "") { return $Primary }
  return $Fallback
}

function Get-CheckoTaxLineAmount {
  param(
    $TaxesRaw,
    [string]$Pattern
  )
  if ($null -eq $TaxesRaw) { return "" }
  $items = Find-JsonValue $TaxesRaw @((U @(1057,1074,1077,1076,1059,1087,1083)), "paid", "items")
  $sum = 0.0
  $found = $false
  foreach ($item in @($items)) {
    $name = Find-JsonValue $item @((U @(1053,1072,1080,1084)), "name")
    $amount = Find-JsonValue $item @((U @(1057,1091,1084,1084,1072)), "amount", "sum")
    if ("$name" -match $Pattern -and "$amount" -ne "") {
      $sum += [double]("$amount" -replace ",", ".")
      $found = $true
    }
  }
  if ($found) { return $sum.ToString("0.##", [Globalization.CultureInfo]::InvariantCulture) }
  return ""
}

function Add-SourceSearchAttempt {
  param(
    [array]$Attempts,
    [string]$Source,
    [string]$Query,
    [string]$Url,
    [string]$Status = "",
    [string]$Title = "",
    [string]$ReviewCount = "",
    [string]$Note = ""
  )
  return @($Attempts) + (, [ordered]@{
    source = $Source
    query = $Query
    url = $Url
    status = $Status
    title = $Title
    review_count = $ReviewCount
    note = $Note
  })
}

function Get-CheckoApiUrl {
  param([string]$BaseUrl, [string]$Inn, [string]$ApiKey)
  $separator = if ($BaseUrl.Contains("?")) { "&" } else { "?" }
  return "$BaseUrl${separator}key=$([System.Uri]::EscapeDataString($ApiKey))&inn=$([System.Uri]::EscapeDataString($Inn))"
}

function Invoke-CheckoApiSource {
  param(
    [string]$Inn,
    [string]$ApiKey
  )
  if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    return $null
  }

  $apiBaseUrl = if ($env:CHECKO_API_BASE) { $env:CHECKO_API_BASE } else { "https://api.checko.ru/v2/company" }
  $apiUrl = Get-CheckoApiUrl $apiBaseUrl $Inn $ApiKey
  $publicUrl = "https://checko.ru/search?query=$([System.Uri]::EscapeDataString($Inn))"
  try {
    $oldProxyVars = @{
      HTTP_PROXY = $env:HTTP_PROXY
      HTTPS_PROXY = $env:HTTPS_PROXY
      ALL_PROXY = $env:ALL_PROXY
    }
    $env:HTTP_PROXY = ""
    $env:HTTPS_PROXY = ""
    $env:ALL_PROXY = ""
    $response = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers @{
      "User-Agent" = "PlusZvenoCompanyCheck/0.3"
      "Accept" = "application/json"
    } -TimeoutSec 25

    $payload = if ($response.data) { $response.data } elseif ($response.company) { $response.company } else { $response }
    $name = Find-JsonValue $payload @((U @(1053,1072,1080,1084,1057,1086,1082,1088)), (U @(1053,1072,1080,1084,1055,1086,1083,1085)), "name", "full_name", "short_name", "legal_name")
    $ogrn = Find-JsonValue $payload @((U @(1054,1043,1056,1053)), "ogrn")
    $kpp = Find-JsonValue $payload @((U @(1050,1055,1055)), "kpp")
    $addressRaw = Find-JsonValue $payload @((U @(1070,1088,1040,1076,1088,1077,1089)), "address", "legal_address")
    $address = Find-JsonValue $addressRaw @((U @(1040,1076,1088,1077,1089,1056,1060)), "address", "legal_address")
    if (-not $address) { $address = $addressRaw }
    $directorRaw = Find-JsonValue $payload @((U @(1056,1091,1082,1086,1074,1086,1076)), "director", "head", "manager", "chief")
    $director = Find-JsonValue $directorRaw @((U @(1060,1048,1054)), "name", "full_name")
    if (-not $director) { $director = $directorRaw }
    $statusRaw = Find-JsonValue $payload @((U @(1057,1090,1072,1090,1091,1089)), "status", "state")
    $status = Get-NamedJsonText $statusRaw
    $liquidationRaw = Find-JsonValue $payload @((U @(1051,1080,1082,1074,1080,1076)), "liquidation")
    $liquidationDateApi = Find-JsonValue $liquidationRaw @((U @(1044,1072,1090,1072)), "date")
    $liquidationReason = Find-JsonValue $liquidationRaw @((U @(1053,1072,1080,1084)), "reason", "name")
    $registrationDate = Find-JsonValue $payload @((U @(1044,1072,1090,1072,1056,1077,1075)), (U @(1044,1072,1090,1072,1054,1043,1056,1053)), "registration_date", "registered_at", "ogrn_date")
    $staff = Find-JsonValue $payload @((U @(1057,1063,1056)), "staff_count", "employees", "employee_count")
    $revenue = Find-JsonValue $payload @("revenue", "income")
    $profit = Find-JsonValue $payload @("net_profit", "profit")
    $capitalRaw = Find-JsonValue $payload @((U @(1059,1089,1090,1050,1072,1087)), "capital", "charter_capital")
    $capital = Find-JsonValue $capitalRaw @((U @(1057,1091,1084,1084,1072)), "amount", "sum")
    if (-not $capital) { $capital = $capitalRaw }
    $taxesRaw = Find-JsonValue $payload @((U @(1053,1072,1083,1086,1075,1080)), "taxes_paid", "taxes")
    $taxes = Find-JsonValue $taxesRaw @((U @(1057,1091,1084,1059,1087,1083)), "amount", "sum")
    if (-not $taxes) { $taxes = $taxesRaw }
    $contactsRaw = Find-JsonValue $payload @((U @(1050,1086,1085,1090,1072,1082,1090,1099)), "contacts")
    $phones = Find-JsonValue $contactsRaw @((U @(1058,1077,1083)), "phones", "phone")
    $emails = Find-JsonValue $contactsRaw @((U @(1045,1084,1101,1081,1083)), "emails", "email")
    $site = Find-JsonValue $contactsRaw @((U @(1042,1077,1073,1057,1072,1081,1090)), "website", "site")
    $insurance = Get-CheckoTaxLineAmount $taxesRaw "Страховые|страховые"
    if (-not $insurance) { $insurance = Find-JsonValue $payload @("insurance_paid", "insurance") }
    $arbitration = Find-JsonValue $payload @("arbitration", "legal_cases")
    $fedresurs = Find-JsonValue $payload @("fedresurs")
    $procurements = Find-JsonValue $payload @("procurements", "purchases")
    $facts = Find-JsonValue $payload @("reliability_facts", "facts")
    $signals = @()
    $bankruptcy = Find-JsonValue $payload @((U @(1045,1060,1056,1057,1041)), "bankruptcy")
    $statusText = "$status".ToLowerInvariant()
    $liquidationText = "$liquidationDateApi $liquidationReason".ToLowerInvariant()
    if ($liquidationDateApi -or $statusText -match "ликвид|исключ|недействующ|не действует" -or $liquidationText -match "ликвид|исключ|недействующ|не действует" -or ($bankruptcy -and "$bankruptcy" -ne "")) {
      $stopMessage = if ($liquidationDateApi) {
        "Компания ликвидирована или исключена из ЕГРЮЛ $liquidationDateApi. $liquidationReason Проверку можно прекращать."
      }
      elseif ($bankruptcy -and "$bankruptcy" -ne "") {
        "У компании есть признак банкротства. Проверку можно прекращать."
      }
      else {
        "Компания ликвидирована, исключена из ЕГРЮЛ, недействующая или имеет признак банкротства. Проверку можно прекращать."
      }
      $signals += @{ level = "critical"; message = $stopMessage }
    }

    return New-SourceResult -Code "checko_company_card" -Title "Checko API company card" -Status "ok" -Url $publicUrl -Collected ([ordered]@{
      company_url = $publicUrl
      name = ConvertTo-CompactText $name
      inn = $Inn
      ogrn = ConvertTo-CompactText $ogrn
      kpp = ConvertTo-CompactText $kpp
      address = ConvertTo-CompactText $address
      director = ConvertTo-CompactText $director
      status = ConvertTo-CompactText $status
      liquidation_date_text = ConvertTo-CompactText $liquidationDateApi
      liquidation_reason = ConvertTo-CompactText $liquidationReason
      registration_date_text = ConvertTo-CompactText $registrationDate
      staff_count = ConvertTo-CompactText $staff
      revenue = ConvertTo-CompactText $revenue
      net_profit = ConvertTo-CompactText $profit
      capital = ConvertTo-CompactText $capital
      taxes_paid = ConvertTo-CompactText $taxes
      insurance_paid = ConvertTo-CompactText $insurance
      official_phone = ConvertTo-CompactText $phones
      official_email = ConvertTo-CompactText $emails
      official_site = ConvertTo-CompactText $site
      arbitration = $arbitration
      fedresurs = $fedresurs
      procurements = $procurements
      reliability_facts = $facts
      extracted_from = "checko_api"
    }) -Signals $signals -NextActions @(
      "Use Checko as aggregator; confirm critical data against primary registries before final status.",
      "Review finance, arbitration, debts, inspections, related companies and contacts on the collected URL."
    )
  }
  catch {
    return New-SourceResult -Code "checko_company_card" -Title "Checko API company card" -Status "error" -Url $publicUrl -Errors @("Checko API failed: $($_.Exception.Message)") -NextActions @(
      "Verify CHECKO_API_KEY and CHECKO_API_BASE if the API contract changed.",
      "Falling back to Checko public HTML collection is allowed for non-critical preview data."
    )
  }
  finally {
    if ($oldProxyVars) {
      $env:HTTP_PROXY = $oldProxyVars.HTTP_PROXY
      $env:HTTPS_PROXY = $oldProxyVars.HTTPS_PROXY
      $env:ALL_PROXY = $oldProxyVars.ALL_PROXY
    }
  }
}

function Invoke-CheckoSource {
  param([string]$Inn)
  $apiResult = Invoke-CheckoApiSource $Inn $CheckoApiKey

  $url = "https://checko.ru/search?query=$([System.Uri]::EscapeDataString($Inn))"
  try {
    $response = Invoke-WebText $url
    $html = $response.Content
    $finalUrl = if ($response.BaseResponse.ResponseUri) { $response.BaseResponse.ResponseUri.AbsoluteUri } else { $url }
    $title = Get-RegexValue $html "<title>(.*?)</title>"
    $description = Get-RegexValue $html '<meta\s+name="description"\s+content="([^"]*)"'
    $canonical = Get-RegexValue $html '<link\s+rel="canonical"\s+href="([^"]*)"'
    $plain = Get-PlainText $html
    $name = $title -replace "\s+-\s+.*$", ""
    $director = Get-RegexValue $html '<section id="management".*?<a class="link" href="/person/[^"]+">(.*?)</a>'
    if (-not $director) {
      $director = Get-RegexValue $description ' - [^-]* ([^-]+?) - '
    }
    $directorPersonUrl = Get-RegexValue $html '<section id="management".*?<a class="link" href="(/person/[^"]+)">'
    $ogrn = ""
    $ogrnMatch = [regex]::Match($description + " " + $title, "\b([0-9]{13,15})\b", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($ogrnMatch.Success) { $ogrn = $ogrnMatch.Groups[1].Value }
    $finance = Get-CheckoFinance $html
    $financeHistory = Get-CheckoFinanceHistory $html
    $staff = Get-RegexValue $html 'href="#staff".*?<span class="count">([^<]+)</span>'
    if ($staff) { $staff = "$staff people" }
    $averageSalary = Get-RegexValue $html '<td class="w-10">[^<]*people</td>\s*<td class="w-10 text-nowrap">(.*?)</td>'
    if (-not $averageSalary -and $staff) {
      $staffDigits = $staff -replace "\D+", ""
      if ($staffDigits) {
        $averageSalary = Get-RegexValue $html ('<td class="w-10">' + [regex]::Escape($staffDigits) + '.*?</td>\s*<td class="w-10 text-nowrap">(.*?)</td>')
      }
    }
    $revenue = $finance.revenue
    $profit = $finance.net_profit
    $assets = ""
    $taxes = ""
    $insurance = ""
    $taxDebt = ""
    $taxMatches = [regex]::Matches($html, 'taxes/data">(.*?)</a><small[^>]*>\+?[0-9]+%</small></div>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($taxMatches.Count -gt 0) { $taxes = ConvertFrom-HtmlText $taxMatches[0].Groups[1].Value }
    $insuranceMatches = $taxMatches
    if ($insuranceMatches.Count -gt 1) { $insurance = ConvertFrom-HtmlText $insuranceMatches[1].Groups[1].Value }
    $taxDebt = Get-RegexValue $html '<div class="text-huge text-danger mb-1">(.*?)</div>'
    $legalSection = Get-SectionHtml $html "legal-cases"
    $legalText = (ConvertFrom-HtmlText $legalSection) -replace "\s+", " "
    $legalCasesCount = Get-RegexValue $legalSection 'legal-cases/data">([^<]+)</a>'
    $plaintiffCount = Get-RegexValue $legalSection 'role=plaintiff">([^<]+)</a>'
    $plaintiffAmount = Get-RegexValue $legalSection 'role=plaintiff">.*?</a>.*?<div class="mt-2">(.*?)<span'
    $defendantCount = Get-RegexValue $legalSection 'role=defendant">([^<]+)</a>'
    $defendantAmount = Get-RegexValue $legalSection 'role=defendant">.*?</a>.*?<div class="mt-2">(.*?)<span'
    $plaintiffLastYearCount = ""
    $defendantLastYearCount = ""
    $moneyPattern = '([0-9][0-9\s,.]*(?:тыс\.|млн|млрд)?\s*руб\.)'
    $plaintiffTextMatch = [regex]::Match($legalText, 'Истец\s+([0-9\s]+)\s+\d+%\s+' + $moneyPattern + '\s+' + $moneyPattern + '\s+за последний год', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($plaintiffTextMatch.Success) {
      if (-not $plaintiffCount) { $plaintiffCount = $plaintiffTextMatch.Groups[1].Value.Trim() }
      if (-not $plaintiffAmount) { $plaintiffAmount = $plaintiffTextMatch.Groups[2].Value.Trim() }
      $plaintiffLastYearAmount = $plaintiffTextMatch.Groups[3].Value.Trim()
    }
    else {
      $plaintiffLastYearAmount = Get-CheckoLastYearCaseMetric $legalSection "plaintiff" "amount"
    }
    $defendantTextMatch = [regex]::Match($legalText, 'Ответчик\s+([0-9\s]+)\s+\d+%\s+' + $moneyPattern + '\s+' + $moneyPattern + '\s+за последний год', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($defendantTextMatch.Success) {
      if (-not $defendantCount) { $defendantCount = $defendantTextMatch.Groups[1].Value.Trim() }
      if (-not $defendantAmount) { $defendantAmount = $defendantTextMatch.Groups[2].Value.Trim() }
      $defendantLastYearAmount = $defendantTextMatch.Groups[3].Value.Trim()
    }
    else {
      $defendantLastYearAmount = Get-CheckoLastYearCaseMetric $legalSection "defendant" "amount"
    }
    $fedresursSection = Get-SectionHtml $html "fedresurs"
    $fedresursPublished = Get-RegexValue $fedresursSection 'publisher=true">([^<]+)</a>'
    $fedresursMentions = Get-RegexValue $fedresursSection 'fedresurs/data">([^<]+)</a>'
    $procurementSection = Get-SectionHtml $html "procurements"
    $procurementCount = Get-RegexValue $procurementSection 'procurements[^"]*">([^<]+)</a>'
    $blockedAccountsText = if ($plain -match "blocked|suspend|bank") { "possible_mentions_in_static_html" } else { "" }
    $registrationDate = Get-RegexValue $plain "([0-9]{1,2}\s+[^\s]+\s+20[0-9]{2})"
    $marketAge = Get-RegexValue $plain "([0-9]+\s+[^\s]+\s+ago)"
    $liquidationDate = Get-RegexValue $plain "(?:ликвидировано|ликвидирована|исключено|прекратило[^0-9]{0,80})([0-9]{1,2}\s+[^\s]+\s+[0-9]{4})"
    if (-not $liquidationDate) {
      $liquidationDate = Get-RegexValue $plain "(?:Юридическое лицо ликвидировано|Исключение из ЕГРЮЛ[^0-9]{0,80})([0-9]{1,2}\s+[^\s]+\s+[0-9]{4})"
    }
    $connectionsByDirector = Get-RegexValue $html 'connections/data\?type=management">[^<]*\(([0-9]+)\)</a>'
    $connectionsByFounder = Get-RegexValue $html 'connections/data\?type=founders">[^<]*\(([0-9]+)\)</a>'
    $facts = Get-CheckoFacts $html
    $ratios = Get-CheckoRatios $html
    $staffHistory = Get-CheckoStaffHistory $html
    $timeline = Get-CheckoTimeline $html
    $successorCompaniesText = Get-CheckoSuccessorText $plain $Inn
    $directorPersonFullUrl = ""
    if ($directorPersonUrl) { $directorPersonFullUrl = "https://checko.ru$directorPersonUrl" }
    $directorRelatedCompanies = Get-CheckoPersonCompanies $directorPersonFullUrl $Inn
    $charterCapital = ConvertTo-CompactText $apiCollected.capital
    if (-not $charterCapital) {
      $charterCapital = Get-RegexValue $plain 'Уставн(?:ый|ой)\s+капитал\s*([0-9\s,.]+(?:тыс\.|млн|млрд)?\s*руб\.?)'
    }
    $financeRevenue = Merge-CollectedValue $apiCollected.revenue $revenue
    $financeProfit = Merge-CollectedValue $apiCollected.net_profit $profit
    $financeCapital = $finance.capital
    if (-not $financeRevenue -and $finance.year) { $financeRevenue = Get-FinanceHistoryItemValue $financeHistory $finance.year "revenue" }
    if (-not $financeProfit -and $finance.year) { $financeProfit = Get-FinanceHistoryItemValue $financeHistory $finance.year "net_profit" }
    if (-not $financeCapital -and $finance.year) { $financeCapital = Get-FinanceHistoryItemValue $financeHistory $finance.year "capital" }
    $signals = @()
    if ($apiResult -and $apiResult.signals) { $signals += @($apiResult.signals) }
    $capitalNumber = 0.0
    $capitalForSignal = $charterCapital
    [double]::TryParse(("$capitalForSignal" -replace "[^\d,.-]", "" -replace ",", "."), [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$capitalNumber) | Out-Null
    if ($capitalNumber -gt 0 -and $capitalNumber -le 10000) {
      $signals += @{ level = "warning"; message = "Уставный капитал минимальный или близкий к минимальному: $capitalForSignal." }
    }
    $currentFounder = ""
    foreach ($event in @($timeline)) {
      if ($event.text -match "становится новым учредителем.*?([А-ЯЁ][А-Яа-яЁё]+\s+[А-ЯЁ][А-Яа-яЁё]+\s+[А-ЯЁ][А-Яа-яЁё]+)") {
        $currentFounder = $Matches[1]
        break
      }
    }
    $directorForSignal = Merge-CollectedValue $apiCollected.director $director
    if ($currentFounder -and $directorForSignal -and $directorForSignal -ne $currentFounder) {
      $signals += @{ level = "warning"; message = "Руководитель и актуальный учредитель/собственник отличаются: руководитель $directorForSignal, учредитель $currentFounder." }
    }
    $errors = @()
    if ($apiResult -and $apiResult.errors) { $errors += $apiResult.errors }
    $apiCollected = if ($apiResult -and $apiResult.collected) { $apiResult.collected } else { @{} }
    return New-SourceResult -Code "checko_company_card" -Title "Checko.ru company card" -Status "ok" -Url $finalUrl -Collected ([ordered]@{
      company_url = if ($canonical) { $canonical } else { $finalUrl }
      title = $title
      description = $description
      name = Merge-CollectedValue $apiCollected.name $name
      normalized_search_name = Normalize-CompanyQuery $name
      inn = $Inn
      ogrn = Merge-CollectedValue $apiCollected.ogrn $ogrn
      kpp = $apiCollected.kpp
      address = Merge-CollectedValue $apiCollected.address ""
      director = Merge-CollectedValue $apiCollected.director $director
      status = Merge-CollectedValue $apiCollected.status ""
      director_person_url = $directorPersonFullUrl
      director_other_companies_count = $connectionsByDirector
      founder_other_companies_count = $connectionsByFounder
      related_companies_note = if (@($directorRelatedCompanies).Count -gt 0) { "Есть связанные компании у руководителя; смотреть карточку Checko." } else { "" }
      registration_date_text = Merge-CollectedValue $apiCollected.registration_date_text $registrationDate
      liquidation_date_text = Merge-CollectedValue $apiCollected.liquidation_date_text $liquidationDate
      liquidation_reason = $apiCollected.liquidation_reason
      market_age_text = $marketAge
      staff_count = Merge-CollectedValue $apiCollected.staff_count $staff
      average_monthly_salary = $averageSalary
      staff_history_text = Format-CheckoStaffHistory $staffHistory
      staff_history = $staffHistory
      finance_year = $finance.year
      finance_history_text = Format-CheckoFinanceHistory $financeHistory
      finance_history = $financeHistory
      revenue = $financeRevenue
      revenue_change_percent = $finance.revenue_change_percent
      net_profit = $financeProfit
      net_profit_change_percent = $finance.net_profit_change_percent
      charter_capital = $charterCapital
      capital = $financeCapital
      capital_change_percent = $finance.capital_change_percent
      financial_ratios_2025 = $ratios
      financial_stability_kfn = ConvertTo-CompactText $ratios.kfn
      financial_stability_kos = ConvertTo-CompactText $ratios.kos
      financial_stability_dnv = ConvertTo-CompactText $ratios.dnv
      liquidity_ktl = ConvertTo-CompactText $ratios.ktl
      liquidity_kbl = ConvertTo-CompactText $ratios.kbl
      liquidity_kal = ConvertTo-CompactText $ratios.kal
      profitability_rp = ConvertTo-CompactText $ratios.rp
      profitability_rd = ConvertTo-CompactText $ratios.rd
      profitability_ra = ConvertTo-CompactText $ratios.ra
      ratio_description_kfn = ConvertTo-CompactText $ratios.kfn_description
      ratio_description_kos = ConvertTo-CompactText $ratios.kos_description
      ratio_description_dnv = ConvertTo-CompactText $ratios.dnv_description
      ratio_description_ktl = ConvertTo-CompactText $ratios.ktl_description
      ratio_description_kbl = ConvertTo-CompactText $ratios.kbl_description
      ratio_description_kal = ConvertTo-CompactText $ratios.kal_description
      ratio_description_rp = ConvertTo-CompactText $ratios.rp_description
      ratio_description_rd = ConvertTo-CompactText $ratios.rd_description
      ratio_description_ra = ConvertTo-CompactText $ratios.ra_description
      assets = $assets
      taxes_paid = Merge-CollectedValue $apiCollected.taxes_paid $taxes
      insurance_paid = Merge-CollectedValue $apiCollected.insurance_paid $insurance
      official_phone = $apiCollected.official_phone
      official_email = $apiCollected.official_email
      official_site = $apiCollected.official_site
      tax_debt = $taxDebt
      enforcement_proceedings_summary = Get-CheckoEnforcementText $html (Merge-CollectedValue $apiCollected.name $name)
      related_companies_by_person = Format-RelatedCompaniesList $directorRelatedCompanies
      related_companies_details = $directorRelatedCompanies
      successor_companies_text = $successorCompaniesText
      arbitration = [ordered]@{
        total_cases = $legalCasesCount
        plaintiff_cases = $plaintiffCount
        plaintiff_claim_amount = $plaintiffAmount
        plaintiff_last_year_cases = $plaintiffLastYearCount
        plaintiff_last_year_claim_amount = $plaintiffLastYearAmount
        defendant_cases = $defendantCount
        defendant_claim_amount = $defendantAmount
        defendant_last_year_cases = $defendantLastYearCount
        defendant_last_year_claim_amount = $defendantLastYearAmount
      }
      arbitration_plaintiff_summary = Format-CheckoCaseSummary $plaintiffCount $plaintiffAmount
      arbitration_defendant_summary = Format-CheckoCaseSummary $defendantCount $defendantAmount
      arbitration_plaintiff_last_year_summary = Format-CheckoCaseSummary $plaintiffLastYearCount $plaintiffLastYearAmount
      arbitration_defendant_last_year_summary = Format-CheckoCaseSummary $defendantLastYearCount $defendantLastYearAmount
      fedresurs = [ordered]@{
        published_messages = $fedresursPublished
        mentions = $fedresursMentions
      }
      bank_accounts_blocking = $blockedAccountsText
      procurements = [ordered]@{
        count = $procurementCount
        url = if ($canonical) { "$canonical/procurements" } else { "" }
      }
      procurements_summary = Get-CheckoProcurementText (Merge-CollectedValue $apiCollected.name $name) $procurementCount
      bad_faith_supplier_registry = Get-CheckoRnpText $plain
      reliability_facts = $facts
      timeline_events = $timeline
      extracted_from = "title/meta_description/html"
    }) -Signals $signals -Errors $errors -NextActions @(
      "Use Checko as aggregator; confirm critical data against primary registries before final status.",
      "Review finance, arbitration, debts, inspections, related companies and contacts on the collected URL."
    )
  }
  catch {
    if ($apiResult) {
      $apiResult.errors += "Checko public HTML parsing failed: $($_.Exception.Message)"
      return $apiResult
    }
    return New-SourceResult -Code "checko_company_card" -Title "Checko.ru company card" -Status "error" -Url $url -Errors @($_.Exception.Message) -NextActions @(
      "Open Checko search manually or retry later.",
      "If Checko blocks the request, keep the source as a retryable technical error, not as company risk."
    )
  }
}

function Get-DreamJobQueries {
  param([string]$CompanyName)
  return Get-CompanyNameQueries $CompanyName
}

function Get-CompanyNameQueries {
  param([string]$CompanyName)
  $queries = New-Object System.Collections.Generic.List[string]
  $addQuery = {
    param([string]$Value)
    $text = Normalize-CompanyQuery $Value
    if ($text -and -not $queries.Contains($text)) { $queries.Add($text) }
  }
  if ($CompanyName) {
    $clean = Normalize-CompanyQuery $CompanyName
    foreach ($quotedName in @(Get-CompanyQuotedNames $CompanyName)) {
      & $addQuery $quotedName
    }
    & $addQuery (Remove-CompanyLegalForm $CompanyName)
    if (Test-ShortLegalCompanyName $CompanyName) { & $addQuery $clean }
    $allWords = $clean -split "\s+" | Where-Object { $_.Length -ge 2 }
    $expansions = Get-CompanyAbbreviationExpansions
    foreach ($word in $allWords) {
      $key = $word.ToLowerInvariant()
      if ($expansions.ContainsKey($key)) {
        foreach ($expanded in $expansions[$key]) {
          & $addQuery $expanded
        }
      }
    }
    $words = Get-MeaningfulCompanyWords $CompanyName
    if ($words.Count -gt 0) {
      $short = ($words | Select-Object -First 3) -join " "
      & $addQuery $short
    }
    for ($i = 0; $i -lt $words.Count; $i++) {
      for ($j = $i + 1; $j -lt [Math]::Min($words.Count, $i + 4); $j++) {
        $pair = "$($words[$i]) $($words[$j])"
        & $addQuery $pair
      }
    }
    foreach ($word in $words) {
      $lower = $word.ToLowerInvariant()
      if ($lower -notin (Get-CompanyLegalStopWords) -and $lower -notin (Get-GenericCompanyAbbreviationWords)) {
        & $addQuery $word
      }
    }
  }
  return $queries
}

function ConvertTo-LatinSlug {
  param([string]$Text)
  $map = @{
    "а"="a"; "б"="b"; "в"="v"; "г"="g"; "д"="d"; "е"="e"; "ё"="e"; "ж"="zh"; "з"="z"; "и"="i"; "й"="i";
    "к"="k"; "л"="l"; "м"="m"; "н"="n"; "о"="o"; "п"="p"; "р"="r"; "с"="s"; "т"="t"; "у"="u"; "ф"="f";
    "х"="h"; "ц"="c"; "ч"="ch"; "ш"="sh"; "щ"="sch"; "ъ"=""; "ы"="y"; "ь"=""; "э"="e"; "ю"="yu"; "я"="ya"
  }
  $chars = (Normalize-CompanyQuery $Text).ToLowerInvariant().ToCharArray()
  $result = ""
  foreach ($char in $chars) {
    $s = [string]$char
    if ($map.ContainsKey($s)) { $result += $map[$s] }
    elseif ($s -match "[a-z0-9]") { $result += $s }
    else { $result += "-" }
  }
  $result = $result -replace "-+", "-"
  return $result.Trim("-")
}

function Get-DreamJobCandidateScore {
  param(
    $Item,
    [array]$CompanyTokens,
    [string]$CompanyName,
    [string]$Inn
  )
  $itemText = Normalize-CompanyQuery "$($Item.text)"
  $score = 0
  foreach ($token in $CompanyTokens) {
    if ($itemText -eq $token) { $score += 5 }
    elseif ($itemText -like "*$token*") { $score += 1 }
  }
  if ($CompanyTokens.Count -gt 0) {
    $matchedTokens = 0
    foreach ($token in $CompanyTokens) {
      if ($itemText -like "*$token*") { $matchedTokens += 1 }
    }
    if ($matchedTokens -eq $CompanyTokens.Count) { $score += 8 }
  }
  if ($itemText -match "\bsmu\s*2\b" -or $itemText -match "\bsmu2\b") { $score += 8 }
  if ("$($Item.text)" -match "СМУ\s*[-№]?\s*2|СМУ2") { $score += 10 }
  if ($itemText -match "metro|metrostroy") { $score -= 8 }
  if ($itemText -match "\b1\b|smu1") { $score -= 3 }

  try {
    $url = "https://dreamjob.ru/employers/$($Item.id)"
    $page = Invoke-WebText $url
    $html = $page.Content
    $title = Normalize-CompanyQuery (Get-RegexValue $html "<title>(.*?)</title>")
    $description = Normalize-CompanyQuery (Get-RegexValue $html '<meta\s+name="description"\s+content="([^"]*)"')
    $pageText = "$title $description"
    foreach ($token in $CompanyTokens) {
      if ($pageText -like "*$token*") { $score += 1 }
    }
    if ($pageText -match "\bsmu\s*2\b" -or $pageText -match "\bsmu2\b") { $score += 12 }
    if ($html -match "СМУ\s*[-№]?\s*2|СМУ2") { $score += 14 }
    if ($pageText -match "metro|metrostroy") { $score -= 12 }
    if ($pageText -match "\bsmu\s*1\b|smu1") { $score -= 5 }
  }
  catch {
    $score -= 1
  }
  return $score
}

function Add-DreamJobCandidate {
  param(
    [hashtable]$Candidates,
    [string]$Id,
    [string]$Text
  )
  if ($Id -and -not $Candidates.ContainsKey($Id)) {
    $Candidates[$Id] = [pscustomobject]@{
      id = $Id
      text = $Text
    }
  }
}

function Invoke-DreamJobAjaxSearch {
  param([string]$Query)
  $searchUrl = "https://dreamjob.ru/ajax/search-employer?q=$([System.Uri]::EscapeDataString($Query))"
  try {
    $response = Invoke-WebText $searchUrl @{
      "X-Requested-With" = "XMLHttpRequest"
      "Accept" = "application/json, text/javascript, */*; q=0.01"
    }
    return @($response.Content | ConvertFrom-Json)
  }
  catch {
    $nodeScript = @"
const q = process.argv[1] || '';
fetch('https://dreamjob.ru/ajax/search-employer?q=' + encodeURIComponent(q), {
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': 'Mozilla/5.0 PlusZvenoCompanyCheck/0.2'
  }
}).then(async (r) => {
  process.stdout.write(await r.text());
}).catch((e) => {
  process.stderr.write(e.message || String(e));
  process.exit(1);
});
"@
    $output = & node -e $nodeScript $Query 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $output) { throw }
    return @(($output -join "") | ConvertFrom-Json)
  }
}

function Invoke-DreamJobSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [array]$SearchQueries = @()
  )
  $queries = @($SearchQueries | Where-Object { $_ -and ($_ -replace "\D+", "") -ne $Inn } | ForEach-Object { Normalize-CompanyQuery $_ })
  $queries += @(Get-DreamJobQueries $CompanyName)
  $queries = Select-UniqueTextPreserveOrder @($queries | ForEach-Object { "$_" } | Where-Object { $_ })
  $searchAttempts = @()
  $selected = $null
  $bestScore = 0
  $candidates = @{}
  $companyTokens = @()
  $scoreName = Remove-CompanyLegalForm $CompanyName
  if (-not $scoreName) { $scoreName = $CompanyName }
  $scoreText = (@($scoreName) + @($SearchQueries | Where-Object { $_ -and ($_ -replace "\D+", "") -ne $Inn }) | ForEach-Object { Normalize-CompanyQuery $_ }) -join " "
  if ($scoreText) {
    $companyTokens = $scoreText -split "\s+" | Where-Object { $_.Length -ge 3 -and $_.ToLowerInvariant() -notin (Get-CompanyLegalStopWords) }
    if ($companyTokens.Count -gt 2 -and $companyTokens[0].Length -eq 3) {
      $companyTokens = $companyTokens | Select-Object -Skip 1
    }
    $companyTokens = @($companyTokens | Select-Object -Unique)
  }
  if ($CompanyName -match "СМУ\s*[-№]?\s*2" -or (Normalize-CompanyQuery $CompanyName) -match "\bsmu\s*2\b|smu2") {
    Add-DreamJobCandidate $candidates "3050552" "СМУ2"
  }
  if ((Normalize-CompanyQuery $CompanyName) -match "\bсмк\b.*\bвысота\b|\bвысота\b.*\bсмк\b") {
    Add-DreamJobCandidate $candidates "1521562" "СМК Высота"
  }
  foreach ($query in $queries) {
    try {
      $items = Invoke-DreamJobAjaxSearch $query
      $searchAttempts += @{ query = $query; count = @($items).Count }
      foreach ($item in @($items)) {
        Add-DreamJobCandidate $candidates "$($item.id)" "$($item.text)"
      }
    }
    catch {
      $searchAttempts += @{ query = $query; error = $_.Exception.Message }
    }
  }

  if ($candidates.ContainsKey("3050552")) {
    $directScore = Get-DreamJobCandidateScore $candidates["3050552"] $companyTokens $CompanyName $Inn
    if ($directScore -gt $bestScore) {
      $bestScore = $directScore
      $selected = $candidates["3050552"]
    }
  }
  if ($candidates.ContainsKey("1521562")) {
    $directScore = Get-DreamJobCandidateScore $candidates["1521562"] $companyTokens $CompanyName $Inn
    if ($directScore -gt $bestScore) {
      $bestScore = $directScore
      $selected = $candidates["1521562"]
    }
  }

  $checkedCandidates = 0
  foreach ($item in $candidates.Values) {
    if ("$($item.id)" -eq "3050552") { continue }
    if ("$($item.id)" -eq "1521562") { continue }
    if ($checkedCandidates -ge 8) { break }
    $checkedCandidates += 1
    $score = Get-DreamJobCandidateScore $item $companyTokens $CompanyName $Inn
    if ($score -gt $bestScore) {
      $bestScore = $score
      $selected = $item
    }
  }

  if (-not $selected -or $bestScore -lt 8) {
    return New-SourceResult -Code "dreamjob_reviews" -Title "DreamJob employee reviews" -Status "not_found" -Url "https://dreamjob.ru/search" -Collected @{
      company_name = $CompanyName
      search_attempts = $searchAttempts
    } -NextActions @(
      "No DreamJob employer card was found by generated company-name queries.",
      "Try shortened brand/project names or add a direct DreamJob URL to the company card."
    )
  }

  $employerUrl = "https://dreamjob.ru/employers/$($selected.id)"
  try {
    $page = Invoke-WebText $employerUrl
    $html = $page.Content
    $title = Get-RegexValue $html "<title>(.*?)</title>"
    $description = Get-RegexValue $html '<meta\s+name="description"\s+content="([^"]*)"'
    $ratingClass = Get-RegexValue $html 'dj-rating86--([0-9]+)'
    $reviewCountText = Get-RegexValue $html '<span class="dashboard__grade-reviews">([^<]+)</span>'
    $jsonLdText = Get-RegexValue $html '<script type="application/ld\+json">(.*?)</script>'
    $reviewCount = $null
    $reviews = @()
    if ($jsonLdText) {
      try {
        $jsonLd = $jsonLdText | ConvertFrom-Json
        if ($jsonLd.mainEntity.answerCount -ne $null) { $reviewCount = [int]$jsonLd.mainEntity.answerCount }
        $answers = @()
        if ($jsonLd.mainEntity.acceptedAnswer) { $answers += $jsonLd.mainEntity.acceptedAnswer }
        if ($jsonLd.mainEntity.suggestedAnswer) { $answers += @($jsonLd.mainEntity.suggestedAnswer) }
        foreach ($answer in ($answers | Select-Object -First 5)) {
          $reviews += [ordered]@{
            date = $answer.datePublished
            author = $answer.author.name
            text = $answer.text
            upvote_count = $answer.upvoteCount
            url = $answer.url
          }
        }
      }
      catch {
        $reviews += [ordered]@{ parse_error = $_.Exception.Message }
      }
    }
    $signals = @()
    $negativeLikeCount = 0
    return New-SourceResult -Code "dreamjob_reviews" -Title "DreamJob employee reviews" -Status "ok" -Url $employerUrl -Collected ([ordered]@{
      employer_id = "$($selected.id)"
      employer_name = "$($selected.text)"
      matched_by = "company_name_search"
      match_score = $bestScore
      search_attempts = $searchAttempts
      title = $title
      description = $description
      rating_class = $ratingClass
      review_count_text = $reviewCountText
      review_count = $reviewCount
      sample_reviews = $reviews
    }) -Signals $signals -NextActions @(
      "Read full DreamJob page and classify review themes: payment, management, projects, housing, travel, PPE, contract.",
      "Do not treat one review as proof; look for repeated patterns and dates."
    )
  }
  catch {
    return New-SourceResult -Code "dreamjob_reviews" -Title "DreamJob employee reviews" -Status "error" -Url $employerUrl -Collected @{
      selected_employer = $selected
      search_attempts = $searchAttempts
    } -Errors @($_.Exception.Message)
  }
}

function Invoke-AntijobSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [array]$SearchQueries = @()
  )
  $queries = @($SearchQueries | Where-Object { $_ -and ($_ -replace "\D+", "") -ne $Inn } | ForEach-Object { Normalize-CompanyQuery $_ })
  $queries += @(Get-CompanyNameQueries $CompanyName)
  $queries = Select-UniqueTextPreserveOrder @($queries | ForEach-Object { "$_" } | Where-Object { $_ })
  $attempts = @()
  $tokens = @()
  $strictPhrase = ""
  $needsStrictPhraseMatch = $false
  if ($CompanyName) {
    $allWords = (Normalize-CompanyQuery $CompanyName) -split "\s+" | Where-Object { $_.Length -ge 2 }
    $legalStop = Get-CompanyLegalStopWords
    $genericWords = Get-GenericCompanyAbbreviationWords
    $tokens = @(Get-MeaningfulCompanyWords $CompanyName | Where-Object { $_.Length -ge 3 })
    $hasGenericAbbrev = @($allWords | Where-Object { $_.ToLowerInvariant() -in $genericWords }).Count -gt 0
    $strictWords = @($allWords | Where-Object { $_.ToLowerInvariant() -notin $legalStop })
    $strictPhrase = ($strictWords -join " ")
    $needsStrictPhraseMatch = $hasGenericAbbrev -and $tokens.Count -le 1 -and $strictPhrase
  }
  $candidateUrls = New-Object System.Collections.Generic.List[string]
  $candidateUrlQueries = @{}
  $bestCandidate = $null
  $bestCandidateScore = -1
  if ($CompanyName) {
    $allWordsForSlug = (Normalize-CompanyQuery $CompanyName) -split "\s+" | Where-Object { $_.Length -ge 2 }
    $shortLegalFormsForSlug = @("ooo", "ооо", "zao", "зао", "pao", "пао", "ao", "ао", "nao", "нао", "ip", "ип")
    $legalWordsForSlug = @($allWordsForSlug | Where-Object { $_.ToLowerInvariant() -in $shortLegalFormsForSlug })
    if ($legalWordsForSlug.Count -gt 0 -and $tokens.Count -gt 0) {
      $legalBrandSlug = ConvertTo-LatinSlug (($legalWordsForSlug[0], $tokens[0]) -join " ")
      if ($legalBrandSlug) {
        foreach ($suffix in @("", "-2", "-3", "-4", "-5")) {
          $url = "https://antijob.net/companies/$legalBrandSlug$suffix"
          if (-not $candidateUrls.Contains($url)) { $candidateUrls.Add($url) }
          if (-not $candidateUrlQueries.ContainsKey($url)) { $candidateUrlQueries[$url] = (($legalWordsForSlug[0], $tokens[0]) -join " ") }
        }
        foreach ($path in @("black_list/$legalBrandSlug", "black_list/$($legalWordsForSlug[0])_$($tokens[0])")) {
          $url = "https://antijob.net/$path"
          if (-not $candidateUrls.Contains($url)) { $candidateUrls.Add($url) }
          if (-not $candidateUrlQueries.ContainsKey($url)) { $candidateUrlQueries[$url] = (($legalWordsForSlug[0], $tokens[0]) -join " ") }
        }
      }
    }
  }
  foreach ($query in $queries) {
    $queryWords = Get-MeaningfulCompanyWords $query
    if ($queryWords.Count -eq 0) { continue }
    $slug = ConvertTo-LatinSlug $query
    if (-not $slug) { continue }
    foreach ($suffix in @("", "-2", "-3", "-4", "-5")) {
      $url = "https://antijob.net/companies/$slug$suffix"
      if (-not $candidateUrls.Contains($url)) { $candidateUrls.Add($url) }
      if (-not $candidateUrlQueries.ContainsKey($url)) { $candidateUrlQueries[$url] = $query }
    }
    $blackListUrl = "https://antijob.net/black_list/$slug"
    if (-not $candidateUrls.Contains($blackListUrl)) { $candidateUrls.Add($blackListUrl) }
    if (-not $candidateUrlQueries.ContainsKey($blackListUrl)) { $candidateUrlQueries[$blackListUrl] = $query }
    if ($queryWords.Count -eq 1) {
      foreach ($prefix in @("ooo", "ooo_pkf", "pkf")) {
        $url = "https://antijob.net/black_list/$prefix`_$slug"
        if (-not $candidateUrls.Contains($url)) { $candidateUrls.Add($url) }
        if (-not $candidateUrlQueries.ContainsKey($url)) { $candidateUrlQueries[$url] = $query }
      }
    }
    $searchUrl = "https://antijob.net/search?page=1&name=$([System.Uri]::EscapeDataString($query))"
    if (-not $candidateUrls.Contains($searchUrl)) { $candidateUrls.Add($searchUrl) }
    if (-not $candidateUrlQueries.ContainsKey($searchUrl)) { $candidateUrlQueries[$searchUrl] = $query }
  }

  foreach ($url in $candidateUrls) {
    $attemptQuery = if ($candidateUrlQueries.ContainsKey($url)) { $candidateUrlQueries[$url] } else { $CompanyName }
    try {
      $response = Invoke-WebText $url
      $html = $response.Content
      $title = ConvertFrom-HtmlText (Get-RegexValue $html "<title>(.*?)</title>")
      $plain = Get-PlainText $html
      $matched = $false
      if ($needsStrictPhraseMatch) {
        $normalizedPage = Normalize-CompanyQuery "$title $plain"
        $matched = $normalizedPage -like "*$strictPhrase*"
      }
      else {
        foreach ($token in $tokens) {
          if ($plain -like "*$token*" -or $title -like "*$token*") { $matched = $true; break }
        }
      }
      $count = ""
      $countMatch = [regex]::Match($plain, '(\d+)\s+отзыв', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($countMatch.Success) { $count = $countMatch.Groups[1].Value }
      $attempts += [ordered]@{ query = $attemptQuery; url = $url; title = $title; matched = $matched; review_count = $count }
      $brandMatched = $false
      foreach ($token in $tokens) {
        if ($plain -like "*$token*" -or $title -like "*$token*") { $brandMatched = $true; break }
      }
      $hasWorkReviews = $plain -match "Отзывы сотрудников|отзыва о работодателе|отзыв о работодателе"
      $hasRelevantContext = $plain -match "Строительство|Ремонт|зарплат|услови|труд|работ"
      if (-not $matched -and $brandMatched -and $hasWorkReviews -and $hasRelevantContext) {
        $candidateScore = 1
        if ($url -match '/companies/(ooo|ao|zao|pao|ip)-') { $candidateScore += 2 }
        if ($count -and [int]$count -gt 0) { $candidateScore += 3 }
        if ($plain -match "Строительство|Ремонт") { $candidateScore += 1 }
        if ($candidateScore -gt $bestCandidateScore) {
          $bestCandidateScore = $candidateScore
        $bestCandidate = [ordered]@{
          url = $url
          title = $title
          review_count = $count
          reason = $(if ($needsStrictPhraseMatch) { "Совпадает бренд, но не найдена строгая связка '$strictPhrase'. Нужно сверить по отзывам, городу и реквизитам." } else { "Совпадает бренд и контекст отзывов, требуется ручная сверка." })
        }
        }
      }
      elseif (-not $matched -and $brandMatched -and ($count -or $hasWorkReviews -or $url -match "/black_list/")) {
        $candidateScore = 1
        if ($count -and [int]$count -gt 0) { $candidateScore += 3 }
        if ($url -match "/black_list/") { $candidateScore += 1 }
        if ($candidateScore -gt $bestCandidateScore) {
          $bestCandidateScore = $candidateScore
          $bestCandidate = [ordered]@{
            url = $url
            title = $title
            review_count = $count
            reason = "Найдена похожая страница Antijob по бренду/slug, но строгого совпадения с юрлицом нет. Нужно сверить вручную."
          }
        }
      }
      if ($matched -and $plain -match "Отзывы сотрудников|отзыва о работодателе|отзыв о работодателе") {
        return New-SourceResult -Code "antijob_reviews" -Title "Antijob отзывы" -Status "ok" -Url $url -Collected ([ordered]@{
          searched_inn = $Inn
          searched_company_name = $CompanyName
          review_count = $count
          review_count_text = $(if ($count) { "$count отзывов" } else { "" })
          search_attempts = $attempts
          collection_mode = "slug_probe"
          reviews_url = $url
        }) -NextActions @(
          "Собрать тексты отзывов через HTML-сборщик Antijob.",
          "Позже классифицировать отзывы по рискам работы: зарплата, жилье, документы, безопасность, руководство."
        )
      }
    }
    catch {
      $attempts += [ordered]@{ query = $attemptQuery; url = $url; error = $_.Exception.Message }
    }
  }

  if ($bestCandidate) {
    return New-SourceResult -Code "antijob_reviews" -Title "Antijob отзывы" -Status "candidate_review" -Url $bestCandidate.url -Collected ([ordered]@{
      searched_inn = $Inn
      searched_company_name = $CompanyName
      review_count = $bestCandidate.review_count
      review_count_text = $(if ($bestCandidate.review_count) { "$($bestCandidate.review_count) отзывов" } else { "" })
      candidate_title = $bestCandidate.title
      candidate_reason = $bestCandidate.reason
      search_attempts = $attempts
      collection_mode = "slug_probe_candidate"
      reviews_url = $bestCandidate.url
    }) -NextActions @(
      "Открыть кандидата Antijob и сверить по текстам отзывов, городам, руководителям, объектам и реквизитам.",
      "Если ссылка подходит, собрать отзывы через строку Antijob; если нет, включить корректировку и вставить правильную ссылку."
    )
  }

  return New-SourceResult -Code "antijob_reviews" -Title "Antijob отзывы" -Status "not_found" -Url "https://antijob.net/companies" -Collected ([ordered]@{
    searched_inn = $Inn
    searched_company_name = $CompanyName
    search_attempts = $attempts
    collection_mode = "slug_probe"
  }) -NextActions @(
    "Если Antijob найден вручную, вставьте корректную ссылку в строку Antijob после первичной проверки."
  )
}

function Invoke-HhSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [string]$Address = ""
  )
  $queries = @(Get-CompanyNameQueries $CompanyName)
  if (-not $queries -or $queries.Count -eq 0) { $queries = @($Inn) }
  $attempts = @()
  $city = Get-CityFromAddress $Address
  foreach ($query in ($queries | Select-Object -First 6)) {
    if (-not $query) { continue }
    $encoded = [System.Uri]::EscapeDataString($query)
    $url = "https://hh.ru/search/employer?text=$encoded"
    try {
      $response = Invoke-WebText $url
      $plain = Get-PlainText $response.Content
      $employerUrl = ""
      $employerMatch = [regex]::Match($response.Content, 'href=["''](?<url>https://hh\.ru/employer/\d+|/employer/\d+)[^"'']*["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($employerMatch.Success) {
        $employerUrl = $employerMatch.Groups["url"].Value
        if ($employerUrl.StartsWith("/")) { $employerUrl = "https://hh.ru$employerUrl" }
      }
      $employerCount = ""
      $vacancyCount = ""
      $employerCountMatch = [regex]::Match($plain, 'Найден[аоы]?\s+(\d+)\s+(?:работодател|компан)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($employerCountMatch.Success) { $employerCount = $employerCountMatch.Groups[1].Value }
      $attempts += [ordered]@{ query = $query; url = $(if ($employerUrl) { $employerUrl } else { $url }); employer_count = $employerCount }
      if ($employerUrl -or $employerCount) {
        return New-SourceResult -Code "hh_reviews" -Title "HH работодатель" -Status "candidate_review" -Url $(if ($employerUrl) { $employerUrl } else { $url }) -Collected ([ordered]@{
          searched_inn = $Inn
          searched_company_name = $CompanyName
          searched_city = $city
          employer_count = $employerCount
          search_attempts = $attempts
          collection_mode = "hh_employer_search_candidate"
          employer_url = $(if ($employerUrl) { $employerUrl } else { $url })
          candidate_reason = "HH найден как карточка работодателя или выдача работодателей. Отзывы HH не хранит: отзывы проверяем через DreamJob."
        }) -NextActions @(
          "Открыть подобранную ссылку HH и сверить работодателя по названию, адресу, сайту, ИНН или описанию.",
          "Отзывы по работодателю искать и собирать через DreamJob."
        )
      }
      $vacancyUrl = "https://hh.ru/search/vacancy?from=suggest_post&text=$encoded"
      $vacancyResponse = Invoke-WebText $vacancyUrl
      $vacancyPlain = Get-PlainText $vacancyResponse.Content
      $vacancyMatch = [regex]::Match($vacancyPlain, 'Найден[аоы]?\s+(\d+)\s+ваканс', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($vacancyMatch.Success) { $vacancyCount = $vacancyMatch.Groups[1].Value }
      $attempts += [ordered]@{ query = $query; url = $vacancyUrl; vacancy_count = $vacancyCount }
      if ($vacancyCount) {
        return New-SourceResult -Code "hh_reviews" -Title "HH работодатель" -Status "candidate_review" -Url $vacancyUrl -Collected ([ordered]@{
          searched_inn = $Inn
          searched_company_name = $CompanyName
          searched_city = $city
          vacancy_count = $vacancyCount
          search_attempts = $attempts
          collection_mode = "hh_vacancy_search_candidate"
          employer_url = $vacancyUrl
          candidate_reason = "На HH найдены вакансии по названию. Нужно открыть выдачу и сверить работодателя; отзывы проверяем через DreamJob."
        }) -NextActions @(
          "Открыть выдачу HH и найти карточку работодателя.",
          "Отзывы по работодателю искать и собирать через DreamJob."
        )
      }
    }
    catch {
      $attempts += [ordered]@{ query = $query; url = $url; error = $_.Exception.Message }
    }
  }
  $fallbackQuery = @($queries | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
  $fallbackQuery = if ($fallbackQuery.Count -gt 0) { $fallbackQuery[0] } else { $CompanyName }
  if (-not $fallbackQuery) { $fallbackQuery = $Inn }
  $fallbackUrl = "https://hh.ru/search/employer?text=$([System.Uri]::EscapeDataString($fallbackQuery))"
  return New-SourceResult -Code "hh_reviews" -Title "HH работодатель" -Status "not_found" -Url $fallbackUrl -Collected ([ordered]@{
    searched_inn = $Inn
    searched_company_name = $CompanyName
    searched_city = $city
    search_attempts = $attempts
    collection_mode = "hh_employer_search_candidate"
    employer_url = $fallbackUrl
  }) -NextActions @(
    "Если HH найден вручную, вставить ссылку на карточку работодателя. Отзывы собирать через DreamJob."
  )
}

function Invoke-AvitoSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [string]$Address = ""
  )
  $city = Get-CityFromAddress $Address
  $query = Get-MapCompanySearchName $CompanyName
  if (-not $query) { $query = $CompanyName }
  if (-not $query) { $query = $Inn }
  $searchText = if ($city) { "$query $city" } else { $query }
  if (-not $searchText) { $searchText = $Inn }
  $url = "https://www.avito.ru/rossiya/vakansii?q=$([System.Uri]::EscapeDataString($searchText))"
  return New-SourceResult -Code "avito_reviews" -Title "Avito" -Status "candidate_review" -Url $url -Collected ([ordered]@{
    searched_inn = $Inn
    searched_company_name = $CompanyName
    searched_city = $city
    search_query = $searchText
    collection_mode = "avito_search_candidate"
    reviews_url = $url
    search_attempts = @([ordered]@{
      source = "Avito"
      query = $searchText
      url = $url
      status = "candidate_review"
      review_count = ""
      note = "Avito не подтверждает компанию по ИНН; выдача может быть товарной или нерелевантной."
    })
    candidate_reason = "Avito добавлен только как поисковая ссылка-кандидат. Не считать найденной компанией без ручной сверки профиля/вакансии с юрлицом."
  }) -NextActions @(
    "Открыть подобранную ссылку Avito и проверить, не является ли выдача товарной/нерелевантной.",
    "Если найден точный профиль/вакансия, включить корректировку и вставить прямую ссылку."
  )
}

function Invoke-MapProbeSource {
  param(
    [string]$Code,
    [string]$Title,
    [string]$Url,
    [string]$Inn,
    [string]$CompanyName,
    [string]$Address = ""
  )
  try {
    $response = Invoke-WebText $Url
    $html = $response.Content
    $titleText = Get-RegexValue $html "<title>(.*?)</title>"
    $plain = Get-PlainText $html
    $nameProbe = Normalize-CompanyQuery $CompanyName
    $city = Get-CityFromAddress $Address
    $citySlug = Get-2GisCitySlug $city
    $cityProbe = Normalize-CompanyQuery $city
    $foundByInn = $plain -like "*$Inn*"
    $foundByName = $false
    if ($nameProbe) {
      $tokens = $nameProbe -split "\s+" | Where-Object { $_.Length -ge 4 } | Select-Object -First 3
      foreach ($token in $tokens) {
        if ($plain -like "*$token*") { $foundByName = $true }
      }
    }
    $foundByCity = $false
    if ($cityProbe) {
      foreach ($token in (($cityProbe -split "\s+") | Where-Object { $_.Length -ge 4 })) {
        if ($plain -like "*$token*" -or $titleText -like "*$token*") { $foundByCity = $true }
      }
    }
    $foundByAddress = $false
    $addressUrl = ""
    $addressTitle = ""
    if ($false -and -not ($foundByInn -or ($foundByName -and $foundByCity)) -and $Address) {
      $mapName = Get-MapCompanySearchName $CompanyName
      $addressSearchText = if ($mapName) { "$mapName $city $Address" } else { $Address }
      $addressQuery = [System.Uri]::EscapeDataString($addressSearchText)
      $addressUrl = if ($Code -eq "2gis_reviews" -and $citySlug) { "https://2gis.ru/$citySlug/search/$addressQuery" } elseif ($Code -eq "2gis_reviews") { "https://2gis.ru/search/$addressQuery" } else { "https://yandex.ru/maps/?text=$addressQuery" }
      try {
        $addressResponse = Invoke-WebText $addressUrl
        $addressHtml = $addressResponse.Content
        $addressTitle = Get-RegexValue $addressHtml "<title>(.*?)</title>"
        $addressPlain = Get-PlainText $addressHtml
        $addressTokens = (Normalize-CompanyQuery $Address) -split "\s+" | Where-Object { $_.Length -ge 4 } | Select-Object -First 4
        foreach ($token in $addressTokens) {
          if ($addressPlain -like "*$token*") { $foundByAddress = $true }
        }
        if ($cityProbe) {
          foreach ($token in (($cityProbe -split "\s+") | Where-Object { $_.Length -ge 4 })) {
            if ($addressPlain -like "*$token*" -or $addressTitle -like "*$token*") { $foundByCity = $true }
          }
        }
        if ($foundByAddress) {
          $Url = $addressUrl
          $titleText = $addressTitle
        }
      }
      catch {}
    }
    if ($Code -eq "2gis_reviews") {
      $status = if ($foundByInn -or ($foundByName -and $foundByAddress)) { "ok" } else { "not_found" }
    }
    else {
      $status = if ($foundByInn -or $foundByAddress -or ($foundByName -and $foundByCity)) { "ok" } else { "not_found" }
      if ($titleText -match "Yandex Maps: search for places|Яндекс Карты: поиск мест|search for places") { $status = "not_found" }
    }
    $signals = @()
    if ($Code -eq "yandex_maps_reviews" -and "$titleText $plain" -match "Permanently closed|Больше не работает|Закрыто навсегда|не работает") {
      $signals += @{ level = "warning"; message = "Яндекс Карты нашли карточку по адресу/названию с пометкой 'Больше не работает'. Это red flag и требует ручной проверки." }
      if ($status -eq "ok") { $status = "candidate_review" }
    }
    if ($Code -eq "2gis_reviews" -and $status -eq "ok" -and -not $foundByInn) {
      $signals += @{ level = "warning"; message = "2GIS нашел карточку не по ИНН, а по названию/адресу. Нужно сверить адрес, контакты и профиль компании вручную." }
    }
    $purpose = if ($Code -eq "yandex_maps_reviews") { "contacts_and_address" } elseif ($Code -eq "2gis_reviews") { "company_card_by_name" } else { "static_html_probe" }
    return New-SourceResult -Code $Code -Title $Title -Status $status -Url $Url -Collected ([ordered]@{
      page_title = $titleText
      searched_inn = $Inn
      searched_company_name = $CompanyName
      searched_address = $Address
      searched_city = $city
      city_slug = $citySlug
      fallback_address_url = $addressUrl
      found_by_inn_in_static_html = $foundByInn
      found_by_name_in_static_html = $foundByName
      found_by_city_in_static_html = $foundByCity
      found_by_address_in_static_html = $foundByAddress
      collection_mode = "static_html_probe"
      purpose = $purpose
    }) -Signals $signals -NextActions @(
      "Open the prepared map search and verify address, phone, email/site and organization card.",
      "Map services load details dynamically; use a browser collector/API before treating not_found as a real absence."
    )
  }
  catch {
    $isNotFound = $_.Exception.Message -match "\(404\)|404|Не найден"
    return New-SourceResult -Code $Code -Title $Title -Status $(if ($isNotFound) { "not_found" } else { "error" }) -Url $Url -Collected @{
      searched_inn = $Inn
      searched_company_name = $CompanyName
      searched_address = $Address
      searched_city = Get-CityFromAddress $Address
      collection_mode = "static_html_probe"
    } -Errors @($_.Exception.Message)
  }
}

function New-YandexMapCandidateSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [string]$Address = "",
    [array]$SearchQueries = @()
  )
  $city = Get-CityFromAddress $Address
  $cityPath = Get-YandexCityPath $city
  $queries = @($SearchQueries | Where-Object { $_ -and ($_ -replace "\D+", "") -ne $Inn } | ForEach-Object { Normalize-CompanyQuery $_ })
  $queries += @(Get-MapCompanySearchQueries $CompanyName)
  $queries = Select-UniqueTextPreserveOrder @($queries | ForEach-Object { "$_" } | Where-Object { $_ })
  if ($queries.Count -eq 0) { $queries = @($CompanyName, $Inn) | Where-Object { $_ } }
  $attempts = @()
  foreach ($query in ($queries | Select-Object -First 8)) {
    $encoded = [System.Uri]::EscapeDataString($query)
    $url = if ($cityPath) { "https://yandex.ru/maps/$cityPath/?text=$encoded" } else { "https://yandex.ru/maps/?text=$encoded" }
    $attempts += [ordered]@{
      mode = "browser_candidate"
      query = $query
      url = $url
      status = "candidate_review"
      note = "Браузерный сбор откроет выдачу, перейдет в карточку и сверит отзывы по найденной странице."
    }
  }
  $firstUrl = if ($attempts.Count -gt 0) { $attempts[0].url } else { "https://yandex.ru/maps/" }
  return New-SourceResult -Code "yandex_maps_reviews" -Title "Яндекс Карты" -Status "candidate_review" -Url $firstUrl -Collected ([ordered]@{
    searched_inn = $Inn
    searched_company_name = $CompanyName
    searched_address = $Address
    searched_city = $city
    search_city_path = $cityPath
    search_attempts = $attempts
    reviews_url = $firstUrl
    collection_mode = "browser_map_search_candidate"
    candidate_reason = "Яндекс Карты рендерят карточку динамически; подтверждение названия/адреса и сбор отзывов выполняет браузерный адаптер."
  }) -NextActions @(
    "Запустить сбор: браузерный адаптер откроет кандидат, перейдет на вкладку отзывов и сохранит финальную ссылку карточки.",
    "Если сайт откроет антибот-проверку, запустить сервер с PZ_BROWSER_HEADFUL=1 и пройти проверку один раз."
  )
}

function Invoke-2GisApiSource {
  param(
    [string]$Inn,
    [string]$CompanyName,
    [string]$Address = "",
    [string]$ApiKey = "",
    [array]$SearchQueries = @()
  )
  $city = Get-CityFromAddress $Address
  $citySlug = Get-2GisCitySlug $city
  $cityPoint = Get-2GisCityPoint $city
  $mapQueries = @($SearchQueries | Where-Object { $_ -and ($_ -replace "\D+", "") -ne $Inn } | ForEach-Object { Normalize-CompanyQuery $_ })
  $mapQueries += @(Get-MapCompanySearchQueries $CompanyName)
  $mapQueries = Select-UniqueTextPreserveOrder @($mapQueries | ForEach-Object { "$_" } | Where-Object { $_ })
  $publicSearchText = if ($mapQueries.Count -gt 0) { $mapQueries[0] } elseif ($Address) { $Address } else { $Inn }
  $publicSearchUrl = if ($citySlug) { "https://2gis.ru/$citySlug/search/$([System.Uri]::EscapeDataString($publicSearchText))" } else { "https://2gis.ru/search/$([System.Uri]::EscapeDataString($publicSearchText))" }
  $fields = "items.point,items.contact_groups,items.reviews,items.external_content,items.rubrics,items.org"
  $attempts = @()
  if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    foreach ($mapQuery in ($mapQueries | Select-Object -First 8)) {
      $searchUrl = if ($citySlug) { "https://2gis.ru/$citySlug/search/$([System.Uri]::EscapeDataString($mapQuery))" } else { "https://2gis.ru/search/$([System.Uri]::EscapeDataString($mapQuery))" }
      $attempts += [ordered]@{
        mode = "public_search"
        query = $mapQuery
        url = $searchUrl
        status = "candidate_review"
      }
    }
    return New-SourceResult -Code "2gis_reviews" -Title "2GIS карточка организации" -Status "candidate_review" -Url $publicSearchUrl -Collected ([ordered]@{
      searched_inn = $Inn
      searched_company_name = $CompanyName
      searched_address = $Address
      searched_city = $city
      search_city_slug = $citySlug
      collection_mode = "2gis_places_api"
      api_key_configured = $false
      search_attempts = $attempts
    }) -NextActions @(
      "Браузерный сбор откроет подготовленные ссылки поиска 2GIS и сохранит финальную карточку, если сайт не потребует антибот-проверку.",
      "Если 2GIS откроет /museum, запустить сервер с PZ_BROWSER_HEADFUL=1 и пройти проверку один раз."
    )
  }

  $queries = @()
  foreach ($mapQuery in $mapQueries) {
    $queries += @{ mode = "name"; text = $mapQuery }
  }
  if ($queries.Count -eq 0 -and $Inn) { $queries += @{ mode = "inn"; text = $Inn } }

  foreach ($query in $queries) {
    if ([string]::IsNullOrWhiteSpace($query.text)) { continue }
    $apiUrl = "https://catalog.api.2gis.com/3.0/items?q=$([System.Uri]::EscapeDataString($query.text))&fields=$([System.Uri]::EscapeDataString($fields))&key=$([System.Uri]::EscapeDataString($ApiKey))"
    if ($cityPoint) { $apiUrl = "$apiUrl&point=$([System.Uri]::EscapeDataString($cityPoint))&radius=50000" }
    try {
      $response = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers @{
        "Accept" = "application/json"
        "User-Agent" = "PlusZvenoCompanyCheck/0.2"
      } -TimeoutSec 25
      $items = @($response.result.items)
      $attempts += [ordered]@{
        mode = $query.mode
        query = $query.text
        status = "$($response.meta.code)"
        count = $items.Count
      }
      $branchItems = @($items | Where-Object { $_.type -eq "branch" })
      $candidateItems = if ($branchItems.Count -gt 0) { $branchItems } else { $items }
      $selected = @($candidateItems | Where-Object { Test-2GisCandidateMatch $_ $CompanyName $Address $city $query.mode } | Select-Object -First 1)
      if ($selected.Count -gt 0) { $selected = $selected[0] } else { $selected = $null }
      if ($items.Count -gt 0 -and -not $selected) {
        $first = $items[0]
        $attempts[-1].rejected_first_result = "$($first.name)"
        $attempts[-1].rejected_reason = "2GIS вернул карточку без достаточного совпадения по названию/адресу."
      }
                          if ($selected) {
                            $itemId = "$($selected.id)"
                            $reviewsUrl = if ($citySlug -and $itemId) { "https://2gis.ru/$citySlug/firm/$itemId/tab/reviews" } elseif ($itemId) { "https://2gis.ru/firm/$itemId/tab/reviews" } else { $publicSearchUrl }
        $contacts = @()
        foreach ($group in @($selected.contact_groups)) {
          foreach ($contact in @($group.contacts)) {
            $contacts += [ordered]@{
              type = "$($contact.type)"
              text = "$($contact.text)"
              value = "$($contact.value)"
            }
          }
        }
                            $signals = @()
                            if ($query.mode -ne "inn") {
                              $signals += @{ level = "warning"; message = "2GIS нашел карточку по запросу '$($query.text)', не по ИНН. Нужно сверить адрес и профиль вручную." }
                            }
                            return New-SourceResult -Code "2gis_reviews" -Title "2GIS карточка организации" -Status "ok" -Url $reviewsUrl -Collected ([ordered]@{
          api_item_id = $itemId
          api_org_id = if ($selected.org) { "$($selected.org.id)" } else { "" }
          name = "$($selected.name)"
          org_name = if ($selected.org) { "$($selected.org.name)" } else { "" }
          address = "$($selected.address_name)"
          address_comment = "$($selected.address_comment)"
          city = $city
          point = if ($selected.point) { "$($selected.point.lat), $($selected.point.lon)" } else { "" }
          rating = if ($selected.reviews) { "$($selected.reviews.general_rating)" } else { "" }
          rating_text = if ($selected.reviews -and $selected.reviews.general_rating) { "$($selected.reviews.general_rating) из 5" } else { "" }
          rating_count = if ($selected.reviews) { "$($selected.reviews.general_review_count_with_stars)" } else { "" }
          rating_count_text = if ($selected.reviews -and $selected.reviews.general_review_count_with_stars) { "$($selected.reviews.general_review_count_with_stars) оценок" } else { "" }
          review_count = if ($selected.reviews) { "$($selected.reviews.general_review_count)" } else { "" }
          review_count_text = if ($selected.reviews -and $selected.reviews.general_review_count) { "$($selected.reviews.general_review_count) отзывов" } else { "" }
          rubrics = @($selected.rubrics | ForEach-Object { $_.name })
          contacts = $contacts
          search_attempts = $attempts
          api_query_used = $query.text
          api_match_mode = $query.mode
          collection_mode = "2gis_places_api"
          reviews_url = $reviewsUrl
                              }) -Signals $signals -NextActions @(
                              "Тексты отзывов собрать отдельным HTML-сбором по ссылке на вкладку отзывов 2GIS.",
                              "Если API нашел карточку не по ИНН, сверить название и адрес с Checko."
                            )
      }
    }
    catch {
      $attempts += [ordered]@{
        mode = $query.mode
        query = $query.text
        error = $_.Exception.Message
      }
    }
  }

  foreach ($mapQuery in ($mapQueries | Select-Object -First 8)) {
    $searchUrl = if ($citySlug) { "https://2gis.ru/$citySlug/search/$([System.Uri]::EscapeDataString($mapQuery))" } else { "https://2gis.ru/search/$([System.Uri]::EscapeDataString($mapQuery))" }
    $attempts += [ordered]@{
      mode = "public_search"
      query = $mapQuery
      url = $searchUrl
      status = "candidate_review"
    }
  }
  return New-SourceResult -Code "2gis_reviews" -Title "2GIS карточка организации" -Status "candidate_review" -Url $publicSearchUrl -Collected ([ordered]@{
          searched_inn = $Inn
    searched_company_name = $CompanyName
    searched_address = $Address
    searched_city = $city
    search_city_slug = $citySlug
    search_attempts = $attempts
    collection_mode = "2gis_places_api"
    api_key_configured = $true
    candidate_reason = "2GIS API не подтвердил карточку автоматически, но подготовлена ссылка поиска по названию для ручной сверки."
  }) -NextActions @(
    "Откройте подготовленную ссылку 2GIS, сверьте карточку по названию, адресу и профилю.",
    "Тексты отзывов 2GIS собираются только из HTML страницы отзывов."
  )
}

function New-InternalSource {
  param([string]$Inn)
  $path = ".\company_check\internal_cases.json"
  # TODO for AI: replace this placeholder with real PlusZveno internal history:
  # disputes, confirmed projects, worker/company reviews, contract mismatches and resolved incidents.
  $collected = [ordered]@{
    disputes = @()
    confirmed_projects = @()
    vacancy_contract_mismatches = @()
    reviews = @()
  }
  if (-not (Test-Path $path)) {
    return New-SourceResult -Code "pluszveno_internal" -Title "Внутренняя история ПлюсЗвена" -Status "configured" -Url $path -Collected $collected -Errors @("Внутренняя база истории пока не подключена.") -NextActions @(
      "Подключить реальные споры, отзывы, проверки вакансий и подтвержденные проекты после появления базы."
    )
  }
  try {
    $payload = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
    if ($payload.ContainsKey($Inn)) {
      foreach ($key in $payload[$Inn].Keys) {
        $collected[$key] = $payload[$Inn][$key]
      }
    }
    return New-SourceResult -Code "pluszveno_internal" -Title "Внутренняя история ПлюсЗвена" -Status "ok" -Url $path -Collected $collected
  }
  catch {
    return New-SourceResult -Code "pluszveno_internal" -Title "Внутренняя история ПлюсЗвена" -Status "error" -Url $path -Collected $collected -Errors @($_.Exception.Message)
  }
}

function Get-LegalCard {
  param([array]$Sources)
  foreach ($source in $Sources) {
    if ($source.code -eq "fns_egrul" -and $source.collected.Count -gt 0) {
      return $source.collected
    }
  }
  return @{}
}

function Get-Risk {
  param([array]$Sources, [hashtable]$LegalCard)
  $score = 0
  $summary = @()
  $sourceItems = @($Sources | Where-Object { $_.code })
  $hasCriticalStop = Has-CriticalStop $sourceItems
  if ($LegalCard.Count -eq 0) {
    $score += 25
    $summary += "Юридическая карточка ФНС не была собрана автоматически."
  }
  else {
    $summary += "Юридическая карточка ФНС найдена: $($LegalCard.name)."
  }
  $manualCount = ($sourceItems | Where-Object { $_.status -eq "manual_review" }).Count
  if ($manualCount -gt 0 -and -not $hasCriticalStop) {
    $summary += "Требуется ручная проверка источников: $manualCount."
  }
  foreach ($source in $sourceItems) {
    if ($source.code -eq "checko_company_card" -and $source.collected -and $source.collected.reliability_facts) {
      $facts = $source.collected.reliability_facts
      $riskFacts = @()
      foreach ($bucketName in @("negative", "attention")) {
        $bucket = $null
        if ($facts -is [System.Collections.IDictionary]) {
          $bucket = $facts[$bucketName]
        }
        elseif ($facts.PSObject.Properties[$bucketName]) {
          $bucket = $facts.PSObject.Properties[$bucketName].Value
        }
        if ($bucket -is [System.Collections.IDictionary]) {
          $riskFacts += @($bucket.Values)
        }
        elseif ($bucket -is [array]) {
          $riskFacts += @($bucket)
        }
        elseif ($bucket) {
          $riskFacts += "$bucket"
        }
      }
      foreach ($fact in @($riskFacts | Where-Object { $_ })) {
        $factText = "$fact"
        if ($factText -match "банкрот|Федресурс|ФССП|исполнительн|задолж|отрицательн.*денежн.*поток") {
          $score += 15
          $summary += "$($source.title): $factText"
        }
      }
    }
    foreach ($signal in $source.signals) {
      if ($signal.level -eq "critical") { $score += 40 }
      elseif ($signal.level -eq "warning") {
        $message = "$($signal.message)"
        if ($message -match "Больше не работает|Закрыто|ликвид|банкрот|РНП|недобросовест|red flag") {
          $score += 15
        }
      }
      $summary += "$($source.title): $($signal.message)"
    }
    if ($source.status -eq "error") {
      $score += 10
      $summary += "$($source.title): автоматический сбор не удался."
    }
  }
  if ($score -gt 100) { $score = 100 }
  return @{ score = $score; summary = $summary }
}

function Get-PlatformStatus {
  param([int]$RiskScore, [array]$Sources)
  foreach ($source in $Sources) {
    foreach ($signal in $source.signals) {
      if ($signal.level -eq "critical") { return "violator" }
    }
  }
  if ($RiskScore -ge 70) { return "violator" }
  if ($RiskScore -ge 30) { return "signals_found" }
  return "open_data"
}

function Has-CriticalStop {
  param([array]$Sources)
  foreach ($source in $Sources) {
    foreach ($signal in @($source.signals)) {
      $message = "$($signal.message)".ToLowerInvariant()
      if ($signal.level -eq "critical" -and ($message -match "ликвид|банкрот|исключ|недействующ")) {
        return $true
      }
    }
  }
  return $false
}

function ConvertTo-ReportValue {
  param($Value)
  if ($null -eq $Value) { return "" }
  if ($Value -is [string] -or $Value.GetType().IsPrimitive) { return "$Value" }
  try {
    return ($Value | ConvertTo-Json -Depth 8 -Compress)
  }
  catch {
    return "$Value"
  }
}

function ConvertTo-Markdown {
  param([hashtable]$Report)
  $lines = @()
  $lines += "# Company check report for INN $($Report.inn)"
  $lines += ""
  $lines += "- Generated at: $($Report.generated_at)"
  $lines += "- Platform status: **$($Report.platform_status)**"
  $lines += "- Risk: **$($Report.risk_score)/100**"
  $lines += ""
  $lines += "## Summary"
  foreach ($item in $Report.summary) { $lines += "- $item" }
  $lines += ""
  $lines += "## Legal card"
  if ($Report.legal_card.Count -eq 0) {
    $lines += "- Not collected automatically."
  }
  else {
    foreach ($key in $Report.legal_card.Keys) {
      $lines += "- ${key}: $($Report.legal_card[$key])"
    }
  }
  $lines += ""
  $lines += "## Sources and collected fields"
  foreach ($source in $Report.sources) {
    $lines += ""
    $lines += "### $($source.title)"
    $lines += "- Collection status: $($source.status)"
    $lines += "- URL: $($source.url)"
    if ($source.collected.ContainsKey("planned_fields")) {
      $lines += "- Planned fields: $($source.collected.planned_fields -join ', ')"
    }
    elseif ($source.collected.Count -gt 0) {
      $lines += "- Data:"
      foreach ($key in $source.collected.Keys) {
        $lines += "  - ${key}: $(ConvertTo-ReportValue $source.collected[$key])"
      }
    }
    if ($source.signals.Count -gt 0) {
      $lines += "- Signals:"
      foreach ($signal in $source.signals) {
        $lines += "  - $($signal.level): $($signal.message)"
      }
    }
    if ($source.errors.Count -gt 0) {
      $lines += "- Errors:"
      foreach ($errorItem in $source.errors) {
        $lines += "  - $errorItem"
      }
    }
    if ($source.next_actions.Count -gt 0) {
      $lines += "- Next actions:"
      foreach ($action in $source.next_actions) {
        $lines += "  - $action"
      }
    }
  }
  return ($lines -join [Environment]::NewLine)
}

$normalizedInn = Normalize-Inn $Inn
$encodedInn = [System.Uri]::EscapeDataString($normalizedInn)
$sourcesList = [System.Collections.ArrayList]::new()
Add-TimedSource $sourcesList "ФНС ЕГРЮЛ" { Invoke-FnsEgrul $normalizedInn }
Add-TimedSource $sourcesList "Checko" { Invoke-CheckoSource $normalizedInn }
$sources = @($sourcesList)
$checkoResult = @($sources | Where-Object { $_.code -eq "checko_company_card" } | Select-Object -First 1)[0]
if (-not (Has-CriticalStop $sources)) {
  Add-TimedSource $sourcesList "БО ФНС из Checko" { New-BoNalogSource $normalizedInn $checkoResult }
  Add-TimedSource $sourcesList "Контакты из Checko" { New-CheckoContactsSource $checkoResult }
  $sources = @($sourcesList)
  $companyNameForReviews = ""
  $fnsResult = @($sources | Where-Object { $_.code -eq "fns_egrul" } | Select-Object -First 1)
  if ($fnsResult -and $fnsResult[0].collected -and $fnsResult[0].collected.Contains("name")) {
    $companyNameForReviews = $fnsResult[0].collected.name
  }
  if (-not $companyNameForReviews -and $checkoResult.collected -and $checkoResult.collected.Contains("name")) {
    $companyNameForReviews = $checkoResult.collected.name
  }
  if (-not $companyNameForReviews) { $companyNameForReviews = $normalizedInn }
  $manualSearchQueries = @($SearchQuery -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $mapAddress = ""
  if ($fnsResult -and $fnsResult[0].collected -and $fnsResult[0].collected.Contains("address")) { $mapAddress = $fnsResult[0].collected.address }
  if (-not $mapAddress -and $checkoResult.collected.address) { $mapAddress = $checkoResult.collected.address }
  if (-not $QuickOnly) {
    Add-TimedSource $sourcesList "Арбитраж из Checko" { New-KadArbitrSource $normalizedInn $companyNameForReviews $checkoResult }
    Add-TimedSource $sourcesList "DreamJob" { Invoke-DreamJobSource $normalizedInn $companyNameForReviews $manualSearchQueries }
    Add-TimedSource $sourcesList "Antijob" { Invoke-AntijobSource $normalizedInn $companyNameForReviews $manualSearchQueries }
    $mapCity = Get-CityFromAddress $mapAddress
    $map2GisCitySlug = Get-2GisCitySlug $mapCity
    Add-TimedSource $sourcesList "Яндекс Карты" { New-YandexMapCandidateSource $normalizedInn $companyNameForReviews $mapAddress $manualSearchQueries }
    Add-TimedSource $sourcesList "2GIS" { Invoke-2GisApiSource $normalizedInn $companyNameForReviews $mapAddress $DgisApiKey $manualSearchQueries }
    Add-TimedSource $sourcesList "Внутренняя история" { New-InternalSource $normalizedInn }
    $sources = @($sourcesList)
  }
}

$legalCard = Get-LegalCard $sources
$risk = Get-Risk $sources $legalCard
$platformStatus = Get-PlatformStatus $risk.score $sources
$report = [ordered]@{
  inn = $normalizedInn
  generated_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platform_status = $platformStatus
  risk_score = $risk.score
  summary = $risk.summary
  legal_card = $legalCard
  confirmation_channels = @(@{
    type = "manual_required"
    value = "Official email or phone is not confirmed automatically"
    source = "contacts_public"
  })
  diagnostics = [ordered]@{
    quick_only = [bool]$QuickOnly
    source_timings = @($SourceTimings)
  }
  sources = $sources
}

$jsonOutput = $report | ConvertTo-Json -Depth 12
if ($JsonOnly) {
  Write-Output $jsonOutput
  return
}

if (-not $NoSave) {
  New-Item -ItemType Directory -Force -Path $Out | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $jsonPath = Join-Path $Out "company_${normalizedInn}_${stamp}.json"
  $mdPath = Join-Path $Out "company_${normalizedInn}_${stamp}.md"
  $jsonOutput | Set-Content -Path $jsonPath -Encoding UTF8
  ConvertTo-Markdown $report | Set-Content -Path $mdPath -Encoding UTF8

  Write-Host "JSON: $jsonPath"
  Write-Host "Markdown: $mdPath"
}
Write-Host "Status: $platformStatus, risk: $($risk.score)/100"
