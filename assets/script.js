// 제철음식 캘린더 메인 스크립트
// 규칙: ES 모듈 없이 단일 페이지 스크립트

const CACHE_KEY = 'seasons:ingredients:v4';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const CATEGORY_ORDER = { '해산물': 1, '채소': 2, '과일': 3, '기타': 4 };
const TENS = ['초순', '중순', '하순'];

// 유틸: 날짜 → ten
function getTenByDay(day) {
  if (day <= 10) return '초순';
  if (day <= 20) return '중순';
  return '하순';
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

  const res = await fetch('data/ingredients.json', { cache: 'no-cache' });
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

// 필터/검색/시기 결합 후 정렬
function queryItems(allItems, categoriesSet, searchText, periodKey) {
  const normalized = (searchText || '').trim().toLowerCase();
  console.log(`queryItems - periodKey: ${periodKey}, 검색어: "${normalized}", 카테고리:`, Array.from(categoriesSet));
  
  const items = allItems.filter((it) => {
    // 시기 포함
    const includesPeriod = it.periods?.some(p => getPeriodKey(p.month, p.ten) === periodKey);
    if (!includesPeriod) return false;
    // 카테고리 OR (선택 없으면 결과 0)
    if (categoriesSet.size === 0) return false;
    if (!categoriesSet.has(it.category)) return false;
    // 검색 AND
    if (!normalized) return true;
    const hay = `${it.name_ko || ''}\n${it.description_ko || ''}`.toLowerCase();
    return hay.includes(normalized);
  });

  console.log(`필터링 전 총 식재료: ${allItems.length}, 필터링 후: ${items.length}`);
  
  // 9월 하순에 해당하는 식재료들을 확인
  if (periodKey === '9-하순') {
    const septItems = allItems.filter(it => it.periods?.some(p => getPeriodKey(p.month, p.ten) === '9-하순'));
    console.log('9월 하순에 해당하는 식재료들:', septItems.map(it => it.name_ko));
  }

  items.sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] || 99;
    const cb = CATEGORY_ORDER[b.category] || 99;
    if (ca !== cb) return ca - cb;
    return (a.name_ko || '').localeCompare(b.name_ko || '', 'ko');
  });
  return items;
}

// DOM refs
const currentPeriodLabelEl = document.getElementById('currentPeriodLabel');
const trackEl = document.getElementById('periodTrack');
const containerEl = document.getElementById('carouselContainer');
const headerEl = document.querySelector('.app-header');
const panelTpl = document.getElementById('panelTemplate');
const cardTpl = document.getElementById('cardTemplate');
const filtersForm = document.getElementById('filtersForm');
const searchInput = document.getElementById('searchInput');

const AppState = {
  allIngredients: [],
  periods: createAllPeriods(),
  currentIndex: 0,
  categories: new Set(['해산물', '채소', '과일', '기타']),
  searchText: '',
  renderCache: new Map(), // periodKey -> signature to avoid unnecessary re-render
};

// 초기 포커스
function computeTodayIndex() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const ten = getTenByDay(now.getDate());
  return getPeriodIndex(month, ten);
}

// 패널 DOM 구성 (순환을 위해 양쪽에 복제 패널 추가)
function buildPanels() {
  trackEl.innerHTML = '';
  
  // 마지막 패널을 앞에 추가 (12월 하순 → 1월 초순 순환용)
  const lastPeriod = AppState.periods[AppState.periods.length - 1];
  const lastNode = panelTpl.content.firstElementChild.cloneNode(true);
  lastNode.dataset.periodKey = lastPeriod.key;
  lastNode.dataset.isClone = 'true';
  trackEl.appendChild(lastNode);
  
  // 실제 패널들 추가
  for (const p of AppState.periods) {
    const node = panelTpl.content.firstElementChild.cloneNode(true);
    node.dataset.periodKey = p.key;
    trackEl.appendChild(node);
  }
  
  // 첫 번째 패널을 뒤에 추가 (1월 초순 → 12월 하순 순환용)
  const firstPeriod = AppState.periods[0];
  const firstNode = panelTpl.content.firstElementChild.cloneNode(true);
  firstNode.dataset.periodKey = firstPeriod.key;
  firstNode.dataset.isClone = 'true';
  trackEl.appendChild(firstNode);
}

// 현재 패널 높이에 맞춰 컨테이너 높이 조정
function updateContainerHeight() {
  try {
    // 실제 패널 인덱스 (복제 패널 제외)
    const actualIndex = AppState.currentIndex + 1; // 앞에 복제 패널 1개 있음
    const panel = trackEl.children[actualIndex];
    if (!containerEl || !panel) return;
    const rect = panel.getBoundingClientRect();
    containerEl.style.height = `${Math.ceil(rect.height)}px`;
  } catch {}
}

function getPanelHeightByIndex(index) {
  try {
    // 실제 패널 인덱스 (복제 패널 제외)
    const actualIndex = index + 1; // 앞에 복제 패널 1개 있음
    const panel = trackEl.children[actualIndex];
    if (!panel) return 0;
    return Math.ceil(panel.getBoundingClientRect().height);
  } catch { return 0; }
}

// 헤더/컨트롤 실제 높이를 CSS 변수로 동기화
function syncLayoutMetrics() {
  const root = document.documentElement;
  const headerH = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0;
  const controlsEl = document.querySelector('.controls');
  const controlsH = controlsEl ? Math.ceil(controlsEl.getBoundingClientRect().height) : 0;
  root.style.setProperty('--header-h', `${headerH}px`);
  root.style.setProperty('--controls-h', `${controlsH}px`);
}

// 스냅 이동
function snapTo(index, animate = true, skipRender = false) {
  const max = AppState.periods.length - 1;
  AppState.currentIndex = Math.max(0, Math.min(max, index));
  
  // 실제 패널 인덱스 (복제 패널 제외)
  const actualIndex = AppState.currentIndex + 1; // 앞에 복제 패널 1개 있음
  const panel = trackEl.children[actualIndex];
  if (panel) {
    panel.scrollIntoView({ behavior: animate ? 'smooth' : 'auto', inline: 'start', block: 'nearest' });
  }
  const { month, ten } = AppState.periods[AppState.currentIndex];
  currentPeriodLabelEl.textContent = formatPeriodLabel(month, ten);
  if (!skipRender) {
    renderPanels();
  }
  requestAnimationFrame(() => { updateContainerHeight(); syncLayoutMetrics(); });
}

// 터치 스와이프
function initSwipe() {
  let dragging = false;
  let scrollRaf = false;

  const onStart = () => {
    dragging = true;
    document.body.classList.add('is-dragging');
    try { renderPanels(); } catch {}
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-dragging');
    requestAnimationFrame(() => { updateContainerHeight(); syncLayoutMetrics(); });
  };

  containerEl.addEventListener('touchstart', onStart, { passive: true });
  containerEl.addEventListener('touchend', onEnd, { passive: true });
  containerEl.addEventListener('mousedown', onStart);
  window.addEventListener('mouseup', onEnd);

  // 네이티브 스크롤로 패널 변경 감지
  let lastIndex = AppState.currentIndex;
  let lastScrollLeft = 0;
  containerEl.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = true;
    requestAnimationFrame(() => {
      const panelWidth = document.querySelector('.panel').getBoundingClientRect().width + 16; // gap
      const currentScrollLeft = containerEl.scrollLeft;
      const scrollIndex = Math.round(currentScrollLeft / panelWidth);
      
      // 복제 패널을 고려한 실제 인덱스 계산
      let newIndex;
      if (scrollIndex === 0) {
        // 첫 번째 복제 패널 (12월 하순) → 실제 마지막 인덱스
        newIndex = AppState.periods.length - 1;
      } else if (scrollIndex === AppState.periods.length + 1) {
        // 마지막 복제 패널 (1월 초순) → 실제 첫 번째 인덱스
        newIndex = 0;
      } else {
        // 실제 패널들 (1 ~ 36)
        newIndex = scrollIndex - 1;
      }
      
      // 인덱스 변화가 2를 초과하면 무시 (한 번에 최대 2개까지만 이동 허용)
      const indexDelta = Math.abs(newIndex - AppState.currentIndex);
      if (indexDelta > 2 && indexDelta !== AppState.periods.length - 1) {
        scrollRaf = false;
        return;
      }
      
      if (newIndex !== AppState.currentIndex) {
        AppState.currentIndex = newIndex;
        const { month, ten } = AppState.periods[AppState.currentIndex];
        currentPeriodLabelEl.textContent = formatPeriodLabel(month, ten);
        renderPanels();
        lastIndex = AppState.currentIndex;
        lastScrollLeft = currentScrollLeft;
      }
      updateContainerHeight();
      syncLayoutMetrics();
      scrollRaf = false;
    });
  }, { passive: true });

  // 스크롤 완료 감지 (스와이프가 완전히 끝난 후)
  let scrollEndTimeout = null;
  containerEl.addEventListener('scrollend', () => {
    // 복제 패널에 도달했을 때 실제 패널로 점프
    const panelWidth = document.querySelector('.panel').getBoundingClientRect().width + 16;
    const scrollIndex = Math.round(containerEl.scrollLeft / panelWidth);
    
    if (scrollIndex === 0) {
      // 첫 번째 복제 패널 → 마지막 실제 패널로 점프
      const targetScrollLeft = AppState.periods.length * panelWidth;
      containerEl.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
    } else if (scrollIndex === AppState.periods.length + 1) {
      // 마지막 복제 패널 → 첫 번째 실제 패널로 점프
      const targetScrollLeft = panelWidth;
      containerEl.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
    }
    
    // 스크롤이 완전히 끝난 후에만 스크롤 위치 초기화
    if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
    scrollEndTimeout = setTimeout(() => {
      const main = document.querySelector('main');
      if (main) {
        main.scrollTop = 0;
      }
    }, 100);
  }, { passive: true });

  // scrollend 이벤트가 지원되지 않는 경우를 위한 폴백
  containerEl.addEventListener('scroll', () => {
    if (scrollEndTimeout) clearTimeout(scrollEndTimeout);
    scrollEndTimeout = setTimeout(() => {
      const panelWidth = document.querySelector('.panel').getBoundingClientRect().width + 16;
      const scrollIndex = Math.round(containerEl.scrollLeft / panelWidth);
      
      if (scrollIndex === 0) {
        const targetScrollLeft = AppState.periods.length * panelWidth;
        containerEl.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
      } else if (scrollIndex === AppState.periods.length + 1) {
        const targetScrollLeft = panelWidth;
        containerEl.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
      }
      
      const main = document.querySelector('main');
      if (main) {
        main.scrollTop = 0;
      }
    }, 150);
  }, { passive: true });
}

// 필터 UI 바인딩
function initFilters() {
  filtersForm.addEventListener('change', () => {
    const checked = new Set(Array.from(filtersForm.querySelectorAll('input[name="category"]:checked')).map(i => i.value));
    AppState.categories = checked;
    renderPanels();
  });
  searchInput.addEventListener('input', () => {
    AppState.searchText = searchInput.value;
    renderPanels();
  });
}

// 모달 관련 요소들
const modal = document.getElementById('ingredientModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalClose = document.querySelector('.modal__close');

// 모달 열기
function openModal(item) {
  modalTitle.textContent = item.name_ko || '';
  modalDescription.textContent = item.description_ko || '';
  
  const imgPath = `images/${item.image || '_fallback.png'}`;
  modalImage.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  modalImage.onerror = () => { 
    modalImage.onerror = null; 
    modalImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMiAxMkgzNlYzNkgxMlYxMloiIGZpbGw9IiNEOUQ5RDkiLz4KPHN2Zz4K';
  };
  modalImage.src = imgPath;
  
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
}

// 모달 닫기
function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; // 배경 스크롤 복원
}

// 카드 생성
function createCard(item) {
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  const title = node.querySelector('.title');
  const thumb = node.querySelector('.thumb');
  const img = node.querySelector('.photo');

  title.textContent = item.name_ko || '';
  const imgPath = `images/${item.image || '_fallback.png'}`;
  img.alt = item.name_ko ? `${item.name_ko} 이미지` : '재료 이미지';
  img.onerror = () => { 
    img.onerror = null; 
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMiAxMkgzNlYzNkgxMlYxMloiIGZpbGw9IiNEOUQ5RDkiLz4KPHN2Zz4K';
  };
  img.addEventListener('load', () => requestAnimationFrame(() => { updateContainerHeight(); syncLayoutMetrics(); }), { once: true });
  img.src = imgPath;

  // 롱프레스로 모달 열기 (모바일 + PC 모두)
  let pressTimer = null;
  let touchStartPos = { x: 0, y: 0 };
  let hasMoved = false;
  let isLongPress = false;
  
  // 터치 이벤트 (모바일)
  node.addEventListener('touchstart', (e) => {
    hasMoved = false;
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    pressTimer = setTimeout(() => {
      if (!hasMoved) {
        isLongPress = true;
        openModal(item);
      }
    }, 380);
  }, { passive: true });
  
  node.addEventListener('touchmove', (e) => {
    if (pressTimer) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.y);
      
      // 10px 이상 움직이면 스크롤로 판단
      if (deltaX > 10 || deltaY > 10) {
        hasMoved = true;
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }
  }, { passive: true });
  
  node.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    pressTimer = null;
    
    // 일반 터치인 경우 외부 링크로 이동
    if (!isLongPress && !hasMoved && item.external_url) {
      e.preventDefault();
      window.open(item.external_url, '_blank', 'noopener,noreferrer');
    }
    isLongPress = false; // 터치 후 플래그 리셋
  });
  node.addEventListener('touchcancel', () => { 
    clearTimeout(pressTimer);
    pressTimer = null;
  });
  
  // 마우스 이벤트 (PC)
  let mouseStartPos = { x: 0, y: 0 };
  let mouseHasMoved = false;
  
  node.addEventListener('mousedown', (e) => {
    mouseHasMoved = false;
    mouseStartPos = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      if (!mouseHasMoved) {
        isLongPress = true;
        openModal(item);
      }
    }, 380);
  });
  
  node.addEventListener('mousemove', (e) => {
    if (pressTimer) {
      const deltaX = Math.abs(e.clientX - mouseStartPos.x);
      const deltaY = Math.abs(e.clientY - mouseStartPos.y);
      
      // 10px 이상 움직이면 드래그로 판단
      if (deltaX > 10 || deltaY > 10) {
        mouseHasMoved = true;
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    }
  });
  
  node.addEventListener('mouseup', (e) => {
    clearTimeout(pressTimer);
    pressTimer = null;
    
    // 일반 클릭인 경우 외부 링크로 이동
    if (!isLongPress && !mouseHasMoved && item.external_url) {
      e.preventDefault();
      window.open(item.external_url, '_blank', 'noopener,noreferrer');
    }
    isLongPress = false; // 마우스 업 후 플래그 리셋
  });
  node.addEventListener('mouseleave', () => { clearTimeout(pressTimer); });


  return node;
}

// 현재 패널 및 인접 패널 렌더
function renderPanels() {
  const { currentIndex, periods, allIngredients, categories, searchText, renderCache } = AppState;
  const max = periods.length - 1;

  const indicesToRender = new Set([
    currentIndex,
    currentIndex === 0 ? max : currentIndex - 1, // 이전
    currentIndex === max ? 0 : currentIndex + 1, // 다음
  ]);

  // 헬퍼: 특정 패널에 주어진 key로 콘텐츠 렌더
  const renderInto = (panel, key) => {
    if (!panel) return;
    const grid = panel.querySelector('.grid');
    const empty = panel.querySelector('.empty');
    const catsSig = Array.from(categories).sort().join(',');
    const searchSig = (searchText || '').trim().toLowerCase();
    const signature = `${key}__${catsSig}__${searchSig}`;

    // 캐시가 동일하면 스킵 (단, 패널이 비어있다면 강제 렌더)
    if (renderCache.get(key) === signature && grid.children.length > 0) return;

    grid.innerHTML = '';
    const items = queryItems(allIngredients, categories, searchText, key);
    if (items.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      for (const item of items) grid.appendChild(createCard(item));
    }
    renderCache.set(key, signature);
  };

  for (const index of indicesToRender) {
    const period = periods[index];
    const key = period.key;

    // 실제 패널 인덱스 (앞에 복제 1개)
    const actualIndex = index + 1;
    renderInto(trackEl.children[actualIndex], key);

    // 왼쪽 경계(1월 초순)일 때, 왼쪽 복제 패널(인덱스 0)에 12월 하순 렌더
    if (index === 0) {
      const leftCloneKey = periods[max].key; // 12월 하순
      renderInto(trackEl.children[0], leftCloneKey);
    }

    // 오른쪽 경계(12월 하순)일 때, 오른쪽 복제 패널(마지막+1)에 1월 초순 렌더
    if (index === max) {
      const rightCloneKey = periods[0].key; // 1월 초순
      renderInto(trackEl.children[periods.length + 1], rightCloneKey);
    }
  }

  requestAnimationFrame(() => { updateContainerHeight(); syncLayoutMetrics(); });
}

// 초기화
async function init() {
  buildPanels();
  initSwipe();
  initFilters();
  
  // 모달 이벤트 리스너
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal__backdrop')) {
      closeModal();
    }
  });
  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  AppState.currentIndex = computeTodayIndex();

  try {
    AppState.allIngredients = await loadIngredients();
  } catch (e) {
    console.error(e);
    AppState.allIngredients = [];
  }

  // 초기 렌더링 및 스냅 (레이아웃 계산 후)
  requestAnimationFrame(() => { 
    renderPanels(); // 먼저 패널 렌더링
    snapTo(AppState.currentIndex, false, true); // 렌더링 스킵
    syncLayoutMetrics(); 
  });

  // 리사이즈 시 현재 패널로 재스냅
  window.addEventListener('resize', () => { 
    snapTo(AppState.currentIndex, false);
    updateContainerHeight();
    syncLayoutMetrics();
  });
}

document.addEventListener('DOMContentLoaded', init);


