param(
  [Parameter(Mandatory = $true)]
  [string]$Inn,

  [string]$CampaignId = "",

  [string]$CompanyName = "",

  [string]$ApiBase = "http://127.0.0.1:8788",

  [string]$InboxSecret = $env:MESSENGER_INBOX_SECRET,

  [string]$BotToken = $env:TELEGRAM_BOT_TOKEN,

  [string[]]$ChatIds = @(),

  [switch]$PostPrompt
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BotToken)) {
  throw "Set TELEGRAM_BOT_TOKEN or pass -BotToken."
}

function Invoke-TelegramApi {
  param([string]$Method, [hashtable]$Body)
  Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BotToken/$Method" -Body $Body -TimeoutSec 60
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

if (-not $CampaignId) {
  $campaign = Invoke-LocalJson "/api/messenger-campaigns" @{
    inn = $Inn
    company_name = $CompanyName
    platforms = @("telegram")
    chat_ids = $ChatIds
  }
  $CampaignId = $campaign.campaign.campaign_id
  $Prompt = $campaign.campaign.prompt
}
else {
  $subject = if ($CompanyName) { $CompanyName } else { "company INN $Inn" }
  $Prompt = "PlusZveno checks information about $subject. If you worked with this company, send this bot a private message with campaign code $CampaignId and factual details: role, period, site/city, promised terms and actual terms. Do not post personal data of other people in the chat."
}

if ($PostPrompt) {
  foreach ($chatId in $ChatIds) {
    if ([string]::IsNullOrWhiteSpace($chatId)) { continue }
    Invoke-TelegramApi "sendMessage" @{
      chat_id = $chatId
      text = $Prompt
      disable_web_page_preview = "true"
    } | Out-Null
    Write-Host "Prompt sent to Telegram chat $chatId"
  }
}

Write-Host "Telegram bot is collecting private replies for campaign $CampaignId and INN $Inn."
Write-Host "Press Ctrl+C to stop."

$offset = 0
while ($true) {
  try {
    $updates = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$BotToken/getUpdates?timeout=45&offset=$offset" -TimeoutSec 60
    foreach ($update in @($updates.result)) {
      $offset = [int64]$update.update_id + 1
      $message = $update.message
      if (-not $message -or -not $message.text) { continue }
      if ($message.chat.type -ne "private") { continue }

      $text = [string]$message.text
      if ($text -match "^/start") {
        Invoke-TelegramApi "sendMessage" @{
          chat_id = $message.chat.id
          text = "Send campaign code $CampaignId and your review in one message. Include role, period, city/site and facts without personal data of other people."
        } | Out-Null
        continue
      }

      $campaignInText = [regex]::Match($text, 'pz-\d{10,15}-\d{14}')
      $messageCampaignId = if ($campaignInText.Success) { $campaignInText.Value } else { $CampaignId }
      $cleanText = ($text -replace [regex]::Escape($messageCampaignId), "").Trim()
      if ($cleanText.Length -lt 10) {
        Invoke-TelegramApi "sendMessage" @{
          chat_id = $message.chat.id
          text = "Please add factual details: your role, work period, site/city and what exactly should be checked."
        } | Out-Null
        continue
      }

      $result = Invoke-LocalJson "/api/messenger-inbox" @{
        inn = $Inn
        company_name = $CompanyName
        campaign_id = $messageCampaignId
        platform = "telegram"
        chat_id = "$($message.chat.id)"
        author_id = "$($message.from.id)"
        private_message = $true
        consent = $true
        role = "not specified"
        text = $cleanText
      }
      $reply = if ($result.duplicate) {
        "This response looks already saved. Thank you."
      }
      else {
        "Thank you. The response is saved and will be moderated before report usage."
      }
      Invoke-TelegramApi "sendMessage" @{
        chat_id = $message.chat.id
        text = $reply
      } | Out-Null
    }
  }
  catch {
    Write-Warning $_.Exception.Message
    Start-Sleep -Seconds 5
  }
}
