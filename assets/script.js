import { Capacitor } from '@capacitor/core';
import { initPush } from './push.js';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { getRecipeIdFromDishName } from './recipe-mapper.js';


// 띵동 제철음식 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v41';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// 구버전 캐시 강제 삭제 (버전 충돌 방지)
try {
  localStorage.removeItem('seasons:ingredients:v40');
  localStorage.removeItem('seasons:ingredients:v39');
  localStorage.removeItem('seasons:ingredients:v38');
  localStorage.removeItem('seasons:ingredients:v37');
  localStorage.removeItem('seasons:ingredients:v36');
  localStorage.removeItem('seasons:ingredients:v20');
  localStorage.removeItem('seasons:ingredients:v19');
  console.log('구버전 캐시 초기화 완료 (v41)');
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
  // 'dynamic' for 동지
  return getDongjiDateForYear(year);
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

  const res = await fetch('data/ingredients.json?v=v39', { cache: 'no-cache' });
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
  const imgPath = `images/${item.image || '_fallback.png'}?v=v12`;
  img.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  img.onerror = () => { 
    img.onerror = null; 
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMiAxMkgzNlYzNkgxMlYxMloiIGZpbGw9IiNEOUQ5RDkiLz4KPHN2Zz4K';
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
  searchInputEl.addEventListener('input', (e) => {
    AppState.searchText = e.target.value;
    renderSingleMonth(getActiveMonth());
  });
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
  try {
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

window.addEventListener('pagehide', () => {
  sessionStorage.setItem('scrollPos_' + window.location.href, window.scrollY);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}