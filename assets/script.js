// 제철음식 캘린더 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v8';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const CATEGORY_ORDER = { '해산물': 1, '채소': 2, '과일': 3, '기타': 4 };
const TENS = ['초순', '중순', '하순'];

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
  
  // 구매하기 버튼 설정
  if (item.external_url) {
    modalPurchaseButtonEl.style.display = 'block';
    modalPurchaseButtonEl.onclick = () => {
      window.open(item.external_url, '_blank', 'noopener,noreferrer');
    };
  } else {
    modalPurchaseButtonEl.style.display = 'none';
  }
  
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

// 오늘 버튼 상태를 전역에서 동기화하는 헬퍼
function syncTodayButtonState() {
  const todayButton = document.getElementById('todayButton');
  if (!todayButton) return;
  const currentIndex = getCurrentPeriodIndex();
  const isAtCurrentPeriod = AppState.currentPeriodIndex === currentIndex;
  todayButton.disabled = isAtCurrentPeriod;
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
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });
}

// 메인 초기화
function initTodayButton() {
  const todayButton = document.getElementById('todayButton');
  if (!todayButton) return;

  todayButton.addEventListener('click', () => {
    const currentIndex = getCurrentPeriodIndex();
    AppState.isProgrammaticScroll = true;
    scrollToPeriod(currentIndex);
    // 클릭 직후에도 바로 비활성화되도록 상태 갱신
    // (scrollToPeriod에서 AppState.currentPeriodIndex가 갱신됨)
    updateTodayButtonState();
    // 스크롤 애니메이션이 끝날 시간을 고려해 잠시 후 플래그 해제 및 최종 동기화
    setTimeout(() => {
      AppState.isProgrammaticScroll = false;
      updateTodayButtonState();
    }, 400);
  });

  // 현재 시기인지 확인하여 버튼 상태 업데이트
  function updateTodayButtonState() {
    const currentIndex = getCurrentPeriodIndex();
    const isAtCurrentPeriod = AppState.currentPeriodIndex === currentIndex;
    todayButton.disabled = isAtCurrentPeriod;
  }

  // 스크롤 이벤트로 실시간 상태 업데이트
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
        updateTodayButtonState();
        applySeasonThemeByPeriodIndex(AppState.currentPeriodIndex);
      }
    }, 100); // 스크롤 완료 후 100ms 뒤에 상태 업데이트
  });

  // 주기적으로 버튼 상태 업데이트 (날짜가 바뀔 수 있으므로)
  setInterval(updateTodayButtonState, 60000); // 1분마다
  updateTodayButtonState(); // 초기 상태 설정
}

async function init() {
  try {
    AppState.allIngredients = await loadIngredients();
    renderAllPeriods();
    initSearch();
    initModal();
    initTodayButton();
    syncHeaderOffset();
    window.addEventListener('resize', () => { requestAnimationFrame(syncHeaderOffset); });
    window.addEventListener('orientationchange', () => { setTimeout(syncHeaderOffset, 250); });
    
    // 초기 로드 시 현재 날짜에 해당하는 시기로 스크롤 (프로그램적 스크롤로 처리)
    setTimeout(() => {
      const currentIndex = getCurrentPeriodIndex();
      AppState.isProgrammaticScroll = true;
      scrollToPeriod(currentIndex);
      // 초기 렌더 직후 레이아웃/이미지 로딩 지연을 감안해 여러 번 동기화
      setTimeout(syncTodayButtonState, 50);
      setTimeout(syncTodayButtonState, 200);
      setTimeout(() => {
        AppState.isProgrammaticScroll = false;
        syncTodayButtonState();
        applySeasonThemeByPeriodIndex(AppState.currentPeriodIndex);
      }, 500);
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