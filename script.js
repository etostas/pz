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
const companyCheckCommand = document.querySelector('#companyCheckCommand');
const companyReportFile = document.querySelector('#companyReportFile');
const companyReportView = document.querySelector('#companyReportView');
const companyReportEmpty = document.querySelector('#companyReportEmpty');
const runCompanyCheck = document.querySelector('#runCompanyCheck');
const companyCheckProgress = document.querySelector('#companyCheckProgress');
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
const companyCheckSteps = [
  { id: 'request', label: 'Отправляем запрос локальному серверу' },
  { id: 'fns', label: 'ФНС ЕГРЮЛ: юридическая карточка и статус' },
  { id: 'checko', label: 'Checko: статус, финансы, контакты и риски' },
  { id: 'critical', label: 'Проверяем стоп-факторы: ликвидация и банкротство' },
  { id: 'finance', label: 'БО ФНС и финансовые показатели' },
  { id: 'reputation', label: 'DreamJob, карты и открытые источники' },
  { id: 'save', label: 'Сохраняем отчет в локальную историю' },
];

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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
    ...(userRole === 'admin' ? [{ route: 'admin', label: 'Управление' }] : []),
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
  runCompanyCheck.textContent = isLoading ? 'Собираю...' : 'Собрать отчет';
}

function renderCompanyCheckProgress(activeIndex = -1, doneIds = [], errorId = '') {
  if (!companyCheckProgress) return;
  companyCheckProgress.hidden = false;
  companyCheckProgress.innerHTML = companyCheckSteps.map((step, index) => {
    const state = errorId === step.id
      ? 'error'
      : doneIds.includes(step.id)
        ? 'done'
        : index === activeIndex
          ? 'active'
          : '';
    return `<div class="progress-step ${state}">${escapeHtml(step.label)}</div>`;
  }).join('');
}

function getDoneCompanyCheckSteps(report, saved) {
  const sources = asArray(report?.sources);
  const sourceCodes = sources.map((source) => source.code);
  const done = ['request'];
  if (sourceCodes.includes('fns_egrul')) done.push('fns');
  if (sourceCodes.includes('checko_company_card')) done.push('checko', 'critical');
  if (sourceCodes.includes('bo_nalog')) done.push('finance');
  if (sourceCodes.some((code) => ['dreamjob_reviews', 'yandex_maps_reviews', '2gis_reviews', 'kad_arbitr'].includes(code))) {
    done.push('reputation');
  }
  if (saved) done.push('save');
  return done;
}

const manualReviewConfigs = [
  { value: '2gis', title: '2GIS', reportCode: '2gis_reviews' },
  { value: 'yandex', title: 'Яндекс Карты', reportCode: 'yandex_maps_reviews' },
  { value: 'hh', title: 'HH', reportCode: 'hh_reviews' },
  { value: 'dreamjob', title: 'DreamJob', reportCode: 'dreamjob_reviews' },
  { value: 'antijob', title: 'Antijob', reportCode: 'antijob_reviews' },
  { value: 'avito', title: 'Avito', reportCode: 'avito_reviews' },
];

function getReviewSourceUrl(report, sourceValue = '2gis') {
  const config = manualReviewConfigs.find((item) => item.value === sourceValue);
  const sourceCode = config?.reportCode || sourceValue;
  const source = getReportSource(report, sourceCode);
  return source?.collected?.reviews_url || source?.url || '';
}

function syncManualReviewPanelFromReport(report) {
  if (!manualReviewPanel || !manualReviewSources || !report) return;
  manualReviewPanel.hidden = false;
  manualReviewSources.innerHTML = manualReviewConfigs.map((config) => {
    const source = getReportSource(report, config.reportCode);
    const url = getReviewSourceUrl(report, config.value);
    const status = url
      ? 'Подобранная ссылка готова для сбора. Включите корректировку, если ссылка неверная.'
      : 'Ссылка не найдена автоматически. Включите корректировку и вставьте корректную ссылку.';
    const rating = source?.collected?.rating_text || '';
    const reviews = source?.collected?.review_count_text || '';
    const pickedLink = url
      ? `<a class="secondary-btn manual-review-picked-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Подобранная ссылка</a>`
      : '<span class="manual-review-no-link">Подобранная ссылка не найдена</span>';
    const correctionChecked = url ? '' : 'checked';
    const correctionHidden = url ? 'hidden' : '';
    return `
      <div class="manual-review-source" data-review-row="${escapeHtml(config.value)}">
        <div class="manual-review-source-head">
          <div>
            <h3>${escapeHtml(config.title)}</h3>
            <p>${escapeHtml([rating, reviews].filter(Boolean).join(' · ') || status)}</p>
          </div>
          <label class="manual-review-correction">
            <input type="checkbox" data-review-correction="${escapeHtml(config.value)}" ${correctionChecked} />
            <span>Нужна корректировка</span>
          </label>
        </div>
        <div class="manual-review-picked">
          ${pickedLink}
        </div>
        <div class="manual-review-row" data-review-correction-row="${escapeHtml(config.value)}" ${correctionHidden}>
          <input data-review-url="${escapeHtml(config.value)}" value="" placeholder="Вставьте корректную ссылку https://..." />
          <button class="primary-btn" type="button" data-review-save="${escapeHtml(config.value)}">Собрать</button>
        </div>
        <div class="manual-review-row" data-review-default-row="${escapeHtml(config.value)}" ${url ? '' : 'hidden'}>
          <button class="primary-btn" type="button" data-review-save="${escapeHtml(config.value)}" data-picked-url="${escapeHtml(url)}">Собрать по подобранной ссылке</button>
        </div>
        <p class="muted-note" data-review-status="${escapeHtml(config.value)}">${escapeHtml(status)}</p>
      </div>
    `;
  }).join('');
}

async function runCompanyCheckReport() {
  const inn = digitsOnly(adminCompanyInn?.value || '');
  if (![10, 12, 13, 15].includes(inn.length)) {
    showToast('Введите ИНН 10/12 цифр, ОГРН 13 цифр или ОГРНИП 15 цифр.');
    adminCompanyInn?.focus();
    return;
  }
  setCompanyCheckLoading(true);
  renderCompanyCheckProgress(0, []);
  const progressTimer = setInterval(() => {
    if (!companyCheckProgress || companyCheckProgress.hidden) return;
    const active = [...companyCheckProgress.querySelectorAll('.progress-step')].findIndex((item) => item.classList.contains('active'));
    const next = Math.min(active + 1, companyCheckSteps.length - 1);
    renderCompanyCheckProgress(next, companyCheckSteps.slice(0, next).map((step) => step.id));
  }, 1400);
  if (companyReportEmpty) {
    companyReportEmpty.hidden = false;
    companyReportEmpty.textContent = 'Собираю данные. Текущий этап показан выше.';
  }
  if (companyReportView) {
    companyReportView.hidden = true;
    companyReportView.innerHTML = '';
  }
  try {
    const response = await fetch(`${API_BASE}/api/company-check?inn=${encodeURIComponent(inn)}`);
    const text = await response.text();
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
    renderCompanyCheckProgress(-1, getDoneCompanyCheckSteps(report, payload.saved));
    renderCompanyReport(report, currentCompanyProfile);
    syncManualReviewPanelFromReport(report);
    showToast(payload.saved ? 'Отчет собран и сохранен в справочник компаний.' : `Отчет собран, но не сохранен: ${payload.save_error || 'ошибка записи справочника'}.`);
  } catch (error) {
    renderCompanyCheckProgress(-1, [], 'request');
    if (companyReportEmpty) {
      companyReportEmpty.hidden = false;
      companyReportEmpty.textContent = `Не удалось собрать отчет: ${error.message || 'ошибка запроса'}. Откройте http://localhost:8788/ или запустите start_admin.bat.`;
    }
  } finally {
    clearInterval(progressTimer);
    setCompanyCheckLoading(false);
  }
}

async function saveManualReviewSource(source) {
  const inn = digitsOnly(adminCompanyInn?.value || currentCompanyReport?.inn || '');
  if (![10, 12, 13, 15].includes(inn.length)) {
    showToast('Сначала соберите первичный отчет по компании.');
    return;
  }
  const urlInput = manualReviewSources?.querySelector(`[data-review-url="${CSS.escape(source)}"]`);
  const correctionInput = manualReviewSources?.querySelector(`[data-review-correction="${CSS.escape(source)}"]`);
  const statusNode = manualReviewSources?.querySelector(`[data-review-status="${CSS.escape(source)}"]`);
  const saveButton = manualReviewSources?.querySelector(`[data-review-save="${CSS.escape(source)}"]`);
  const pickedUrl = saveButton?.dataset.pickedUrl || getReviewSourceUrl(currentCompanyReport, source);
  const url = correctionInput?.checked ? (urlInput?.value.trim() || '') : pickedUrl;
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
    renderCompanyReport(currentCompanyReport, currentCompanyProfile);
    syncManualReviewPanelFromReport(currentCompanyReport);
    const nextStatusNode = manualReviewSources?.querySelector(`[data-review-status="${CSS.escape(source)}"]`);
    if (nextStatusNode) nextStatusNode.textContent = 'Отзывы собраны и сохранены.';
    showToast('Отзывы собраны и добавлены к отчету.');
  } catch (error) {
    if (statusNode) statusNode.textContent = 'Ошибка сбора.';
    showToast(error.message || 'Не удалось собрать отзывы.');
  } finally {
    if (saveButton) saveButton.disabled = false;
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
  if (['revenue', 'net_profit', 'capital', 'taxes_paid', 'insurance_paid', 'tax_debt'].includes(key)) {
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

function renderFnsVerifiedLine(report) {
  const fns = getReportSource(report, 'fns_egrul');
  if (!fns || fns.status !== 'ok') return '';
  return `
    <section class="company-report-section">
      <p class="muted">Проверена в ФНС ЕГРЮЛ/ЕГРИП: сверены ИНН, ОГРН, КПП, наименование, юридический адрес, руководитель и статус. Компания действующая.</p>
    </section>
  `;
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
    capital: 'Уставный капитал',
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
    'capital', 'capital_change_percent', 'taxes_paid', 'insurance_paid',
    'financial_stability_kfn', 'financial_stability_kos', 'financial_stability_dnv',
    'liquidity_ktl', 'liquidity_kbl', 'liquidity_kal',
    'profitability_rp', 'profitability_rd', 'profitability_ra',
    'procurements_summary', 'bad_faith_supplier_registry',
    'arbitration_plaintiff_summary', 'arbitration_defendant_summary',
    'arbitration_plaintiff_last_year_summary', 'arbitration_defendant_last_year_summary',
    'plaintiff_summary', 'defendant_summary', 'plaintiff_last_year_summary', 'defendant_last_year_summary',
    'official_phone', 'official_email', 'official_site',
    'tax_debt', 'enforcement_proceedings_summary', 'bank_accounts_blocking',
    'related_companies_by_person',
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
    'required_fields',
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
    hh_reviews: 'HH',
    avito_reviews: 'Avito',
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
      'arbitration', 'fedresurs', 'procurements', 'reliability_facts', 'timeline_events'
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

function renderCompanyReport(report, companyProfile = null) {
  if (!companyReportView || !companyReportEmpty) return;
  const sources = asArray(report.sources);
  const visibleSources = getVisibleReportSources(sources);
  const checko = getReportSource(report, 'checko_company_card');
  const dreamjob = getReportSource(report, 'dreamjob_reviews');
  const criticalStop = hasCriticalStop(report);
  const reportTitle = getReportCompanyName(report, checko);
  // TODO: build a factual summary engine from normalized source signals instead of rendering generic source-status lines.
  companyReportEmpty.hidden = true;
  companyReportView.hidden = false;
  if (criticalStop) {
    companyReportView.innerHTML = `
      <section class="company-report-section">
        <h3>${escapeHtml(reportTitle)}</h3>
        <p class="muted">Отчет по идентификатору ${escapeHtml(report.inn || '')}</p>
      </section>
      <div class="company-report-summary">
        <div class="report-metric"><span>Идентификатор</span><strong>${escapeHtml(report.inn || '')}</strong></div>
        <div class="report-metric"><span>Риск</span><strong>${escapeHtml(report.risk_score ?? 0)}/100</strong></div>
        <div class="report-metric"><span>Проверка</span><strong>остановлена</strong></div>
      </div>
      <section class="company-report-section">
        <h3>Проверку можно прекратить</h3>
        <ul class="report-list">
          ${(report.summary || ['Компания имеет критический статус.']).map((item) => `<li>${escapeHtml(translateSummary(item))}</li>`).join('')}
        </ul>
      </section>
      <section class="company-report-section">
        <h3>Данные проверки</h3>
        ${renderReportTable(visibleSources)}
      </section>
      ${renderCollectedReviewsSection(visibleSources)}
      ${companyProfile ? `<p class="muted registry-footnote">Справочник: проверок в локальной истории: ${escapeHtml(companyProfile.reports?.length || 0)}.</p>` : ''}
    `;
    return;
  }
  companyReportView.innerHTML = `
    <section class="company-report-section">
      <h3>${escapeHtml(reportTitle)}</h3>
      <p class="muted">Отчет по идентификатору ${escapeHtml(report.inn || '')}</p>
    </section>
    <div class="company-report-summary">
      <div class="report-metric"><span>Идентификатор</span><strong>${escapeHtml(report.inn || '')}</strong></div>
      <div class="report-metric"><span>Риск</span><strong>${escapeHtml(report.risk_score ?? 0)}/100</strong></div>
      <div class="report-metric"><span>Проверок</span><strong>${sources.length}</strong></div>
    </div>

    ${renderFnsVerifiedLine(report)}

    <section class="company-report-section">
      <h3>Отчет</h3>
      ${renderReportTable(visibleSources)}
    </section>
    ${renderCollectedReviewsSection(visibleSources)}
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
manualReviewSources?.addEventListener('click', (event) => {
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
      renderCompanyReport(report);
      syncManualReviewPanelFromReport(report);
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
