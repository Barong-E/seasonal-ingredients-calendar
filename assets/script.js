import { Capacitor, registerPlugin } from '@capacitor/core';
import { initPush } from './push.js';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { getRecipeIdFromDishName } from './recipe-mapper.js';

// AI 식재료 스캔용 커스텀 네이티브 플러그인 등록
const FoodScanner = registerPlugin('FoodScanner');


// 띵동 제철음식 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v72';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// 구버전 캐시 강제 삭제 (버전 충돌 방지)
try {
  localStorage.removeItem('seasons:ingredients:v71');
  localStorage.removeItem('seasons:ingredients:v70');
  localStorage.removeItem('seasons:ingredients:v69');
  localStorage.removeItem('seasons:ingredients:v67');
  localStorage.removeItem('seasons:ingredients:v66');
  localStorage.removeItem('seasons:ingredients:v65');
  localStorage.removeItem('seasons:ingredients:v64');
  localStorage.removeItem('seasons:ingredients:v60');
  localStorage.removeItem('seasons:ingredients:v59');
  localStorage.removeItem('seasons:ingredients:v44'); // 이미지 경로 분리 전 버전
  localStorage.removeItem('seasons:ingredients:v43');
  localStorage.removeItem('seasons:ingredients:v42');
  localStorage.removeItem('seasons:ingredients:v40');
  localStorage.removeItem('seasons:ingredients:v39');
  localStorage.removeItem('seasons:ingredients:v38');
  localStorage.removeItem('seasons:ingredients:v37');
  localStorage.removeItem('seasons:ingredients:v36');
  localStorage.removeItem('seasons:ingredients:v20');
  localStorage.removeItem('seasons:ingredients:v19');
  console.log('구버전 캐시 초기화 완료 (v45)');
} catch (e) {
  // ignore
}

const CATEGORY_ORDER = { '해산물': 1, '채소': 2, '과일': 3, '기타': 4 };
// const TENS = ['초순', '중순', '하순']; // 삭제됨

// --- 명절/절기 관련 로직 시작 ---

async function loadHolidays() {
  try {
    const res = await fetch('data/holidays.json?v=v11');
    if (!res.ok) throw new Error('명절 데이터 로드 실패');
    const data = await res.json();
    return { holidays: data, error: null };
  } catch (err) {
    console.error(err);
    return { holidays: [], error: err };
  }
}

function getSolarOverrideDate(holiday, year) {
  const overrides = holiday.solar_overrides;
  if (!overrides) return null;
  const key = String(year);
  const data = overrides[key];
  if (!data) return null;
  if (typeof data === 'string') {
    const parts = data.split('-');
    if (parts.length !== 2) return null;
    const mm = parseInt(parts[0], 10);
    const dd = parseInt(parts[1], 10);
    if (!mm || !dd) return null;
    return new Date(year, mm - 1, dd);
  }
  if (typeof data === 'object' && data.month && data.day) {
    return new Date(year, data.month - 1, data.day);
  }
  return null;
}

function getDongjiDateForYear(year) {
  if (year === 2025) return new Date(2025, 11, 22);
  if (year === 2026) return new Date(2026, 11, 22);
  return new Date(year, 11, 22);
}

function isGyeongDay(date) {
  const baseDate = new Date(2025, 6, 20); // 2025년 7월 20일 (경자일 - 경일)
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const d2 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const diffTime = d1.getTime() - d2.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return (diffDays % 10 + 10) % 10 === 0;
}

function getIpchunDateForYear(year) {
  const dY = year - 2000;
  const base = 4.861;
  const leapCount = Math.floor((dY + 3) / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 1, dayVal); // 2월은 index 1
}

function getHajiDateForYear(year) {
  const dY = year - 2000;
  const base = 21.533;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 5, dayVal); // 6월은 index 5
}

function getIpchuDateForYear(year) {
  const dY = year - 2000;
  const base = 7.65;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 7, dayVal); // 8월은 index 7
}

function getChobokDateForYear(year) {
  const hajiDate = getHajiDateForYear(year);
  let currentDate = new Date(hajiDate);
  let gyeongCount = 0;
  while (gyeongCount < 3) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isGyeongDay(currentDate)) {
      gyeongCount++;
    }
  }
  return currentDate;
}

function getJungbokDateForYear(year) {
  const hajiDate = getHajiDateForYear(year);
  let currentDate = new Date(hajiDate);
  let gyeongCount = 0;
  while (gyeongCount < 4) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isGyeongDay(currentDate)) {
      gyeongCount++;
    }
  }
  return currentDate;
}

function getMalbokDateForYear(year) {
  const ipchuDate = getIpchuDateForYear(year);
  let currentDate = new Date(ipchuDate);
  if (isGyeongDay(currentDate)) {
    return currentDate;
  }
  while (true) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isGyeongDay(currentDate)) {
      return currentDate;
    }
  }
}

function getHolidaySolarDateForYear(holiday, year) {
  const { type, month, day } = holiday.date;

  // 1) 연도별 오버라이드 우선
  const overrideDate = getSolarOverrideDate(holiday, year);
  if (overrideDate) return overrideDate;

  // 한식: 동지로부터 105일째
  if (holiday.id === 'hansik') {
    const dongjiDate = getDongjiDateForYear(year - 1);
    if (!dongjiDate) return null;
    const hansikDate = new Date(dongjiDate);
    hansikDate.setDate(hansikDate.getDate() + 105);
    return hansikDate;
  }

  // 섣달그믐: 음력 12월 마지막 날
  if (holiday.id === 'seotdal') {
    const calendar = new KoreanLunarCalendar();
    let ok = calendar.setLunarDate(year, 12, 30, false);
    if (!ok) ok = calendar.setLunarDate(year, 12, 29, false);
    if (!ok) return null;
    const solar = calendar.getSolarCalendar();
    if (!solar || !solar.year || !solar.month || !solar.day) return null;
    return new Date(solar.year, solar.month - 1, solar.day);
  }

  // 입춘: 절기 공식으로 자동 계산
  if (holiday.id === 'ipchun') {
    return getIpchunDateForYear(year);
  }

  // 초복: 하지 후 3번째 경일로 자동 계산
  if (holiday.id === 'chobok') {
    return getChobokDateForYear(year);
  }

  // 중복: 하지 후 4번째 경일로 자동 계산
  if (holiday.id === 'jungbok') {
    return getJungbokDateForYear(year);
  }

  // 말복: 입추 후 1번째 경일로 자동 계산
  if (holiday.id === 'malbok') {
    return getMalbokDateForYear(year);
  }

  // 2) 타입별 계산
  if (type === 'lunar') {
    const calendar = new KoreanLunarCalendar();
    const intercalation = Boolean(holiday.date.intercalation);
    const ok = calendar.setLunarDate(year, month, day, intercalation);
    if (!ok) return null;
    const solar = calendar.getSolarCalendar();
    if (!solar || !solar.year || !solar.month || !solar.day) return null;
    return new Date(solar.year, solar.month - 1, solar.day);
  }
  if (type === 'solar') {
    return new Date(year, month - 1, day);
  }
  // 'dynamic' — 동지 또는 solar_overrides 전용 (삼복, 입춘 등)
  if (holiday.date.name === '동지') return getDongjiDateForYear(year);
  return null;
}

function getHolidaySolarDate(holiday, today) {
  const baseYear = today.getFullYear();
  let date = getHolidaySolarDateForYear(holiday, baseYear);
  if (!date) return null;
  if (date < today) {
    date = getHolidaySolarDateForYear(holiday, baseYear + 1);
  }
  return date;
}

function getUpcomingHoliday(holidays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let upcoming = null;
  let minDiff = Infinity;

  holidays.forEach(holiday => {
    const holidayDate = getHolidaySolarDate(holiday, today);
    if (!holidayDate) return;

    const diff = holidayDate.getTime() - today.getTime();
    if (diff >= 0 && diff < minDiff) {
      minDiff = diff;
      upcoming = { ...holiday, solarDate: holidayDate };
    }
  });

  return upcoming;
}

function displayHolidayBanner(holiday) {
  if (!holiday) return;

  const banner = document.getElementById('holidayBanner');
  if (!banner) return;

  const dateEl = banner.querySelector('.holiday-banner__date');
  const descriptionEl = banner.querySelector('.holiday-banner__description');
  const imageEl = banner.querySelector('.holiday-banner__image');

  const month = holiday.solarDate.getMonth() + 1;
  const day = holiday.solarDate.getDate();

  dateEl.textContent = `${month}월 ${day}일은 ${holiday.name}입니다.`;
  descriptionEl.textContent = `${holiday.name}에는 ${holiday.main_food} 먹어요`;
  imageEl.src = `images/${holiday.image}`;
  imageEl.alt = holiday.name;

  banner.style.display = 'block';
  document.body.classList.add('has-banner'); // 배너가 있을 때 body에 클래스 추가
  
  banner.onclick = () => {
    window.location.href = `holiday.html?id=${encodeURIComponent(holiday.id)}`;
  };
}

function displayHolidayError() {
  const banner = document.getElementById('holidayBanner');
  if (!banner) return;
  const dateEl = banner.querySelector('.holiday-banner__date');
  const descriptionEl = banner.querySelector('.holiday-banner__description');
  const imageEl = banner.querySelector('.holiday-banner__image');

  banner.classList.add('holiday-banner--error');
  banner.style.cursor = 'default';
  banner.onclick = null;

  if (dateEl) dateEl.textContent = '명절 정보를 불러올 수 없습니다.';
  if (descriptionEl) descriptionEl.textContent = '네트워크 상태를 확인해 주세요.';
  if (imageEl) {
    imageEl.removeAttribute('src');
    imageEl.alt = '';
    imageEl.style.display = 'none';
  }

  banner.style.display = 'block';
  document.body.classList.add('has-banner');
}

// 헤더 및 배너 스크롤 동작 통합 관리
function initHeaderAndBannerScroll() {
  const banner = document.getElementById('holidayBanner');
  const header = document.querySelector('.app-header');
  const monthNav = document.getElementById('monthNav');

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateScrollState = () => {
    const currentScrollY = window.scrollY;
    const headerHeight = getHeaderHeight();
    
    if (banner) {
      banner.style.top = `${headerHeight}px`;
    }
    
    if (currentScrollY !== lastScrollY) {
      if (currentScrollY < lastScrollY || currentScrollY <= 50) {
        // 스크롤 올리거나 최상단: 헤더, 월 네비게이터, 배너 표시
        if (header) header.classList.remove('header--hidden');
        if (monthNav) monthNav.classList.remove('header--hidden');
        if (banner) {
          banner.classList.remove('hidden');
          document.body.classList.add('has-banner');
        }
      } else {
        // 스크롤 내릴 때 (프로그램적 스크롤 아닐 때만): 헤더 숨김, 월 네비게이터 위로 이동
        if (!AppState.isProgrammaticScroll && currentScrollY > 50) {
          if (header) header.classList.add('header--hidden');
          if (monthNav) monthNav.classList.add('header--hidden');
          if (banner) {
            banner.classList.add('hidden');
            document.body.classList.remove('has-banner');
          }
        }
      }
    }
    
    lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    ticking = false;
  };

  updateScrollState();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollState);
      ticking = true;
    }
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(updateScrollState);
  });
}

// 명절 모달 관련 로직 제거됨 (holiday.html로 이동)



// 시기 관련 유틸 삭제 및 단순화
function getCurrentMonthIndex() {
  const now = new Date();
  return now.getMonth(); // 0-11
}

function formatMonthLabel(month) {
  return `${month}월`;
}

// 계절 판별 (1: 겨울, 2: 겨울, 3~5: 봄, 6~8: 여름, 9~11: 가을, 12: 겨울)
function getSeasonByMonth(month) {
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

function applySeasonThemeByMonthIndex(monthIndex) {
  const m = monthIndex + 1;
  const season = getSeasonByMonth(m);
  const body = document.body;
  body.classList.remove('theme-spring', 'theme-summer', 'theme-autumn', 'theme-winter');
  body.classList.add(`theme-${season}`);
}

// 로컬 캐시 로딩 후 months 필드로 필터링 (초/중/하순 모두 포함된 것만 이미 변환됨)
async function loadIngredients() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch {}

  const res = await fetch('data/ingredients.json?v=v62', { cache: 'no-cache' });
  if (!res.ok) throw new Error('데이터 로드 실패');
  const data = await res.json();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {}
  return data;
}

// 12개월 시기 생성
function createAllMonths() {
  const list = [];
  for (let m = 1; m <= 12; m++) {
    list.push({ month: m, key: `month-${m}` });
  }
  return list;
}

// 필터/검색/시기 결합 후 정렬
function queryItems(allItems, searchText, month) {
  const normalized = (searchText || '').trim().toLowerCase();
  
  const items = allItems.filter((it) => {
    // 시기(월) 포함 여부 확인
    const includesMonth = it.months?.includes(month);
    if (!includesMonth) return false;
    
    // 검색 AND
    if (!normalized) return true;
    const hay = `${it.name_ko || ''}\n${it.description_ko || ''}`.toLowerCase();
    return hay.includes(normalized);
  });

  items.sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] || 99;
    const cb = CATEGORY_ORDER[b.category] || 99;
    if (ca !== cb) return ca - cb;
    return (a.name_ko || '').localeCompare(b.name_ko || '', 'ko');
  });
  return items;
}

// DOM refs
const trackEl = document.getElementById('periodTrack');
const searchInputEl = document.getElementById('searchInput');
const cardTpl = document.getElementById('cardTemplate');
const offlineNoticeEl = document.getElementById('offlineNotice');

// 전역 상태
const AppState = {
  allIngredients: [],
  months: createAllMonths(),
  searchText: '',
  renderCache: new Map(),
  lastScrollPosition: 0,
  isSearching: false,
  currentMonthIndex: 0,
  isProgrammaticScroll: false
};

// 헤더 높이 계산
function getHeaderHeight() {
  const header = document.querySelector('.app-header');
  return header ? Math.ceil(header.getBoundingClientRect().height) : 0;
}

// 헤더 높이를 CSS 변수로 반영 (레이아웃 상단 패딩)
function syncHeaderOffset() {
  const headerH = getHeaderHeight();
  document.documentElement.style.setProperty('--header-offset', `${headerH}px`);
}

function updateOfflineNotice() {
  if (!offlineNoticeEl) return;
  offlineNoticeEl.hidden = navigator.onLine;
}

function initOfflineNotice() {
  updateOfflineNotice();
  window.addEventListener('online', updateOfflineNotice);
  window.addEventListener('offline', updateOfflineNotice);
}

// 카드 생성
function createCard(item) {
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  const title = node.querySelector('.title');
  const thumb = node.querySelector('.thumb');
  const img = node.querySelector('.photo');
  const popularDishValue = node.querySelector('.popular-dish-value');

  title.textContent = item.name_ko || '';
  const imgPath = `images/${item.image || '_fallback.png'}?v=v13`;
  img.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  img.onerror = () => { 
    img.onerror = null; 
    img.src = 'images/_fallback.png';
  };
  img.src = imgPath;

  // 대표 요리 정보 표시 (첫 번째 요리만)
  if (item.popular_dish) {
    const dishes = item.popular_dish.split(',').map(d => d.trim());
    let dishName = dishes[0];
    const ingredientName = item.name_ko || '';

    // [똑똑한 요리명 줄이기 규칙]
    // 1. 요리명이 5글자를 초과하고 (6자 이상)
    // 2. 요리명에 식재료 이름이 포함되어 있다면
    // → 식재료 이름을 지워서 중복을 피함 (예: 아스파라거스 베이컨 말이 -> 베이컨 말이)
    if (dishName.length > 5 && ingredientName && dishName.includes(ingredientName)) {
      dishName = dishName.replace(ingredientName, '').trim();
    }

    popularDishValue.textContent = dishName;
  } else {
    popularDishValue.textContent = '-';
  }

  // 클릭으로 상세 페이지 열기
  node.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `ingredient.html?id=${encodeURIComponent(item.name_ko)}`;
  });

  return node;
}

// 식재료 모달 관련 코드 제거 (상세 페이지로 이동)


// 현재 표시 중인 월 (1~12)
function getActiveMonth() {
  const hash = window.location.hash; // e.g. "#month-5"
  const match = hash.match(/^#month-(\d{1,2})$/);
  if (match) {
    const m = parseInt(match[1], 10);
    if (m >= 1 && m <= 12) return m;
  }
  return new Date().getMonth() + 1; // 기본값: 오늘 월
}

function setActiveMonth(month, direction = 'right') {
  const m = Math.max(1, Math.min(12, month));
  history.pushState({ month: m }, '', `#month-${m}`);
  renderSingleMonth(m, direction);
  applySeasonThemeByMonthIndex(m - 1);
  updateMonthLabel(m);
}

function updateMonthLabel(month) {
  const el = document.getElementById('monthLabelText');
  if (el) el.textContent = `${month}월`;
}

// 단일 월 렌더링
function renderSingleMonth(month, direction = 'right', isInitialLoad = false) {
  const { allIngredients, searchText } = AppState;

  trackEl.innerHTML = '';

  const monthSection = document.createElement('div');
  monthSection.className = direction === 'left'
    ? 'month-section slide-left'
    : 'month-section';
  monthSection.setAttribute('data-month-index', month - 1);

  const gridContainer = document.createElement('div');
  gridContainer.className = 'period-grid';

  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.setAttribute('role', 'status');
  empty.textContent = '이 달에는 제철 식재료 정보가 없습니다.';

  const filteredItems = queryItems(allIngredients, searchText, month);

  if (filteredItems.length === 0) {
    gridContainer.appendChild(empty);
    empty.style.display = 'block';
  } else {
    const prevMonth = month === 1 ? 12 : month - 1;
    const newItems = filteredItems.filter(item =>
      item.months?.includes(month) && !item.months.includes(prevMonth)
    );
    const existingItems = filteredItems.filter(item =>
      !(item.months?.includes(month) && !item.months.includes(prevMonth))
    );

    if (newItems.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'new-ingredients-section';
      const hdr = document.createElement('div');
      hdr.className = 'new-ingredients-header';
      hdr.innerHTML = '<span class="new-icon">✦</span> 이달의 새로운 맛';
      sec.appendChild(hdr);
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.setAttribute('role', 'list');
      newItems.forEach(item => grid.appendChild(createCard(item)));
      sec.appendChild(grid);
      gridContainer.appendChild(sec);
    }

    if (existingItems.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'existing-ingredients-section';
      const hdr = document.createElement('div');
      hdr.className = 'existing-ingredients-header';
      hdr.textContent = '계속해서 제철인 맛';
      sec.appendChild(hdr);
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.setAttribute('role', 'list');
      existingItems.forEach(item => grid.appendChild(createCard(item)));
      sec.appendChild(grid);
      gridContainer.appendChild(sec);
    }

    gridContainer.appendChild(empty);
  }

  monthSection.appendChild(gridContainer);
  trackEl.appendChild(monthSection);
  if (!isInitialLoad) {
    window.scrollTo(0, 0);
  }

  AppState.currentMonthIndex = month - 1;
}

// 월 네비게이터 초기화
function initMonthNav() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');
  const labelBtn = document.getElementById('monthLabel');

  prevBtn?.addEventListener('click', () => {
    const cur = getActiveMonth();
    setActiveMonth(cur === 1 ? 12 : cur - 1, 'left');
  });

  nextBtn?.addEventListener('click', () => {
    const cur = getActiveMonth();
    setActiveMonth(cur === 12 ? 1 : cur + 1, 'right');
  });

  // 가운데 월 버튼 클릭 → 오늘 월로 이동
  labelBtn?.addEventListener('click', () => {
    const today = new Date().getMonth() + 1;
    const cur = getActiveMonth();
    setActiveMonth(today, today >= cur ? 'right' : 'left');
  });

  // 뒤로가기 처리
  window.addEventListener('popstate', (e) => {
    const m = e.state?.month || getActiveMonth();
    renderSingleMonth(m, 'left');
    applySeasonThemeByMonthIndex(m - 1);
    updateMonthLabel(m);
  });

  // 좌우 스와이프 지원
  let touchStartX = 0;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 60) return; // 짧은 터치 무시
    const cur = getActiveMonth();
    if (dx < 0) {
      // 왼쪽 스와이프 → 다음 달
      setActiveMonth(cur === 12 ? 1 : cur + 1, 'right');
    } else {
      // 오른쪽 스와이프 → 이전 달
      setActiveMonth(cur === 1 ? 12 : cur - 1, 'left');
    }
  }, { passive: true });
}

// 검색 이벤트
function initSearch() {
  const form = document.getElementById('filtersForm');
  if (form && searchInputEl) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = searchInputEl.value.trim();
      if (query) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
}

// 메인 초기화
function initHeaderControls() {
  const brandEl = document.querySelector('.brand');
  const settingButton = document.getElementById('settingButton');

  if (brandEl) {
    brandEl.addEventListener('click', () => {
      const today = new Date().getMonth() + 1;
      const cur = getActiveMonth();
      setActiveMonth(today, today >= cur ? 'right' : 'left');
    });
  }

  if (settingButton) {
    settingButton.addEventListener('click', () => {
      if (!Capacitor.isNativePlatform()) {
        showWebNotificationInfoModal();
        return;
      }
      window.location.href = 'setting.html';
    });
  }
}

function showWebNotificationInfoModal() {
  const existing = document.getElementById('webNotificationInfoModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'webNotificationInfoModal';
  modal.className = 'info-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <div class="info-modal__buttons">
        <button type="button" class="info-modal__btn info-modal__btn--ios" disabled>iOS (준비중)</button>
        <a href="https://play.google.com/store/apps/details?id=net.seasonalfood.app&referrer=utm_source%3Dseasonalfood_web%26utm_medium%3Dinternal%26utm_campaign%3Dnoti_bell_popup" target="_blank" rel="noopener noreferrer" class="info-modal__btn info-modal__btn--android">Android 설치</a>
      </div>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;

  function close() {
    modal.remove();
    document.body.style.overflow = '';
  }

  modal.querySelector('.info-modal__backdrop').addEventListener('click', close);
  modal.querySelector('.info-modal__close').addEventListener('click', close);

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: 'webNotification' }, '', location.href);
}

async function init() {
  localStorage.setItem('lastTab', 'index.html');
  try {
    // --- 방문 횟수 체크 및 인앱 리뷰 요청 로직 ---
    let visits = parseInt(localStorage.getItem('app_visits') || '0', 10);
    let hasPromptedReview = localStorage.getItem('review_prompted');
    visits++;
    localStorage.setItem('app_visits', visits.toString());

    if (visits === 3 && !hasPromptedReview) {
      if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
          // 플러그인이 로드되어 있는지 확인 후 실행
          if (Capacitor.Plugins.InAppReview) {
            await Capacitor.Plugins.InAppReview.requestReview();
            localStorage.setItem('review_prompted', 'true');
          }
        } catch (e) {
          console.log('리뷰 요청 실패', e);
        }
      }
    }
    // ------------------------------------------

    if (trackEl) {
      trackEl.innerHTML = '<div class="loading"><span class="loading__spinner" aria-hidden="true"></span><span class="loading__text">데이터를 불러오는 중입니다...</span></div>';
    }

    AppState.allIngredients = await loadIngredients();

    const holidayResult = await loadHolidays();
    const holidays = holidayResult.holidays;
    AppState.holidays = holidays;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    AppState.holidays.forEach(h => {
      h.solarDate = getHolidaySolarDate(h, today);
    });

    window.AppState = AppState;

    if (holidayResult.error) {
      displayHolidayError();
    } else {
      const upcomingHoliday = getUpcomingHoliday(holidays);
      displayHolidayBanner(upcomingHoliday);
    }

    // 현재 월 결정 (URL 해시 우선, 없으면 오늘)
    const activeMonth = getActiveMonth();

    // 초기 상태를 history에 기록
    if (!window.location.hash) {
      history.replaceState({ month: activeMonth }, '', `#month-${activeMonth}`);
    }

    renderSingleMonth(activeMonth, 'right', true);
    applySeasonThemeByMonthIndex(activeMonth - 1);
    updateMonthLabel(activeMonth);

    initSearch();
    initPush();
    initHeaderControls();
    initMonthNav();
    initOfflineNotice();
    initHeaderAndBannerScroll();
    syncHeaderOffset();

    // GNB 카메라 탭 이벤트 등록
    const btnCamera = document.getElementById('btnCamera');
    if (btnCamera) {
      btnCamera.addEventListener('click', (e) => {
        e.preventDefault();
        startCameraScanner();
      });

      // 플로팅 버튼(FAB) 진입 애니메이션 타이머
      if (btnCamera.classList.contains('fab-scanner')) {
        // 진입 직후(100ms 지연) 바로 스르륵 길어짐 애니메이션 노출
        let entryTimer = setTimeout(() => {
          btnCamera.classList.add('expanded');
          
          // 그 후 2초 동안 길게 보여준 뒤 다시 축소
          entryTimer = setTimeout(() => {
            btnCamera.classList.remove('expanded');
            entryTimer = null;
          }, 2000);
        }, 100);

        // 스크롤 감지 확장/축소 애니메이션 추가
        let isScrolling;
        window.addEventListener('scroll', () => {
          // 최초 진입 타이머가 아직 작동 중이면 해제 (스크롤 감지가 우선적으로 덮어씀)
          if (entryTimer) {
            clearTimeout(entryTimer);
            entryTimer = null;
          }

          // 스크롤 중에는 텍스트 노출 (확장)
          btnCamera.classList.add('expanded');

          // 기존 스크롤 타이머 해제
          clearTimeout(isScrolling);

          // 1초 동안 스크롤이 움직이지 않으면 원래 아이콘으로 축소
          isScrolling = setTimeout(() => {
            btnCamera.classList.remove('expanded');
          }, 1000);
        }, { passive: true });
      }
    }

    const btnExit = document.getElementById('btnExitScanner');
    if (btnExit) {
      btnExit.addEventListener('click', (e) => {
        e.preventDefault();
        closeCameraScanner();
      });
    }

    // URL 파라미터 체크 (?openCamera=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCamera') === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('openCamera');
      window.history.replaceState({}, '', url.pathname + url.hash);
      
      // 조금 대기 후 카메라 실행 (기기 렌더링 안정화)
      setTimeout(startCameraScanner, 600);
    }

    window.addEventListener('resize', () => { requestAnimationFrame(syncHeaderOffset); });
    window.addEventListener('orientationchange', () => { setTimeout(syncHeaderOffset, 250); });

    // 스크롤 복원
    const savedScroll = sessionStorage.getItem('scrollPos_' + window.location.href);
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
        sessionStorage.removeItem('scrollPos_' + window.location.href);
      }, 100);
    }

  } catch (err) {
    console.error('초기화 실패:', err);
    trackEl.innerHTML = '<div class="error">데이터를 불러올 수 없습니다.</div>';
  }
}

// =======================================================
//  AI 카메라 스캐너 바인딩 함수군 (Gemini 1.5 Flash 셔터 방식)
// =======================================================

async function startCameraScanner() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
    showCameraFallbackModal();
    return;
  }

  try {
    // 1. 웹뷰 배경 투명화 및 레이아웃 숨김
    document.documentElement.classList.add('body-transparent');
    const overlay = document.getElementById('cameraScannerOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 2. 결과 카드 및 로딩 상태 초기화
    const card = document.getElementById('scannerResultCard');
    if (card) card.style.display = 'none';

    const shutterBtn = document.getElementById('btnCapturePhoto');
    const loadingEl = document.getElementById('scannerLoading');
    if (shutterBtn) {
      shutterBtn.style.display = 'flex';
      shutterBtn.disabled = false;
      // 이벤트 리스너 중복 방지를 위한 단일 바인딩
      shutterBtn.onclick = takePhotoAndAnalyze;
    }
    if (loadingEl) loadingEl.style.display = 'none';

    // 3. 네이티브 카메라 켜기
    await FoodScanner.startCamera();
  } catch (err) {
    console.error('카메라 시작 에러:', err);
    alert('카메라 실행 중 에러가 발생했습니다: ' + err.message);
    closeCameraScanner();
  }
}

async function closeCameraScanner() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      await FoodScanner.stopCamera();
    }
  } catch (err) {
    console.error(err);
  }

  // 뷰 상태 원복
  document.documentElement.classList.remove('body-transparent');
  const overlay = document.getElementById('cameraScannerOverlay');
  if (overlay) overlay.style.display = 'none';

  const card = document.getElementById('scannerResultCard');
  if (card) card.style.display = 'none';

  const shutterBtn = document.getElementById('btnCapturePhoto');
  const loadingEl = document.getElementById('scannerLoading');
  if (shutterBtn) {
    shutterBtn.disabled = false;
    shutterBtn.onclick = null;
  }
  if (loadingEl) loadingEl.style.display = 'none';
}

async function takePhotoAndAnalyze() {
  const shutterBtn = document.getElementById('btnCapturePhoto');
  const loadingEl = document.getElementById('scannerLoading');
  const card = document.getElementById('scannerResultCard');

  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  try {
    // UI를 '분석 중' 상태로 전환 (disabled 먼저 처리해 연속 탭으로 인한 중복 호출 방지)
    if (shutterBtn) {
      shutterBtn.disabled = true;
      shutterBtn.style.display = 'none';
    }
    if (loadingEl) loadingEl.style.display = 'flex';
    if (card) card.style.display = 'none';

    // 1차 이미지 분석 호출 (식재료 이름 & 여부 판정)
    const result = await FoodScanner.captureAndAnalyze();
    
    if (result && result.is_food && result.name) {
      const foodNameKo = result.name;
      // 로컬 DB에서 식재료 검색
      const localItem = AppState.allIngredients.find(i => i.name_ko === foodNameKo);

      if (localItem) {
        // 로컬 DB에 있는 경우: 2차 호출 없이 바로 결과 출력
        if (loadingEl) loadingEl.style.display = 'none';
        if (shutterBtn) {
          shutterBtn.style.display = 'flex';
          shutterBtn.disabled = false;
        }
        showDetectedFoodTips(result, localItem);
      } else {
        // 로컬 DB에 없는 경우: 텍스트 기반 2차 API 호출
        try {
          const tipsResult = await FoodScanner.getIngredientTipsByName({ ingredientName: foodNameKo });
          const finalResult = {
            ...result,
            selection_tip: tipsResult.selection_tip,
            seasonal_months: tipsResult.seasonal_months
          };

          if (loadingEl) loadingEl.style.display = 'none';
          if (shutterBtn) {
            shutterBtn.style.display = 'flex';
            shutterBtn.disabled = false;
          }
          showDetectedFoodTips(finalResult, null);
        } catch (tipsErr) {
          console.error('2차 AI 분석 에러:', tipsErr);
          // 2차 호출 실패 시 기본 안내와 함께 1차 정보로 결과 출력
          if (loadingEl) loadingEl.style.display = 'none';
          if (shutterBtn) {
            shutterBtn.style.display = 'flex';
            shutterBtn.disabled = false;
          }
          showDetectedFoodTips(result, null);
        }
      }
    } else {
      // 식재료가 아니거나 결과가 없을 때 (result가 null이어도 안전하게 처리)
      if (loadingEl) loadingEl.style.display = 'none';
      if (shutterBtn) {
        shutterBtn.style.display = 'flex';
        shutterBtn.disabled = false;
      }
      showDetectedFoodTips(result || { is_food: false, name: '' }, null);
    }
  } catch (err) {
    console.error('AI 분석 에러:', err);

    // UI 원복
    if (loadingEl) loadingEl.style.display = 'none';
    if (shutterBtn) {
      shutterBtn.style.display = 'flex';
      shutterBtn.disabled = false;
    }

    // 에러 종류별 분기 팝업 처리
    if (err.code === 'API_LIMIT_EXCEEDED') {
      alert('앗! 이달의 AI 스캔 무료 사용량(한도)을 모두 채웠어요. 다음 달에 다시 이용해 주세요! 💚');
    } else if (err.code === 'API_KEY_MISSING') {
      alert('Gemini API 키가 아직 설정되지 않았습니다. android/app/src/main/java/net/seasonalfood/app/FoodScannerPlugin.java 파일 상단의 GEMINI_API_KEY에 발급받으신 키를 적고 다시 빌드해 주세요!');
    } else if (err.code === 'API_AUTH_FAILED') {
      alert('API 인증에 실패했습니다. 관리자에게 문의해 주세요.');
    } else if (err.code === 'API_ERROR') {
      alert('AI 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } else {
      alert('네트워크 연결 상태를 확인해 주시거나 잠시 후 다시 시도해 주세요.');
    }
  }
}

function showDetectedFoodTips(result, localItem) {
  const card = document.getElementById('scannerResultCard');
  const nameEl = document.getElementById('detectedFoodName');
  const tipsEl = document.getElementById('detectedFoodTips');
  
  if (!card || !nameEl || !tipsEl) return;

  const foodNameKo = result ? result.name : '';
  const isFood = result ? result.is_food : false;

  // 식재료가 아니라고 판단된 경우 예외 처리
  if (!isFood || !foodNameKo) {
    nameEl.textContent = '인식 불가';
    tipsEl.textContent = '식재료를 감지하지 못했습니다. 식재료를 화면 가득 찬 곳에서 다시 찍어주세요.';
    card.style.display = 'block';
    return;
  }

  // 1. 기존 DB에 있는 식재료라면, 훨씬 정확도가 높은 사람이 직접 적은 로컬 꿀팁을 노출함
  if (localItem && localItem.selection_ko) {
    nameEl.textContent = `${foodNameKo} 고르는 방법`;
    
    const currentMonth = new Date().getMonth() + 1;
    const isSeasonal = localItem.months && localItem.months.includes(currentMonth);

    if (isSeasonal) {
      tipsEl.innerHTML = `<span style="color: #0A7B34; font-weight: bold; display: block; margin-bottom: 8px;">지금 제철입니다! 🌱</span>${localItem.selection_ko}`;
    } else if (localItem.months && localItem.months.length > 0) {
      const seasonalMonthsText = localItem.months.map(m => `${m}월`).join(', ');
      tipsEl.innerHTML = `<span style="color: #ef4444; font-weight: bold; display: block; margin-bottom: 8px;">지금은 제철이 아닙니다. (${seasonalMonthsText}이 제철입니다.) ⚠️</span>${localItem.selection_ko}`;
    } else {
      tipsEl.textContent = localItem.selection_ko;
    }
  } 
  // 2. 기존 DB에 없는 새로운 식재료라면, Gemini가 실시간으로 직접 작성한 꿀팁을 화면에 동적으로 뿌려줌
  else {
    nameEl.textContent = `${foodNameKo} 고르는 방법 (AI)`;
    
    const currentMonth = new Date().getMonth() + 1;
    // Capacitor JSArray는 includes()를 지원하지 않을 수 있으므로 Array.from()으로 안전하게 변환
    const seasonalMonths = Array.from(result.seasonal_months || []);
    const isSeasonal = seasonalMonths.includes(currentMonth);
    const selectionTip = result.selection_tip || '신선하고 고유의 색택이 선명하며 흠집이 없는 것을 고르는 것이 좋습니다.';

    if (isSeasonal) {
      tipsEl.innerHTML = `<span style="color: #0A7B34; font-weight: bold; display: block; margin-bottom: 8px;">지금 제철입니다! 🌱</span>${selectionTip}`;
    } else if (seasonalMonths.length > 0) {
      const seasonalMonthsText = seasonalMonths.map(m => `${m}월`).join(', ');
      tipsEl.innerHTML = `<span style="color: #ef4444; font-weight: bold; display: block; margin-bottom: 8px;">지금은 제철이 아닙니다. (${seasonalMonthsText}이 제철입니다.) ⚠️</span>${selectionTip}`;
    } else {
      tipsEl.textContent = selectionTip;
    }
  }

  card.style.display = 'block';
}

function showCameraFallbackModal() {
  const existing = document.getElementById('webCameraInfoModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'webCameraInfoModal';
  modal.className = 'info-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">📷 실시간 AI 식재료 스캔은 모바일 앱 전용 기능이에요. 지금 바로 앱을 다운로드받아 카메라 사물 인식 기능을 경험해 보세요! 🌱</p>
      <div class="info-modal__buttons">
        <button type="button" class="info-modal__btn info-modal__btn--ios" disabled>iOS (준비중)</button>
        <a href="https://play.google.com/store/apps/details?id=net.seasonalfood.app&referrer=utm_source%3Dseasonalfood_web%26utm_medium%3Dinternal%26utm_campaign%3Dai_scan_popup" target="_blank" rel="noopener noreferrer" class="info-modal__btn info-modal__btn--android">Android 설치</a>
      </div>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;

  function close() {
    modal.remove();
    document.body.style.overflow = '';
  }

  modal.querySelector('.info-modal__backdrop').addEventListener('click', close);
  modal.querySelector('.info-modal__close').addEventListener('click', close);

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

window.addEventListener('pagehide', () => {
  sessionStorage.setItem('scrollPos_' + window.location.href, window.scrollY);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}