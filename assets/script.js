import { Capacitor } from '@capacitor/core';
import { initPush } from './push.js';
import KoreanLunarCalendar from 'korean-lunar-calendar';

// 띵동 제철음식 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v12';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// 구버전 캐시 강제 삭제 (버전 충돌 방지)
try {
  localStorage.removeItem('seasons:ingredients:v11');
  localStorage.removeItem('seasons:ingredients:v10');
  console.log('구버전 캐시 초기화 완료 (v12)');
} catch(e) {}

const CATEGORY_ORDER = { '해산물': 1, '채소': 2, '과일': 3, '기타': 4 };
// const TENS = ['초순', '중순', '하순']; // 삭제됨

// --- 명절/절기 관련 로직 시작 ---

async function loadHolidays() {
  try {
    const res = await fetch('data/holidays.json?v=v10');
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

// 배너 스크롤 동작 - 헤더와 함께 움직이도록 수정
function initBannerScroll() {
  const banner = document.getElementById('holidayBanner');
  if (!banner) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateBanner = () => {
    const currentScrollY = window.scrollY;
    const headerHeight = getHeaderHeight();
    
    // 배너 위치를 헤더 아래로 동적으로 조정
    banner.style.top = `${headerHeight}px`;
    
    // 스크롤 방향이 실제로 변경되었을 때만 배너 상태 변경
    if (currentScrollY !== lastScrollY) {
      // 스크롤을 올리거나 최상단 근처일 때 배너 보임
      if (currentScrollY < lastScrollY || currentScrollY <= 50) {
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
      } else {
        // 아래로 스크롤할 때 배너 숨김 (단, 프로그램적 스크롤 중이 아닐 때만)
        if (!AppState.isProgrammaticScroll) {
          banner.classList.add('hidden');
          document.body.classList.remove('has-banner');
        }
      }
    }
    
    lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    ticking = false;
  };

  // 초기 배너 위치 설정
  updateBanner();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateBanner);
      ticking = true;
    }
  });

  // 윈도우 리사이즈 시에도 배너 위치 업데이트
  window.addEventListener('resize', () => {
    requestAnimationFrame(updateBanner);
  });
}

// 명절 모달 관련 로직 제거됨 (holiday.html로 이동)

// 요리 이름을 레시피 ID로 매핑
function getRecipeIdFromDishName(dishName) {
  const mapping = {
    '갈치조림': 'galchi-jorim',
    '고등어조림': 'godeungeo-jorim',
    '고등어구이': 'godeungeo-gui',
    '굴전': 'gul-jeon',
    '굴국밥': 'gul-gukbap',
    '떡국': 'tteokguk',
    '송편': 'songpyeon',
    '팥죽': 'patjuk',
    '도다리쑥국': 'dodari-ssukguk',
    '바지락칼국수': 'bajirak-kalguksu',
    '주꾸미볶음': 'jukumi-bokkeum',
    '오징어볶음': 'ojingeo-bokkeum',
    '전복죽': 'jeonbok-juk',
    '삼치구이': 'samchi-gui',
    '오곡밥': 'ogokbap',
    '묵은 나물': 'mukeun-namul',
    '밀전병': 'miljeonbyeong',
    '잡채': 'japchae',
    '전·잡채·갈비찜 등': 'japchae',
    '전': 'jeon',
    '화전': 'hwajeon',
    '수리취떡': 'surichwitteok',
    '밀국수': 'milguksu',
    '국수': 'milguksu',
    '국화전': 'gukwha-jeon',
    '갈비찜': 'galbijjim',
    '김치': 'baechu-kimchi',
    '배추김치': 'baechu-kimchi',
    '시금치나물': 'sigeumchi-namul',
    '깍두기': 'kkakdugi',
    '애호박볶음': 'aehobak-bokkeum',
    '애호박전': 'aehobak-jeon',
    '감자조림': 'gamja-jorim',
    '감자전': 'gamja-jeon',
    '연근조림': 'yeongeun-jorim',
    '우엉조림': 'ueong-jorim',
    '가지나물': 'gaji-namul',
    '가지볶음': 'gaji-bokkeum',
    '오이무침': 'oi-muchim',
    '오이냉국': 'oi-naengguk',
    '열무김치': 'yeolmu-kimchi',
    '봄동겉절이': 'bomdong-geotjeori',
    '무국': 'mu-guk',
    '무조림': 'mu-jorim',
    '호박죽': 'hobak-juk',
    '호박전': 'aehobak-jeon',
    '아귀찜': 'agui-jjim',
    '꽃게찜': 'kkotge-jjim',
    '간장게장': 'ganjang-gejang',
    '대구탕': 'daegu-tang',
    '대구찜': 'daegu-jjim',
    '동태찌개': 'dongtae-jjigae',
    '명태조림': 'myeongtae-jorim',
    '추어탕': 'chueotang',
    '매생이굴국': 'maesaengi-gul-guk',
    '홍합탕': 'honghap-tang',
    '홍합밥': 'honghap-bap',
    '멸치볶음': 'myeolchi-bokkeum',
    '광어회': 'gwangeo-hoe',
    '농어회': 'nongeo-hoe',
    '농어탕': 'nongeo-tang',
    '민어회': 'mineo-hoe',
    '민어구이': 'mineo-gui',
    '전어구이': 'jeonuh-gui',
    '장어구이': 'jangeo-gui',
    '꽁치구이': 'kkongchi-gui',
    '대하구이': 'daeha-gui',
    '대하찜': 'daeha-jjim',
    '전복구이': 'jeonbok-gui',
    '키조개구이': 'kijogae-gui',
    '키조개회': 'kijogae-hoe',
    '가리비구이': 'garibi-gui',
    '꼬막무침': 'kkomak-muchim',
    '꼬막비빔밥': 'kkomak-bibimbap',
    '멍게초무침': 'meongge-muchim',
    '멍게비빔밥': 'meongge-bibimbap',
    '소라무침': 'sora-muchim',
    '바지락술찜': 'bajirak-suljjim',
    '파래전': 'parae-jeon',
    '과메기 무채 곁들임': 'gwamegi-muchae',
    '냉이국': 'naengi-guk',
    '냉이무침': 'naengi-muchim',
    '달래장': 'dallae-jang',
    '달래무침': 'dallae-muchim',
    '두릅무침': 'dureup-muchim',
    '미나리무침': 'minari-muchim',
    '미나리전': 'minari-jeon',
    '쑥국': 'ssuk-guk',
    '쑥떡': 'ssuk-tteok',
    '씀바귀나물': 'sseumbagwi-namul',
    '취나물무침': 'chwi-namul',
    '깻잎찜': 'kkaennip-jjim',
    '깻잎김치': 'kkaennip-kimchi',
    '찐 옥수수': 'oksusu',
    '옥수수전': 'oksusu-jeon',
    '군고구마': 'gun-goguma',
    '고구마맛탕': 'goguma-mattang',
    '유자차': 'yuja-cha',
    '토란국': 'toran-guk',
    '더덕구이': 'deodeok-gui',
    '군밤': 'gunbam',
    '밤조림': 'bam-jorim',
    '송이구이': 'songi-gui',
    '송이전골': 'songi-jeongol',
    '은행구이': 'eunhaeng-gui',
    '표고볶음': 'pyogo-bokkeum',
    '표고전': 'pyogo-jeon',
    // 추가 음료/청/화채/국
    '매실청': 'maesil-cheong',
    '매실장아찌': 'maesil-jangajji',
    '매실짱아찌': 'maesil-jangajji',
    '배추국': 'baechu-guk',
    '복분자청': 'bokbunja-cheong',
    '복분자주': 'bokbunja-ju',
    '석류주스': 'seokryu-juice',
    '제호탕': 'jeho-tang',
    '창포주': 'changpo-ju',
    '국화주': 'gukwha-ju',
    '진달래 화채': 'jindallae-hwachae',
    '진달래화채': 'jindallae-hwachae',
    '앵두화채': 'aengdu-hwachae'
  };
  return mapping[dishName] || null;
}

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

  const res = await fetch('data/ingredients.json?v=v12', { cache: 'no-cache' });
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
  const caloriesValue = node.querySelector('.calories-value');

  title.textContent = item.name_ko || '';
  const imgPath = `images/${item.image || '_fallback.png'}?v=v8`;
  img.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  img.onerror = () => { 
    img.onerror = null; 
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMiAxMkgzNlYzNkgxMlYxMloiIGZpbGw9IiNEOUQ5RDkiLz4KPHN2Zz4K';
  };
  img.src = imgPath;

  // 카테고리 라벨 제거 요청에 따라 주석 처리
  /*
  if (item.category) {
    const catLabel = document.createElement('div');
    catLabel.className = 'card-category-label';
    catLabel.textContent = item.category;
    thumb.appendChild(catLabel);
  }
  */

  // 칼로리 정보 표시
  if (item.calories_per_100g) {
    caloriesValue.textContent = `${item.calories_per_100g}kcal`;
  } else {
    caloriesValue.textContent = '-';
  }

  // 클릭으로 상세 페이지 열기
  node.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `ingredient.html?id=${encodeURIComponent(item.name_ko)}`;
  });

  return node;
}

// 식재료 모달 관련 코드 제거 (상세 페이지로 이동)

// 모든 월 렌더링 (세로 배치)
function renderAllMonths() {
  const { months, allIngredients, searchText, renderCache } = AppState;
  
  trackEl.innerHTML = '';
  
  for (const item of months) {
    const month = item.month;
    // 월별 헤더 생성
    const monthHeader = document.createElement('div');
    monthHeader.className = 'period-header';
    monthHeader.textContent = formatMonthLabel(month);
    monthHeader.setAttribute('data-month-index', month - 1);
    trackEl.appendChild(monthHeader);
    
    // 월별 식재료 그리드 생성
    const gridContainer = document.createElement('div');
    gridContainer.className = 'period-grid';
    
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    empty.textContent = '검색 결과가 없습니다.';
    
    trackEl.appendChild(gridContainer);
    
    // 캐시 확인
    const searchSig = (searchText || '').trim().toLowerCase();
    const signature = `${month}__${searchSig}`;
    
    gridContainer.innerHTML = '';
    
    // 식재료 렌더링 (월 단위)
    const filteredItems = queryItems(allIngredients, searchText, month);
    if (filteredItems.length === 0) {
      gridContainer.appendChild(empty);
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      
      const prevMonth = month === 1 ? 12 : month - 1;
      const newItems = [];
      const existingItems = [];
      
      filteredItems.forEach(item => {
        const isNew = item.months && item.months.includes(month) && !item.months.includes(prevMonth);
        if (isNew) {
          newItems.push(item);
        } else {
          existingItems.push(item);
        }
      });
      
      if (newItems.length > 0) {
        const newSection = document.createElement('div');
        newSection.className = 'new-ingredients-section';
        
        const newHeader = document.createElement('div');
        newHeader.className = 'new-ingredients-header';
        newHeader.innerHTML = '<span class="new-icon">✦</span> 이달의 새로운 맛';
        newSection.appendChild(newHeader);
        
        const newGrid = document.createElement('div');
        newGrid.className = 'grid';
        newGrid.setAttribute('role', 'list');
        newItems.forEach(item => newGrid.appendChild(createCard(item)));
        newSection.appendChild(newGrid);
        
        gridContainer.appendChild(newSection);
      }
      
      if (existingItems.length > 0) {
        const existSection = document.createElement('div');
        existSection.className = 'existing-ingredients-section';
        
        const existHeader = document.createElement('div');
        existHeader.className = 'existing-ingredients-header';
        existHeader.textContent = '계속해서 제철인 맛';
        existSection.appendChild(existHeader);
        
        const existGrid = document.createElement('div');
        existGrid.className = 'grid';
        existGrid.setAttribute('role', 'list');
        existingItems.forEach(item => existGrid.appendChild(createCard(item)));
        existSection.appendChild(existGrid);
        
        gridContainer.appendChild(existSection);
      }
      
      gridContainer.appendChild(empty);
    }
    renderCache.set(month, signature);
  }
}

// 특정 월로 스크롤
function scrollToMonth(monthIndex) {
  const monthHeader = document.querySelector(`[data-month-index="${monthIndex}"]`);
  if (!monthHeader) return;
  const offset = getHeaderHeight() + 8;
  const y = (window.pageYOffset || document.documentElement.scrollTop) + monthHeader.getBoundingClientRect().top - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
  AppState.currentMonthIndex = monthIndex;
  applySeasonThemeByMonthIndex(monthIndex); // 기존 함수명 유지하되 monthIndex로 동작
}

// 오늘 버튼 상태를 전역에서 동기화하는 헬퍼 (삭제됨)
function syncTodayButtonState() {
  // 더 이상 사용하지 않음
}

// 현재 화면에 보이는 월 인덱스 감지
function getCurrentVisibleMonthIndex() {
  const monthHeaders = document.querySelectorAll('.period-header');
  if (!monthHeaders.length) return -1;

  const headerOffset = getHeaderHeight() + 8;

  let firstBelow = -1;
  for (let i = 0; i < monthHeaders.length; i++) {
    const top = monthHeaders[i].getBoundingClientRect().top - headerOffset;
    if (top >= 0) { firstBelow = i; break; }
  }

  if (firstBelow === -1) {
    return parseInt(monthHeaders[monthHeaders.length - 1].getAttribute('data-month-index'));
  }
  if (firstBelow === 0) {
    return parseInt(monthHeaders[0].getAttribute('data-month-index'));
  }
  const topFromOffset = monthHeaders[firstBelow].getBoundingClientRect().top - headerOffset;
  if (Math.abs(topFromOffset) <= 8) {
    return parseInt(monthHeaders[firstBelow].getAttribute('data-month-index'));
  }
  return parseInt(monthHeaders[firstBelow - 1].getAttribute('data-month-index'));
}

// 검색 결과가 있는 첫 번째 월로 스크롤
function scrollToFirstSearchResult() {
  const monthHeaders = document.querySelectorAll('.period-header');
  for (const header of monthHeaders) {
    const monthIndex = parseInt(header.getAttribute('data-month-index'));
    const month = monthIndex + 1;
    const items = queryItems(AppState.allIngredients, AppState.searchText, month);
    
    if (items.length > 0) {
      scrollToMonth(monthIndex);
      break;
    }
  }
}

// 현재 스크롤 위치 저장
function saveScrollPosition() {
  AppState.lastScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
}

// 저장된 스크롤 위치로 복원
function restoreScrollPosition() {
  window.scrollTo({
    top: AppState.lastScrollPosition,
    behavior: 'smooth'
  });
}

// 검색 이벤트
function initSearch() {
  searchInputEl.addEventListener('input', (e) => {
    const searchValue = e.target.value.trim();
    const previousSearchText = AppState.searchText.trim();
    
    // 검색 시작 시 현재 위치 저장
    if (!AppState.isSearching && searchValue && !previousSearchText) {
      saveScrollPosition();
      AppState.isSearching = true;
    }
    
    AppState.searchText = e.target.value;
    renderAllMonths();
    
    if (searchValue) {
      setTimeout(() => scrollToFirstSearchResult(), 100);
    } else if (AppState.isSearching && !searchValue && previousSearchText) {
      AppState.isSearching = false;
      setTimeout(() => restoreScrollPosition(), 100);
    }
  });
}



// 메인 초기화
function initHeaderControls() {
  const brandEl = document.querySelector('.brand');
  const settingButton = document.getElementById('settingButton');

  // 브랜드 클릭 시 오늘 날짜로 이동
  if (brandEl) {
    brandEl.addEventListener('click', () => {
      const currentMonthIndex = getCurrentMonthIndex();
      AppState.isProgrammaticScroll = true;
      
      const banner = document.getElementById('holidayBanner');
      if (banner) {
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
      }

      scrollToMonth(currentMonthIndex);
      
      setTimeout(() => {
        AppState.isProgrammaticScroll = false;
        applySeasonThemeByMonthIndex(currentMonthIndex);
      }, 2000);
    });
  }

  // 설정 버튼 클릭 (웹에서는 알림 안내 모달만 표시, 앱에서는 설정 페이지로 이동)
  if (settingButton) {
    settingButton.addEventListener('click', () => {
      if (!Capacitor.isNativePlatform()) {
        showWebNotificationInfoModal();
        return;
      }
      window.location.href = 'setting.html';
    });
  }

  // 스크롤 이벤트로 실시간 테마/상태 업데이트
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!AppState.isProgrammaticScroll) {
        const currentMonthIndex = getCurrentVisibleMonthIndex();
        if (currentMonthIndex !== -1) {
          AppState.currentMonthIndex = currentMonthIndex;
        }
        applySeasonThemeByMonthIndex(AppState.currentMonthIndex);
      }
    }, 100);
  });
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
      <p class="info-modal__message">알림은 앱에서만 받을 수 있습니다. 스토어에서 설치해주세요.</p>
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
    // 초기 로딩 표시 (느린 네트워크 대응)
    if (trackEl) {
      trackEl.innerHTML = '<div class="loading"><span class="loading__spinner" aria-hidden="true"></span><span class="loading__text">데이터를 불러오는 중입니다...</span></div>';
    }

    AppState.allIngredients = await loadIngredients();
    
    // 명절/절기 배너 로드 및 표시
    const holidayResult = await loadHolidays();
    const holidays = holidayResult.holidays;
    // 전역 상태에 저장 (알림 예약을 위해)
    AppState.holidays = holidays;
    
    // solarDate 미리 계산해서 넣어두기
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    AppState.holidays.forEach(h => {
        h.solarDate = getHolidaySolarDate(h, today);
    });
    
    // AppState를 전역으로 노출 (setting.js에서 접근 가능하도록)
    window.AppState = AppState;
    console.log('✅ AppState 전역 노출 완료, allIngredients 수:', AppState.allIngredients.length);

    if (holidayResult.error) {
      displayHolidayError();
    } else {
      const upcomingHoliday = getUpcomingHoliday(holidays);
      displayHolidayBanner(upcomingHoliday);
    }

    renderAllMonths();
    initSearch();
    initPush(); // Push 알림 초기화
    initHeaderControls();
    
    initOfflineNotice();
    initBannerScroll(); // 배너 스크롤 기능 초기화
    syncHeaderOffset();
    window.addEventListener('resize', () => { requestAnimationFrame(syncHeaderOffset); });
    window.addEventListener('orientationchange', () => { setTimeout(syncHeaderOffset, 250); });
    
    // 초기 로드 시 현재 월로 스크롤
    setTimeout(() => {
      const currentMonthIndex = getCurrentMonthIndex();
      AppState.isProgrammaticScroll = true;
      
      const banner = document.getElementById('holidayBanner');
      if (banner) {
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
      }

      scrollToMonth(currentMonthIndex);
      
      setTimeout(() => {
        AppState.isProgrammaticScroll = false;
        applySeasonThemeByMonthIndex(AppState.currentMonthIndex);
      }, 2000);
    }, 300);
  } catch (err) {
    console.error('초기화 실패:', err);
    trackEl.innerHTML = '<div class="error">데이터를 불러올 수 없습니다.</div>';
  }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}