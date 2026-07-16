param(
  [Parameter(Mandatory = $true)]
  [string]$Inn,

  [Parameter(Mandatory = $true)]
  [string]$CampaignId,

  [string]$CompanyName = "",

  [int]$Port = 8791,

  [string]$ApiBase = "http://127.0.0.1:8788",

  [string]$InboxSecret = $env:MESSENGER_INBOX_SECRET,

  [string]$VkConfirmation = $env:VK_CALLBACK_CONFIRMATION,

  [string]$VkSecret = $env:VK_CALLBACK_SECRET,

  [string]$VkGroupToken = $env:VK_GROUP_TOKEN,

  [string]$VkApiVersion = "5.199"
)

$ErrorActionPreference = "Stop"

function Send-Text {
  param($Context, [string]$Text, [int]$StatusCode = 200)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = "text/plain; charset=utf-8"
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

function Send-VkMessage {
  param([string]$PeerId, [string]$Text)
  if ([string]::IsNullOrWhiteSpace($VkGroupToken)) { return }
  $body = @{
    access_token = $VkGroupToken
    v = $VkApiVersion
    peer_id = $PeerId
    random_id = Get-Random
    message = $Text
  }
  try {
    Invoke-RestMethod -Method Post -Uri "https://api.vk.com/method/messages.send" -Body $body -TimeoutSec 30 | Out-Null
  }
  catch {
    Write-Warning $_.Exception.Message
  }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "VK callback bridge: http://127.0.0.1:$Port/"
Write-Host "Campaign: $CampaignId, INN: $Inn"
Write-Host "Expose this local URL through a public HTTPS tunnel for VK Callback API."
Write-Host "Press Ctrl+C to stop."

while ($true) {
  $context = $listener.GetContext()
  try {
    if ($context.Request.HttpMethod -ne "POST") {
      Send-Text $context "POST only" 405
      continue
    }
    $reader = [System.IO.StreamReader]::new($context.Request.InputStream, [System.Text.Encoding]::UTF8)
    $raw = $reader.ReadToEnd()
    $reader.Close()
    $payload = $raw | ConvertFrom-Json

    if ($VkSecret -and $payload.secret -ne $VkSecret) {
      Send-Text $context "forbidden" 403
      continue
    }

    if ($payload.type -eq "confirmation") {
      if ([string]::IsNullOrWhiteSpace($VkConfirmation)) {
        Send-Text $context "VK_CALLBACK_CONFIRMATION is not set" 500
      }
      else {
        Send-Text $context $VkConfirmation
      }
      continue
    }

    if ($payload.type -ne "message_new") {
      Send-Text $context "ok"
      continue
    }

    $message = $payload.object.message
    if (-not $message -or -not $message.text) {
      Send-Text $context "ok"
      continue
    }

    $text = [string]$message.text
    $campaignInText = [regex]::Match($text, 'pz-\d{10,15}-\d{14}')
    $messageCampaignId = if ($campaignInText.Success) { $campaignInText.Value } else { $CampaignId }
    $cleanText = ($text -replace [regex]::Escape($messageCampaignId), "").Trim()
    if ($cleanText.Length -lt 10) {
      Send-VkMessage "$($message.peer_id)" "Please add role, period, site/city and factual details."
      Send-Text $context "ok"
      continue
    }

    $result = Invoke-LocalJson "/api/messenger-inbox" @{
      inn = $Inn
      company_name = $CompanyName
      campaign_id = $messageCampaignId
      platform = "vk"
      chat_id = "$($message.peer_id)"
      author_id = "$($message.from_id)"
      private_message = $true
      consent = $true
      role = "not specified"
      text = $cleanText
    }

    if ($result.duplicate) {
      Send-VkMessage "$($message.peer_id)" "This response looks already saved. Thank you."
    }
    else {
      Send-VkMessage "$($message.peer_id)" "Thank you. The response is saved and will be moderated before report usage."
    }
    Send-Text $context "ok"
  }
  catch {
    Write-Warning $_.Exception.Message
    try { Send-Text $context "error" 500 } catch {}
  }
}
