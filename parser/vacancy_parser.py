#!/usr/bin/env python3
"""Collect shift-work construction vacancies from supported sources.

MVP scope:
- hh.ru is collected through the public API.
- vpoiskerabot.ru is collected through its public JSON endpoint if available.
- avito.ru and rabota.ru are represented as adapters with legal/technical guardrails:
  they build search URLs and record source status, but do not bypass anti-bot
  protections. Add official API credentials or an approved export feed here.

Output:
- JSONL with normalized vacancy records.
- CSV for manual review by a PlusZveno representative.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
DEFAULT_SPECIALTIES = ROOT / "specialties.txt"
DEFAULT_OUT = ROOT / "out"


@dataclass
class Vacancy:
  source: str
  source_kind: str
  source_url: str
  external_id: str
  title: str
  company: str
  region: str
  salary_from: int | None
  salary_to: int | None
  currency: str
  schedule: str
  employment: str
  description: str
  specialty_query: str
  parsed_at: str
  confidence: float
  status: str = "primary_import"
  needs_clarification: str = "conditions, contacts, housing, PPE, road, tax, contract"

  def stable_key(self) -> str:
    basis = "|".join([
      normalize_text(self.title),
      normalize_text(self.company),
      normalize_text(self.region),
      str(self.salary_from or ""),
      str(self.salary_to or ""),
    ])
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()


class HttpClient:
  def __init__(self, timeout: int = 20, delay: float = 0.4) -> None:
    self.timeout = timeout
    self.delay = delay
    self.last_request = 0.0

  def get_json(self, url: str, headers: dict[str, str] | None = None) -> Any:
    elapsed = time.time() - self.last_request
    if elapsed < self.delay:
      time.sleep(self.delay - elapsed)
    req = urllib.request.Request(url, headers={
      "User-Agent": "PlusZvenoVacancyParser/0.1 contact: parser@pluszveno.local",
      "Accept": "application/json,text/plain,*/*",
      **(headers or {}),
    })
    self.last_request = time.time()
    with urllib.request.urlopen(req, timeout=self.timeout) as response:
      payload = response.read()
    return json.loads(payload.decode("utf-8"))

  def get_text(self, url: str, headers: dict[str, str] | None = None) -> str:
    elapsed = time.time() - self.last_request
    if elapsed < self.delay:
      time.sleep(self.delay - elapsed)
    req = urllib.request.Request(url, headers={
      "User-Agent": "PlusZvenoVacancyParser/0.1 contact: parser@pluszveno.local",
      "Accept": "text/html,application/xhtml+xml,*/*",
      **(headers or {}),
    })
    self.last_request = time.time()
    with urllib.request.urlopen(req, timeout=self.timeout) as response:
      payload = response.read()
      charset = response.headers.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def normalize_text(value: str | None) -> str:
  if not value:
    return ""
  return re.sub(r"\s+", " ", value).strip().lower()


def clean_html(value: str | None) -> str:
  if not value:
    return ""
  value = re.sub(r"<[^>]+>", " ", value)
  return re.sub(r"\s+", " ", value).strip()


def load_specialties(path: Path, limit: int | None = None) -> list[str]:
  items = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
  return items[:limit] if limit else items


class HhSource:
  name = "hh.ru"
  kind = "primary_api"

  def __init__(self, client: HttpClient, area: str | None = None, per_page: int = 20, pages: int = 1) -> None:
    self.client = client
    self.area = area
    self.per_page = per_page
    self.pages = pages

  def collect(self, query: str) -> Iterable[Vacancy]:
    for page in range(self.pages):
      params = {
        "text": query,
        "per_page": str(self.per_page),
        "page": str(page),
        "search_field": "name",
      }
      if self.area:
        params["area"] = self.area
      url = "https://api.hh.ru/vacancies?" + urllib.parse.urlencode(params)
      try:
        data = self.client.get_json(url)
      except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[hh.ru] {query}: {exc}", file=sys.stderr)
        return

      for item in data.get("items", []):
        salary = item.get("salary") or {}
        employer = item.get("employer") or {}
        area = item.get("area") or {}
        snippet = item.get("snippet") or {}
        yield Vacancy(
          source=self.name,
          source_kind=self.kind,
          source_url=item.get("alternate_url") or item.get("url") or url,
          external_id=str(item.get("id") or ""),
          title=item.get("name") or "",
          company=employer.get("name") or "",
          region=area.get("name") or "",
          salary_from=salary.get("from"),
          salary_to=salary.get("to"),
          currency=salary.get("currency") or "",
          schedule=(item.get("schedule") or {}).get("name") or "",
          employment=(item.get("employment") or {}).get("name") or "",
          description=clean_html(" ".join(filter(None, [snippet.get("requirement"), snippet.get("responsibility")]))),
          specialty_query=query,
          parsed_at=now_iso(),
          confidence=0.68,
        )


class VpoiskeSource:
  name = "vpoiskerabot.ru"
  kind = "secondary_aggregator"

  def __init__(self, client: HttpClient, per_query_limit: int = 20) -> None:
    self.client = client
    self.per_query_limit = per_query_limit

  def collect(self, query: str) -> Iterable[Vacancy]:
    params = {"q": query}
    url = "https://vpoiskerabot.ru/api/search?" + urllib.parse.urlencode(params)
    try:
      data = self.client.get_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
      print(f"[vpoiskerabot.ru] {query}: {exc}", file=sys.stderr)
      return

    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list):
      return

    for item in items[: self.per_query_limit]:
      salary_from, salary_to = parse_salary(item)
      yield Vacancy(
        source=self.name,
        source_kind=self.kind,
        source_url=str(item.get("url") or item.get("link") or url),
        external_id=str(item.get("id") or item.get("url") or ""),
        title=str(item.get("title") or item.get("name") or ""),
        company=str(item.get("company") or item.get("employer") or ""),
        region=str(item.get("region") or item.get("city") or item.get("location") or ""),
        salary_from=salary_from,
        salary_to=salary_to,
        currency="RUR",
        schedule=str(item.get("schedule") or ""),
        employment=str(item.get("employment") or ""),
        description=clean_html(str(item.get("description") or item.get("snippet") or "")),
        specialty_query=query,
        parsed_at=now_iso(),
        confidence=0.42,
      )


class SearchUrlSource:
  """Adapter for sources that need official API/feed approval before scraping."""

  def __init__(self, name: str, base_url: str, client: HttpClient, allow_html: bool = False) -> None:
    self.name = name
    self.base_url = base_url
    self.client = client
    self.allow_html = allow_html
    self.kind = "source_url_pending_api_or_feed"

  def collect(self, query: str) -> Iterable[Vacancy]:
    url = self.base_url.format(q=urllib.parse.quote_plus(query))
    if self.allow_html:
      try:
        page = self.client.get_text(url)
      except (urllib.error.URLError, TimeoutError) as exc:
        print(f"[{self.name}] {query}: {exc}", file=sys.stderr)
        return
      if self.name == "avito.ru":
        avito_items = parse_avito_cards(page, url, query)
        if avito_items:
          yield from avito_items
          return
      jobs = parse_jsonld_jobs(page)
      if jobs:
        for index, item in enumerate(jobs):
          salary_from, salary_to, currency = parse_jsonld_salary(item)
          yield Vacancy(
            source=self.name,
            source_kind="primary_html_jsonld",
            source_url=str(item.get("url") or url),
            external_id=str(item.get("identifier") or item.get("url") or f"{url}#{index}"),
            title=str(item.get("title") or ""),
            company=parse_jsonld_company(item),
            region=parse_jsonld_region(item),
            salary_from=salary_from,
            salary_to=salary_to,
            currency=currency,
            schedule=str(item.get("workHours") or ""),
            employment=parse_employment(item.get("employmentType")),
            description=clean_html(str(item.get("description") or "")),
            specialty_query=query,
            parsed_at=now_iso(),
            confidence=0.48,
          )
        return

    yield Vacancy(
      source=self.name,
      source_kind=self.kind,
      source_url=url,
      external_id=hashlib.sha1(url.encode("utf-8")).hexdigest(),
      title=f"Поисковая выдача: {query}",
      company="",
      region="",
      salary_from=None,
      salary_to=None,
      currency="",
      schedule="",
      employment="",
      description="Требуется официальный API, партнерский экспорт или ручное подтверждение разрешенного способа сбора.",
      specialty_query=query,
      parsed_at=now_iso(),
      confidence=0.05,
      status="source_pending",
      needs_clarification="approved integration method",
    )


def parse_avito_cards(page: str, search_url: str, query: str) -> list[Vacancy]:
  vacancies: list[Vacancy] = []
  blocks = re.findall(
    r'(<meta itemProp="description" content=".*?</div></div></div>)',
    page,
    flags=re.DOTALL,
  )
  if not blocks:
    blocks = re.findall(
      r'(<div[^>]+data-marker="item-line"[^>]*>.*?)(?=<div[^>]+data-marker="item-line"|</main>|$)',
      page,
      flags=re.DOTALL,
    )

  for index, block in enumerate(blocks):
    title_match = re.search(
      r'<h2 itemProp="name".*?<a itemProp="url"[^>]*title="(?P<title>[^"]+)"[^>]*href="(?P<url>/[^"]+)"',
      block,
      flags=re.DOTALL,
    )
    if not title_match:
      continue

    description_match = re.search(r'<meta itemProp="description" content="(?P<description>.*?)"', block, flags=re.DOTALL)
    salary_match = re.search(r'itemProp="price" content="(?P<price>\d+)"', block)
    location_match = re.search(r'geo-address-[^"]*">(?P<location>.*?)</span>', block, flags=re.DOTALL)
    company_match = re.search(r'iva-item-userInfoStep.*?>(?P<company>[^<>]{2,80})</', block, flags=re.DOTALL)

    title = html.unescape(title_match.group("title")).strip()
    source_url = "https://www.avito.ru" + title_match.group("url").split("?")[0]
    salary_from = int(salary_match.group("price")) if salary_match else None
    description = html.unescape(description_match.group("description")).strip() if description_match else ""
    location = clean_html(html.unescape(location_match.group("location"))) if location_match else ""
    company = clean_html(html.unescape(company_match.group("company"))) if company_match else ""

    vacancies.append(Vacancy(
      source="avito.ru",
      source_kind="primary_html",
      source_url=source_url,
      external_id=source_url.rsplit("_", 1)[-1] if "_" in source_url else hashlib.sha1(source_url.encode("utf-8")).hexdigest(),
      title=title,
      company=company,
      region=location,
      salary_from=salary_from,
      salary_to=None,
      currency="RUR" if salary_from else "",
      schedule="",
      employment="",
      description=clean_html(description),
      specialty_query=query,
      parsed_at=now_iso(),
      confidence=0.38,
      needs_clarification="company, contacts, salary, schedule, housing, PPE, road, contract",
    ))

  return vacancies


def parse_jsonld_jobs(page: str) -> list[dict[str, Any]]:
  jobs: list[dict[str, Any]] = []
  scripts = re.findall(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    page,
    flags=re.IGNORECASE | re.DOTALL,
  )
  for script in scripts:
    try:
      payload = json.loads(html.unescape(script).strip())
    except json.JSONDecodeError:
      continue
    for item in flatten_jsonld(payload):
      if isinstance(item, dict) and item.get("@type") in ("JobPosting", ["JobPosting"]):
        jobs.append(item)
  return jobs


def flatten_jsonld(payload: Any) -> Iterable[Any]:
  if isinstance(payload, list):
    for item in payload:
      yield from flatten_jsonld(item)
  elif isinstance(payload, dict):
    if "@graph" in payload:
      yield from flatten_jsonld(payload["@graph"])
    yield payload


def parse_jsonld_company(item: dict[str, Any]) -> str:
  org = item.get("hiringOrganization") or {}
  if isinstance(org, dict):
    return str(org.get("name") or "")
  return str(org or "")


def parse_jsonld_region(item: dict[str, Any]) -> str:
  loc = item.get("jobLocation") or {}
  if isinstance(loc, list):
    loc = loc[0] if loc else {}
  address = loc.get("address") if isinstance(loc, dict) else {}
  if isinstance(address, dict):
    return ", ".join(str(address.get(k) or "") for k in ("addressRegion", "addressLocality") if address.get(k))
  return ""


def parse_jsonld_salary(item: dict[str, Any]) -> tuple[int | None, int | None, str]:
  salary = item.get("baseSalary") or {}
  if not isinstance(salary, dict):
    return None, None, ""
  currency = str(salary.get("currency") or salary.get("salaryCurrency") or "")
  value = salary.get("value") or {}
  if isinstance(value, dict):
    min_value = value.get("minValue") or value.get("value")
    max_value = value.get("maxValue")
    return int(min_value) if min_value else None, int(max_value) if max_value else None, currency
  if isinstance(value, (int, float)):
    return int(value), None, currency
  return None, None, currency


def parse_employment(value: Any) -> str:
  if isinstance(value, list):
    return ", ".join(str(item) for item in value)
  return str(value or "")


def parse_salary(item: dict[str, Any]) -> tuple[int | None, int | None]:
  for key in ("salary", "salary_text", "pay"):
    value = item.get(key)
    if isinstance(value, dict):
      return value.get("from"), value.get("to")
    if isinstance(value, str):
      nums = [int(re.sub(r"\D", "", n)) for n in re.findall(r"\d[\d\s]{2,}", value)]
      if len(nums) >= 2:
        return min(nums), max(nums)
      if len(nums) == 1:
        return nums[0], None
  return None, None


def now_iso() -> str:
  return datetime.now(timezone.utc).isoformat()


def deduplicate(vacancies: Iterable[Vacancy]) -> list[Vacancy]:
  seen: dict[str, Vacancy] = {}
  for vacancy in vacancies:
    key = vacancy.stable_key()
    if key not in seen:
      seen[key] = vacancy
      continue
    existing = seen[key]
    existing.source = merge_unique(existing.source, vacancy.source)
    existing.source_kind = merge_unique(existing.source_kind, vacancy.source_kind)
    existing.source_url = merge_unique(existing.source_url, vacancy.source_url)
    existing.external_id = merge_unique(existing.external_id, vacancy.external_id)
    existing.confidence = max(existing.confidence, vacancy.confidence)
  return list(seen.values())


def merge_unique(left: str, right: str) -> str:
  values = []
  for item in [*left.split(" | "), *right.split(" | ")]:
    item = item.strip()
    if item and item not in values:
      values.append(item)
  return " | ".join(values)


def write_jsonl(path: Path, rows: Iterable[Vacancy]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  with path.open("w", encoding="utf-8") as fh:
    for row in rows:
      fh.write(json.dumps(dataclasses.asdict(row), ensure_ascii=False) + "\n")


def write_csv(path: Path, rows: list[Vacancy]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  fields = [field.name for field in dataclasses.fields(Vacancy)]
  with path.open("w", encoding="utf-8-sig", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=fields)
    writer.writeheader()
    for row in rows:
      writer.writerow(dataclasses.asdict(row))


def build_sources(args: argparse.Namespace, client: HttpClient) -> list[Any]:
  selected = set(args.sources)
  sources: list[Any] = []
  if "hh" in selected:
    sources.append(HhSource(client, area=args.hh_area, per_page=args.per_page, pages=args.pages))
  if "vpoiskerabot" in selected:
    sources.append(VpoiskeSource(client, per_query_limit=args.per_page))
  if "avito" in selected:
    sources.append(SearchUrlSource("avito.ru", "https://www.avito.ru/all/vakansii?q={q}", client, args.allow_html_scraping))
  if "rabota" in selected:
    sources.append(SearchUrlSource("rabota.ru", "https://www.rabota.ru/vacancy/?query={q}", client, args.allow_html_scraping))
  return sources


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Collect industrial shift vacancies.")
  parser.add_argument("--specialties", type=Path, default=DEFAULT_SPECIALTIES)
  parser.add_argument("--limit-specialties", type=int, default=None)
  parser.add_argument("--sources", nargs="+", default=["hh", "vpoiskerabot", "avito", "rabota"], choices=["hh", "vpoiskerabot", "avito", "rabota"])
  parser.add_argument("--hh-area", default=None, help="hh.ru area id, e.g. 113 for Russia.")
  parser.add_argument("--per-page", type=int, default=20)
  parser.add_argument("--pages", type=int, default=1)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  parser.add_argument("--allow-html-scraping", action="store_true", help="Try to collect open JSON-LD JobPosting from source HTML without bypassing protections.")
  return parser.parse_args()


def main() -> int:
  args = parse_args()
  client = HttpClient()
  specialties = load_specialties(args.specialties, args.limit_specialties)
  sources = build_sources(args, client)
  collected: list[Vacancy] = []

  for query in specialties:
    for source in sources:
      collected.extend(source.collect(query))

  rows = deduplicate(collected)
  stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
  jsonl_path = args.out / f"vacancies_{stamp}.jsonl"
  csv_path = args.out / f"vacancies_review_{stamp}.csv"
  write_jsonl(jsonl_path, rows)
  write_csv(csv_path, rows)
  print(f"Collected: {len(rows)}")
  print(f"JSONL: {jsonl_path}")
  print(f"CSV: {csv_path}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
