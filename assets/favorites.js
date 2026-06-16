// favorites.js
// 즐겨찾기 목록 연동 및 데이터 관리 스크립트

// 글로벌 상태
const State = {
  currentTab: 'ingredients', // 'ingredients', 'recipes', 'holidays'
  ingredientsData: [],
  recipesData: [],
  holidaysData: [],
  favorites: {
    ingredients: [],
    recipes: [],
    holidays: []
  }
};

// 로컬 저장소 키 정의
const STORAGE_KEYS = {
  ingredients: 'seasons:favorites:ingredients',
  recipes: 'seasons:favorites:recipes',
  holidays: 'seasons:favorites:holidays'
};

// 12개월 테마 적용
function applySeasonTheme() {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  let season = 'autumn';
  if (currentMonth === 12 || currentMonth === 1 || currentMonth === 2) season = 'winter';
  else if (currentMonth >= 3 && currentMonth <= 5) season = 'spring';
  else if (currentMonth >= 6 && currentMonth <= 8) season = 'summer';

  document.body.classList.remove('theme-spring', 'theme-summer', 'theme-autumn', 'theme-winter');
  document.body.classList.add(`theme-${season}`);
}

// 로컬 저장소에서 즐겨찾기 불러오기
function loadFavoritesFromStorage() {
  try {
    State.favorites.ingredients = JSON.parse(localStorage.getItem(STORAGE_KEYS.ingredients)) || [];
    State.favorites.recipes = JSON.parse(localStorage.getItem(STORAGE_KEYS.recipes)) || [];
    State.favorites.holidays = JSON.parse(localStorage.getItem(STORAGE_KEYS.holidays)) || [];
  } catch (e) {
    console.error('즐겨찾기 데이터를 불러오는 데 실패했습니다.', e);
  }
}

// 즐겨찾기 저장
function saveFavoritesToStorage(type) {
  try {
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(State.favorites[type]));
  } catch (e) {
    console.error('즐겨찾기 데이터를 저장하는 데 실패했습니다.', e);
  }
}

// 비동기 데이터 fetch (캐시 버전 맞춰서 로드)
async function fetchData() {
  const cacheVersion = 'v45'; // recipes.json 및 ingredients.json 최신 캐시 버전
  try {
    const [ingRes, recRes, holRes] = await Promise.all([
      fetch(`data/ingredients.json?v=${cacheVersion}`).then(r => r.ok ? r.json() : []),
      fetch(`data/recipes.json?v=${cacheVersion}`).then(r => r.ok ? r.json() : []),
      fetch(`data/holidays.json?v=v11`).then(r => r.ok ? r.json() : [])
    ]);

    State.ingredientsData = ingRes;
    State.recipesData = recRes;
    State.holidaysData = holRes;
  } catch (err) {
    console.error('데이터 로드 실패', err);
  }
}

// 제철 시기 텍스트 변환 헬퍼 함수
function getMonthsRangeText(months) {
  if (!months || months.length === 0) return '';
  if (months.length === 1) return `${months[0]}월`;

  const sorted = [...months].sort((a, b) => a - b);

  // 일반적인 연속성 검사 (예: 5, 6, 7 -> 5월~7월)
  let isConsecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }
  if (isConsecutive) {
    return `${sorted[0]}월~${sorted[sorted.length - 1]}월`;
  }

  // 순환 연속성 검사 (예: 11, 12, 1, 2 -> 11월~2월)
  const missing = [];
  for (let m = 1; m <= 12; m++) {
    if (!months.includes(m)) {
      missing.push(m);
    }
  }

  let isMissingConsecutive = true;
  for (let i = 1; i < missing.length; i++) {
    if (missing[i] !== missing[i - 1] + 1) {
      isMissingConsecutive = false;
      break;
    }
  }

  if (isMissingConsecutive) {
    const startMonth = missing[missing.length - 1] === 12 ? 1 : missing[missing.length - 1] + 1;
    const endMonth = missing[0] === 1 ? 12 : missing[0] - 1;
    return `${startMonth}월~${endMonth}월`;
  }

  return sorted.map(m => `${m}월`).join(', ');
}

// 카드 엘리먼트 생성
function createCardElement(item, type) {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('role', 'listitem');

  let titleText = '';
  let imagePath = '';
  let detailUrl = '';
  let subText = '';

  if (type === 'ingredients') {
    titleText = item.name_ko;
    imagePath = `images/${item.image || '_fallback.png'}`;
    detailUrl = `ingredient.html?id=${encodeURIComponent(item.name_ko)}`;
    const monthText = getMonthsRangeText(item.months);
    const dishText = item.popular_dish ? item.popular_dish.split(',')[0].trim() : '';

    let infoParts = [];
    if (monthText) infoParts.push(`🗓️ ${monthText}`);
    if (dishText) infoParts.push(`🍲 ${dishText}`);
    subText = infoParts.join(' · ');
  } else if (type === 'recipes') {
    titleText = item.name;
    
    // 식재료 매칭을 통한 제철 정보 가져오기
    let matchedIngredient = null;
    if (item.ingredients && item.ingredients.length > 0) {
      for (const ing of item.ingredients) {
        const matched = State.ingredientsData.find(s => 
          s.name_ko === ing.name || ing.name.includes(s.name_ko)
        );
        if (matched) {
          matchedIngredient = matched;
          break;
        }
      }
    }
    
    // 레시피 전용 이미지 우선, 없으면 폴백 이미지
    imagePath = `images/${item.image || '_fallback.png'}`;
    detailUrl = `recipe.html#${encodeURIComponent(item.id)}`;
    
    const monthText = matchedIngredient ? getMonthsRangeText(matchedIngredient.months) : '';
    let infoParts = [];
    if (monthText) infoParts.push(`🗓️ ${monthText}`);
    infoParts.push(`⏱️ ${item.cookTime || '-'}`);
    infoParts.push(`🧑‍🍳 ${item.difficulty || '-'}`);
    subText = infoParts.join(' · ');
  } else if (type === 'holidays') {
    titleText = item.name;
    imagePath = `images/${item.image || 'holidays/holiday-seollal.jpg'}`;
    detailUrl = `holiday.html?id=${encodeURIComponent(item.id)}`;
    subText = `🌾 ${item.main_food || '절기 음식'}`;
  }

  // 카드 본문 뼈대
  card.innerHTML = `
    <div class="thumb" aria-hidden="true">
      <img class="photo" src="${imagePath}" alt="${titleText} 이미지" onerror="this.onerror=null; this.src='images/_fallback.png';" />
    </div>
    <div class="card-content">
      <h2 class="title">${titleText}</h2>
      ${subText ? `<div class="popular-dish"><span class="popular-dish-value">${subText}</span></div>` : ''}
    </div>
    <button class="card-favorite-btn" type="button" aria-label="즐겨찾기 해제" title="즐겨찾기 해제">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </button>
  `;

  // 카드 클릭 시 상세로 이동 (하트 버튼 클릭 시엔 제외)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-favorite-btn')) return;
    window.location.href = detailUrl;
  });

  // 하트 버튼 클릭 핸들러 (즐겨찾기 해제)
  const favBtn = card.querySelector('.card-favorite-btn');
  favBtn.addEventListener('click', () => {
    // 1. 애니메이션 클래스 추가
    card.classList.add('fade-out');

    // 2. State 및 로컬 저장소 갱신
    let targetId = '';
    if (type === 'ingredients') targetId = item.name_ko;
    else if (type === 'recipes') targetId = item.id;
    else if (type === 'holidays') targetId = item.id;

    State.favorites[type] = State.favorites[type].filter(id => id !== targetId);
    saveFavoritesToStorage(type);

    // 3. 0.35초 후 DOM 제거 및 빈 상태 검증
    setTimeout(() => {
      card.remove();
      const remainCards = document.querySelectorAll('.favorites-grid .card');
      if (remainCards.length === 0) {
        document.getElementById('emptyState').style.display = 'flex';
      }
    }, 350);
  });

  return card;
}

// 현재 탭 렌더링
function renderCurrentTab() {
  const listEl = document.getElementById('favoritesList');
  const emptyStateEl = document.getElementById('emptyState');
  listEl.innerHTML = '';

  const favList = State.favorites[State.currentTab];
  let itemsToRender = [];

  if (State.currentTab === 'ingredients') {
    itemsToRender = State.ingredientsData.filter(i => favList.includes(i.name_ko));
  } else if (State.currentTab === 'recipes') {
    itemsToRender = State.recipesData.filter(r => favList.includes(r.id));
  } else if (State.currentTab === 'holidays') {
    itemsToRender = State.holidaysData.filter(h => favList.includes(h.id));
  }

  if (itemsToRender.length === 0) {
    emptyStateEl.style.display = 'flex';
    listEl.style.display = 'none';
  } else {
    emptyStateEl.style.display = 'none';
    listEl.style.display = 'grid';

    itemsToRender.forEach(item => {
      const card = createCardElement(item, State.currentTab);
      listEl.appendChild(card);
    });
  }
}

// 탭 클릭 핸들러 설정
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      State.currentTab = tab.dataset.tab;
      renderCurrentTab();
    });
  });
}

// 백업 & 복구 설정
function initBackupAndRestore() {
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');

  btnExport?.addEventListener('click', () => {
    try {
      const dataStr = JSON.stringify(State.favorites);
      // Base64 인코딩을 통해 텍스트 복사가 쉽도록 만듦
      const backupCode = btoa(encodeURIComponent(dataStr));
      
      navigator.clipboard.writeText(backupCode).then(() => {
        alert('📋 백업 코드가 클립보드에 복사되었습니다!\n메모장 등에 붙여넣어 보관하세요.');
      }).catch(() => {
        // 클립보드 복사 API 비지원 대비
        prompt('아래 코드를 복사하여 보관하세요:', backupCode);
      });
    } catch (e) {
      alert('백업 코드를 생성하는 데 실패했습니다.');
    }
  });

  btnImport?.addEventListener('click', () => {
    const code = prompt('보관해 두신 백업 코드를 붙여넣어 주세요:');
    if (!code) return;

    try {
      const decodedStr = decodeURIComponent(atob(code.trim()));
      const importedFavorites = JSON.parse(decodedStr);

      // 데이터 규격 검증
      if (
        importedFavorites &&
        Array.isArray(importedFavorites.ingredients) &&
        Array.isArray(importedFavorites.recipes) &&
        Array.isArray(importedFavorites.holidays)
      ) {
        // 로컬 저장소에 덮어쓰기
        localStorage.setItem(STORAGE_KEYS.ingredients, JSON.stringify(importedFavorites.ingredients));
        localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(importedFavorites.recipes));
        localStorage.setItem(STORAGE_KEYS.holidays, JSON.stringify(importedFavorites.holidays));

        alert('📥 즐겨찾기 목록이 완벽하게 복원되었습니다!');
        window.location.reload();
      } else {
        throw new Error('올바르지 않은 데이터 형식');
      }
    } catch (e) {
      alert('❌ 올바른 백업 코드가 아닙니다. 코드를 다시 확인해 주세요.');
    }
  });
}

// 메인 초기화
async function init() {
  applySeasonTheme();
  loadFavoritesFromStorage();
  initTabs();
  initBackupAndRestore();

  // 데이터 로딩 중 표시
  const listEl = document.getElementById('favoritesList');
  listEl.innerHTML = '<div class="loading">데이터를 불러오는 중입니다...</div>';

  await fetchData();
  renderCurrentTab();
}

document.addEventListener('DOMContentLoaded', init);
