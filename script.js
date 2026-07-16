const pages = [...document.querySelectorAll('.page')];
const toast = document.querySelector('#toast');
const cookieBanner = document.querySelector('#cookieBanner');
const loginPhone = document.querySelector('#loginPhone');
const checkPhone = document.querySelector('#checkPhone');
const checkForm = document.querySelector('#checkForm');
const noticeFeed = document.querySelector('#noticeFeed');
const noticeLock = document.querySelector('#noticeLock');
const specialtySelect = document.querySelector('#specialtySelect');
const sourceList = document.querySelector('#sourceList');
const parserCard = document.querySelector('#parserCard');
const parsedVacancyList = document.querySelector('#parsedVacancyList');
const vacancyCount = document.querySelector('#vacancyCount');
const vacancyDetailTitle = document.querySelector('#vacancyDetailTitle');
const vacancyDetailGrid = document.querySelector('#vacancyDetailGrid');
const vacancyDetailDescription = document.querySelector('#vacancyDetailDescription');
const vacancyDetailStatus = document.querySelector('#vacancyDetailStatus');
const vacancySourceLink = document.querySelector('#vacancySourceLink');
const phoneLogin = document.querySelector('#phoneLogin');
const sessionActions = document.querySelector('#sessionActions');
const topNav = document.querySelector('#topNav');
const adminCompanyInn = document.querySelector('#adminCompanyInn');
const companyCheckTitle = document.querySelector('#companyCheckTitle');
const companyInnEditor = document.querySelector('#companyInnEditor');
const companyInnSummary = document.querySelector('#companyInnSummary');
const editCompanyInn = document.querySelector('#editCompanyInn');
const companyCheckCommand = document.querySelector('#companyCheckCommand');
const companyReportFile = document.querySelector('#companyReportFile');
const companyReportView = document.querySelector('#companyReportView');
const companyReportEmpty = document.querySelector('#companyReportEmpty');
const runCompanyCheck = document.querySelector('#runCompanyCheck');
const companyCheckFlow = document.querySelector('#companyCheckFlow');
const companyCheckLog = document.querySelector('#companyCheckLog');
const companyStagePanel = document.querySelector('#companyStagePanel');
const manualReviewPanel = document.querySelector('#manualReviewPanel');
const manualReviewSources = document.querySelector('#manualReviewSources');
const vacancyCheckLink = document.querySelector('#vacancyCheckLink');
const vacancyCheckRole = document.querySelector('#vacancyCheckRole');
const vacancyCheckNext = document.querySelector('#vacancyCheckNext');
const vacancyCheckResult = document.querySelector('#vacancyCheckResult');
const vacancyCheckPhoneStep = document.querySelector('#vacancyCheckPhoneStep');
const checkPhoneNext = document.querySelector('#checkPhoneNext');

const routes = ['home', 'check-vacancy', 'auth', 'sms', 'notifications', 'profile', 'vacancies', 'vacancy', 'rating', 'admin'];
const ADMIN_PHONE_DIGITS = '70000000000';
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8788' : '';
let companyCheckStage = 1;

const specialties = [
  'Сварщик НАКС РД',
  'Сварщик НАКС НГДО',
  'Монтажник МК',
  'Мастер СМР',
  'Машинист автокрана',
  'Дефектоскопист УЗК',
  'Инженер ПТО',
  'Электромонтажник',
  'Стропальщик',
  'Бригадир',
];

const sources = [
  { name: 'hh.ru', type: 'первичный источник', status: 'API / импорт', fields: 'должность, компания, регион, зарплата, описание, ссылка' },
  { name: 'avito.ru', type: 'первичный источник', status: 'импорт по ссылкам/выдаче', fields: 'должность, телефон, регион, зарплата, график, ссылка' },
  { name: 'rabota.ru', type: 'первичный источник', status: 'импорт по выдаче', fields: 'должность, компания, регион, зарплата, условия, ссылка' },
  { name: 'vpoiskerabot.ru', type: 'агрегатор', status: 'сверка и аналитика', fields: 'зарплатная статистика, похожие вакансии, источник второго уровня' },
];

const parsedVacancy = {
  title: 'Сварщик НАКС РД',
  source: 'hh.ru + avito.ru',
  company: 'ООО СеверМонтаж',
  region: 'Нижегородская область, Кстово',
  salary: 'от 220 000 ₽ за вахту',
  schedule: '60/30',
  confidence: '62%',
  status: 'Первичная информация',
  missing: 'не подтверждены проживание, СИЗ, дорога, НДФЛ и договор',
};

const importedVacancies = [
  {
    title: 'Бригадир монтажников (участок металлоконструкций)',
    company: 'ООО СК "ИНТЕРПОЛ"',
    salary: '168 000 – 181 000 руб.',
    location: 'Хабаровский край, Нанайский район, с. Малмыж',
    source: 'vpoiskerabot / Роструд',
    url: 'https://trudvsem.ru/vacancy/card/1077451024200/5d398a28-519e-11f0-a065-d549be31d974',
    description: 'Руководство бригадой монтажников на строительном объекте. Контроль проведения и качества выполненных работ.',
    published: '2026-06-22',
    confidence: '62%',
    verified: true,
    vakhta: true,
    salaryValue: 168000,
  },
  {
    title: 'Монтажник металлоконструкций вахта',
    company: 'Avito',
    salary: 'требует уточнения',
    location: 'Чамзинка',
    source: 'Avito',
    url: 'https://www.avito.ru/chamzinka/vakansii/montazhnik_metallokonstruktsiy_vahta_3180989635',
    description: 'Карточка найдена в HTML-выдаче Avito. Нужна проверка ставки, графика, проживания и контакта.',
    published: '',
    confidence: '38%',
    verified: false,
    vakhta: true,
    salaryValue: 0,
  },
  {
    title: 'Монтажник по монтажу стальных и железобетонных конструкций',
    company: 'SuperJob',
    salary: '170 000 – 180 000 руб.',
    location: 'Поселок имени Морозова',
    source: 'vpoiskerabot / SuperJob',
    url: 'https://spb.superjob.ru/vakansii/montazhnik-po-montazhu-stalnyh-i-zhelezobetonnyh-konstrukcij-51984030.html',
    description: 'Монтаж и демонтаж строительных металлоконструкций. Требуется удостоверение 4-5 разрядов, опыт от 3 лет, допуск на высоту.',
    published: '2026-06-18',
    confidence: '55%',
    verified: true,
    vakhta: false,
    salaryValue: 170000,
  },
  {
    title: 'Монтажник металлоконструкций',
    company: 'ООО "ЛЕВ СТРОЙ"',
    salary: '66 000 – 70 000 руб.',
    location: 'Череповец, ПАО "Северсталь"',
    source: 'vpoiskerabot / Роструд',
    url: 'https://trudvsem.ru/vacancy/card/5157746131989/78a7403e-f8e9-11ef-808b-cb26dff57dd7',
    description: 'Монтажник металлоконструкций на территории ПАО Северсталь. Описаны требования к такелажным и монтажным работам.',
    published: '2026-06-03',
    confidence: '64%',
    verified: false,
    vakhta: false,
    salaryValue: 66000,
  },
  {
    title: 'Монтажник в Череповце',
    company: 'Avito',
    salary: 'требует уточнения',
    location: 'Череповец',
    source: 'Avito',
    url: 'https://www.avito.ru/cherepovets/vakansii/montazhnik_8111090173',
    description: 'Работы по монтажу и демонтажу металлоконструкций. Карточка найдена в выдаче Avito.',
    published: '',
    confidence: '38%',
    verified: false,
    vakhta: false,
    salaryValue: 0,
  },
  {
    title: 'Ученик монтажника металлоконструкций',
    company: 'SuperJob',
    salary: 'от 100 000 руб.',
    location: 'Балаково',
    source: 'vpoiskerabot / SuperJob',
    url: 'https://balakovo.superjob.ru/vakansii/uchenik-montazhnika-metallokonstrukcij-52009302.html',
    description: 'Сборка и монтаж металлоконструкций на производстве. Рассматривают кандидатов без опыта с обучением.',
    published: '2026-06-19',
    confidence: '52%',
    verified: true,
    vakhta: false,
    salaryValue: 100000,
  },
  {
    title: 'Бригада монтажников металлоконструкций',
    company: 'ООО "Джобкарт"',
    salary: '160 000 – 185 000 руб.',
    location: 'Москва и Московская область',
    source: 'vpoiskerabot / Роструд',
    url: 'https://trudvsem.ru/vacancy/card/5147746474134/dc69e324-5e69-11f1-b4a8-cb523d2e9346',
    description: 'Вахтовый метод, монтаж металлических конструкций, предоставление жилья или компенсации, СИЗ, питание.',
    published: '2026-06-02',
    confidence: '66%',
    verified: true,
    vakhta: true,
    salaryValue: 160000,
  },
  {
    title: 'Монтажник мк в Нерюнгри',
    company: 'Avito',
    salary: 'требует уточнения',
    location: 'Нерюнгри',
    source: 'Avito',
    url: 'https://www.avito.ru/neryungri/vakansii/montazhnik_mk_8076738339',
    description: 'Карточка найдена в выдаче Avito. Нужна ручная сверка объекта и условий вахты.',
    published: '',
    confidence: '38%',
    verified: false,
    vakhta: true,
    salaryValue: 0,
  },
];

const noticeSets = {
  worker: [
    { icon: 'П', title: 'Проверка вакансии доступна', text: 'Вы можете запросить проверку непроверенной вакансии или открыть данные по проверенной.' },
    { icon: 'Д', title: 'Документы скрыты', text: 'Компании видят только статусы и обезличенный профиль до вашего согласия.' },
  ],
  admin: [
    { icon: 'И', title: 'Импорт вакансий', text: 'Есть непроверенные вакансии из Avito и агрегаторов, ожидающие ручной проверки.' },
    { icon: 'П', title: 'Проверка условий', text: 'Сверьте ставку, график, жилье, дорогу, СИЗ, НДФЛ, договор и контакт работодателя.' },
  ],
};

let isAuthenticated = false;
let userRole = 'guest';
let parserStatus = 'empty';
let pendingAfterAuth = null;
let selectedVacancyIndex = 0;
let heroSlideIndex = 0;
let heroTimer = null;
let currentCompanyReport = null;
let currentCompanyProfile = null;
let currentCompanySearchQuery = '';

function escapeHtml(value = '') {
  return fixMojibake(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fixMojibake(value = '') {
  const text = String(value ?? '');
  if (!/[╨╤]/.test(text)) return text;
  const map = {
    '╨░': 'а', '╨▒': 'б', '╨▓': 'в', '╨│': 'г', '╨┤': 'д', '╨╡': 'е', '╤С': 'ё',
    '╨╢': 'ж', '╨╖': 'з', '╨╕': 'и', '╨╣': 'й', '╨║': 'к', '╨╗': 'л', '╨╝': 'м',
    '╨╜': 'н', '╨╛': 'о', '╨┐': 'п', '╤А': 'р', '╤Б': 'с', '╤В': 'т', '╤Г': 'у',
    '╤Д': 'ф', '╤Е': 'х', '╤Ж': 'ц', '╤З': 'ч', '╤И': 'ш', '╤Й': 'щ', '╤К': 'ъ',
    '╤Л': 'ы', '╤М': 'ь', '╤Н': 'э', '╤О': 'ю', '╤П': 'я',
    '╨Р': 'А', '╨С': 'Б', '╨Т': 'В', '╨У': 'Г', '╨Ф': 'Д', '╨Х': 'Е', '╨Ц': 'Ж',
    '╨Ч': 'З', '╨Ш': 'И', '╨Щ': 'Й', '╨Ъ': 'К', '╨Ы': 'Л', '╨Ь': 'М', '╨Э': 'Н',
    '╨Ю': 'О', '╨Я': 'П', '╨а': 'Р', '╨б': 'С', '╨в': 'Т', '╨г': 'У', '╨д': 'Ф',
    '╨е': 'Х', '╨ж': 'Ц', '╨з': 'Ч', '╨и': 'Ш', '╨й': 'Щ', '╨к': 'Ъ', '╨л': 'Ы',
    '╨м': 'Ь', '╨н': 'Э', '╨о': 'Ю', '╨п': 'Я',
  };
  return text.replace(/╨.|╤./g, (chunk) => map[chunk] || chunk);
}

function formatDateTime(value) {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(-2)}`;
}

function translateStatus(value = '') {
  const map = {
    ok: 'собрано',
    error: 'ошибка',
    manual_review: 'ручная проверка',
    candidate_review: 'кандидат, нужна сверка',
    configured: 'подключено',
    not_found: 'не найдено',
    open_data: 'открытые данные',
    signals_found: 'есть сигналы',
    violator: 'риск высокий',
  };
  return map[value] || value;
}

function translateSummary(value = '') {
  return String(value)
    .replace('FNS legal card was not collected automatically.', 'Юридическая карточка ФНС не была собрана автоматически.')
    .replace(/^FNS legal card found: /, 'Юридическая карточка ФНС найдена: ')
    .replace(/^Manual source checks required: (\d+)\.$/, 'Требуется ручная проверка источников: $1.')
    .replace(': automatic collection failed.', ': автоматический сбор не удался.');
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

function formatRussianPhone(value) {
  let digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`;
  const rest = digits.slice(1, 11);
  const p1 = rest.slice(0, 3);
  const p2 = rest.slice(3, 6);
  const p3 = rest.slice(6, 8);
  const p4 = rest.slice(8, 10);
  return `+7 ${p1}${p2 ? ` ${p2}` : ''}${p3 ? `-${p3}` : ''}${p4 ? `-${p4}` : ''}`;
}

function attachPhoneMask(input) {
  input.addEventListener('input', () => {
    input.value = formatRussianPhone(input.value);
  });
}

function setPage(name) {
  if (!routes.includes(name)) return;
  document.body.dataset.page = name;
  pages.forEach((page) => page.classList.toggle('active', page.dataset.page === name));
  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'admin' && companyInnEditor && !companyInnEditor.hidden) {
    setTimeout(() => adminCompanyInn?.focus(), 50);
  }
}

function setHeroSlide(index) {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('[data-hero-dot]')];
  if (!slides.length) return;
  heroSlideIndex = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === heroSlideIndex));
  dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === heroSlideIndex));
}

function startHeroSlider() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => setHeroSlide(heroSlideIndex + 1), 6500);
}

function showPhoneLogin() {
  setPage('auth');
  if (phoneLogin) phoneLogin.hidden = false;
  setTimeout(() => loginPhone?.focus(), 50);
}

function navigateRoute(route) {
  if (route === 'auth' && !isAuthenticated) {
    showPhoneLogin();
    return;
  }
  if (route === 'notifications' && !isAuthenticated) {
    showPhoneLogin();
    showToast('Сначала подтвердите номер или код компании.');
    return;
  }
  if (route === 'admin' && userRole !== 'admin') {
    setPage('home');
    showToast('Интерфейс администратора доступен только после служебного входа.');
    return;
  }
  setPage(route);
  if (route === 'notifications') renderNotices();
}

function handleRouteClick(event) {
  event.preventDefault();
  navigateRoute(event.currentTarget.dataset.route);
}

function renderTopNav() {
  if (!topNav) return;
  if (!isAuthenticated) {
    const guestItems = [
      { route: 'vacancies', label: 'Вакансии' },
      { route: 'check-vacancy', label: 'Проверить вакансию' },
      { route: 'auth', label: 'Вход' },
    ];
    topNav.innerHTML = guestItems.map((item) => `<a href="#${item.route}" data-route="${item.route}">${item.label}</a>`).join('');
    topNav.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', handleRouteClick));
    return;
  }
  const items = [
    ...(userRole === 'admin' ? [{ route: 'admin', label: 'Админка' }] : []),
    { route: 'vacancies', label: 'Вакансии' },
    ...(isAuthenticated ? [{ route: 'notifications', label: 'Уведомления' }] : []),
    { route: 'profile', label: 'Профиль' },
    { route: 'rating', label: 'Рейтинг' },
  ];
  topNav.innerHTML = items.map((item) => `<a href="#${item.route}" data-route="${item.route}">${item.label}</a>`).join('');
  topNav.querySelectorAll('[data-route]').forEach((link) => link.addEventListener('click', handleRouteClick));
}

function renderSessionActions() {
  if (!sessionActions) return;
  if (!isAuthenticated) {
    sessionActions.innerHTML = '';
    return;
  }
  sessionActions.innerHTML = `
    <button class="ghost-btn session-phone" type="button" data-route="${userRole === 'admin' ? 'admin' : 'profile'}">${loginPhone.value || '+7 900 000-00-00'}</button>
  `;
}

function logout() {
  isAuthenticated = false;
  userRole = 'guest';
  pendingAfterAuth = null;
  renderTopNav();
  renderSessionActions();
  renderImportedVacancies();
  renderNotices();
  setPage('home');
  showToast('Вы вышли из аккаунта.');
}

function renderNotices() {
  if (!noticeFeed) return;
  if (!isAuthenticated) {
    noticeFeed.innerHTML = '';
    if (noticeLock) noticeLock.hidden = false;
    return;
  }
  if (noticeLock) noticeLock.hidden = true;
  const set = userRole === 'admin' ? noticeSets.admin : noticeSets.worker;
  noticeFeed.innerHTML = set.map((item) => `
    <article class="notice">
      <div class="notice-icon">${item.icon}</div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.text}</p>
      </div>
      <button class="secondary-btn" type="button">Открыть</button>
    </article>
  `).join('');
}

function renderSources() {
  if (!sourceList) return;
  sourceList.innerHTML = sources.map((source) => `
    <div class="source-item">
      <b>${source.name}</b>
      <span>${source.type}</span>
      <div class="source-meta">
        <span>${source.status}</span>
        <span>${source.fields}</span>
      </div>
    </div>
  `).join('');
}

function renderParserCard(status = parserStatus) {
  if (!parserCard) return;
  if (status === 'empty') {
    parserCard.innerHTML = '<span>Запустите первичный парсинг, чтобы увидеть нормализованную карточку вакансии.</span>';
    return;
  }

  const statusText = {
    imported: 'Импортировано, требуется уточнение',
    clarify: 'Передано представителю ПлюсЗвена',
    confirmed: 'Подтверждено ПлюсЗвено',
  }[status];

  parserCard.innerHTML = `
    <b>${parsedVacancy.title}</b>
    <span>Источник: ${parsedVacancy.source}</span>
    <span>Компания: ${parsedVacancy.company}</span>
    <span>Регион: ${parsedVacancy.region}</span>
    <span>Оплата: ${parsedVacancy.salary}</span>
    <span>График: ${parsedVacancy.schedule}</span>
    <span>Доверие первичных данных: ${parsedVacancy.confidence}</span>
    <span>Не хватает: ${parsedVacancy.missing}</span>
    <strong>${statusText}</strong>
  `;
}

function updateCompanyCheckCommand() {
  if (!companyCheckCommand || !adminCompanyInn) return;
  const inn = digitsOnly(adminCompanyInn.value) || '7453330144';
  companyCheckCommand.textContent = `powershell -ExecutionPolicy Bypass -File .\\company_check\\company_check.ps1 -Inn ${inn}`;
}

function setCompanyCheckLoading(isLoading) {
  if (!runCompanyCheck) return;
  runCompanyCheck.disabled = isLoading;
  runCompanyCheck.textContent = isLoading ? 'Проверяю...' : 'Проверить';
}

function formatDuration(ms = 0) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} сек.`;
  return `${Math.floor(seconds / 60)} мин. ${seconds % 60} сек.`;
}

function resetCompanyCheckLog() {
  if (!companyCheckLog) return;
  companyCheckLog.hidden = false;
  companyCheckLog.innerHTML = '';
}

function addCompanyCheckLog(message = '') {
  if (!companyCheckLog) return;
  companyCheckLog.hidden = false;
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
  companyCheckLog.insertAdjacentHTML('beforeend', `<div><span>${escapeHtml(time)}</span>${escapeHtml(message)}</div>`);
  companyCheckLog.scrollTop = companyCheckLog.scrollHeight;
}

function logSourceTimings(report = {}) {
  const timings = asArray(report?.diagnostics?.source_timings);
  if (!timings.length) return;
  addCompanyCheckLog('Время по источникам:');
  timings.forEach((item) => {
    const seconds = Number(item.seconds || 0);
    addCompanyCheckLog(`${item.source || 'Источник'}: ${formatDuration(seconds * 1000)}.`);
  });
}

function logFallbackDiagnostics(report = {}) {
  if (report?.diagnostics?.fallback_used !== 'local_registry') return;
  addCompanyCheckLog('Название и короткая карточка взяты из локального справочника: внешний источник не вернул достаточно данных.');
}

function logReviewSearchResults(report = {}) {
  const rows = buildSearchVariantRows(report);
  if (!rows.length) {
    addCompanyCheckLog('Источники проверены: вариантов для таблицы не найдено.');
    return;
  }
  addCompanyCheckLog('Результаты поиска источников:');
  rows.forEach((row) => {
    const state = getSearchVariantState(row);
    const stateText = state === 'found' ? 'найдено' : state === 'doubt' ? 'нужна сверка' : 'не найдено';
    const urlText = row.url ? ` Ссылка: ${row.url}` : '';
    addCompanyCheckLog(`${row.sourceTitle}: ${stateText}. ${row.countText || ''}.${urlText}`);
  });
}

function setCompanyStage(stage = 1) {
  companyCheckStage = stage;
  setCompanyCheckFlow(stage, Array.from({ length: Math.max(0, stage - 1) }, (_, index) => index + 1));
  if (companyInnSummary) companyInnSummary.hidden = stage !== 1 || !currentCompanyReport;
}

function setCompanyInnEditMode(isEditing) {
  if (companyInnEditor) companyInnEditor.hidden = !isEditing;
  if (companyInnSummary) companyInnSummary.hidden = isEditing;
  if (isEditing) {
    if (companyCheckTitle) companyCheckTitle.hidden = true;
    setCompanyStage(1);
    if (companyStagePanel) companyStagePanel.hidden = true;
    if (manualReviewPanel) manualReviewPanel.hidden = true;
    if (companyReportView) companyReportView.hidden = true;
    setTimeout(() => adminCompanyInn?.focus(), 30);
  }
}

function renderCompanyCheckTitle(report = {}) {
  if (!companyCheckTitle) return;
  const inn = report?.inn || adminCompanyInn?.value || '';
  companyCheckTitle.hidden = false;
  companyCheckTitle.innerHTML = `
    <div>
      <span>ИНН ${escapeHtml(inn)}</span>
    </div>
  `;
}

function setCompanyCheckFlow(activeStep = 1, doneSteps = []) {
  if (!companyCheckFlow) return;
  companyCheckFlow.querySelectorAll('[data-flow-step]').forEach((item) => {
    const step = Number(item.dataset.flowStep || 0);
    item.classList.toggle('active', step === activeStep);
    item.classList.remove('done');
  });
}

function renderCompanyStage(stage = 1, report = currentCompanyReport) {
  if (!companyStagePanel || !report) return;
  setCompanyStage(stage);
  companyStagePanel.hidden = false;
  if (manualReviewPanel) manualReviewPanel.hidden = true;
  if (companyReportView) companyReportView.hidden = true;

  if (stage === 1) {
    const name = getCompanyDisplayName(report);
    if (!name) {
      companyStagePanel.innerHTML = `
        <div class="stage-card warn">
          <p>ФНС/Checko не вернули название автоматически. Для поиска источников укажите название компании вручную.</p>
          <label class="review-keywords">
            <span>Поисковые слова</span>
            <textarea data-company-search-queries rows="2">${escapeHtml(buildReviewSearchKeywords(report))}</textarea>
          </label>
          <div class="stage-actions"><button class="primary-btn" type="button" data-company-next="2">Далее</button></div>
        </div>
      `;
      return;
    }
    const metrics = getCheckoBriefMetrics(report);
    const relatedCompanies = getRelatedConstructionCompanies(report);
    const reliabilityFacts = getCheckoReliabilityFacts(report);
    const factsHtml = [
      ['Положительные', reliabilityFacts.positive, 'good'],
      ['Требуют внимания', reliabilityFacts.attention, 'warn'],
      ['Негативные', reliabilityFacts.negative, 'bad'],
    ].filter(([, items]) => items.length).map(([title, items, state]) => `
      <div class="${state}">
        <span>${escapeHtml(title)}</span>
        <p>${escapeHtml(items.slice(0, 3).join('; '))}</p>
      </div>
    `).join('');
    const hasStop = metrics.some((metric) => metric.state === 'bad' && /Ликвидация|Банкротство/.test(metric.label));
    companyStagePanel.innerHTML = `
      <div class="stage-card">
        <div class="stage-card-grid">
          <div><span>Название</span><p>${escapeHtml(name)}</p></div>
          <div><span>Юр. адрес</span><p>${escapeHtml(getCompanyLegalAddress(report) || 'нет данных')}</p></div>
          <div><span>Директор</span><p>${escapeHtml(getCompanyDirector(report) || 'нет данных')}</p></div>
          <div><span>Город</span><p>${escapeHtml(getCompanyCity(report) || 'нет данных')}</p></div>
          ${metrics.map((metric) => `
            <div class="${escapeHtml(metric.state)}">
              <span>${escapeHtml(metric.label)}</span>
              <p>${escapeHtml(metric.value)}</p>
            </div>
          `).join('')}
        </div>
        <div class="stage-related">
          <span>Связанные строительные компании директора/учредителей</span>
          <p>${relatedCompanies.length ? escapeHtml(relatedCompanies.join('; ')) : 'не найдены'}</p>
        </div>
        ${factsHtml ? `<div class="stage-card-grid stage-facts">${factsHtml}</div>` : ''}
        ${hasStop
          ? '<div class="stage-actions"><button class="primary-btn" type="button" data-company-show-report>Показать отчет</button></div>'
          : `<label class="review-keywords">
              <span>Поисковые слова для источников</span>
              <textarea data-company-search-queries rows="2">${escapeHtml(buildReviewSearchKeywords(report))}</textarea>
            </label>
            <div class="stage-actions"><button class="primary-btn" type="button" data-company-next="2">Далее</button></div>`}
      </div>
    `;
    return;
  }

  if (stage === 2) {
    companyStagePanel.hidden = true;
    syncManualReviewPanelFromReport(report);
  }
}

const manualReviewConfigs = [
  { value: '2gis', title: '2GIS', reportCode: '2gis_reviews' },
  { value: 'yandex', title: 'Яндекс Карты', reportCode: 'yandex_maps_reviews' },
  { value: 'dreamjob', title: 'DreamJob', reportCode: 'dreamjob_reviews' },
  { value: 'antijob', title: 'Antijob', reportCode: 'antijob_reviews' },
];

function getCompanyDisplayName(report = {}) {
  return report?.legal_card?.name
    || getReportSource(report, 'checko_company_card')?.collected?.name
    || getReportSource(report, 'fns_egrul')?.collected?.name
    || '';
}

function getCompanyShortName(report = {}) {
  return getCompanyDisplayName(report)
    || getReportSource(report, 'checko_company_card')?.collected?.name
    || getReportSource(report, 'checko_company_card')?.collected?.normalized_search_name
    || '';
}

function getCompanyFullName(report = {}) {
  return getCompanyDisplayName(report)
    || getReportSource(report, 'checko_company_card')?.collected?.full_name
    || getReportSource(report, 'fns_egrul')?.collected?.name
    || '';
}

function stripLegalForm(value = '') {
  const quoted = extractQuotedCompanyNames(value);
  if (quoted.length) return normalizeKeyword(quoted[0]);
  return normalizeKeyword(value)
    .replace(/\b(непубличное акционерное общество|общество с ограниченной ответственностью|акционерное общество|публичное акционерное общество|закрытое акционерное общество|индивидуальный предприниматель|ооо|ао|зао|пао|нао|ип)\b/gi, ' ')
    .replace(/\b(общество|с|ограниченной|ответственностью|акционерное|непубличное|публичное|закрытое|индивидуальный|предприниматель|компания)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuotedCompanyNames(value = '') {
  const text = String(value || '');
  const names = [];
  const quotePattern = /["«]([^"»]+)["»]?/g;
  let match;
  while ((match = quotePattern.exec(text))) {
    if (match[1]?.trim()) names.push(match[1].trim());
  }
  return names;
}

function getCompanyLegalAddress(report = {}) {
  return report?.legal_card?.address
    || getReportSource(report, 'checko_company_card')?.collected?.address
    || getReportSource(report, 'checko_company_card')?.collected?.legal_address
    || getReportSource(report, 'fns_egrul')?.collected?.address
    || '';
}

function getCompanyDirector(report = {}) {
  return report?.legal_card?.director
    || getReportSource(report, 'checko_company_card')?.collected?.director
    || getReportSource(report, 'fns_egrul')?.collected?.director
    || '';
}

function getCompanyCity(report = {}) {
  const address = getCompanyLegalAddress(report);
  const knownCities = ['Уфа', 'Челябинск', 'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск', 'Казань', 'Нижний Новгород', 'Краснодар', 'Пермь', 'Тюмень'];
  const normalizedAddress = String(address || '').replace(/\s+/g, ' ');
  for (const city of knownCities) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:г\\.?|город)?\\s*${escaped}(?:,|\\b)`, 'i').test(normalizedAddress)) return city;
  }
  const cityMatch = normalizedAddress.match(/(?:^|,\s*)(?:г\.|г\s+|город\s+)\s*(?!о\.)([^,\n]+)/i);
  if (cityMatch) return cityMatch[1].replace(/^город\s+/i, '').trim();
  const districtMatch = normalizedAddress.match(/г\.\s*о\.\s*(?:город\s*)?([^,\n]+)/i);
  if (districtMatch) return districtMatch[1].replace(/^город\s+/i, '').trim();
  const match = String(address).match(/(?:г\.|город)\s*([^,\n]+)/i);
  return match ? match[1].replace(/^город\s+/i, '').trim() : '';
}

function getCheckoReliabilityFacts(report = {}) {
  const collected = getReportSource(report, 'checko_company_card')?.collected || {};
  const facts = collected.reliability_facts || {};
  const normalize = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'object') return Object.values(value).map((item) => String(item || '').trim()).filter(Boolean);
    return [String(value).trim()].filter(Boolean);
  };
  return {
    positive: normalize(facts.positive),
    attention: normalize(facts.attention),
    negative: normalize(facts.negative),
  };
}

function getCheckoBriefMetrics(report = {}) {
  const checko = getReportSource(report, 'checko_company_card');
  const collected = checko?.collected || {};
  const facts = getCheckoReliabilityFacts(report);
  const factsText = [
    ...facts.positive,
    ...facts.attention,
    ...facts.negative,
    ...asArray(report?.summary),
  ].join(' ');
  const liquidationSignal = /ликвид|недейств|прекращ/i.test(`${factsText} ${collected.status || ''} ${collected.liquidation_reason || ''}`);
  const bankruptcySignal = /банкрот|федресурс/i.test(factsText);
  const revenueYear = collected.revenue && collected.finance_year ? ` (${collected.finance_year})` : '';
  const defendantSummary = collected.arbitration_defendant_summary || collected.defendant_summary || '';
  const confirmedStop = /ликвид|недейств|прекращ|банкрот/i.test(`${collected.status || ''} ${collected.liquidation_reason || ''} ${collected.liquidation_date_text || ''}`);
  const legalRiskText = liquidationSignal || bankruptcySignal
    ? [
      liquidationSignal ? 'есть сигнал ликвидации/статуса' : '',
      bankruptcySignal ? 'есть сигнал банкротства' : '',
    ].filter(Boolean).join(', ')
    : 'нет';
  const revenueRub = parseMoneyToRubles(collected.revenue);
  const staffNumber = Number(String(collected.staff_count || collected.average_headcount || '').replace(/\D+/g, '') || 0);
  const hasDefendantCases = defendantSummary && !/^0\b|0 шт/i.test(defendantSummary);
  const enforcementText = String(collected.enforcement_proceedings_summary || '');
  const hasEnforcement = enforcementText && !/нет сведений|отсутств/i.test(enforcementText);
  const riskScore = Number(report?.risk_score || 0);
  return [
    { label: 'Ликвидация / банкротство', value: legalRiskText, state: confirmedStop ? 'bad' : liquidationSignal || bankruptcySignal ? 'warn' : 'good' },
    { label: `Обороты${revenueYear}`, value: getRevenueDisplay(collected), state: revenueRub > 0 && revenueRub < 200_000_000 ? 'bad' : revenueRub >= 200_000_000 && revenueRub < 500_000_000 ? 'warn' : revenueRub >= 500_000_000 ? 'good' : 'warn' },
    { label: 'Сотрудники', value: collected.staff_count || collected.average_headcount || 'нет данных', state: staffNumber > 0 && staffNumber < 10 ? 'bad' : staffNumber >= 10 && staffNumber < 50 ? 'warn' : staffNumber >= 50 ? 'good' : 'warn' },
    { label: 'Входящие суды', value: hasEnforcement ? `${defendantSummary || 'нет'}; есть исполнительные производства` : /^0\b|0 шт/i.test(defendantSummary) ? 'нет' : defendantSummary || 'нет данных', state: hasEnforcement ? 'bad' : hasDefendantCases ? 'warn' : 'good' },
    { label: 'Риск', value: `${riskScore >= 5 ? '?' : '✓'} ${riskScore}%`, state: riskScore >= 20 ? 'bad' : riskScore >= 5 ? 'warn' : 'good' },
  ];
}

function getRelatedConstructionCompanies(report = {}) {
  const collected = getReportSource(report, 'checko_company_card')?.collected || {};
  const details = asArray(collected.related_companies_details?.all_companies || collected.related_companies_details);
  const rows = details
    .filter((item) => item && !item.is_current_company && item.is_construction_smr)
    .map((item) => {
      const parts = [
        item.name || '',
        item.inn ? `ИНН ${item.inn}` : '',
        item.role === 'leader' ? 'директор' : item.role === 'founder' ? 'учредитель' : item.role || '',
      ].filter(Boolean);
      return parts.join(', ');
    });
  if (collected.successor_companies_text) rows.unshift(`Правопреемник: ${collected.successor_companies_text}`);
  if (rows.length) return rows.slice(0, 6);
  const text = collected.related_companies_by_person || '';
  if (text && !/не найдены/i.test(text)) return [text];
  return [];
}

function normalizeKeyword(value = '') {
  return String(value).replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
}

function buildReviewSearchKeywords(report = {}) {
  const keywords = new Set();
  const add = (value) => {
    const text = normalizeKeyword(value);
    if (text) keywords.add(text);
  };
  const shortName = getCompanyShortName(report);
  const fullName = getCompanyFullName(report);
  add(stripLegalForm(shortName));
  add(stripLegalForm(fullName));
  extractQuotedCompanyNames(shortName).forEach(add);
  extractQuotedCompanyNames(fullName).forEach(add);
  add(shortName);
  return [...keywords].filter(Boolean).join(', ');
}

function getCompanySearchQueryText() {
  const stageInput = companyStagePanel?.querySelector('[data-company-search-queries]');
  const reviewInput = manualReviewSources?.querySelector('[data-review-keywords]');
  return (stageInput?.value || reviewInput?.value || currentCompanySearchQuery || buildReviewSearchKeywords(currentCompanyReport || {})).trim();
}

function renderReviewDashboard(report = {}, rows = []) {
  return `
    <div class="review-dashboard" aria-label="Сводка поиска отзывов">
      ${manualReviewConfigs.map((config) => {
        const source = getReportSource(report, config.reportCode);
        const sourceRows = rows.filter((row) => row.sourceValue === config.value);
        const hasFound = sourceRows.some((row) => getSearchVariantState(row) === 'found');
        const hasDoubt = sourceRows.some((row) => getSearchVariantState(row) === 'doubt');
        const status = hasFound ? 'found' : hasDoubt ? 'doubt' : source ? 'missing' : 'missing';
        return `
          <div class="review-dashboard-item ${status}">
            <span class="review-service-icon">${escapeHtml(config.title.slice(0, 2))}</span>
            <span>${escapeHtml(config.title)}</span>
            <b>${status === 'found' ? '✓' : status === 'doubt' ? '!' : '×'}</b>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getReviewSourceUrl(report, sourceValue = '2gis') {
  const config = manualReviewConfigs.find((item) => item.value === sourceValue);
  const sourceCode = config?.reportCode || sourceValue;
  const source = getReportSource(report, sourceCode);
  return source?.collected?.reviews_url || source?.collected?.employer_url || source?.url || '';
}

function getSearchAttemptCountText(attempt = {}, source = {}) {
  if (isClosedMapSource(source)) return 'Больше не работает';
  if (source.status === 'not_found') return 'Не найдено';
  if (source.status === 'candidate_review') return 'Нужна сверка';
  if (attempt.review_count_text) return attempt.review_count_text;
  if (attempt.review_count) return `${attempt.review_count} отзывов`;
  if (attempt.employer_count) return `${attempt.employer_count} работодателей`;
  if (attempt.company_count) return `${attempt.company_count} компаний`;
  if (attempt.vacancy_count) return `${attempt.vacancy_count} вакансий`;
  if (attempt.count !== undefined && attempt.count !== '') return `${attempt.count} вариантов`;
  if (attempt.error || source.status === 'not_found') return 'Не найдено';
  return source.status === 'candidate_review' ? 'Нужна сверка' : translateStatus(source.status || 'not_started');
}

function getSearchAttemptStatusText(attempt = {}, source = {}) {
  if (attempt.error) return 'не найдено';
  if (attempt.status) return translateStatus(attempt.status);
  return translateStatus(source.status || 'не начато');
}

function getSearchAttemptQuery(attempt = {}, source = {}) {
  return attempt.query || attempt.search_query || source?.collected?.search_query || source?.collected?.searched_company_name || source?.collected?.api_query_used || source?.collected?.searched_inn || '';
}

function isClosedMapSource(source = {}) {
  if (source?.code !== 'yandex_maps_reviews') return false;
  const haystack = [
    source?.status,
    source?.collected?.page_title,
    source?.collected?.title,
    source?.collected?.status_text,
    ...asArray(source?.signals).map((signal) => signal?.message || ''),
  ].join(' ');
  return /Permanently closed|Больше не работает|Закрыто навсегда|не работает/i.test(haystack);
}

function isSearchVariantMissing(row = {}) {
  const countText = String(row.countText || '').toLowerCase();
  return Boolean(row.notFound || !row.url || countText.includes('не найдено') || countText.includes('рќрµ рЅр°р№рґрµрЅрѕ'));
}

function getSearchVariantState(row = {}) {
  const countText = String(row.countText || '').toLowerCase();
  if (row.statusText?.includes('браузерному') || countText.includes('нужна сверка') || countText.includes('больше не работает') || countText.includes('кандидат')) return 'doubt';
  if (isSearchVariantMissing(row)) return 'missing';
  return row.url ? 'found' : 'missing';
}

function buildSearchVariantRows(report) {
  const rowsByKey = new Map();
  manualReviewConfigs.forEach((config) => {
    const source = getReportSource(report, config.reportCode);
    if (!source) return;
    const attempts = asArray(source?.collected?.search_attempts).filter((item) => item && typeof item === 'object');
    const hasUrlAttempt = attempts.some((item) => item.url);
    const hasResolvedAttempt = attempts.some((item) => !item.error && (
      item.url || item.title || item.review_count || item.review_count_text || item.company_count || item.vacancy_count || item.count
    ));
    const normalizedAttempts = attempts.length ? attempts : [{
      query: source?.collected?.search_query || source?.collected?.api_query_used || source?.collected?.searched_company_name || source?.collected?.searched_inn || '',
      url: source?.collected?.reviews_url || source?.collected?.employer_url || source?.url || '',
      status: source.status,
      review_count: source?.collected?.review_count || '',
      review_count_text: source?.collected?.review_count_text || '',
    }];
    normalizedAttempts.forEach((attempt, index) => {
      if (hasUrlAttempt && !attempt.url) return;
      if (attempt.error && hasResolvedAttempt) return;
      const query = getSearchAttemptQuery(attempt, source);
      const url = attempt.error ? '' : (attempt.url || source?.collected?.reviews_url || source?.collected?.employer_url || source?.url || '');
      const countText = getSearchAttemptCountText(attempt, source);
      const key = url ? `${config.value}|${url}` : `${config.value}|missing|${query || index}`;
      const existing = rowsByKey.get(key);
      if (existing) {
        if (query && !existing.queries.includes(query)) existing.queries.push(query);
        if (!existing.url && url) existing.url = url;
        if (existing.countText === 'Не найдено' && countText !== 'Не найдено') existing.countText = countText;
        existing.notFound = isSearchVariantMissing(existing);
        return;
      }
      const row = {
        id: `${config.value}-${rowsByKey.size}`,
        sourceValue: config.value,
        sourceTitle: config.title,
        queries: query ? [query] : [],
        countText,
        url,
        collectable: ['ok', 'candidate_review'].includes(source.status) && Boolean(url),
        statusText: ['ok', 'candidate_review'].includes(source.status) && url ? 'готово к браузерному сбору' : 'не найдено',
        checked: false,
        notFound: Boolean(attempt.error || source.status === 'not_found' || !url),
      };
      row.notFound = isSearchVariantMissing(row);
      rowsByKey.set(key, row);
    });
  });
  return [...rowsByKey.values()];
}

function syncManualReviewPanelFromReport(report) {
  if (!manualReviewPanel || !manualReviewSources || !report) return;
  manualReviewPanel.hidden = false;
  const keywordText = getCompanySearchQueryText() || buildReviewSearchKeywords(report);
  currentCompanySearchQuery = keywordText;
  const rows = buildSearchVariantRows(report);
  manualReviewSources.innerHTML = `
    ${renderReviewDashboard(report, rows)}
    <label class="review-keywords">
      <span>Ключевые слова поиска</span>
      <textarea data-review-keywords rows="2">${escapeHtml(keywordText)}</textarea>
    </label>
    <div class="search-variants-wrap">
      <table class="search-variants-table">
        <thead>
          <tr>
            <th>Источник</th>
            <th>Ссылка</th>
            <th>Поисковое слово</th>
            <th>Действие</th>
            <th>Статус сбора</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const queryText = row.queries?.length ? row.queries.join(', ') : 'ручной поиск';
            const variantState = getSearchVariantState(row);
            return `
              <tr class="search-variant-${escapeHtml(variantState)}" data-search-row="${escapeHtml(row.id)}" data-review-source="${escapeHtml(row.sourceValue)}" data-search-not-found="${isSearchVariantMissing(row) ? 'true' : 'false'}">
                <td>${escapeHtml(row.sourceTitle)}</td>
                <td>${row.url ? `<a href="${escapeHtml(row.url)}" target="_blank" rel="noreferrer">открыть</a>` : 'нет ссылки'}</td>
                <td>${escapeHtml(queryText)}</td>
                <td>
                  ${row.url
                    ? `<a href="#" data-search-edit="${escapeHtml(row.id)}">Актуализировать</a><a href="#" data-search-remove="${escapeHtml(row.id)}">Удалить</a>`
                    : `<a href="#" data-search-add="${escapeHtml(row.sourceValue)}">Добавить</a>`}
                </td>
                <td data-search-status="${escapeHtml(row.id)}" data-review-source="${escapeHtml(row.sourceValue)}" data-review-url-value="${escapeHtml(row.url)}" data-review-collectable="${row.collectable ? 'true' : 'false'}">${escapeHtml(row.statusText || 'не начато')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="search-variants-actions">
      <button class="secondary-btn" type="button" data-search-remove-missing>Удалить "не найденные"</button>
      <button class="primary-btn" type="button" data-search-start>Собрать</button>
    </div>
  `;
}

async function runCompanyCheckReport() {
  const inn = digitsOnly(adminCompanyInn?.value || '');
  if (![10, 12, 13, 15].includes(inn.length)) {
    showToast('Введите ИНН 10/12 цифр, ОГРН 13 цифр или ОГРНИП 15 цифр.');
    adminCompanyInn?.focus();
    return;
  }
  setCompanyCheckLoading(true);
  setCompanyCheckFlow(1, []);
  resetCompanyCheckLog();
  const startedAt = Date.now();
  let waitLogTimer = null;
  currentCompanySearchQuery = '';
  addCompanyCheckLog(`Начал проверку ИНН ${inn}.`);
  addCompanyCheckLog('Отправляю запрос в локальную админку: /api/company-check.');
  addCompanyCheckLog('Сервер запустит PowerShell-сборщик company_check.ps1. Промежуточные ответы от него пока не приходят, поэтому ждём итоговый JSON.');
  if (companyStagePanel) companyStagePanel.hidden = true;
  if (manualReviewPanel) manualReviewPanel.hidden = true;
  if (companyReportEmpty) {
    companyReportEmpty.hidden = true;
    companyReportEmpty.textContent = '';
  }
  if (companyReportView) {
    companyReportView.hidden = true;
    companyReportView.innerHTML = '';
  }
  try {
    waitLogTimer = window.setInterval(() => {
      addCompanyCheckLog(`Проверка ещё выполняется. Ждём ответ сервера, прошло ${formatDuration(Date.now() - startedAt)}.`);
    }, 10000);
    const response = await fetch(`${API_BASE}/api/company-check?inn=${encodeURIComponent(inn)}`);
    addCompanyCheckLog(`Ответ от локальной админки получен через ${formatDuration(Date.now() - startedAt)}.`);
    const text = await response.text();
    addCompanyCheckLog('Читаю ответ и разбираю JSON отчёта.');
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || 'Сервер вернул не JSON.');
    }
    if (!response.ok || payload.error) throw new Error(payload.error || 'Ошибка сбора');
    const report = payload.report || payload;
    currentCompanyReport = report;
    currentCompanyProfile = payload.company_profile || null;
    currentCompanySearchQuery = buildReviewSearchKeywords(report);
    addCompanyCheckLog('Отчёт разобран. Проверяю, есть ли название компании и ключевые поля.');
    logSourceTimings(report);
    logFallbackDiagnostics(report);
    renderCompanyCheckTitle(report);
    setCompanyInnEditMode(false);
    renderCompanyStage(1, report);
    addCompanyCheckLog(payload.saved ? 'Отчёт сохранён в локальный справочник.' : 'Отчёт получен, но не сохранён в локальный справочник.');
    addCompanyCheckLog('Показываю короткую карточку компании.');
    showToast(payload.saved ? 'Компания найдена. Проверьте карточку и переходите дальше.' : `Компания найдена, но отчет не сохранен: ${payload.save_error || 'ошибка записи справочника'}.`);
  } catch (error) {
    setCompanyStage(1);
    addCompanyCheckLog(`Проверка остановлена: ${error.message || 'ошибка запроса'}.`);
    if (companyReportEmpty) {
      companyReportEmpty.hidden = false;
      companyReportEmpty.textContent = `Компания не найдена или проверка не выполнена: ${error.message || 'ошибка запроса'}.`;
    }
  } finally {
    if (waitLogTimer) window.clearInterval(waitLogTimer);
    setCompanyCheckLoading(false);
  }
}

async function loadCompanyReviewSources() {
  const inn = digitsOnly(currentCompanyReport?.inn || adminCompanyInn?.value || '');
  if (!inn) return;
  const searchQuery = getCompanySearchQueryText();
  currentCompanySearchQuery = searchQuery;
  setCompanyCheckFlow(2, [1]);
  if (companyStagePanel) {
    companyStagePanel.hidden = false;
    companyStagePanel.innerHTML = '<div class="stage-card">Ищу источники отзывов и карточки компании. Это отдельный запрос: DreamJob, Antijob, Яндекс Карты, 2GIS.</div>';
  }
  const startedAt = Date.now();
  let waitLogTimer = null;
  addCompanyCheckLog('Переходим к источникам. Отправляю запрос: /api/company-check-sources.');
  addCompanyCheckLog(`Поисковые слова для источников: ${searchQuery || 'не указаны'}.`);
  addCompanyCheckLog('Этот шаг может быть дольше: проверяются DreamJob, Antijob, Яндекс Карты и 2GIS.');
  try {
    waitLogTimer = window.setInterval(() => {
      addCompanyCheckLog(`Поиск источников ещё выполняется, прошло ${formatDuration(Date.now() - startedAt)}.`);
    }, 10000);
    const response = await fetch(`${API_BASE}/api/company-check-sources?inn=${encodeURIComponent(inn)}&q=${encodeURIComponent(searchQuery)}`);
    addCompanyCheckLog(`Ответ по источникам получен через ${formatDuration(Date.now() - startedAt)}.`);
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || 'Сервер вернул не JSON.');
    }
    if (!response.ok || payload.error) throw new Error(payload.error || 'Ошибка поиска источников');
    currentCompanyReport = payload.report || currentCompanyReport;
    currentCompanyProfile = payload.company_profile || currentCompanyProfile;
    logSourceTimings(currentCompanyReport);
    logFallbackDiagnostics(currentCompanyReport);
    logReviewSearchResults(currentCompanyReport);
    addCompanyCheckLog('Источники разобраны. Показываю варианты поиска.');
    renderCompanyStage(2, currentCompanyReport);
  } catch (error) {
    addCompanyCheckLog(`Поиск источников остановлен: ${error.message || 'ошибка запроса'}.`);
    if (companyStagePanel) {
      companyStagePanel.hidden = false;
      companyStagePanel.innerHTML = `<div class="stage-card bad">Не удалось найти источники: ${escapeHtml(error.message || 'ошибка запроса')}.</div>`;
    }
  } finally {
    if (waitLogTimer) window.clearInterval(waitLogTimer);
  }
}

async function saveManualReviewSource(source, forcedUrl = '', statusSelector = '') {
  const inn = digitsOnly(adminCompanyInn?.value || currentCompanyReport?.inn || '');
  if (![10, 12, 13, 15].includes(inn.length)) {
    showToast('Сначала соберите первичный отчет по компании.');
    return;
  }
  const urlInput = manualReviewSources?.querySelector(`[data-review-url="${CSS.escape(source)}"]`);
  const correctionInput = manualReviewSources?.querySelector(`[data-review-correction="${CSS.escape(source)}"]`);
  const statusNode = statusSelector
    ? manualReviewSources?.querySelector(statusSelector)
    : manualReviewSources?.querySelector(`[data-review-status="${CSS.escape(source)}"]`);
  const saveButton = manualReviewSources?.querySelector(`[data-review-save="${CSS.escape(source)}"]`);
  const pickedUrl = saveButton?.dataset.pickedUrl || getReviewSourceUrl(currentCompanyReport, source);
  const url = forcedUrl || (correctionInput?.checked ? (urlInput?.value.trim() || '') : pickedUrl);
  if (!url) {
    showToast('Укажите ссылку на страницу с отзывами.');
    urlInput?.focus();
    return;
  }
  if (statusNode) statusNode.textContent = 'Собираю отзывы...';
  if (saveButton) saveButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/company-manual-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inn, source, url }),
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || 'Сервер вернул не JSON.');
    }
    if (!response.ok || payload.error) throw new Error(payload.error || 'Ошибка сохранения');
    currentCompanyProfile = payload.company_profile || currentCompanyProfile;
    currentCompanyReport = payload.report || currentCompanyProfile?.latest_report || currentCompanyReport;
    const manualSource = getReportSource(currentCompanyReport, `manual_${source}_reviews`);
    const matchNote = manualSource?.collected?.address_match === false || manualSource?.collected?.address_match === 'False'
      ? 'собрано, адрес не подтверждён'
      : 'собрано';
    syncManualReviewPanelFromReport(currentCompanyReport);
    const nextStatusNode = statusSelector ? manualReviewSources?.querySelector(statusSelector) : null;
    if (nextStatusNode) nextStatusNode.textContent = matchNote;
    showToast('Отзывы собраны и добавлены к отчету.');
  } catch (error) {
    if (statusNode) statusNode.textContent = 'Ошибка сбора.';
    showToast(error.message || 'Не удалось собрать отзывы.');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

async function startSelectedSearchAnalysis() {
  const rows = [...(manualReviewSources?.querySelectorAll('[data-search-row]') || [])]
    .filter((row) => row.dataset.searchNotFound !== 'true')
    .filter((row) => row.dataset.searchDeleted !== 'true')
    .map((row) => {
      const statusNode = row.querySelector('[data-search-status]');
      return {
        row,
        rowId: row.dataset.searchRow || '',
        source: statusNode?.dataset.reviewSource || '',
        url: statusNode?.dataset.reviewUrlValue || '',
        collectable: statusNode?.dataset.reviewCollectable === 'true',
        statusNode,
      };
    })
    .filter((item) => item.source && item.url && item.collectable);
  if (!rows.length) {
    showToast('Нет найденных источников для сбора. Добавьте ссылку или удалите лишние строки.');
    return;
  }
  const startButton = manualReviewSources?.querySelector('[data-search-start]');
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = 'Собираю...';
  }
  setCompanyCheckFlow(4, [1, 2, 3]);
  addCompanyCheckLog(`Начинаю сбор по найденным источникам: ${rows.length}.`);
  try {
    for (const item of rows) {
      const statusSelector = `[data-search-status="${CSS.escape(item.rowId)}"]`;
      if (item.statusNode) item.statusNode.textContent = 'сбор начат';
      const browserSource = item.source === '2gis' || item.source === 'yandex';
      addCompanyCheckLog(`${browserSource ? 'Запускаю браузерный сбор' : 'Собираю'} ${item.source}: ${item.url}.`);
      await saveManualReviewSource(item.source, item.url, statusSelector);
    }
  } finally {
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = 'Собрать';
    }
  }
  setCompanyCheckFlow(5, [1, 2, 3, 4]);
  addCompanyCheckLog('Сбор по источникам завершен. Показываю итоговый отчет.');
  if (manualReviewPanel) manualReviewPanel.hidden = true;
  if (companyStagePanel) companyStagePanel.hidden = true;
  renderCompanyReport(currentCompanyReport, currentCompanyProfile);
  companyReportView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateSearchVariantUrl(rowId, nextUrl) {
  const row = manualReviewSources?.querySelector(`[data-search-row="${CSS.escape(rowId)}"]`);
  if (!row) return;
  row.dataset.searchNotFound = nextUrl ? 'false' : 'true';
  const linkCell = row.children[1];
  if (linkCell) {
    linkCell.innerHTML = nextUrl ? `<a href="${escapeHtml(nextUrl)}" target="_blank" rel="noreferrer">открыть</a>` : 'нет ссылки';
  }
  const statusNode = row.querySelector('[data-search-status]');
  if (statusNode) {
    statusNode.dataset.reviewUrlValue = nextUrl;
    statusNode.dataset.reviewCollectable = nextUrl ? 'true' : 'false';
    statusNode.textContent = nextUrl ? 'готово к сбору' : 'не найдено';
  }
}

function removeSearchVariant(rowId) {
  const row = manualReviewSources?.querySelector(`[data-search-row="${CSS.escape(rowId)}"]`);
  if (!row) return;
  const statusNode = row.querySelector('[data-search-status]');
  if (statusNode && !row.dataset.originalUrl) row.dataset.originalUrl = statusNode.dataset.reviewUrlValue || '';
  row.dataset.searchDeleted = 'true';
  row.classList.add('search-variant-deleted');
  if (statusNode) {
    statusNode.dataset.reviewCollectable = 'false';
    statusNode.textContent = 'удалено';
  }
  const actionCell = row.children[3];
  if (actionCell) actionCell.innerHTML = `<a href="#" data-search-restore="${escapeHtml(rowId)}">Вернуть</a>`;
}

function restoreSearchVariant(rowId) {
  const row = manualReviewSources?.querySelector(`[data-search-row="${CSS.escape(rowId)}"]`);
  if (!row) return;
  const statusNode = row.querySelector('[data-search-status]');
  row.dataset.searchDeleted = 'false';
  row.classList.remove('search-variant-deleted');
  const url = row.dataset.originalUrl || statusNode?.dataset.reviewUrlValue || '';
  if (statusNode) {
    statusNode.dataset.reviewUrlValue = url;
    statusNode.dataset.reviewCollectable = url ? 'true' : 'false';
    statusNode.textContent = url ? 'готово к сбору' : 'не найдено';
  }
  const actionCell = row.children[3];
  if (actionCell) {
    actionCell.innerHTML = url
      ? `<a href="#" data-search-edit="${escapeHtml(rowId)}">Изменить</a><a href="#" data-search-remove="${escapeHtml(rowId)}">Удалить</a>`
      : `<a href="#" data-search-add="${escapeHtml(row.dataset.reviewSource || '')}">Добавить</a>`;
  }
}

function compactValue(value) {
  if (value === null || value === undefined || value === '') return 'нет данных';
  if (Array.isArray(value)) {
    if (!value.length) return 'нет данных';
    if (value.every((item) => typeof item !== 'object')) return value.map((item) => compactValue(item)).join(', ');
    return `${value.length} записей`;
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return compactValue(parsed);
    } catch {}
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(text)) {
    const normalized = text.replace(',', '.');
    const [integerPart, decimalPart] = normalized.split('.');
    const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimalPart ? `${grouped},${decimalPart}` : grouped;
  }
  return text;
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text);
}

function formatMoneyValue(value) {
  const number = parseNumericValue(value);
  if (number === null || Number.isNaN(number)) return compactValue(value);
  const abs = Math.abs(number);
  const units = [
    { value: 1_000_000_000, label: 'млрд руб.' },
    { value: 1_000_000, label: 'млн руб.' },
    { value: 1_000, label: 'тыс. руб.' },
  ];
  const unit = units.find((item) => abs >= item.value);
  if (!unit) return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(number)} руб.`;
  return `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number / unit.value)} ${unit.label}`;
}

function parseMoneyToRubles(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  const match = raw.match(/-?\d+(?:[,.]\d+)?/);
  if (!match) return 0;
  const number = Number(match[0].replace(',', '.'));
  if (!Number.isFinite(number)) return 0;
  if (raw.includes('млрд')) return number * 1_000_000_000;
  if (raw.includes('млн')) return number * 1_000_000;
  if (raw.includes('тыс')) return number * 1_000;
  return number;
}

function getLatestFinanceHistoryItem(checko = {}) {
  const history = asArray(checko.finance_history);
  if (history.length) {
    return history
      .filter((item) => item?.year)
      .sort((a, b) => Number(b.year) - Number(a.year))[0] || null;
  }
  const parts = String(checko.finance_history_text || '').split('; ').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  const match = last.match(/^(\d{4}):\s*выручка\s*([^,;]+(?:руб\.)?),\s*прибыль\s*([^,;]+(?:руб\.)?)/i);
  return match ? { year: match[1], revenue: match[2], net_profit: match[3] } : null;
}

function getRevenueDisplay(checko = {}) {
  if (checko.revenue) return `${formatMoneyValue(checko.revenue)}${checko.finance_year ? ` (${checko.finance_year})` : ''}`;
  const latest = getLatestFinanceHistoryItem(checko);
  if (latest?.revenue) return `не собрано за ${checko.finance_year || 'последний год'}; последняя история: ${formatMoneyValue(latest.revenue)} (${latest.year})`;
  return 'нет данных';
}

function getTrendLabel(values = []) {
  const numbers = values.map((value) => parseMoneyToRubles(value)).filter((value) => value > 0);
  if (numbers.length < 2) return 'недостаточно данных';
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  const drops = numbers.slice(1).filter((value, index) => value < numbers[index]).length;
  if (last > first && drops <= 1) return 'рост';
  if (last < first && drops >= Math.ceil((numbers.length - 1) / 2)) return 'снижение';
  return 'нестабильно';
}

function formatLastFinanceYears(checko = {}) {
  const items = asArray(checko.finance_history).filter((item) => item?.year).slice(-5);
  if (!items.length) return checko.finance_history_text ? checko.finance_history_text.split('; ').slice(-5).join('; ') : 'нет данных';
  const trend = getTrendLabel(items.map((item) => item.revenue));
  return `${items.map((item) => `${item.year}: выручка ${item.revenue || 'нет'}, прибыль ${item.net_profit || 'нет'}`).join('; ')}. Вывод: ${trend}.`;
}

function formatLastStaffYears(checko = {}) {
  const items = asArray(checko.staff_history).filter((item) => item?.year).slice(-5);
  if (!items.length) return checko.staff_history_text || 'нет данных';
  const counts = items.map((item) => String(item.staff_count || '').replace(/\D+/g, '')).filter(Boolean).map(Number);
  const trend = counts.length >= 2 ? (counts[counts.length - 1] > counts[0] ? 'рост' : counts[counts.length - 1] < counts[0] ? 'снижение' : 'стабильно') : 'недостаточно данных';
  return `${items.map((item) => `${item.year}: ${item.staff_count || 'нет'}, средняя зарплата ${item.average_monthly_salary || 'нет'}`).join('; ')}. Вывод: ${trend}.`;
}

function renderFinanceDynamicsTable(checko = {}) {
  const financeItems = asArray(checko.finance_history).filter((item) => item?.year).slice(-5);
  const staffItems = asArray(checko.staff_history).filter((item) => item?.year).slice(-5);
  const years = [...new Set([...financeItems, ...staffItems].map((item) => String(item.year)))].sort();
  if (!years.length) return '';
  const financeByYear = new Map(financeItems.map((item) => [String(item.year), item]));
  const staffByYear = new Map(staffItems.map((item) => [String(item.year), item]));
  const revenueTrend = getTrendLabel(years.map((year) => financeByYear.get(year)?.revenue || ''));
  const staffCounts = years.map((year) => String(staffByYear.get(year)?.staff_count || '').replace(/\D+/g, '')).filter(Boolean).map(Number);
  const staffTrend = staffCounts.length >= 2 ? (staffCounts[staffCounts.length - 1] > staffCounts[0] ? 'рост' : staffCounts[staffCounts.length - 1] < staffCounts[0] ? 'снижение' : 'стабильно') : 'недостаточно данных';
  return `
    <table class="report-table compact finance-dynamics-table">
      <thead><tr><th>Год</th><th>Выручка</th><th>Прибыль</th><th>Сотрудники</th><th>Средняя зарплата</th></tr></thead>
      <tbody>
        ${years.map((year) => {
          const finance = financeByYear.get(year) || {};
          const staff = staffByYear.get(year) || {};
          return `<tr>
            <td>${escapeHtml(year)}</td>
            <td>${escapeHtml(formatMoneyValue(finance.revenue) || 'нет данных')}</td>
            <td>${escapeHtml(formatMoneyValue(finance.net_profit) || 'нет данных')}</td>
            <td>${escapeHtml(staff.staff_count || 'нет данных')}</td>
            <td>${escapeHtml(staff.average_monthly_salary || 'нет данных')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="report-note">Наблюдение: выручка - ${escapeHtml(revenueTrend)}, сотрудники - ${escapeHtml(staffTrend)}.</p>
  `;
}

function formatDefendantCasesForReport(checko = {}) {
  const total = checko.arbitration_defendant_summary || checko.defendant_summary || '';
  const lastYear = checko.arbitration_defendant_last_year_summary || checko.defendant_last_year_summary || '';
  if (!total || /^0\b|0 шт/i.test(total)) return 'нет';
  if (/количество не найдено/i.test(lastYear)) {
    const amountMatch = String(lastYear).match(/на сумму\s+(.+)$/i);
    return amountMatch ? `${total}; за последний год сумма исков: ${amountMatch[1]}` : total;
  }
  return lastYear ? `${total}; за последний год: ${lastYear}` : total;
}

function getRatioConclusion(checko = {}) {
  const problems = [];
  const checks = [
    ['financial_stability_kfn', 0.2, 'КФН низкий: зависимость от заемных средств'],
    ['financial_stability_kos', 0, 'КОС отрицательный: не хватает собственных оборотных средств'],
    ['liquidity_ktl', 1, 'КТЛ ниже 1: слабее покрытие краткосрочных обязательств'],
    ['liquidity_kbl', 0.7, 'КБЛ низкий: мало быстрых активов'],
    ['liquidity_kal', 0.1, 'КАЛ низкий: мало денег для немедленных расчетов'],
    ['profitability_rp', 0, 'РП отрицательная: продажи убыточны'],
    ['profitability_rd', 0, 'РД отрицательная: основная деятельность убыточна'],
    ['profitability_ra', 0, 'РА отрицательная: активы убыточны'],
  ];
  checks.forEach(([key, threshold, message]) => {
    const value = parseNumericValue(String(checko[key] || '').replace('%', ''));
    if (value !== null && value < threshold) problems.push(`${labelReportKey(key)} ${checko[key]} - ${message}`);
  });
  const values = ['financial_stability_kfn', 'financial_stability_kos', 'financial_stability_dnv', 'liquidity_ktl', 'liquidity_kbl', 'liquidity_kal', 'profitability_rp', 'profitability_rd', 'profitability_ra']
    .map((key) => `${labelReportKey(key)} ${checko[key] || 'нет'}`)
    .join('; ');
  return problems.length ? `${values}. Отклонения: ${problems.join('; ')}.` : `${values}. Вывод: критичных отклонений по устойчивости, ликвидности и рентабельности не видно.`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  const ruMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruMatch) {
    return new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]));
  }
  const ruMonthMatch = text.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i);
  if (ruMonthMatch) {
    const months = {
      января: 0,
      февраля: 1,
      марта: 2,
      апреля: 3,
      мая: 4,
      июня: 5,
      июля: 6,
      августа: 7,
      сентября: 8,
      октября: 9,
      ноября: 10,
      декабря: 11,
    };
    return new Date(Number(ruMonthMatch[3]), months[ruMonthMatch[2].toLowerCase()], Number(ruMonthMatch[1]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatAgeYears(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  const today = new Date();
  let years = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) years -= 1;
  if (years < 0) return '';
  const lastTwo = years % 100;
  const last = years % 10;
  const label = lastTwo >= 11 && lastTwo <= 14 ? 'лет' : last === 1 ? 'год' : last >= 2 && last <= 4 ? 'года' : 'лет';
  return `${years} ${label}`;
}

function formatRegistrationAndAge(checko) {
  const registration = checko?.collected?.registration_date_text || checko?.collected?.registration_date;
  const dateText = formatDateOnly(registration);
  const ageText = formatAgeYears(registration) || checko?.collected?.market_age_text || '';
  if (dateText && ageText) return `${dateText} / ${ageText}`;
  return dateText || ageText || 'нет данных';
}

function formatReportValue(key, value) {
  if (['inn', 'ogrn', 'kpp', 'okpo', 'employer_id'].includes(key)) {
    return value === null || value === undefined || value === '' ? 'нет данных' : String(value);
  }
  if (['staff_count', 'average_headcount'].includes(key)) {
    const number = parseNumericValue(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('ru-RU').format(number) : compactValue(value);
  }
  if (['revenue', 'net_profit', 'capital', 'charter_capital', 'taxes_paid', 'insurance_paid', 'tax_debt'].includes(key)) {
    return formatMoneyValue(value);
  }
  return compactValue(value);
}

function getReportSource(report, code) {
  return asArray(report?.sources).find((source) => source.code === code);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function getVisibleReportSources(sources = []) {
  // TODO AI: запланировать полноценную внутреннюю историю ПлюсЗвена и вернуть ее в отчет, когда появятся реальные данные/метрики.
  const hiddenSourceCodes = new Set(['fns_egrul', 'bo_nalog', 'zakupki_rnp', 'pluszveno_internal']);
  return sources.filter((source) => !hiddenSourceCodes.has(source.code));
}

function hasCriticalStop(report) {
  return asArray(report?.sources).some((source) =>
    asArray(source?.signals).some((signal) =>
      signal.level === 'critical' && /ликвид|банкрот|исключ|недействующ/i.test(signal.message || '')
    )
  );
}

function labelReportKey(key = '') {
  const labels = {
    company_url: 'Карточка',
    name: 'Компания',
    inn: 'ИНН',
    ogrn: 'ОГРН',
    kpp: 'КПП',
    address: 'Адрес',
    director: 'Руководитель',
    status: 'Статус',
    registration_date_text: 'Дата регистрации',
    liquidation_date_text: 'Дата ликвидации',
    market_age_text: 'Возраст',
    staff_count: 'Сотрудников',
    average_monthly_salary: 'Средняя зарплата',
    staff_history_text: 'Сотрудники и зарплата по годам',
    finance_history_text: 'Финансовая отчетность по годам',
    revenue: 'Выручка',
    revenue_change_percent: 'Динамика выручки',
    net_profit: 'Чистая прибыль',
    net_profit_change_percent: 'Динамика прибыли',
    capital: 'Капитал по отчетности',
    charter_capital: 'Уставной капитал',
    taxes_paid: 'Налоги',
    insurance_paid: 'Страховые взносы',
    financial_stability_kfn: 'КФН',
    financial_stability_kos: 'КОС',
    financial_stability_dnv: 'ДНВ',
    liquidity_ktl: 'КТЛ',
    liquidity_kbl: 'КБЛ',
    liquidity_kal: 'КАЛ',
    profitability_rp: 'РП',
    profitability_rd: 'РД',
    profitability_ra: 'РА',
    procurements_summary: 'Госзакупки',
    bad_faith_supplier_registry: 'РНП',
    arbitration_plaintiff_summary: 'Арбитраж: истец',
    arbitration_defendant_summary: 'Арбитраж: ответчик',
    arbitration_plaintiff_last_year_summary: 'Истец за последний год',
    arbitration_defendant_last_year_summary: 'Ответчик за последний год',
    official_phone: 'Телефон',
    official_email: 'Email',
    official_site: 'Сайт',
    tax_debt: 'Недоимка',
    enforcement_proceedings_summary: 'Исполнительные производства',
    bank_accounts_blocking: 'Блокировки счетов',
    related_companies_note: 'Связанные компании',
    related_companies_by_person: 'Связанные компании СМР',
    successor_companies_text: 'Правопреемник',
    employer_name: 'Работодатель',
    employer_id: 'ID работодателя',
    rating: 'Оценка',
    rating_text: 'Оценка',
    rating_count: 'Количество оценок',
    rating_count_text: 'Количество оценок',
    review_count: 'Отзывы',
    review_count_text: 'Отзывы',
    api_item_id: 'ID карточки 2GIS',
    api_org_id: 'ID организации 2GIS',
    org_name: 'Организация 2GIS',
    api_query_used: 'Найдено по запросу',
    api_match_mode: 'Способ поиска',
    reviews_url: 'Страница отзывов',
    rubrics: 'Рубрики',
    contacts: 'Контакты',
    rating_class: 'Рейтинг',
    search_query: 'Поисковый запрос',
    review_rule: 'Как проверять',
    source_note: 'Комментарий',
    plaintiff_summary: 'Истец',
    defendant_summary: 'Ответчик',
    plaintiff_last_year_summary: 'Истец за последний год',
    defendant_last_year_summary: 'Ответчик за последний год',
    page_title: 'Страница',
    searched_company_name: 'Искомое название',
    searched_address: 'Искомый адрес',
    searched_city: 'Город поиска',
    found_by_address_in_static_html: 'Адрес найден',
  };
  return labels[key] || key;
}

function getReportKeyDescription(key = '', collected = {}) {
  const descriptions = {
    financial_stability_kfn: collected.ratio_description_kfn || 'Коэффициент автономии: показывает независимость компании от кредиторов.',
    financial_stability_kos: collected.ratio_description_kos || 'Коэффициент обеспеченности собственными оборотными средствами.',
    financial_stability_dnv: collected.ratio_description_dnv || 'Долговая нагрузка по выручке: обязательства относительно годовой выручки.',
    liquidity_ktl: collected.ratio_description_ktl || 'Текущая ликвидность: способность погашать текущие обязательства.',
    liquidity_kbl: collected.ratio_description_kbl || 'Быстрая ликвидность: погашение краткосрочных обязательств ликвидными активами.',
    liquidity_kal: collected.ratio_description_kal || 'Абсолютная ликвидность: мгновенная платежеспособность за счет денег и краткосрочных вложений.',
    profitability_rp: collected.ratio_description_rp || 'Чистая рентабельность продаж: прибыль на рубль выручки.',
    profitability_rd: collected.ratio_description_rd || 'Рентабельность основной деятельности до прочих доходов и расходов.',
    profitability_ra: collected.ratio_description_ra || 'Рентабельность активов: отдача от использования активов.',
  };
  return descriptions[key] || '';
}

function getReportTableKeys(collected = {}) {
  const priorityKeys = [
    'company_url', 'name', 'inn', 'ogrn', 'kpp', 'address', 'director', 'status',
    'registration_date_text', 'staff_count', 'average_monthly_salary', 'staff_history_text',
    'finance_history_text',
    'revenue', 'revenue_change_percent', 'net_profit', 'net_profit_change_percent',
    'charter_capital', 'capital', 'capital_change_percent', 'taxes_paid', 'insurance_paid',
    'financial_stability_kfn', 'financial_stability_kos', 'financial_stability_dnv',
    'liquidity_ktl', 'liquidity_kbl', 'liquidity_kal',
    'profitability_rp', 'profitability_rd', 'profitability_ra',
    'procurements_summary', 'bad_faith_supplier_registry',
    'arbitration_plaintiff_summary', 'arbitration_defendant_summary',
    'arbitration_plaintiff_last_year_summary', 'arbitration_defendant_last_year_summary',
    'plaintiff_summary', 'defendant_summary', 'plaintiff_last_year_summary', 'defendant_last_year_summary',
    'official_phone', 'official_email', 'official_site',
    'tax_debt', 'enforcement_proceedings_summary',
    'related_companies_by_person',
    'successor_companies_text',
    'employer_name', 'employer_id', 'review_count', 'review_count_text', 'rating_class',
    'page_title', 'searched_company_name', 'searched_address', 'searched_city', 'found_by_address_in_static_html',
    'source_note',
  ];
  const hiddenKeys = new Set([
    'sample_reviews', 'search_attempts', 'director_related_companies', 'financial_ratios_2025',
    'arbitration', 'raw_checko_arbitration', 'fedresurs', 'procurements', 'reliability_facts', 'timeline_events',
    'finance_history', 'staff_history', 'related_companies_details',
    'ratio_description_kfn', 'ratio_description_kos', 'ratio_description_dnv',
    'ratio_description_ktl', 'ratio_description_kbl', 'ratio_description_kal',
    'ratio_description_rp', 'ratio_description_rd', 'ratio_description_ra',
    'normalized_search_name', 'director_person_url', 'description', 'title', 'extracted_from',
    'collection_mode', 'purpose', 'fallback_address_url', 'city_slug', 'found_by_inn_in_static_html', 'found_by_name_in_static_html', 'found_by_city_in_static_html',
    'found_by_address_in_static_html', 'required_fields', 'finance_year', 'search_inn', 'searched_inn', 'search_query',
    'searched_company_name', 'searched_address', 'searched_city', 'bank_accounts_blocking',
  ]);
  return [
    ...priorityKeys.filter((key) => Object.prototype.hasOwnProperty.call(collected, key)),
    ...Object.keys(collected).filter((key) => !priorityKeys.includes(key) && !hiddenKeys.has(key)),
  ].filter((key) => {
    const value = collected[key];
    return value !== null && value !== undefined && value !== '';
  }).slice(0, 50);
}

function getSourceDisplayName(source = {}) {
  const names = {
    checko_company_card: 'Checko',
    contacts_public: 'Контакты',
    kad_arbitr: 'Арбитраж',
    dreamjob_reviews: 'DreamJob',
    yandex_maps_reviews: 'Яндекс Карты',
    '2gis_reviews': '2GIS',
    fns_egrul: 'ФНС',
    manual_2gis_reviews: '2GIS',
    manual_yandex_reviews: 'Яндекс Карты',
    manual_hh_reviews: 'HH',
    manual_dreamjob_reviews: 'DreamJob',
    manual_antijob_reviews: 'Antijob',
    manual_avito_reviews: 'Avito',
    antijob_reviews: 'Antijob',
    hh_reviews: 'HH работодатель',
    avito_reviews: 'Avito',
    messenger_reviews: 'Опросы в мессенджерах',
  };
  return names[source.code] || source.title || source.code || '';
}

function renderReportTable(sources = []) {
  const rows = sources.flatMap((source) => {
    const keys = getReportTableKeys(source.collected || {});
    const dataRows = keys.map((key) => {
      const value = key === 'registration_date_text'
        ? formatRegistrationAndAge({ collected: source.collected })
        : formatReportValue(key, source.collected[key]);
      const note = getReportKeyDescription(key, source.collected) || translateStatus(source.status || '');
      return `
        <tr>
          <td>${escapeHtml(getSourceDisplayName(source))}</td>
          <td>${escapeHtml(labelReportKey(key))}</td>
          <td>${escapeHtml(value)}</td>
          <td>${escapeHtml(note)}</td>
        </tr>
      `;
    });
    if (!dataRows.length) {
      return [`
        <tr>
          <td>${escapeHtml(getSourceDisplayName(source))}</td>
          <td>Статус</td>
          <td>${escapeHtml(translateStatus(source.status || ''))}</td>
          <td>${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">открыть</a>` : ''}</td>
        </tr>
      `];
    }
    return dataRows;
  });
  if (!rows.length) return '<p class="muted">Нет данных для отображения.</p>';
  return `
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th>Источник</th>
            <th>Показатель</th>
            <th>Значение</th>
            <th>Пояснение</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `;
}

function getReportCompanyName(report, checko) {
  return checko?.collected?.name || report?.legal_card?.name || `Идентификатор ${report?.inn || ''}`;
}

function renderSourceData(collected = {}) {
  const priorityKeys = [
    'company_url', 'name', 'inn', 'ogrn', 'kpp', 'address', 'director', 'status', 'related_companies_note',
    'registration_date_text', 'market_age_text', 'staff_count', 'average_monthly_salary',
    'revenue', 'revenue_change_percent', 'net_profit', 'net_profit_change_percent',
    'capital', 'capital_change_percent', 'taxes_paid', 'insurance_paid',
    'financial_stability_kfn', 'financial_stability_kos', 'financial_stability_dnv',
    'procurements_summary', 'bad_faith_supplier_registry',
    'arbitration_plaintiff_summary', 'arbitration_defendant_summary',
    'arbitration_plaintiff_last_year_summary', 'arbitration_defendant_last_year_summary',
    'official_phone', 'official_email', 'official_site',
    'tax_debt', 'bank_accounts_blocking', 'title',
    'employer_name', 'employer_id', 'review_count', 'review_count_text', 'rating_class',
  ];
  const keys = [
    ...priorityKeys.filter((key) => Object.prototype.hasOwnProperty.call(collected, key)),
    ...Object.keys(collected).filter((key) => !priorityKeys.includes(key) && ![
      'sample_reviews', 'search_attempts', 'director_related_companies', 'financial_ratios_2025',
      'arbitration', 'fedresurs', 'procurements', 'reliability_facts', 'timeline_events',
      'finance_year', 'search_inn', 'searched_inn', 'search_query', 'searched_company_name',
      'searched_address', 'searched_city', 'bank_accounts_blocking'
    ].includes(key)),
  ].slice(0, 28);
  if (!keys.length) return '';
  return `
    <div class="source-data-grid">
      ${keys.map((key) => `
        <div>
          <span>${escapeHtml(labelReportKey(key))}</span>
          <strong>${escapeHtml(formatReportValue(key, collected[key]))}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderReviewSample(source) {
  const reviews = source?.collected?.sample_reviews;
  const items = (Array.isArray(reviews) ? reviews : [reviews]).filter((item) => item && typeof item === 'object' && item.text);
  if (!items.length) return '';
  return `
    <div class="review-sample">
      ${items.map((sample, index) => {
        const meta = [
          sample.rating ? `Оценка: ${sample.rating}` : '',
          sample.verification_status ? `Статус: ${sample.verification_status}` : '',
          sample.date ? `Дата: ${sample.date}` : '',
        ].filter(Boolean).join(' · ');
        return `
          <article>
            <h4>Отзыв ${index + 1}</h4>
            <b>Кто: ${escapeHtml(sample.author || 'не указано')}</b>
            <span>${escapeHtml(meta)}</span>
            <p>${escapeHtml(sample.text)}</p>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderCollectedReviewsSection(sources = []) {
  const blocks = sources
    .filter((source) => Array.isArray(source?.collected?.sample_reviews) && source.collected.sample_reviews.length)
    .map((source) => `
      <div class="source-review-block">
        <h4>${escapeHtml(getSourceDisplayName(source))}</h4>
        ${renderReviewSample(source)}
      </div>
    `);
  if (!blocks.length) return '';
  return `
    <section class="company-report-section">
      <h3>Собранные отзывы</h3>
      ${blocks.join('')}
    </section>
  `;
}

function getAllCollectedReviewItems(sources = []) {
  return sources.flatMap((source) => asArray(source?.collected?.sample_reviews).map((review) => ({
    ...review,
    source: getSourceDisplayName(source),
  }))).filter((review) => review && review.text);
}

const employmentReviewCategories = [
  ['Оплата труда и деньги', ['не платят зарплату', 'зарплату задерживают', 'кидают на зарплату', 'не рассчитали при увольнении', 'удерживают из зарплаты', 'режут зарплату', 'обещали одно платят другое', 'зарплата ниже обещанной', 'платят копейки', 'зарплата в конверте', 'серая зарплата', 'черная зарплата', 'переработки не оплачивают', 'выходные не оплачивают', 'праздники не оплачивают', 'не платят больничный']],
  ['Штрафы, удержания, простои', ['штрафы без причины', 'штрафуют за любую мелочь', 'штрафы из ниоткуда', 'удерживают деньги без согласия', 'удерживают за инструмент', 'удерживают за брак', 'заставляют платить за спецодежду', 'простой по вине начальства', 'простой за свой счет', 'простой не оплачивают']],
  ['Оформление и серые схемы', ['работа без оформления', 'не оформляют официально', 'без трудового договора', 'договор не показывают', 'в бумагах одно по факту другое', 'заставляют подписывать задним числом', 'нет записи в трудовой', 'официально минималка остальное в конверте', 'нет больничных и отпуска', 'фирма-однодневка', 'постоянно меняют название фирмы']],
  ['График и переработки', ['работаем с утра до ночи', '12 часов без доплат', 'постоянные переработки', 'переработки не оплачиваются', 'заставляют работать в выходные', 'работа без выходных', 'смены без перерыва', 'нет нормального обеда', 'график все время меняется', 'график ставят как хотят', 'отпуск не дают', 'отпуск только за свой счет']],
  ['Условия труда и безопасность', ['очень тяжелые условия', 'работа на улице в мороз', 'работа на улице в жару', 'нет нормальных бытовок', 'живем в ужасных условиях', 'грязь и бардак в общежитии', 'нет душа', 'спецодежду не выдают', 'спецодежда за свой счет', 'средства защиты не выдают', 'инструмент старый и опасный', 'работа на высоте без страховки', 'опасная работа', 'техника безопасности отсутствует', 'инструктаж для галочки', 'травмы скрывают', 'несчастные случаи не оформляют']],
  ['Отношение начальства', ['неадекватное начальство', 'начальство орет', 'мат и крики', 'хамство начальства', 'хамское отношение', 'кумовство', 'неравенство в зарплатах', 'распределение премий', 'премий по принципу', 'полностью отбивают мотивацию', 'обращаются как с рабами', 'давят морально', 'угрожают увольнением', 'угрожают не заплатить', 'заставляют писать по собственному', 'к людям нет уважения', 'на людей наплевать', 'из-за начальства большая текучка', 'обманывают по условиям', 'жалобы игнорируют']],
  ['Эксплуатация и давление', ['жесткая эксплуатация', 'эксплуатируют мигрантов', 'работа нелегально', 'паспорт забирают', 'документы забирают', 'угрожают полицией', 'угрожают депортацией', 'завышенные нормы', 'заставляют работать за двоих', 'не отпускают к врачу', 'не отпускают домой']],
  ['Организация работ', ['полный бардак на объекте', 'бардак в организации работ', 'стройка без порядка', 'вечный аврал', 'планирования нет', 'постоянно меняют задания', 'нет материалов для работы', 'простой по их вине', 'за простой не платят', 'сроки нереальные', 'крайними делают рабочих']],
  ['Документы и увольнение', ['про правила в компании не говорят', 'про оплату нигде не написано', 'премии как захотят', 'премию могут отобрать', 'премией шантажируют', 'бумаги задним числом', 'заставляют писать по собственному', 'увольняют по статье без причины', 'трудовую не отдают', 'документы не отдают']],
  ['Репутационные звоночки', ['шарашкина контора', 'черный работодатель', 'об этой фирме плохие отзывы', 'бегите пока не поздно', 'не советую туда идти', 'сплошной обман', 'развод на зарплату', 'людей используют и выбрасывают', 'огромная текучка', 'никто долго не держится', 'все нормальные быстро уходят', 'вечно идет набор', 'объявления висят постоянно']],
];

function analyzeReviewCategories(sources = []) {
  const reviews = getAllCollectedReviewItems(sources);
  return employmentReviewCategories.map(([name, phrases]) => {
    const matches = [];
    reviews.forEach((review) => {
      const text = String(review.text || '').toLowerCase();
      const found = phrases.filter((phrase) => text.includes(phrase));
      if (found.length) matches.push({ source: review.source, phrases: found });
    });
    return { name, count: matches.length, sources: [...new Set(matches.map((item) => item.source))] };
  });
}

const positiveReviewCategories = [
  ['Своевременная оплата', ['зарплата вовремя', 'своевременная оплата', 'зарплата в установленные сроки', 'стабильная заработная плата']],
  ['Условия и быт', ['хорошие условия труда', 'условия проживания', 'столовая', 'общежит']],
  ['Руководство и коллектив', ['понимающее руководство', 'уважительное отношение', 'небольшой коллектив', 'хороший коллектив']],
  ['Рост и стабильность', ['возможность развиваться', 'карьера', 'стабильность', 'перспективы']],
];

function analyzePositiveReviewCategories(sources = []) {
  const reviews = getAllCollectedReviewItems(sources);
  return positiveReviewCategories.map(([name, phrases]) => {
    const count = reviews.filter((review) => {
      const text = String(review.text || '').toLowerCase();
      return phrases.some((phrase) => text.includes(phrase));
    }).length;
    return { name, count };
  });
}

function buildEmploymentRecommendation(report = {}, sources = []) {
  const checko = getReportSource(report, 'checko_company_card')?.collected || {};
  const flags = [];
  const positives = [];
  const latestFinance = getLatestFinanceHistoryItem(checko);
  const revenueValue = checko.revenue || latestFinance?.revenue || '';
  const profitValue = checko.net_profit || latestFinance?.net_profit || '';
  const revenue = parseMoneyToRubles(revenueValue);
  const taxes = parseMoneyToRubles(checko.taxes_paid);
  const netProfit = parseMoneyToRubles(profitValue);
  const charterCapital = parseMoneyToRubles(checko.charter_capital);
  const age = Number((String(checko.market_age_text || '').match(/\d+/) || [])[0] || 0);
  const taxShare = revenue > 0 && taxes > 0 ? Math.round((taxes / revenue) * 100) : null;
  const reliabilityFacts = getCheckoReliabilityFacts(report);
  const factsText = [...reliabilityFacts.attention, ...reliabilityFacts.negative].join(' ');
  if (/ликвид|недейств|прекращ/i.test(`${checko.status} ${checko.liquidation_reason} ${checko.liquidation_date_text}`)) flags.push(`Стоп-фактор: статус Checko/FНС указывает на ликвидацию или недействующее состояние (${checko.status || 'статус не указан'}).`);
  if (/банкрот|Федресурс/i.test(`${asArray(report.summary).join(' ')} ${factsText}`)) flags.push('Стоп-фактор: найден сигнал банкротства/Федресурса.');
  if (/ФССП|исполнительн|задолж/i.test(factsText)) flags.push('Есть негативный факт по ФССП или задолженности.');
  if (/отрицательн.*денежн.*поток/i.test(factsText)) flags.push('Отрицательный операционный денежный поток: риск кассовых разрывов и задержек выплат.');
  if (revenue > 0 && revenue < 500_000_000) flags.push(`Выручка ниже 500 млн руб.: ${formatMoneyValue(revenueValue)} (${checko.revenue ? checko.finance_year || 'год не указан' : latestFinance?.year || 'история'}). Это риск устойчивости фонда оплаты труда.`);
  if (revenue >= 500_000_000) positives.push(`Выручка выше порога 500 млн руб.: ${formatMoneyValue(revenueValue)} за ${checko.revenue ? checko.finance_year || 'последний доступный год' : latestFinance?.year || 'историю'}.`);
  if (netProfit <= 0) flags.push(`Прибыль отсутствует или отрицательная: ${formatMoneyValue(profitValue)}. Это риск задержек зарплаты при кассовых разрывах.`);
  if (netProfit > 0) positives.push(`Компания прибыльная: ${formatMoneyValue(profitValue)}${checko.finance_year ? ` (${checko.finance_year})` : ''}.`);
  if (charterCapital > 0 && charterCapital <= 100_000) flags.push(`Уставной капитал низкий: ${formatMoneyValue(checko.charter_capital)}.`);
  if (age && age < 5) flags.push(`Компания на рынке менее 5 лет: ${checko.market_age_text}.`);
  if (age >= 5) positives.push(`Возраст компании не менее 5 лет: ${checko.market_age_text || 'подтвержден по дате регистрации'}.`);
  if (taxShare !== null && taxShare < 20) flags.push(`Доля налогов к выручке ниже 20%: около ${taxShare}%. Нужна проверка структуры налогов и нагрузки.`);
  if (taxShare !== null && taxShare >= 20) positives.push(`Налоговая нагрузка выглядит достаточной: около ${taxShare}% от выручки.`);
  if (/отсутств/i.test(checko.procurements_summary || '')) flags.push('Госзакупки не найдены: нет дополнительного признака проверки заказчиками/государством.');
  else if (checko.procurements_summary) positives.push('Есть сведения по госзакупкам: это плюс к проверяемости компании.');
  if (!/не входит|отсутств/i.test(checko.bad_faith_supplier_registry || '') && checko.bad_faith_supplier_registry) flags.push(`РНП: ${checko.bad_faith_supplier_registry}.`);
  if (checko.arbitration_defendant_summary && !/^0\b|0 шт/i.test(checko.arbitration_defendant_summary)) flags.push(`Суды как ответчик: ${formatDefendantCasesForReport(checko)}. Нужно проверить предмет споров, особенно трудовые.`);
  const ratioWarnings = [
    ['financial_stability_kfn', 0.2, 'КФН низкий: компания сильнее зависит от заемных средств. Это повышает риск кассовых разрывов и задержек зарплаты.'],
    ['financial_stability_kos', 0, 'КОС отрицательный: собственных оборотных средств недостаточно, устойчивость слабее.'],
    ['liquidity_ktl', 1, 'КТЛ ниже 1: текущих активов может не хватать для покрытия краткосрочных обязательств.'],
    ['liquidity_kbl', 0.7, 'КБЛ низкий: быстрых ликвидных активов мало для срочных платежей.'],
    ['liquidity_kal', 0.1, 'КАЛ низкий: мало денежных средств для немедленных расчетов.'],
    ['profitability_rp', 0, 'РП отрицательная: продажи убыточны.'],
    ['profitability_rd', 0, 'РД отрицательная: основная деятельность убыточна.'],
    ['profitability_ra', 0, 'РА отрицательная: активы не генерируют прибыль.'],
  ];
  let ratioProblemCount = 0;
  ratioWarnings.forEach(([key, threshold, message]) => {
    const value = parseNumericValue(String(checko[key] || '').replace('%', ''));
    if (value !== null && value < threshold) {
      ratioProblemCount += 1;
      flags.push(`${labelReportKey(key)} ${checko[key]}: ${message}`);
    }
  });
  if (ratioProblemCount === 0 && ['financial_stability_kfn', 'financial_stability_kos', 'liquidity_ktl', 'liquidity_kbl', 'liquidity_kal', 'profitability_rp', 'profitability_rd', 'profitability_ra'].some((key) => checko[key])) {
    positives.push('Ключевые коэффициенты стабильности, ликвидности и рентабельности без критичных отклонений.');
  }
  if (checko.finance_history_text) positives.push(`Динамика за 5 лет: ${checko.finance_history_text.split('; ').slice(-5).join('; ')}.`);
  const related = getRelatedConstructionCompanies(report);
  if (related.length) positives.push(`Связанные строительные компании по директору/учредителям: ${related.join('; ')}.`);
  const sourceNotes = sources
    .filter((source) => ['yandex_maps_reviews', '2gis_reviews', 'dreamjob_reviews', 'antijob_reviews'].includes(source.code))
    .map((source) => `${getSourceDisplayName(source)}: ${translateStatus(source.status)}${source.url ? `, ${source.url}` : ''}`);
  if (sourceNotes.length) positives.push(`Проверенные источники отзывов: ${sourceNotes.join('; ')}.`);
  const reviewStats = analyzeReviewCategories(sources);
  const positiveStats = analyzePositiveReviewCategories(sources);
  const reviewFlagCount = reviewStats.reduce((sum, item) => sum + item.count, 0);
  if (reviewFlagCount > 0) flags.push(`В отзывах найдено ${reviewFlagCount} совпадений по трудовым редфлагам.`);
  const decision = flags.some((item) => /Стоп-фактор|ликвидац|банкрот/i.test(item))
    ? 'Не рекомендовать без ручной проверки документов и актуального статуса.'
    : flags.length >= 4
      ? 'Компания требует осторожности: перед трудоустройством нужно отдельно проверить условия оплаты, график и устойчивость работодателя.'
      : 'Критичных стоп-факторов по компании не видно; можно рассматривать как работодателя после проверки конкретных условий вакансии.';
  return { decision, flags, positives, reviewStats, positiveStats };
}

function renderEmploymentRecommendation(report = {}, sources = []) {
  const analysis = buildEmploymentRecommendation(report, sources);
  return `
    <section class="company-report-section employment-summary">
      <h3>Вывод</h3>
      <p>${escapeHtml(analysis.decision)}</p>
      <div class="employment-columns">
        <div>
          <h4>Редфлаги</h4>
          <ul class="report-list">${(analysis.flags.length ? analysis.flags : ['Критичные редфлаги по собранным данным не найдены.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
        <div>
          <h4>Подтверждающие факторы</h4>
          <ul class="report-list">${analysis.positives.slice(0, 12).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
      </div>
      <h4>Отзывы по трудовым категориям</h4>
      <table class="report-table compact">
        <tbody>
          ${analysis.reviewStats.map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${item.count ? `${escapeHtml(item.count)} совпадений` : 'не найдено'}</td>
              <td>${escapeHtml(item.sources.join(', ') || 'источники без совпадений')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderBriefCompanySection(report = {}) {
  const checko = getReportSource(report, 'checko_company_card')?.collected || {};
  const metrics = getCheckoBriefMetrics(report);
  const fullNameNoForm = stripLegalForm(getCompanyFullName(report));
  return `
    <section class="company-report-section">
      <h3>Краткая карточка</h3>
      <div class="source-data-grid">
        <div><span>Краткое название</span><strong>${escapeHtml(getCompanyShortName(report) || getCompanyDisplayName(report) || 'нет данных')}</strong></div>
        <div><span>Полное без юр. формы</span><strong>${escapeHtml(fullNameNoForm || 'нет данных')}</strong></div>
        <div><span>Город</span><strong>${escapeHtml(getCompanyCity(report) || 'нет данных')}</strong></div>
        <div><span>Юр. адрес</span><strong>${escapeHtml(getCompanyLegalAddress(report) || 'нет данных')}</strong></div>
        <div><span>Директор</span><strong>${escapeHtml(getCompanyDirector(report) || 'нет данных')}</strong></div>
        ${metrics.slice(0, 1).map((metric) => `<div><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></div>`).join('')}
        <div><span>Связанные компании</span><strong>${escapeHtml(getRelatedConstructionCompanies(report).join('; ') || 'не найдены')}</strong></div>
      </div>
    </section>
  `;
}

function renderFinancialSection(report = {}) {
  const checko = getReportSource(report, 'checko_company_card')?.collected || {};
  const rows = [
    ['Уставной капитал', formatMoneyValue(checko.charter_capital)],
    ['Капитал по отчетности', formatMoneyValue(checko.capital)],
    ['Сотрудники', formatReportValue('staff_count', checko.staff_count)],
  ];
  const analysis = buildEmploymentRecommendation(report, asArray(report.sources));
  return `
    <section class="company-report-section">
      <h3>Ключевые показатели компании</h3>
      <table class="report-table compact"><tbody>
        ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value || 'нет данных')}</td></tr>`).join('')}
      </tbody></table>
      ${renderFinanceDynamicsTable(checko)}
      <ul class="report-list">${analysis.flags.filter((item) => /выручк|прибыл|капитал|актив|налог|КФН|КОС|ДНВ|КТЛ|КБЛ|КАЛ|РП|РД|РА|возраст|рынке/i.test(item)).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>По собранным финансовым данным критичных замечаний не найдено.</li>'}</ul>
    </section>
  `;
}

function renderGovernmentChecksSection(report = {}) {
  const checko = getReportSource(report, 'checko_company_card')?.collected || {};
  const reliabilityFacts = getCheckoReliabilityFacts(report);
  const factsText = [...reliabilityFacts.attention, ...reliabilityFacts.negative].join(' ');
  const hasBankruptcy = /банкрот|Федресурс/i.test(`${asArray(report.summary).join(' ')} ${factsText}`);
  const fedresurs = hasBankruptcy
    ? [checko.fedresurs?.mentions, checko.fedresurs?.published_messages].filter(Boolean).join(', ')
    : 'нет актуального стоп-сигнала';
  const rows = [
    ['Госзакупки', checko.procurements_summary || 'нет данных'],
    ['РНП', checko.bad_faith_supplier_registry || 'нет данных'],
    ['Суды как ответчик', formatDefendantCasesForReport(checko)],
    ['Исполнительные производства', checko.enforcement_proceedings_summary || 'нет данных'],
    ['Федресурс', fedresurs || 'нет данных'],
    ['Checko: требуют внимания', reliabilityFacts.attention.join('; ') || 'нет'],
    ['Checko: негативные факты', reliabilityFacts.negative.join('; ') || 'нет'],
    ['Checko: положительные факты', reliabilityFacts.positive.join('; ') || 'нет'],
  ];
  return `
    <section class="company-report-section">
      <h3>Проверки государством</h3>
      <table class="report-table compact"><tbody>
        ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}
      </tbody></table>
    </section>
  `;
}

function renderWorkReviewsReportSection(report = {}, sources = []) {
  const reviewStats = analyzeReviewCategories(sources);
  const positiveStats = analyzePositiveReviewCategories(sources);
  const manualBaseCodes = new Set(
    sources
      .filter((source) => source.code?.startsWith('manual_'))
      .map((source) => source.code.replace(/^manual_/, ''))
  );
  const reviewSources = sources.filter((source) => {
    if (!/reviews/.test(source.code)) return false;
    if (!source.code?.startsWith('manual_') && manualBaseCodes.has(source.code)) return false;
    return true;
  });
  const ratingRows = reviewSources
    .filter((source) => source.collected?.rating_text || source.collected?.rating_count_text || source.collected?.review_count_text)
    .map((source) => `${getSourceDisplayName(source)}: ${[source.collected?.rating_text, source.collected?.rating_count_text, source.collected?.review_count_text].filter(Boolean).join(', ')}`);
  const formatReviewSourceDetails = (source) => {
    const collected = source.collected || {};
    const parts = [collected.review_count_text || collected.source_note || source.url || 'нет данных'];
    if (collected.name_match !== undefined || collected.address_match !== undefined) {
      parts.push(`сверка: название ${collected.name_match ? '✓' : '?'}, город ${collected.city_match ? '✓' : '?'}, улица ${collected.street_match ? '✓' : '?'}, дом ${collected.house_match ? '✓' : '?'}`);
    }
    return parts.join('; ');
  };
  return `
    <section class="company-report-section">
      <h3>Отзывы о работе в компании</h3>
      ${ratingRows.length ? `<p>${escapeHtml(ratingRows.join('; '))}</p>` : ''}
      <table class="report-table compact"><tbody>
        ${reviewSources.map((source) => `<tr><td>${escapeHtml(getSourceDisplayName(source))}</td><td>${escapeHtml(translateStatus(source.status))}</td><td>${escapeHtml(formatReviewSourceDetails(source))}</td></tr>`).join('')}
      </tbody></table>
      <h4>Статистика по трудовым редфлагам</h4>
      <table class="report-table compact"><tbody>
        ${reviewStats.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.count ? `${escapeHtml(item.count)} совпадений` : 'не найдено'}</td><td>${escapeHtml(item.sources.join(', ') || '')}</td></tr>`).join('')}
      </tbody></table>
      <h4>Плюсы в отзывах</h4>
      <table class="report-table compact"><tbody>
        ${positiveStats.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.count ? `${escapeHtml(item.count)} упоминаний` : 'не найдено'}</td></tr>`).join('')}
      </tbody></table>
      ${renderCollectedReviewsSection(sources)}
    </section>
  `;
}

function renderCompanyReport(report, companyProfile = null) {
  if (!companyReportView || !companyReportEmpty) return;
  const sources = asArray(report.sources);
  const visibleSources = getVisibleReportSources(sources);
  const criticalStop = hasCriticalStop(report);
  companyReportEmpty.hidden = true;
  companyReportView.hidden = false;
  companyReportView.innerHTML = `
    ${criticalStop ? `<section class="company-report-section"><h3>Стоп-сигналы</h3><ul class="report-list">${(report.summary || []).map((item) => `<li>${escapeHtml(translateSummary(item))}</li>`).join('')}</ul></section>` : ''}
    ${renderBriefCompanySection(report)}
    ${renderEmploymentRecommendation(report, visibleSources)}
    ${renderFinancialSection(report)}
    ${renderGovernmentChecksSection(report)}
    ${renderWorkReviewsReportSection(report, visibleSources)}
    ${companyProfile ? `
      <p class="muted registry-footnote">
        Справочник: добавлена ${escapeHtml(formatDateTime(companyProfile.created_at))}, обновлена ${escapeHtml(formatDateTime(companyProfile.updated_at))}, проверок в локальной истории: ${escapeHtml(companyProfile.reports?.length || 0)}.
      </p>
    ` : ''}
  `;
}

function renderImportedVacancies() {
  if (!parsedVacancyList) return;
  const rows = getFilteredVacancies();
  if (vacancyCount) vacancyCount.textContent = `${rows.length} вакансий`;
  parsedVacancyList.innerHTML = rows.map(({ vacancy, index }) => `
    <article class="vacancy-card parsed-vacancy">
      <div>
        <p class="eyebrow">${vacancy.verified ? 'Проверенная' : 'Не проверенная'} · ${vacancy.source} · доверие ${vacancy.confidence}</p>
        <h2>${vacancy.title}</h2>
        <p>${vacancy.company ? `${vacancy.company}. ` : ''}${vacancy.salary}. ${vacancy.location || 'Локация требует уточнения'}.</p>
        <div class="tag-row">
          <span>${vacancy.verified ? 'проверена ПлюсЗвено' : 'первичный импорт'}</span>
          <span>${vacancy.verified ? 'можно проверить по номеру' : 'можно попросить проверить'}</span>
          ${vacancy.vakhta ? '<span>вахта</span>' : ''}
          ${vacancy.published ? `<span>${vacancy.published}</span>` : ''}
        </div>
      </div>
      <button class="primary-btn" type="button" data-open-vacancy="${index}">${userRole === 'admin' && !vacancy.verified ? 'Взять в проверку' : 'Открыть'}</button>
    </article>
  `).join('');
}

function getFilteredVacancies() {
  const search = document.querySelector('#filterSearch')?.value.trim().toLowerCase() || '';
  const status = document.querySelector('#filterStatus')?.value || 'all';
  const source = document.querySelector('#filterSource')?.value || 'all';
  const region = document.querySelector('#filterRegion')?.value.trim().toLowerCase() || '';
  const salary = Number(document.querySelector('#filterSalary')?.value || 0);
  const onlyVakhta = Boolean(document.querySelector('#filterVakhta')?.checked);
  const sort = document.querySelector('#filterSort')?.value || 'date';

  const rows = importedVacancies
    .map((vacancy, index) => ({ vacancy, index }))
    .filter(({ vacancy }) => {
      const haystack = `${vacancy.title} ${vacancy.company} ${vacancy.location} ${vacancy.description}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (status === 'verified' && !vacancy.verified) return false;
      if (status === 'unverified' && vacancy.verified) return false;
      if (source !== 'all' && !vacancy.source.includes(source)) return false;
      if (region && !vacancy.location.toLowerCase().includes(region)) return false;
      if (salary && vacancy.salaryValue < salary) return false;
      if (onlyVakhta && !vacancy.vakhta) return false;
      return true;
    });

  rows.sort((a, b) => {
    if (sort === 'salary') return b.vacancy.salaryValue - a.vacancy.salaryValue;
    if (sort === 'trust') return Number(b.vacancy.verified) - Number(a.vacancy.verified);
    return (b.vacancy.published || '').localeCompare(a.vacancy.published || '');
  });
  return rows;
}

function openImportedVacancy(index) {
  const vacancy = importedVacancies[index];
  if (!vacancy) return;
  selectedVacancyIndex = index;
  vacancyDetailTitle.textContent = vacancy.title;
  vacancyDetailGrid.innerHTML = `
    <div><span>Источник</span><b>${vacancy.source}</b></div>
    <div><span>Компания</span><b>${vacancy.company || 'уточнить'}</b></div>
    <div><span>Оплата</span><b>${vacancy.salary}</b></div>
    <div><span>Локация</span><b>${vacancy.location || 'уточнить'}</b></div>
    <div><span>Дата публикации</span><b>${vacancy.published || 'уточнить'}</b></div>
    <div><span>Доверие данных</span><b>${vacancy.confidence}</b></div>
  `;
  vacancyDetailDescription.textContent = vacancy.description;
  vacancyDetailStatus.textContent = vacancy.verified
    ? 'Статус: проверенная вакансия, можно запросить информацию по номеру'
    : 'Статус: не проверенная вакансия, можно попросить ПлюсЗвено проверить условия';
  document.querySelector('#acceptVacancy').textContent = userRole === 'admin'
    ? 'Взять в проверку'
    : vacancy.verified ? 'Проверить по номеру' : 'Попросить проверить';
  vacancySourceLink.href = vacancy.url;
  setPage('vacancy');
}

function normalizeUrl(value = '') {
  return value.trim().replace(/\/$/, '').toLowerCase();
}

function findVacancyByUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return importedVacancies.find((vacancy) => normalizeUrl(vacancy.url) === normalized) || null;
}

function showVacancyCheckMessage(html) {
  if (!vacancyCheckResult) return;
  vacancyCheckResult.hidden = false;
  vacancyCheckResult.innerHTML = html;
}

function requestVacancyCheckPhone() {
  if (vacancyCheckPhoneStep) vacancyCheckPhoneStep.hidden = false;
  setTimeout(() => checkPhone?.focus(), 50);
}

function handleVacancyCheckNext() {
  const role = vacancyCheckRole?.value || 'worker';
  const url = vacancyCheckLink?.value.trim() || '';
  if (vacancyCheckPhoneStep) vacancyCheckPhoneStep.hidden = true;
  if (!url) {
    showVacancyCheckMessage('<p class="field-error">Вставьте ссылку на вакансию.</p>');
    return;
  }
  if (role === 'company') {
    showVacancyCheckMessage('<p>Проверка вакансий в этом разделе предназначена для сотрудников, бригад и заводов/заказчиков. Для компаний функция доступна при рейтинге от 4.0+.</p>');
    return;
  }
  const vacancy = findVacancyByUrl(url);
  if (vacancy?.verified) {
    showVacancyCheckMessage('<p>Эта вакансия уже была проверена. Авторизуйтесь или зарегистрируйтесь, чтобы открыть результаты проверки.</p><button class="primary-btn" type="button" data-route="auth">Войти по номеру</button>');
    return;
  }
  showVacancyCheckMessage('<p>Такой проверенной вакансии пока нет в базе. Подтвердите номер, и мы примем заявку на проверку.</p>');
  pendingAfterAuth = 'request-check';
  requestVacancyCheckPhone();
}

function sendLoginCode() {
  const digits = digitsOnly(loginPhone.value);
  if (digits.length < 11 || !['7', '8'].includes(digits[0])) {
    document.querySelector('#loginError').textContent = 'Введите номер в российском формате.';
    return;
  }
  document.querySelector('#loginError').textContent = '';
  setPage('sms');
  setTimeout(() => document.querySelector('#smsCode')?.focus(), 50);
  showToast('Код отправлен. Для демо подойдет любой 4-значный код.');
}

function confirmSmsCode() {
  if (digitsOnly(document.querySelector('#smsCode').value).length !== 4) {
    document.querySelector('#smsError').textContent = 'Введите 4 цифры.';
    return;
  }
  document.querySelector('#smsError').textContent = '';
  isAuthenticated = true;
  userRole = digitsOnly(loginPhone.value || checkPhone?.value || '') === ADMIN_PHONE_DIGITS ? 'admin' : 'worker';
  const authPhone = loginPhone.value || checkPhone?.value || '+7 900 000-00-00';
  document.querySelector('#accountLabel').textContent = authPhone;
  document.querySelector('#accountLabel').nextElementSibling.textContent = userRole === 'admin' ? 'администратор' : 'рейтинг 1.0';
  renderTopNav();
  renderSessionActions();
  renderNotices();
  renderImportedVacancies();
  if (pendingAfterAuth === 'request-check') {
    pendingAfterAuth = null;
    showToast('Заявка на проверку вакансии отправлена в ПлюсЗвено.');
    setPage('notifications');
    return;
  }
  if (pendingAfterAuth === 'verified-info') {
    pendingAfterAuth = null;
    showToast('Доступ к проверенной информации открыт по номеру.');
    openImportedVacancy(selectedVacancyIndex);
    return;
  }
  setPage(userRole === 'admin' ? 'admin' : 'notifications');
  showToast(userRole === 'admin' ? 'Открыт интерфейс администратора.' : 'Вход выполнен. Открыты уведомления.');
}

function fillSpecialties() {
  if (!specialtySelect) return;
  specialtySelect.innerHTML = specialties.map((item) => `<option>${item}</option>`).join('');
}

document.querySelectorAll('[data-route]').forEach((button) => {
  button.addEventListener('click', () => {
    navigateRoute(button.dataset.route);
  });
});

document.querySelectorAll('[data-auth-method="phone"]').forEach((button) => {
  button.addEventListener('click', showPhoneLogin);
});

document.querySelectorAll('[data-hero-dot]').forEach((button) => {
  button.addEventListener('click', () => {
    setHeroSlide(Number(button.dataset.heroDot));
    startHeroSlider();
  });
});

sessionActions?.addEventListener('click', (event) => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    navigateRoute(routeButton.dataset.route);
  }
});

if (loginPhone) attachPhoneMask(loginPhone);
if (checkPhone) attachPhoneMask(checkPhone);

document.querySelector('#loginSend')?.addEventListener('click', sendLoginCode);
loginPhone?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendLoginCode();
  }
});

document.querySelector('#smsCode')?.addEventListener('input', (event) => {
  event.target.value = digitsOnly(event.target.value).slice(0, 4);
});

document.querySelector('#smsConfirm')?.addEventListener('click', confirmSmsCode);
document.querySelector('#smsCode')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmSmsCode();
  }
});

vacancyCheckNext?.addEventListener('click', handleVacancyCheckNext);
vacancyCheckResult?.addEventListener('click', (event) => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) navigateRoute(routeButton.dataset.route);
});
vacancyCheckLink?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleVacancyCheckNext();
  }
});
checkPhoneNext?.addEventListener('click', () => {
  if (loginPhone && checkPhone) loginPhone.value = checkPhone.value;
  sendLoginCode();
});
checkPhone?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (loginPhone) loginPhone.value = checkPhone.value;
    sendLoginCode();
  }
});
document.querySelector('#profileLogout')?.addEventListener('click', logout);

checkForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const inn = digitsOnly(document.querySelector('#checkInn').value);
  const link = document.querySelector('#checkLink').value.trim();
  const phone = digitsOnly(document.querySelector('#checkPhone').value);
  const consentPersonal = document.querySelector('#checkConsentPersonal').checked;
  const consentTask = document.querySelector('#checkConsentTask').checked;
  const error = document.querySelector('#checkError');

  if (![10, 12, 13, 15].includes(inn.length)) {
    error.textContent = 'Укажите ИНН 10/12 цифр, ОГРН 13 цифр или ОГРНИП 15 цифр.';
    return;
  }
  if (!link) {
    error.textContent = 'Добавьте ссылку на вакансию.';
    return;
  }
  if (phone.length < 11) {
    error.textContent = 'Укажите телефон для обратной связи.';
    return;
  }
  if (!consentPersonal || !consentTask) {
    error.textContent = 'Нужны оба согласия.';
    return;
  }

  error.textContent = '';
  setPage('sms');
  showToast('Заявка принята. Подтвердите телефон по SMS.');
});

parsedVacancyList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-vacancy]');
  if (!button) return;
  openImportedVacancy(Number(button.dataset.openVacancy));
});

document.querySelector('#acceptVacancy')?.addEventListener('click', () => {
  const vacancy = importedVacancies[selectedVacancyIndex];
  if (userRole === 'admin') {
    showToast('Вакансия взята в проверку администратором.');
    setPage('admin');
    return;
  }
  if (!isAuthenticated) {
    pendingAfterAuth = vacancy?.verified ? 'verified-info' : 'request-check';
    showPhoneLogin();
    showToast('Для действия укажите номер телефона и подтвердите код.');
    return;
  }
  showToast(vacancy?.verified ? 'Проверенная информация открыта по номеру.' : 'Заявка на проверку отправлена в ПлюсЗвено.');
  setPage('notifications');
});

document.querySelector('#shareDocs')?.addEventListener('click', () => {
  showToast('Запрос на передачу документов подготовлен.');
});

document.querySelector('#runParser')?.addEventListener('click', () => {
  parserStatus = 'imported';
  renderParserCard(parserStatus);
  showToast('Первичная информация импортирована из hh.ru, avito.ru, rabota.ru и агрегатора.');
});

document.querySelector('#markClarify')?.addEventListener('click', () => {
  parserStatus = 'clarify';
  renderParserCard(parserStatus);
  showToast('Вакансия передана представителю ПлюсЗвена на уточнение.');
});

document.querySelector('#markConfirm')?.addEventListener('click', () => {
  parserStatus = 'confirmed';
  parsedVacancy.confidence = '94%';
  parsedVacancy.missing = 'ожидается трудовой договор для сверки условий';
  renderParserCard(parserStatus);
  showToast('Условия подтверждены представителем ПлюсЗвена.');
});

adminCompanyInn?.addEventListener('input', updateCompanyCheckCommand);
adminCompanyInn?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    runCompanyCheckReport();
  }
});
runCompanyCheck?.addEventListener('click', runCompanyCheckReport);
editCompanyInn?.addEventListener('click', () => {
  setCompanyInnEditMode(true);
});
companyStagePanel?.addEventListener('click', (event) => {
  const reportButton = event.target.closest('[data-company-show-report]');
  if (reportButton) {
    renderCompanyReport(currentCompanyReport, currentCompanyProfile);
    return;
  }
  const nextButton = event.target.closest('[data-company-next]');
  if (!nextButton) return;
  const nextStage = Number(nextButton.dataset.companyNext || 1);
  if (nextStage === 2) {
    loadCompanyReviewSources();
    return;
  }
  renderCompanyStage(nextStage, currentCompanyReport);
});
manualReviewSources?.addEventListener('click', (event) => {
  const startButton = event.target.closest('[data-search-start]');
  if (startButton) {
    startSelectedSearchAnalysis();
    return;
  }
  const removeMissingButton = event.target.closest('[data-search-remove-missing]');
  if (removeMissingButton) {
    manualReviewSources.querySelectorAll('[data-search-row][data-search-not-found="true"]').forEach((row) => row.remove());
    return;
  }
  const editButton = event.target.closest('[data-search-edit]');
  if (editButton) {
    event.preventDefault();
    const rowId = editButton.dataset.searchEdit || '';
    const current = manualReviewSources.querySelector(`[data-search-status="${CSS.escape(rowId)}"]`)?.dataset.reviewUrlValue || '';
    const next = window.prompt('Ссылка для сбора', current);
    if (next !== null) updateSearchVariantUrl(rowId, next.trim());
    return;
  }
  const removeButton = event.target.closest('[data-search-remove]');
  if (removeButton) {
    event.preventDefault();
    removeSearchVariant(removeButton.dataset.searchRemove || '');
    return;
  }
  const restoreButton = event.target.closest('[data-search-restore]');
  if (restoreButton) {
    event.preventDefault();
    restoreSearchVariant(restoreButton.dataset.searchRestore || '');
    return;
  }
  const addButton = event.target.closest('[data-search-add]');
  if (addButton) {
    event.preventDefault();
    const next = window.prompt('Вставьте ссылку для сбора');
    if (!next) return;
    const row = addButton.closest('[data-search-row]');
    updateSearchVariantUrl(row?.dataset.searchRow || '', next.trim());
    return;
  }
  const button = event.target.closest('[data-review-save]');
  if (!button) return;
  saveManualReviewSource(button.dataset.reviewSave || '');
});
manualReviewSources?.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-review-correction]');
  if (!checkbox) return;
  const source = checkbox.dataset.reviewCorrection || '';
  const correctionRow = manualReviewSources.querySelector(`[data-review-correction-row="${CSS.escape(source)}"]`);
  const defaultRow = manualReviewSources.querySelector(`[data-review-default-row="${CSS.escape(source)}"]`);
  if (correctionRow) correctionRow.hidden = !checkbox.checked;
  if (defaultRow) defaultRow.hidden = checkbox.checked;
  if (checkbox.checked) {
    const input = manualReviewSources.querySelector(`[data-review-url="${CSS.escape(source)}"]`);
    setTimeout(() => input?.focus(), 30);
  }
});

document.querySelector('#copyCompanyCheckCommand')?.addEventListener('click', async () => {
  updateCompanyCheckCommand();
  const command = companyCheckCommand?.textContent || '';
  try {
    await navigator.clipboard.writeText(command);
    showToast('Команда проверки скопирована.');
  } catch {
    showToast('Команда готова. Скопируйте ее из блока ниже.');
  }
});

companyReportFile?.addEventListener('change', () => {
  const file = companyReportFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const report = JSON.parse(String(reader.result || '{}'));
      currentCompanyReport = report;
      currentCompanyProfile = null;
      renderCompanyCheckTitle(report);
      setCompanyInnEditMode(false);
      renderCompanyStage(1, report);
      if (adminCompanyInn && report.inn) {
        adminCompanyInn.value = report.inn;
        updateCompanyCheckCommand();
      }
      showToast('Отчет проверки компании загружен в ИА.');
    } catch {
      showToast('Не удалось прочитать JSON-отчет.');
    }
  });
  reader.readAsText(file, 'utf-8');
});

document.querySelector('#cookieAccept')?.addEventListener('click', () => {
  cookieBanner.classList.add('hide');
  showToast('Cookies приняты.');
});

document.querySelectorAll('.topnav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigateRoute(link.dataset.route);
  });
});

document.querySelector('#vacancyFilters')?.addEventListener('input', renderImportedVacancies);
document.querySelector('#vacancyFilters')?.addEventListener('change', renderImportedVacancies);

document.querySelectorAll('[data-focus="checkInn"]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector('#checkInn').focus());
});

fillSpecialties();
renderNotices();
renderSources();
renderParserCard();
renderImportedVacancies();
renderTopNav();
renderSessionActions();
updateCompanyCheckCommand();
setHeroSlide(0);
startHeroSlider();
setPage('home');
