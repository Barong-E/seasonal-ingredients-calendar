import { Capacitor } from '@capacitor/core';
import { initPush } from './push.js';
import KoreanLunarCalendar from 'korean-lunar-calendar';

// 띵동 제철음식 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v11';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const CATEGORY_ORDER = { '해산물': 1, '채소': 2, '과일': 3, '기타': 4 };
const TENS = ['초순', '중순', '하순'];

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
    openHolidayModal(holiday);
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

function openHolidayModal(holiday) {
  const modal = document.getElementById('holidayModal');
  if (!modal) return;

  history.pushState({ modal: 'holiday' }, '', location.href);
  // DOM 요소들 가져오기
  modal.querySelector('#holidayModalTitle').textContent = holiday.name;
  modal.querySelector('#holidayModalSummary').textContent = holiday.summary;
  modal.querySelector('#holidayModalImage').src = `images/${holiday.image}`;
  modal.querySelector('#holidayModalImage').alt = holiday.name;

  // 관련 이야기
  const storyEl = modal.querySelector('#holidayModalStory');
  if (holiday.story) {
    const storyContent = `<strong>${holiday.story.title}</strong><br>${holiday.story.content}`;
    modal.querySelector('#holidayModalStoryContent').innerHTML = storyContent;
    storyEl.style.display = 'block';
  } else {
    storyEl.style.display = 'none';
  }

  // 대표 음식
  const foodsEl = modal.querySelector('#holidayModalFoods');
  const foodsContentEl = modal.querySelector('#holidayModalFoodsContent');
  if (holiday.details.foods && holiday.details.foods.length > 0) {
    foodsContentEl.innerHTML = '';
    holiday.details.foods.forEach(food => {
      const recipeId = getRecipeIdFromDishName(food.name);
      const item = document.createElement('div');
      item.className = 'item';
      
      const nameEl = document.createElement('span');
      nameEl.className = 'item__name';
      if (recipeId) {
        const link = document.createElement('a');
        // 해시 기반 + 확장자 명시 (정적 호스팅 호환)
        link.href = `recipe.html#${recipeId}`;
        link.className = 'dish-link';
        link.textContent = food.name;
        nameEl.appendChild(link);
      } else {
        nameEl.textContent = food.name;
      }
      
      const descEl = document.createElement('p');
      descEl.className = 'item__description';
      descEl.textContent = food.description;
      
      item.appendChild(nameEl);
      item.appendChild(descEl);
      foodsContentEl.appendChild(item);
    });
    foodsEl.style.display = 'block';
  } else {
    foodsEl.style.display = 'none';
  }

  // 대표 풍습
  const customsEl = modal.querySelector('#holidayModalCustoms');
  const customsContentEl = modal.querySelector('#holidayModalCustomsContent');
  if (holiday.details.customs && holiday.details.customs.length > 0) {
    customsContentEl.innerHTML = holiday.details.customs.map(custom => `
      <div class="item">
        <span class="item__name">${custom.name}</span>
        <p class="item__description">${custom.description}</p>
      </div>
    `).join('');
    customsEl.style.display = 'block';
  } else {
    customsEl.style.display = 'none';
  }

  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal__close').focus();
}

function closeHolidayModal() {
  const modal = document.getElementById('holidayModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// --- 명절/절기 관련 로직 끝 ---

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

// 유틸: 날짜 → ten
function getTenByDay(day) {
  if (day <= 10) return '초순';
  if (day <= 20) return '중순';
  return '하순';
}

// 현재 날짜에 해당하는 시기 인덱스 계산
function getCurrentPeriodIndex() {
  const now = new Date();
  const month = now.getMonth() + 1; // 0-11 → 1-12
  const day = now.getDate();
  const ten = getTenByDay(day);
  return getPeriodIndex(month, ten);
}

// 유틸: month, ten → 0..35 인덱스
function getPeriodIndex(month, ten) {
  const tenIndex = { '초순': 0, '중순': 1, '하순': 2 }[ten];
  return (month - 1) * 3 + tenIndex;
}

function getPeriodKey(month, ten) {
  return `${month}-${ten}`;
}

function formatPeriodLabel(month, ten) {
  return `${month}월 ${ten}`;
}

// 계절 판별 (1: 겨울, 2: 겨울, 3~5: 봄, 6~8: 여름, 9~11: 가을, 12: 겨울)
function getSeasonByMonth(month) {
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

function applySeasonThemeByPeriodIndex(periodIndex) {
  const period = AppState.periods[periodIndex];
  if (!period) return;
  const season = getSeasonByMonth(period.month);
  const body = document.body;
  body.classList.remove('theme-spring', 'theme-summer', 'theme-autumn', 'theme-winter');
  body.classList.add(`theme-${season}`);
}

// 로컬 캐시 로딩
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

    const res = await fetch('data/ingredients.json?v=v8', { cache: 'no-cache' });
  if (!res.ok) throw new Error('데이터 로드 실패');
  const data = await res.json();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {}
  return data;
}

// 36개 시기 생성
function createAllPeriods() {
  const list = [];
  for (let m = 1; m <= 12; m++) {
    for (const ten of TENS) {
      list.push({ month: m, ten, key: getPeriodKey(m, ten) });
    }
  }
  return list;
}

// 필터/검색/시기 결합 후 정렬 (카테고리 필터 제거)
function queryItems(allItems, searchText, periodKey) {
  const normalized = (searchText || '').trim().toLowerCase();
  console.log(`queryItems - periodKey: ${periodKey}, 검색어: "${normalized}"`);
  
  const items = allItems.filter((it) => {
    // 시기 포함
    const includesPeriod = it.periods?.some(p => getPeriodKey(p.month, p.ten) === periodKey);
    if (!includesPeriod) return false;
    // 검색 AND
    if (!normalized) return true;
    const hay = `${it.name_ko || ''}\n${it.description_ko || ''}`.toLowerCase();
    return hay.includes(normalized);
  });

  console.log(`필터링 전 총 식재료: ${allItems.length}, 필터링 후: ${items.length}`);

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
const modalEl = document.getElementById('ingredientModal');
const modalImageEl = document.getElementById('modalImage');
const modalTitleEl = document.getElementById('modalTitle');
const modalDescriptionEl = document.getElementById('modalDescription');
const modalCloseEl = document.querySelector('.modal__close');
const modalPurchaseButtonEl = document.getElementById('modalPurchaseButton');
const modalPreparationEl = document.getElementById('modalPreparation');
const modalPreparationTextEl = document.getElementById('modalPreparationText');
const modalStorageEl = document.getElementById('modalStorage');
const modalStorageContentEl = document.getElementById('modalStorageContent');
const modalDishEl = document.getElementById('modalDish');
const modalDishTextEl = document.getElementById('modalDishText');
const offlineNoticeEl = document.getElementById('offlineNotice');

// 전역 상태
const AppState = {
  allIngredients: [],
  periods: createAllPeriods(),
  searchText: '',
  renderCache: new Map(),
  lastScrollPosition: 0, // 검색 전 스크롤 위치 저장
  isSearching: false, // 검색 중인지 여부
  currentPeriodIndex: 0, // 현재 보고 있는 시기 인덱스
  isProgrammaticScroll: false // 프로그램으로 스크롤 중 여부(버튼 클릭 등)
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

  // 칼로리 정보 표시
  if (item.calories_per_100g) {
    caloriesValue.textContent = `${item.calories_per_100g}kcal`;
  } else {
    caloriesValue.textContent = '-';
  }

  // 클릭으로 모달 열기 (모바일 + PC 모두)
  node.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(item);
  });

  return node;
}

// 모달 열기
function openModal(item) {
  modalImageEl.src = `images/${item.image || '_fallback.png'}?v=v8`;
  modalImageEl.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  modalTitleEl.textContent = item.name_ko || '';
  modalDescriptionEl.textContent = item.description_ko || '';
  
  // 칼로리 정보 설정
  const modalCaloriesEl = document.getElementById('modalCalories');
  const modalCaloriesPer100gEl = document.getElementById('modalCaloriesPer100g');
  const modalCaloriesPerServingEl = document.getElementById('modalCaloriesPerServing');
  
  if (item.calories_per_100g) {
    modalCaloriesEl.style.display = 'block';
    modalCaloriesPer100gEl.textContent = `${item.calories_per_100g}kcal`;
    if (item.calories_per_serving) {
      modalCaloriesPerServingEl.textContent = item.calories_per_serving;
    } else {
      modalCaloriesPerServingEl.textContent = '';
    }
  } else {
    modalCaloriesEl.style.display = 'none';
  }
  
  // 손질법 설정
  if (item.preparation_ko) {
    modalPreparationEl.style.display = 'block';
    modalPreparationTextEl.textContent = item.preparation_ko;
  } else {
    modalPreparationEl.style.display = 'none';
  }
  
  // 보관법 설정
  if (item.storage_room_temp || item.storage_refrigerator || item.storage_freezer) {
    modalStorageEl.style.display = 'block';
    modalStorageContentEl.innerHTML = '';
    
    const storageTypes = [
      { type: '실온', icon: '🏠', method: item.storage_room_temp },
      { type: '냉장', icon: '🧊', method: item.storage_refrigerator },
      { type: '냉동', icon: '❄️', method: item.storage_freezer }
    ];
    
    storageTypes.forEach(storage => {
      if (storage.method) {
        const storageItem = document.createElement('div');
        storageItem.className = 'modal__storage-item';
        storageItem.innerHTML = `
          <span class="modal__storage-type">${storage.icon} ${storage.type}</span>
          <span class="modal__storage-method">${storage.method}</span>
        `;
        modalStorageContentEl.appendChild(storageItem);
      }
    });
  } else {
    modalStorageEl.style.display = 'none';
  }
  
  // 대표 요리 설정
  if (item.popular_dish) {
    modalDishEl.style.display = 'block';
    modalDishTextEl.innerHTML = '';
    
    // 대표 요리를 쉼표로 분리하여 각각 링크로 만들기
    const dishes = item.popular_dish.split(',').map(d => d.trim());
    dishes.forEach((dish, index) => {
      const recipeId = getRecipeIdFromDishName(dish);
      
      if (recipeId) {
        const link = document.createElement('a');
        // 해시 기반 + 확장자 명시 (정적 호스팅 호환)
        link.href = `recipe.html#${recipeId}`;
        link.className = 'dish-link';
        link.textContent = dish;
        modalDishTextEl.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.textContent = dish;
        modalDishTextEl.appendChild(span);
      }
      
      if (index < dishes.length - 1) {
        modalDishTextEl.appendChild(document.createTextNode(', '));
      }
    });
  } else {
    modalDishEl.style.display = 'none';
  }
  
  // 구매하기 버튼 설정
  if (item.external_url) {
    modalPurchaseButtonEl.style.display = 'block';
    modalPurchaseButtonEl.onclick = () => {
      showCoupangRedirectOverlay();
      setTimeout(() => {
        window.open(item.external_url, '_blank', 'noopener,noreferrer');
        setTimeout(removeCoupangRedirectOverlay, 400);
      }, 600);
    };
  } else {
    modalPurchaseButtonEl.style.display = 'none';
  }
  
  history.pushState({ modal: 'ingredient' }, '', location.href);
  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // 포커스를 모달로 이동
  modalCloseEl.focus();
}

// 모달 닫기
function closeModal() {
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.style.display = 'none';
  document.body.style.overflow = '';
}

function showCoupangRedirectOverlay() {
  removeCoupangRedirectOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'coupangRedirectOverlay';
  overlay.className = 'redirect-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <p class="redirect-overlay__text"><span class="redirect-overlay__highlight">쿠팡</span>으로 이동 중이에요</p>
    <div class="redirect-overlay__arrow" aria-hidden="true"></div>
  `;
  document.body.appendChild(overlay);
  history.pushState({ modal: 'coupang' }, '', location.href);
  requestAnimationFrame(() => overlay.classList.add('redirect-overlay--visible'));
}

function removeCoupangRedirectOverlay() {
  const overlay = document.getElementById('coupangRedirectOverlay');
  if (overlay) {
    overlay.classList.remove('redirect-overlay--visible');
    setTimeout(() => overlay.remove(), 200);
  }
}

// 모든 시기 렌더링 (세로 배치)
function renderAllPeriods() {
  const { periods, allIngredients, searchText, renderCache } = AppState;
  
  trackEl.innerHTML = '';
  
  for (const period of periods) {
    // 시기 헤더 생성
    const periodHeader = document.createElement('div');
    periodHeader.className = 'period-header';
    periodHeader.textContent = formatPeriodLabel(period.month, period.ten);
    periodHeader.setAttribute('data-period-index', getPeriodIndex(period.month, period.ten));
    trackEl.appendChild(periodHeader);
    
    // 시기별 식재료 그리드 생성
    const gridContainer = document.createElement('div');
    gridContainer.className = 'period-grid';
    
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('role', 'list');
    
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    empty.textContent = '검색 결과가 없습니다.';
    
    gridContainer.appendChild(grid);
    gridContainer.appendChild(empty);
    trackEl.appendChild(gridContainer);
    
    // 캐시 확인
    const catsSig = 'all'; // 카테고리 필터 제거
    const searchSig = (searchText || '').trim().toLowerCase();
    const signature = `${period.key}__${catsSig}__${searchSig}`;
    
    // 캐시가 동일하면 스킵
    if (renderCache.get(period.key) === signature && grid.children.length > 0) {
      continue;
    }
    
    // 기존 카드들 제거 (중복 방지)
    grid.innerHTML = '';
    
    // 식재료 렌더링
    const items = queryItems(allIngredients, searchText, period.key);
    if (items.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      // 중복 제거: 이미 추가된 식재료는 건너뛰기
      const addedItems = new Set();
      for (const item of items) {
        if (!addedItems.has(item.name_ko)) {
          addedItems.add(item.name_ko);
          grid.appendChild(createCard(item));
        }
      }
    }
    renderCache.set(period.key, signature);
  }
}

// 특정 시기로 스크롤
function scrollToPeriod(periodIndex) {
  const periodHeader = document.querySelector(`[data-period-index="${periodIndex}"]`);
  if (!periodHeader) return;
  const offset = getHeaderHeight() + 8; // 헤더 높이 + 여유
  const y = (window.pageYOffset || document.documentElement.scrollTop) + periodHeader.getBoundingClientRect().top - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
  AppState.currentPeriodIndex = periodIndex; // 현재 시기 인덱스 업데이트
  applySeasonThemeByPeriodIndex(periodIndex);
}

// 오늘 버튼 상태를 전역에서 동기화하는 헬퍼 (삭제됨)
function syncTodayButtonState() {
  // 더 이상 사용하지 않음
}

// 현재 화면에 보이는 시기 인덱스 감지
function getCurrentVisiblePeriodIndex() {
  const periodHeaders = document.querySelectorAll('.period-header');
  if (!periodHeaders.length) return -1;

  const headerOffset = getHeaderHeight() + 8; // 헤더 높이 + 여유

  // 화면 상단(헤더 아래) 기준으로 첫 번째로 아래에 보이는 헤더를 찾고,
  // 그 바로 이전 헤더를 "현재 시기"로 간주
  let firstBelow = -1;
  for (let i = 0; i < periodHeaders.length; i++) {
    const top = periodHeaders[i].getBoundingClientRect().top - headerOffset;
    if (top >= 0) { firstBelow = i; break; }
  }

  if (firstBelow === -1) {
    // 전부 화면 위에 있다면 마지막 헤더가 현재 시기
    return parseInt(periodHeaders[periodHeaders.length - 1].getAttribute('data-period-index'));
  }
  if (firstBelow === 0) {
    // 아직 어떤 헤더도 위로 지나가지 않았다면 첫 번째 시기
    return parseInt(periodHeaders[0].getAttribute('data-period-index'));
  }
  // 첫 아래 헤더가 헤더 바로 아래에 거의 붙어있다면 그 헤더를 현재 시기로 간주
  const topFromOffset = periodHeaders[firstBelow].getBoundingClientRect().top - headerOffset;
  if (Math.abs(topFromOffset) <= 8) {
    return parseInt(periodHeaders[firstBelow].getAttribute('data-period-index'));
  }
  // 그렇지 않다면 그 바로 이전 헤더가 현재 시기
  return parseInt(periodHeaders[firstBelow - 1].getAttribute('data-period-index'));
}

// 검색 결과가 있는 첫 번째 시기로 스크롤
function scrollToFirstSearchResult() {
  const periodHeaders = document.querySelectorAll('.period-header');
  for (const header of periodHeaders) {
    const periodIndex = parseInt(header.getAttribute('data-period-index'));
    const period = AppState.periods[periodIndex];
    const items = queryItems(AppState.allIngredients, AppState.searchText, period.key);
    
    if (items.length > 0) {
      scrollToPeriod(periodIndex);
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
    renderAllPeriods();
    
    if (searchValue) {
      // 검색어가 있으면 첫 번째 결과로 스크롤
      setTimeout(() => scrollToFirstSearchResult(), 100);
    } else if (AppState.isSearching && !searchValue && previousSearchText) {
      // 검색어를 모두 지웠으면 원래 위치로 복원
      AppState.isSearching = false;
      setTimeout(() => restoreScrollPosition(), 100);
    }
  });
}

// 모달 이벤트
function initModal() {
  modalCloseEl.addEventListener('click', closeModal);
  
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl || e.target.classList.contains('modal__backdrop')) {
      closeModal();
    }
  });

  // 명절 모달 이벤트 핸들러 추가
  const holidayModal = document.getElementById('holidayModal');
  if (holidayModal) {
    holidayModal.querySelector('.modal__close').addEventListener('click', closeHolidayModal);
    holidayModal.addEventListener('click', (e) => {
      if (e.target === holidayModal || e.target.classList.contains('modal__backdrop')) {
        closeHolidayModal();
      }
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalEl.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
      if (holidayModal && holidayModal.getAttribute('aria-hidden') === 'false') {
        closeHolidayModal();
      }
    }
  });

  // 모바일 뒤로가기: 팝업/오버레이가 열려 있으면 팝업만 닫기
  window.addEventListener('popstate', () => {
    if (document.getElementById('coupangRedirectOverlay')) {
      removeCoupangRedirectOverlay();
      return;
    }
    if (modalEl.getAttribute('aria-hidden') === 'false') {
      closeModal();
      return;
    }
    if (holidayModal && holidayModal.getAttribute('aria-hidden') === 'false') {
      closeHolidayModal();
      return;
    }
    const webNoti = document.getElementById('webNotificationInfoModal');
    if (webNoti) {
      webNoti.remove();
      document.body.style.overflow = '';
      return;
    }
    const settingModal = document.getElementById('settingModal');
    if (settingModal && settingModal.getAttribute('aria-hidden') === 'false' && typeof window.closeSettingModal === 'function') {
      window.closeSettingModal();
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
      const currentIndex = getCurrentPeriodIndex();
      AppState.isProgrammaticScroll = true;
      
      // 앱에서 배너가 즉시 사라지는 문제 해결을 위해 강제로 표시
      const banner = document.getElementById('holidayBanner');
      if (banner) {
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
      }

      scrollToPeriod(currentIndex);
      
      // 스크롤 후 플래그 해제
      setTimeout(() => {
        AppState.isProgrammaticScroll = false;
        applySeasonThemeByPeriodIndex(currentIndex);
      }, 2000);
    });
  }

  // 설정 버튼 클릭 (웹에서는 알림 안내 모달만 표시, 앱에서는 설정 모달)
  if (settingButton) {
    settingButton.addEventListener('click', () => {
      if (!Capacitor.isNativePlatform()) {
        showWebNotificationInfoModal();
        return;
      }
      openSettingModal(); // 설정 모달 열기
    });
  }

  // 스크롤 이벤트로 실시간 테마/상태 업데이트
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (!AppState.isProgrammaticScroll) {
        // 스크롤 위치 기반으로 현재 시기 감지
        const currentPeriodIndex = getCurrentVisiblePeriodIndex();
        if (currentPeriodIndex !== -1) {
          AppState.currentPeriodIndex = currentPeriodIndex;
        }
        applySeasonThemeByPeriodIndex(AppState.currentPeriodIndex);
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

    renderAllPeriods();
    initSearch();
    initModal();
    initPush(); // Push 알림 초기화
    initHeaderControls();
    
    // 설정 모달 초기화
    const { initSettingModal } = await import('./setting.js');
    initSettingModal();
    initOfflineNotice();
    initBannerScroll(); // 배너 스크롤 기능 초기화
    syncHeaderOffset();
    window.addEventListener('resize', () => { requestAnimationFrame(syncHeaderOffset); });
    window.addEventListener('orientationchange', () => { setTimeout(syncHeaderOffset, 250); });
    
    // 초기 로드 시 현재 날짜에 해당하는 시기로 스크롤 (프로그램적 스크롤로 처리)
    setTimeout(() => {
      const currentIndex = getCurrentPeriodIndex();
      AppState.isProgrammaticScroll = true;
      
      // 앱에서 배너가 즉시 사라지는 문제 해결을 위해 강제로 표시
      const banner = document.getElementById('holidayBanner');
      if (banner) {
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
      }

      scrollToPeriod(currentIndex);
      // 초기 렌더 직후 레이아웃/이미지 로딩 지연을 감안해 여러 번 동기화
      setTimeout(syncTodayButtonState, 50);
      setTimeout(syncTodayButtonState, 200);
      setTimeout(() => {
        AppState.isProgrammaticScroll = false;
        syncTodayButtonState();
        applySeasonThemeByPeriodIndex(AppState.currentPeriodIndex);
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