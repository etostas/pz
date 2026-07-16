param(
  [Parameter(Mandatory = $true)]
  [string]$Inn,

  [Parameter(Mandatory = $true)]
  [string]$CampaignId,

  [string]$CompanyName = "",

  [int]$Port = 8792,

  [string]$ApiBase = "http://127.0.0.1:8788",

  [string]$InboxSecret = $env:MESSENGER_INBOX_SECRET,

  [string]$BridgeSecret = $env:MAX_BRIDGE_SECRET
)

$ErrorActionPreference = "Stop"

function Send-Json {
  param($Context, $Value, [int]$StatusCode = 200)
  $json = $Value | ConvertTo-Json -Depth 20
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "application/json; charset=utf-8"
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Invoke-LocalJson {
  param([string]$Path, [hashtable]$Body)
  $json = $Body | ConvertTo-Json -Depth 20
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($InboxSecret)) {
    $headers["X-PlusZveno-Secret"] = $InboxSecret
  }
  Invoke-RestMethod -Method Post -Uri "$ApiBase$Path" -ContentType "application/json; charset=utf-8" -Headers $headers -Body $json -TimeoutSec 60
}

function First-Value {
  param([object[]]$Values)
  foreach ($value in $Values) {
    if ($null -ne $value -and "$value" -ne "") { return "$value" }
  }
  return ""
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "Max webhook bridge: http://127.0.0.1:$Port/"
Write-Host "Campaign: $CampaignId, INN: $Inn"
Write-Host "Use a public HTTPS tunnel or platform adapter to POST incoming private messages here."
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $context = $listener.GetContext()
  try {
    if ($context.Request.HttpMethod -ne "POST") {
      Send-Json $context @{ error = "POST only" } 405
      continue
    }
    if ($BridgeSecret) {
      $provided = $context.Request.Headers["X-Max-Bridge-Secret"]
      if ($provided -ne $BridgeSecret) {
        Send-Json $context @{ error = "forbidden" } 403
        continue
      }
    }

    $reader = [System.IO.StreamReader]::new($context.Request.InputStream, [System.Text.Encoding]::UTF8)
    $raw = $reader.ReadToEnd()
    $reader.Close()
    $payload = $raw | ConvertFrom-Json

    $message = if ($payload.message) { $payload.message } elseif ($payload.update.message) { $payload.update.message } else { $payload }
    $text = First-Value @($message.text, $message.body.text, $message.content.text, $payload.text)
    $authorId = First-Value @($message.sender.id, $message.from.id, $message.user.id, $payload.author_id, $payload.user_id)
    $chatId = First-Value @($message.chat.id, $message.dialog.id, $message.recipient.id, $payload.chat_id, $payload.dialog_id)
    $isPrivate = $true
    if ($null -ne $payload.private_message) { $isPrivate = [bool]$payload.private_message }
    elseif ($message.chat.type -and "$($message.chat.type)" -notin @("private", "dialog", "direct")) { $isPrivate = $false }

    if (-not $isPrivate) {
      Send-Json $context @{ saved = $false; error = "Only private messages are accepted." } 400
      continue
    }
    if ([string]::IsNullOrWhiteSpace($text)) {
      Send-Json $context @{ saved = $false; error = "No text found in payload." } 400
      continue
    }

    $campaignInText = [regex]::Match($text, 'pz-\d{10,15}-\d{14}')
    $messageCampaignId = if ($campaignInText.Success) { $campaignInText.Value } else { $CampaignId }
    $cleanText = ($text -replace [regex]::Escape($messageCampaignId), "").Trim()
    if ($cleanText.Length -lt 10) {
      Send-Json $context @{ saved = $false; error = "Text is too short." } 400
      continue
    }

    $result = Invoke-LocalJson "/api/messenger-inbox" @{
      inn = $Inn
      company_name = $CompanyName
      campaign_id = $messageCampaignId
      platform = "max"
      chat_id = $chatId
      author_id = $authorId
      private_message = $true
      consent = $true
      role = "not specified"
      text = $cleanText
    }
    Send-Json $context @{ saved = $result.saved; duplicate = $result.duplicate; response_id = $result.response.response_id }
  }
  catch {
    Write-Warning $_.Exception.Message
    try { Send-Json $context @{ error = $_.Exception.Message } 500 } catch {}
  }
}
