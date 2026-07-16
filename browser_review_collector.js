#!/usr/bin/env node

const fs = require('fs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanReviewText(value) {
  let text = normalizeText(value);
  if (/^@media|{.*}|transform:|ymaps/i.test(text)) return '';
  text = text.replace(/^(?:[А-ЯA-Z]\s+)?[^.!?]{2,80}?\s+Знаток города\s+\d+\s+уровня\s+Подписаться\s+/i, '');
  const yandexPrefix = text.match(/^.*?\b\d{1,2}\s+[А-Яа-яЁё]+\s+(.+)$/i);
  if (yandexPrefix && /Подписаться|Знаток города/i.test(text.slice(0, Math.max(0, text.length - yandexPrefix[1].length)))) {
    text = normalizeText(yandexPrefix[1]);
  }
  const dated = text.match(/(?:сегодня|вчера|\d{1,2}\s+[а-яё]+(?:\s+\d{4})?|\d{1,2}[.]\d{1,2}[.]\d{2,4})\s+(.+)$/i);
  if (dated && normalizeText(dated[1]).length >= 20) text = normalizeText(dated[1]);
  if (/^(Подписаться|Знаток города)/i.test(text)) return '';
  if (/^(Офис компании|Адрес|Контакты|Рейтинг|Оцените|Написать отзыв)$/i.test(text)) return '';
  return text;
}

function dedupeReviews(items) {
  const seen = new Set();
  const result = [];
  const ordered = [...items].sort((a, b) => normalizeText(a.text).length - normalizeText(b.text).length);
  for (const item of ordered) {
    const text = cleanReviewText(item.text);
    if (text.length < 35) continue;
    if (/^(Рейтинг|Отзывы|\d+\s+отзыв|По умолчанию|Оцените)/i.test(text)) continue;
    const lower = text.toLowerCase();
    if (result.some((existing) => lower.includes(existing.text.toLowerCase()) || existing.text.toLowerCase().includes(lower))) continue;
    const key = text.toLowerCase().slice(0, 260);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      text,
      author: normalizeText(item.author),
      date: normalizeText(item.date),
      rating: normalizeText(item.rating),
      url: item.url || '',
      verification_status: normalizeText(item.verification_status),
    });
  }
  return result;
}

function writeResult(result, outPath = '') {
  const json = JSON.stringify(result, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json, 'utf8');
  } else {
    process.stdout.write(json);
  }
}

function isUsefulReviewText(text) {
  const value = normalizeText(text);
  if (value.length < 35 || value.length > 4000) return false;
  if (!/[А-Яа-яA-Za-z]/.test(value)) return false;
  if (/^(Отзывы|Написать отзыв|Показать полностью|Сначала новые|По умолчанию|Поделиться|Исправить|Пожаловаться)$/i.test(value)) return false;
  if (/cookie|captcha|javascript|браузер/i.test(value)) return false;
  const hasReviewMarker = /\b(отзыв|оценк|звезд|достоинств|недостатк|коммент|работ|зарплат|начальств|сотрудник|клиент|место|компан)/i.test(value);
  const hasSentence = /[.!?]/.test(value) || value.split(' ').length >= 8;
  return hasReviewMarker || hasSentence;
}

async function autoScroll(page, steps) {
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(700);
    const buttons = await page.locator('button, a').evaluateAll((nodes) => nodes
      .map((node, index) => ({ index, text: (node.innerText || node.textContent || '').trim() }))
      .filter((item) => /показать|ещ[её]|читать|отзывы|развернуть|more|show/i.test(item.text))
      .slice(0, 8));
    for (const button of buttons) {
      try {
        await page.locator('button, a').nth(button.index).click({ timeout: 700 });
        await page.waitForTimeout(250);
      } catch {}
    }
  }
}

async function openReviewsTab(page) {
  const selectors = [
    'text=/^Отзывы(\\s+\\d+)?$/i',
    'a[href*="reviews"]',
    'button:has-text("Отзывы")',
    '[role="tab"]:has-text("Отзывы")',
  ];
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.count()) {
        await locator.click({ timeout: 2500 });
        await page.waitForTimeout(1500);
        return true;
      }
    } catch {}
  }
  return false;
}

async function collectFromDom(page, source, url) {
  return page.evaluate(({ source, url }) => {
    const normalize = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const textOf = (node) => normalize(node?.innerText || node?.textContent || '');
    const bodyText = textOf(document.body);
    const reviewsAnchor = bodyText.search(/\bОтзывы\b/i);
    const uiPattern = /(Маршрут|Контакты|Время работы|Как добраться|Показать телефон|Исправить неточность|Вы владелец|Разместить рекламу|Источник данных|Пользовательское соглашение|Обзор Фото|Панорама|Похожие места|Написать отзыв|Оцените это место)/i;
    const isCompactReviewText = (text) => {
      if (text.length < 35 || text.length > 1800) return false;
      if (uiPattern.test(text)) return false;
      if (!/[.!?]/.test(text)) return false;
      if (!/(зарплат|работ|начальств|коллектив|место|компан|обслужив|качество|ужас|отличн|хорош|плохо|достой|офис|строитель)/i.test(text)) return false;
      return true;
    };
    const candidates = [];
    const leafNodes = [...document.querySelectorAll('article, li, div, section, span, p')]
      .filter((node) => {
      const text = textOf(node);
      if (source === 'yandex' && reviewsAnchor >= 0 && bodyText.indexOf(text) >= 0 && bodyText.indexOf(text) < reviewsAnchor) return false;
      if (!isCompactReviewText(text)) return false;
        const childTexts = [...node.children].map(textOf).filter((item) => item.length >= 30);
        if (childTexts.some((item) => item !== text && item.length / text.length > 0.82)) return false;
        return true;
      });
    const datePattern = /\b(\d{1,2}\s+[а-яё]+\s+\d{4}|\d{1,2}[.]\d{1,2}[.]\d{2,4}|сегодня|вчера)\b/i;
    const ratingPattern = /\b([1-5](?:[,.]\d)?)\s*(?:из\s*5|звезд|★)/i;
    for (const node of leafNodes) {
      const text = textOf(node);
      const lower = text.toLowerCase();
      const className = String(node.className || '').toLowerCase();
      const aria = String(node.getAttribute('aria-label') || '').toLowerCase();
      const parentText = textOf(node.parentElement || node);
      const looksLikeReview = /review|comment|rating|business-review|card|sidebar/.test(className + ' ' + aria)
        || /отзыв|оценк|достоинств|недостатк|коммент|ответ владельца|читать полностью/.test(lower)
        || datePattern.test(parentText)
        || source === 'yandex'
        || source === '2gis';
      if (!looksLikeReview) continue;
      const siblingText = [...(node.parentElement?.children || [])].map(textOf).filter(Boolean);
      const date = (parentText.match(datePattern) || [])[0] || '';
      const rating = (text.match(ratingPattern) || [])[1] || '';
      let author = '';
      const possibleAuthor = siblingText.find((item) => item.length >= 2 && item.length <= 80 && !datePattern.test(item) && !/отзыв|оценк|читать|показать|маршрут|контакты/i.test(item));
      if (possibleAuthor) author = possibleAuthor;
      candidates.push({
        text,
        author,
        date,
        rating,
        url,
        verification_status: source === '2gis' && /подтвержд/i.test(text) ? 'подтвержден' : '',
      });
    }
    return {
      title: document.title || '',
      page_text: textOf(document.body).slice(0, 3000),
      reviews: candidates,
    };
  }, { source, url });
}

function getMeta(domResult, reviews, finalUrl) {
  const text = normalizeText(domResult.page_text || '');
  const ratingMatch = text.match(/\b([1-5](?:[,.]\d)?)\s*(?:из\s*5|★|рейтинг)/i);
  const reviewCountMatch = text.match(/\b(\d[\d\s]*)\s+(?:отзыв(?:а|ов)?|оцен(?:ка|ки|ок))\b/i);
  return {
    title: normalizeText(domResult.title),
    rating: ratingMatch ? ratingMatch[1].replace(',', '.') : '',
    rating_text: ratingMatch ? `${ratingMatch[1].replace(',', '.')} из 5` : '',
    review_count: reviewCountMatch ? Number(reviewCountMatch[1].replace(/\s+/g, '')) : reviews.length,
    review_count_text: reviewCountMatch ? `${reviewCountMatch[1].replace(/\s+/g, ' ')} отзывов/оценок` : `${reviews.length} отзывов`,
    source_note: reviews.length
      ? 'Отзывы собраны браузерным адаптером из видимой части страницы.'
      : 'Браузер открыл страницу, но видимые тексты отзывов не найдены. Возможно, сайт потребовал капчу/авторизацию или изменил разметку.',
    collection_mode: 'browser_playwright',
    final_url: finalUrl,
  };
}

function getTokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['ооо', 'ао', 'пао', 'зао', 'общество', 'ограниченной', 'ответственностью', 'область', 'город', 'улица'].includes(token));
}

function parseAddress(value) {
  const text = normalizeText(value);
  const cityMatch = text.match(/(?:^|,\s*)(?:г\.|г\s+|город\s+)\s*(?!о\.)([^,]+)/i)
    || text.match(/г\.\s*о\.\s*(?:город\s*)?([^,]+)/i);
  const streetMatch = text.match(/(?:ул\.|улица|пр-кт|проспект|пер\.|переулок|ш\.|шоссе|наб\.|набережная|б-р|бульвар)\s*([^,]+)/i);
  const houseMatch = text.match(/(?:д\.|дом|здание|зд\.)\s*([0-9]+[А-Яа-яA-Za-z0-9/-]*)/i);
  return {
    city: normalizeText(cityMatch ? cityMatch[1].replace(/^город\s+/i, '') : ''),
    street: normalizeText(streetMatch ? streetMatch[1] : ''),
    house: normalizeText(houseMatch ? houseMatch[1] : ''),
  };
}

function getMatchInfo(pageText, expectedName, expectedAddress) {
  const haystack = normalizeText(pageText).toLowerCase();
  const nameTokens = getTokens(expectedName);
  const expectedParts = parseAddress(expectedAddress);
  const expectedCity = normalizeText(expectedParts.city).toLowerCase();
  const expectedStreetTokens = getTokens(expectedParts.street).filter((token) => token.length >= 4);
  const expectedHouse = normalizeText(expectedParts.house).toLowerCase();
  const matchedName = nameTokens.filter((token) => haystack.includes(token));
  const matchedStreet = expectedStreetTokens.filter((token) => haystack.includes(token));
  const cityMatch = expectedCity ? haystack.includes(expectedCity) : false;
  const houseMatch = expectedHouse ? new RegExp(`(^|\\s)${expectedHouse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(haystack) : false;
  const structuredAddressMatch = Boolean(expectedCity && expectedStreetTokens.length && expectedHouse && cityMatch && matchedStreet.length > 0 && houseMatch);
  const addressTokens = getTokens(expectedAddress).filter((token) => /\d/.test(token) || token.length >= 5);
  const matchedAddress = addressTokens.filter((token) => haystack.includes(token));
  return {
    expected_name: expectedName || '',
    expected_address: expectedAddress || '',
    name_match: nameTokens.length ? matchedName.length >= Math.min(2, nameTokens.length) : false,
    address_match: structuredAddressMatch || (addressTokens.length ? matchedAddress.length >= Math.min(3, Math.max(1, addressTokens.length)) : false),
    expected_city: expectedParts.city,
    expected_street: expectedParts.street,
    expected_house: expectedParts.house,
    city_match: cityMatch,
    street_match: matchedStreet.length > 0,
    house_match: houseMatch,
    matched_name_tokens: matchedName,
    matched_address_tokens: matchedAddress,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const url = args.url || '';
  const source = args.source || '';
  const limit = Number(args.limit || 50);
  const expectedName = args.company || '';
  const expectedAddress = args.address || '';
  const outPath = args.out || '';
  const headed = args.headed || process.env.PZ_BROWSER_HEADFUL === '1';
  const profileDir = args.profile || process.env.PZ_BROWSER_PROFILE || '';
  if (!/^https?:\/\//i.test(url)) throw new Error('Укажите корректную ссылку http/https.');

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('Playwright не установлен. Выполните в проекте: npm init -y; npm install -D playwright; npx playwright install chromium');
  }

  const launchOptions = {
    headless: !headed,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-dev-shm-usage',
    ],
  };
  const runWithPage = async (page, close) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(headed ? 6000 : 2500);
      const beforeReviews = await collectFromDom(page, source, page.url()).catch(() => ({ title: '', page_text: '', reviews: [] }));
      await openReviewsTab(page);
      await autoScroll(page, Number(args.scrolls || 10));
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const finalUrl = page.url();
      const domResult = await collectFromDom(page, source, finalUrl);
      const antiBot = /\/museum|captcha|showcaptcha|access-denied|robot/i.test(finalUrl + ' ' + domResult.title + ' ' + domResult.page_text);
      const reviews = dedupeReviews(domResult.reviews.filter((item) => isUsefulReviewText(item.text))).slice(0, limit);
      const meta = getMeta(domResult, reviews, finalUrl);
      const matchInfo = getMatchInfo(`${beforeReviews.title} ${beforeReviews.page_text} ${domResult.title} ${domResult.page_text}`, expectedName, expectedAddress);
      Object.assign(meta, matchInfo);
      if ((expectedName || expectedAddress) && !(matchInfo.name_match && matchInfo.address_match)) {
        meta.source_note = `${meta.source_note} Совпадение карточки неполное: название ${matchInfo.name_match ? 'совпало' : 'не подтверждено'}, адрес ${matchInfo.address_match ? 'совпал' : 'не подтвержден'}.`;
      }
      if (antiBot && !reviews.length) {
        meta.source_note = headed
          ? 'Сайт открыл антибот-проверку. Пройдите ее в видимом браузере и повторите сбор: профиль будет переиспользован.'
          : 'Сайт открыл антибот-проверку. Для 2GIS/Яндекс запустите сервер с PZ_BROWSER_HEADFUL=1 и пройдите проверку в видимом браузере.';
      }
      const result = {
        ok: true,
        source,
        url,
        final_url: finalUrl,
        reviews,
        meta,
      };
      writeResult(result, outPath);
    } finally {
      await close();
    }
  };

  if (profileDir) {
    const context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions,
      locale: 'ru-RU',
      viewport: { width: 1365, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    });
    const page = context.pages()[0] || await context.newPage();
    await runWithPage(page, () => context.close());
    return;
  }

  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      locale: 'ru-RU',
      viewport: { width: 1365, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    });
    const page = await context.newPage();
    await runWithPage(page, () => browser.close());
  } finally {
    if (browser.isConnected()) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  const args = parseArgs(process.argv);
  writeResult({
    ok: false,
    error: error && error.message ? error.message : String(error),
  }, args.out || '');
  process.exitCode = 1;
});
