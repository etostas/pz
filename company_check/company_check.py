#!/usr/bin/env python3
"""Build a PlusZveno company due-diligence report by INN.

The checker separates three cases:
- automatic: a public endpoint can be queried without credentials;
- configured: the source needs a token, partner feed, or internal database;
- manual_review: the source has a public search page, but no stable public API.

The output is meant for the admin interface and for a PlusZveno representative
who confirms vacancies and company accounts.
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
INTERNAL_CASES = ROOT / "internal_cases.json"


@dataclass
class SourceResult:
  code: str
  title: str
  status: str
  url: str
  collected: dict[str, Any] = field(default_factory=dict)
  signals: list[dict[str, str]] = field(default_factory=list)
  errors: list[str] = field(default_factory=list)
  next_actions: list[str] = field(default_factory=list)


@dataclass
class CompanyReport:
  inn: str
  generated_at: str
  platform_status: str
  risk_score: int
  summary: list[str]
  legal_card: dict[str, Any]
  confirmation_channels: list[dict[str, str]]
  sources: list[SourceResult]
  representative_checklist: list[str]


class HttpClient:
  def __init__(self, timeout: int = 20, delay: float = 0.6) -> None:
    self.timeout = timeout
    self.delay = delay
    self.last_request = 0.0

  def request_json(
    self,
    url: str,
    method: str = "GET",
    data: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
  ) -> Any:
    body = None
    if data is not None:
      body = urllib.parse.urlencode(data).encode("utf-8")
    elapsed = time.time() - self.last_request
    if elapsed < self.delay:
      time.sleep(self.delay - elapsed)
    request = urllib.request.Request(
      url,
      data=body,
      method=method,
      headers={
        "User-Agent": "PlusZvenoCompanyCheck/0.1 contact: check@pluszveno.local",
        "Accept": "application/json,text/plain,*/*",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        **(headers or {}),
      },
    )
    self.last_request = time.time()
    with urllib.request.urlopen(request, timeout=self.timeout) as response:
      payload = response.read()
      charset = response.headers.get_content_charset() or "utf-8"
    return json.loads(payload.decode(charset, errors="replace"))


class FnsEgrulSource:
  code = "fns_egrul"
  title = "ФНС: ЕГРЮЛ/ЕГРИП"
  base_url = "https://egrul.nalog.ru/"

  def collect(self, inn: str, client: HttpClient) -> SourceResult:
    result = SourceResult(
      code=self.code,
      title=self.title,
      status="error",
      url=self.base_url,
      next_actions=[
        "Сверить юридическое лицо, статус, ОГРН, КПП, адрес и руководителя.",
        "Если ФНС не вернула данные автоматически, приложить выписку ЕГРЮЛ вручную.",
      ],
    )
    try:
      search = client.request_json(self.base_url, method="POST", data={"query": inn})
      token = search.get("t")
      if not token:
        result.errors.append("ФНС не вернула токен поиска.")
        return result
      url = f"{self.base_url}search-result/{urllib.parse.quote(token)}"
      data = client.request_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
      result.status = "manual_review"
      result.errors.append(str(exc))
      result.next_actions.append("Автоматический endpoint ФНС не ответил; открыть egrul.nalog.ru и скачать выписку вручную.")
      return result

    rows = data.get("rows") or []
    if not rows:
      result.status = "ok"
      result.signals.append({
        "level": "warning",
        "message": "По указанному ИНН не найдено записей в ответе ФНС.",
      })
      return result

    row = rows[0]
    result.status = "ok"
    result.url = url
    result.collected = {
      "name": row.get("n"),
      "ogrn": row.get("o"),
      "inn": row.get("i"),
      "kpp": row.get("p"),
      "address": row.get("a"),
      "director": row.get("g"),
      "status": row.get("e") or row.get("r"),
      "registration_date": row.get("d"),
      "entity_type": row.get("k"),
    }
    status_text = str(result.collected.get("status") or "").lower()
    if any(word in status_text for word in ["ликвид", "прекращ", "недейств"]):
      result.signals.append({
        "level": "critical",
        "message": "В ответе ФНС есть признак прекращения деятельности или недействующего статуса.",
      })
    return result


class ManualSource:
  def __init__(self, code: str, title: str, url_template: str, what: list[str]) -> None:
    self.code = code
    self.title = title
    self.url_template = url_template
    self.what = what

  def collect(self, inn: str, client: HttpClient) -> SourceResult:
    del client
    return SourceResult(
      code=self.code,
      title=self.title,
      status="manual_review",
      url=self.url_template.format(inn=urllib.parse.quote(inn)),
      collected={"planned_fields": self.what},
      next_actions=[
        "Открыть источник и зафиксировать результат проверки в карточке компании.",
        "При регулярной доступности API заменить ручной источник на автоматический адаптер.",
      ],
    )


class InternalPlusZvenoSource:
  code = "pluszveno_internal"
  title = "ПлюсЗвено: внутренняя история"

  def collect(self, inn: str, client: HttpClient) -> SourceResult:
    del client
    result = SourceResult(
      code=self.code,
      title=self.title,
      status="ok",
      url=str(INTERNAL_CASES),
      collected={
        "disputes": [],
        "confirmed_projects": [],
        "vacancy_contract_mismatches": [],
        "reviews": [],
      },
      next_actions=[
        "После запуска базы подключить реальные диспуты, отзывы и историю проверок вакансий.",
      ],
    )
    if not INTERNAL_CASES.exists():
      result.status = "configured"
      result.errors.append("Файл внутренней истории пока не создан.")
      return result
    try:
      payload = json.loads(INTERNAL_CASES.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
      result.status = "error"
      result.errors.append(str(exc))
      return result
    company = payload.get(inn, {})
    result.collected.update(company)
    for dispute in company.get("disputes", []):
      if dispute.get("status") in {"confirmed_company_fault", "debt_confirmed"}:
        result.signals.append({
          "level": "critical",
          "message": f"Подтвержденный спор: {dispute.get('title', 'без названия')}",
        })
    return result


SOURCES = [
  FnsEgrulSource(),
  ManualSource(
    "bo_nalog",
    "ФНС: государственный информационный ресурс бухгалтерской отчетности",
    "https://bo.nalog.ru/search?query={inn}",
    [
      "выручка",
      "прибыль/убыток",
      "стоимость активов",
      "динамика отчетности",
    ],
  ),
  ManualSource(
    "fedresurs",
    "Федресурс: банкротство и существенные факты",
    "https://fedresurs.ru/search/entity?searchString={inn}",
    [
      "сообщения о банкротстве",
      "ликвидация/реорганизация",
      "существенные факты",
      "залоги и уведомления, если применимо",
    ],
  ),
  ManualSource(
    "kad_arbitr",
    "Картотека арбитражных дел",
    "https://kad.arbitr.ru/",
    [
      "дела в роли ответчика",
      "платежные и подрядные споры",
      "массовость исков",
      "суммы требований",
    ],
  ),
  ManualSource(
    "zakupki_rnp",
    "ЕИС закупки: реестр недобросовестных поставщиков",
    "https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html?searchString={inn}",
    [
      "наличие в РНП",
      "основание включения",
      "срок нахождения в реестре",
    ],
  ),
  ManualSource(
    "fssp",
    "ФССП: исполнительные производства",
    "https://fssp.gov.ru/iss/ip/",
    [
      "активные исполнительные производства",
      "суммы задолженности",
      "характер задолженности",
    ],
  ),
  ManualSource(
    "sro",
    "НОСТРОЙ/НОПРИЗ: членство СРО",
    "https://reestr.nostroy.ru/",
    [
      "членство СРО",
      "уровень ответственности",
      "приостановления и исключения",
    ],
  ),
  ManualSource(
    "contacts_public",
    "Официальные контакты компании",
    "https://www.google.com/search?q={inn}%20официальный%20сайт%20email%20телефон",
    [
      "официальный сайт",
      "официальная почта",
      "официальный телефон",
      "совпадение контактов с вакансией",
    ],
  ),
  ManualSource(
    "checko_company_card",
    "Checko.ru: агрегированная карточка компании",
    "https://checko.ru/search?query={inn}",
    [
      "юридическая карточка и статус",
      "руководитель и учредители",
      "финансовая отчетность и динамика",
      "арбитражные дела",
      "исполнительные производства и долги",
      "проверки и лицензии",
      "связанные компании и массовые признаки",
      "контакты, сайт и адреса, если опубликованы",
    ],
  ),
  ManualSource(
    "dreamjob_reviews",
    "DreamJob: отзывы сотрудников",
    "https://dreamjob.ru/search?query={inn}",
    [
      "общая оценка работодателя",
      "количество отзывов",
      "положительные и отрицательные темы",
      "жалобы на задержки оплаты",
      "жалобы на условия проживания, дорогу, СИЗ и оформление",
      "ответы представителя компании",
    ],
  ),
  ManualSource(
    "yandex_maps_reviews",
    "Яндекс Карты: отзывы по офису/объекту",
    "https://yandex.ru/maps/?text={inn}",
    [
      "карточки компании по ИНН, названию и адресу",
      "рейтинг",
      "количество отзывов",
      "свежие негативные отзывы",
      "жалобы работников и подрядчиков",
      "совпадение адреса с юридическим или проектным адресом",
    ],
  ),
  ManualSource(
    "2gis_reviews",
    "2ГИС: отзывы по офису/объекту",
    "https://2gis.ru/search/{inn}",
    [
      "карточки компании по ИНН, названию и адресу",
      "рейтинг",
      "количество отзывов",
      "свежие негативные отзывы",
      "жалобы работников и подрядчиков",
      "совпадение адреса с юридическим или проектным адресом",
    ],
  ),
  InternalPlusZvenoSource(),
]


def now_iso() -> str:
  return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def validate_inn(value: str) -> str:
  inn = re.sub(r"\D+", "", value)
  if len(inn) not in {10, 12}:
    raise ValueError("ИНН должен содержать 10 цифр для компании или 12 цифр для ИП.")
  return inn


def collect_report(inn: str, only: set[str] | None = None) -> CompanyReport:
  client = HttpClient()
  source_results = []
  for source in SOURCES:
    if only and source.code not in only:
      continue
    source_results.append(source.collect(inn, client))

  legal_card = build_legal_card(source_results)
  confirmation_channels = build_confirmation_channels(source_results)
  risk_score, summary = evaluate_risk(source_results, legal_card)
  platform_status = choose_platform_status(risk_score, source_results)
  return CompanyReport(
    inn=inn,
    generated_at=now_iso(),
    platform_status=platform_status,
    risk_score=risk_score,
    summary=summary,
    legal_card=legal_card,
    confirmation_channels=confirmation_channels,
    sources=source_results,
    representative_checklist=build_checklist(platform_status),
  )


def build_legal_card(results: list[SourceResult]) -> dict[str, Any]:
  for result in results:
    if result.code == "fns_egrul" and result.collected:
      return result.collected
  return {}


def build_confirmation_channels(results: list[SourceResult]) -> list[dict[str, str]]:
  channels: list[dict[str, str]] = []
  for result in results:
    contacts = result.collected.get("contacts") if isinstance(result.collected, dict) else None
    if not isinstance(contacts, list):
      continue
    for contact in contacts:
      if isinstance(contact, dict) and contact.get("value"):
        channels.append({
          "type": str(contact.get("type") or "unknown"),
          "value": str(contact["value"]),
          "source": result.title,
        })
  if not channels:
    channels.append({
      "type": "manual_required",
      "value": "Официальная почта или телефон не подтверждены автоматически",
      "source": "contacts_public",
    })
  return channels


def evaluate_risk(results: list[SourceResult], legal_card: dict[str, Any]) -> tuple[int, list[str]]:
  score = 0
  summary: list[str] = []
  if not legal_card:
    score += 25
    summary.append("Не удалось автоматически собрать юридическую карточку ФНС.")
  else:
    summary.append(f"Юридическая карточка найдена: {legal_card.get('name') or 'название не распознано'}.")

  manual_count = sum(1 for result in results if result.status == "manual_review")
  if manual_count:
    summary.append(f"Требуется ручная сверка источников: {manual_count}.")

  for result in results:
    for signal in result.signals:
      level = signal.get("level")
      if level == "critical":
        score += 40
      elif level == "warning":
        score += 15
      summary.append(f"{result.title}: {signal.get('message')}")
    if result.status == "error":
      score += 10
      summary.append(f"{result.title}: автоматический сбор не завершен.")
  return min(score, 100), summary


def choose_platform_status(risk_score: int, results: list[SourceResult]) -> str:
  has_critical = any(
    signal.get("level") == "critical"
    for result in results
    for signal in result.signals
  )
  if has_critical or risk_score >= 70:
    return "Нарушитель"
  if risk_score >= 30:
    return "Есть сигналы"
  return "По открытым данным"


def build_checklist(status: str) -> list[str]:
  checklist = [
    "Сверить ИНН, ОГРН, КПП и полное юридическое название с ФНС.",
    "Найти официальную почту или телефон на официальном сайте, ФНС/ГИР БО, 2ГИС или в закупочных документах.",
    "Отправить код подтверждения только на официальный канал и сохранить факт отправки.",
    "Сверить условия вакансии: ставка на руки, НДФЛ, дорога, СИЗ, суточные, проживание, график, тип договора.",
    "Запросить трудовой договор и сравнить его с заявленными условиями вакансии.",
    "Проверить проект: заказчик/завод, объект, юрлицо завода, руководитель проекта и срок реализации.",
    "Сверить Checko.ru как агрегатор: финансы, арбитраж, долги, проверки, связи и контакты.",
    "Сверить отзывы DreamJob, Яндекс Карт и 2ГИС: отделить клиентские отзывы от отзывов работников и подрядчиков.",
    "Зафиксировать ручные результаты по судам, Федресурсу, РНП, ФССП и СРО.",
  ]
  if status in {"Есть сигналы", "Нарушитель"}:
    checklist.append("Не выдавать статус `Подтверждена`, пока представитель не закроет все критичные сигналы.")
  return checklist


def save_report(report: CompanyReport, out_dir: Path) -> tuple[Path, Path]:
  out_dir.mkdir(parents=True, exist_ok=True)
  stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
  digest = hashlib.sha1(f"{report.inn}-{report.generated_at}".encode("utf-8")).hexdigest()[:8]
  base = out_dir / f"company_{report.inn}_{stamp}_{digest}"
  json_path = base.with_suffix(".json")
  md_path = base.with_suffix(".md")
  json_path.write_text(
    json.dumps(dataclasses.asdict(report), ensure_ascii=False, indent=2),
    encoding="utf-8",
  )
  md_path.write_text(render_markdown(report), encoding="utf-8")
  return json_path, md_path


def render_markdown(report: CompanyReport) -> str:
  lines = [
    f"# Отчет проверки компании по ИНН {report.inn}",
    "",
    f"- Дата формирования: `{report.generated_at}`",
    f"- Статус платформы: **{report.platform_status}**",
    f"- Риск: **{report.risk_score}/100**",
    "",
    "## Краткий вывод",
  ]
  lines.extend(f"- {item}" for item in report.summary)
  lines.extend(["", "## Юридическая карточка"])
  if report.legal_card:
    for key, value in report.legal_card.items():
      lines.append(f"- {key}: {value or 'нет данных'}")
  else:
    lines.append("- Автоматически не собрана.")

  lines.extend(["", "## Каналы подтверждения"])
  for channel in report.confirmation_channels:
    lines.append(f"- {channel['type']}: {channel['value']} ({channel['source']})")

  lines.extend(["", "## Источники и что собираем"])
  for source in report.sources:
    lines.extend([
      "",
      f"### {source.title}",
      f"- Статус сбора: `{source.status}`",
      f"- Ссылка: {source.url}",
    ])
    planned = source.collected.get("planned_fields") if isinstance(source.collected, dict) else None
    if planned:
      lines.append("- Собираем: " + ", ".join(str(item) for item in planned))
    elif source.collected:
      lines.append("- Данные:")
      for key, value in source.collected.items():
        lines.append(f"  - {key}: {value or 'нет данных'}")
    if source.signals:
      lines.append("- Сигналы:")
      for signal in source.signals:
        lines.append(f"  - {signal.get('level')}: {signal.get('message')}")
    if source.errors:
      lines.append("- Ошибки:")
      for error in source.errors:
        lines.append(f"  - {error}")
    if source.next_actions:
      lines.append("- Следующие действия:")
      for action in source.next_actions:
        lines.append(f"  - {action}")

  lines.extend(["", "## Чеклист представителя ПлюсЗвена"])
  lines.extend(f"- {item}" for item in report.representative_checklist)
  lines.append("")
  return "\n".join(lines)


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Check company by INN and build PlusZveno report.")
  parser.add_argument("--inn", required=True, help="Company or individual entrepreneur INN.")
  parser.add_argument("--out", default=str(OUT), help="Output directory.")
  parser.add_argument(
    "--sources",
    nargs="*",
    help="Optional source codes to run. Example: --sources fns_egrul pluszveno_internal",
  )
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  try:
    inn = validate_inn(args.inn)
  except ValueError as exc:
    print(exc)
    return 2
  report = collect_report(inn, set(args.sources) if args.sources else None)
  json_path, md_path = save_report(report, Path(args.out))
  print(f"JSON: {json_path}")
  print(f"Markdown: {md_path}")
  print(f"Status: {report.platform_status}, risk: {report.risk_score}/100")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
