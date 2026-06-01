import { Capacitor } from '@capacitor/core';
import KoreanLunarCalendar from 'korean-lunar-calendar';

// 뒤로가기 전역 함수 정의
window.handleSmartBack = function(fallbackUrl) {
  if (window.history.length <= 1) {
    window.location.href = fallbackUrl || 'index.html';
  } else {
    window.history.back();
  }
};

// 글로벌 상태 관리
const SearchState = {
  currentTab: 'ingredients', // 'ingredients', 'holidays', 'recipes', 'recommendations'
  searchText: '',
  ingredientsData: [],
  holidaysData: [],
  recipesData: [],
  results: {
    ingredients: [],
    holidays: [],
    recipes: [],
    recommendations: []
  }
};

// 테마 컬러 적용
function applySeasonTheme() {
  const currentMonth = new Date().getMonth() + 1;
  let season = 'autumn';
  if (currentMonth === 12 || currentMonth === 1 || currentMonth === 2) season = 'winter';
  else if (currentMonth >= 3 && currentMonth <= 5) season = 'spring';
  else if (currentMonth >= 6 && currentMonth <= 8) season = 'summer';

  document.body.classList.remove('theme-spring', 'theme-summer', 'theme-autumn', 'theme-winter');
  document.body.classList.add(`theme-${season}`);
}

// 명절 날짜 계산 관련 헬퍼 함수군 (holidays-list.js의 로직 활용)
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
  return new Date(year, 1, dayVal);
}

function getHajiDateForYear(year) {
  const dY = year - 2000;
  const base = 21.533;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 5, dayVal);
}

function getIpchuDateForYear(year) {
  const dY = year - 2000;
  const base = 7.65;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 7, dayVal);
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
  const overrideDate = getSolarOverrideDate(holiday, year);
  if (overrideDate) return overrideDate;

  if (holiday.id === 'hansik') {
    const dongjiDate = getDongjiDateForYear(year - 1);
    if (!dongjiDate) return null;
    const hansikDate = new Date(dongjiDate);
    hansikDate.setDate(hansikDate.getDate() + 105);
    return hansikDate;
  }

  if (holiday.id === 'seotdal') {
    const calendar = new KoreanLunarCalendar();
    let ok = calendar.setLunarDate(year, 12, 30, false);
    if (!ok) ok = calendar.setLunarDate(year, 12, 29, false);
    if (!ok) return null;
    const solar = calendar.getSolarCalendar();
    if (!solar || !solar.year || !solar.month || !solar.day) return null;
    return new Date(solar.year, solar.month - 1, solar.day);
  }

  if (holiday.id === 'ipchun') return getIpchunDateForYear(year);
  if (holiday.id === 'chobok') return getChobokDateForYear(year);
  if (holiday.id === 'jungbok') return getJungbokDateForYear(year);
  if (holiday.id === 'malbok') return getMalbokDateForYear(year);

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
  if (holiday.date.name === '동지') return getDongjiDateForYear(year);
  return null;
}

function getHolidaySolarDate(holiday, today) {
  const baseYear = today.getFullYear();
  return getHolidaySolarDateForYear(holiday, baseYear);
}

function formatDateString(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

// 제철 시기 텍스트 변환 헬퍼 함수
function getMonthsRangeText(months) {
  if (!months || months.length === 0) return '';
  if (months.length === 1) return `${months[0]}월`;

  const sorted = [...months].sort((a, b) => a - b);

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

// 데이터 로딩
async function loadAllData() {
  const cacheVersion = 'v44';
  try {
    const [ingRes, holRes, recRes] = await Promise.all([
      fetch(`data/ingredients.json?v=${cacheVersion}`).then(r => r.ok ? r.json() : []),
      fetch(`data/holidays.json?v=v11`).then(r => r.ok ? r.json() : []),
      fetch(`data/recipes.json?v=${cacheVersion}`).then(r => r.ok ? r.json() : [])
    ]);

    SearchState.ingredientsData = ingRes;
    SearchState.holidaysData = holRes;
    SearchState.recipesData = recRes;
  } catch (err) {
    console.error('데이터 로드 실패', err);
  }
}

// 검색어 매칭 필터링 수행
function performSearch() {
  const query = (SearchState.searchText || '').trim().toLowerCase();
  
  if (!query) {
    SearchState.results = {
      ingredients: [],
      holidays: [],
      recipes: [],
      recommendations: []
    };
    return;
  }

  // 1. 식재료 검색
  SearchState.results.ingredients = SearchState.ingredientsData.filter(item => {
    const hay = `${item.name_ko || ''} ${item.category || ''} ${item.description_ko || ''} ${item.popular_dish || ''}`.toLowerCase();
    return hay.includes(query);
  });

  // 2. 명절·절기 검색
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  SearchState.results.holidays = SearchState.holidaysData.map(h => {
    const solarDate = getHolidaySolarDate(h, today);
    return { ...h, solarDate };
  }).filter(h => {
    const foodNames = (h.details?.foods || []).map(f => f.name).join(' ');
    const customNames = (h.details?.customs || []).map(c => c.name).join(' ');
    const hay = `${h.name || ''} ${h.main_food || ''} ${h.summary || ''} ${foodNames} ${customNames}`.toLowerCase();
    return hay.includes(query);
  });

  // 3. 레시피 검색
  SearchState.results.recipes = SearchState.recipesData.filter(recipe => {
    const ingredientNames = (recipe.ingredients || []).map(i => i.name).join(' ');
    const seasoningNames = (recipe.seasoning || []).map(s => s.name).join(' ');
    const stepsText = (recipe.steps || []).map(s => s.description).join(' ');
    const tipsText = (recipe.tips || []).join(' ');
    const hay = `${recipe.name || ''} ${recipe.category || ''} ${recipe.description || ''} ${ingredientNames} ${seasoningNames} ${stepsText} ${tipsText}`.toLowerCase();
    return hay.includes(query);
  });

  // 4. 추천 검색 (recommended_for 기준 식재료 매칭)
  SearchState.results.recommendations = SearchState.ingredientsData.filter(item => {
    if (!item.recommended_for || !Array.isArray(item.recommended_for)) return false;
    return item.recommended_for.some(rec => rec.toLowerCase().includes(query));
  });
}

// 탭 카운트 뱃지 갱신
function updateTabCounts() {
  document.getElementById('count-ingredients').textContent = SearchState.results.ingredients.length;
  document.getElementById('count-holidays').textContent = SearchState.results.holidays.length;
  document.getElementById('count-recipes').textContent = SearchState.results.recipes.length;
  document.getElementById('count-recommendations').textContent = SearchState.results.recommendations.length;
}

// 탭별 결과물 카드 그리기
function renderResults() {
  const container = document.getElementById('searchResultList');
  const emptyState = document.getElementById('emptyState');
  container.innerHTML = '';

  const activeTab = SearchState.currentTab;
  const list = SearchState.results[activeTab];

  if (!SearchState.searchText.trim()) {
    emptyState.querySelector('.empty-state__title').textContent = '검색어를 입력해 주세요';
    emptyState.querySelector('.empty-state__desc').textContent = '식재료, 명절, 레시피, 추천 키워드로 찾을 수 있어요!';
    emptyState.style.display = 'flex';
    container.style.display = 'none';
    return;
  }

  if (list.length === 0) {
    emptyState.querySelector('.empty-state__title').textContent = '검색 결과가 없습니다';
    emptyState.querySelector('.empty-state__desc').textContent = '다른 키워드로 검색해 보세요!';
    emptyState.style.display = 'flex';
    container.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'grid';

  if (activeTab === 'ingredients') {
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      const monthText = getMonthsRangeText(item.months);
      const dishText = item.popular_dish ? item.popular_dish.split(',')[0].trim() : '';

      let infoParts = [];
      if (monthText) infoParts.push(`🗓️ ${monthText}`);
      if (dishText) infoParts.push(`🍲 ${dishText}`);
      const subText = infoParts.join(' · ');

      card.innerHTML = `
        <div class="thumb" aria-hidden="true">
          <img class="photo" src="images/${item.image || '_fallback.png'}" alt="${item.name_ko} 이미지" onerror="this.onerror=null; this.src='images/_fallback.png';" />
        </div>
        <div class="card-content">
          <h2 class="title">${item.name_ko}</h2>
          ${subText ? `<div class="popular-dish"><span class="popular-dish-value">${subText}</span></div>` : ''}
        </div>
      `;

      card.onclick = () => {
        window.location.href = `ingredient.html?id=${encodeURIComponent(item.name_ko)}`;
      };
      container.appendChild(card);
    });
  } 
  
  else if (activeTab === 'holidays') {
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      const dateStr = formatDateString(item.solarDate);
      const subText = `🗓️ ${dateStr}`;

      card.innerHTML = `
        <div class="thumb" aria-hidden="true">
          <img class="photo" src="images/${item.image || '_fallback.png'}" alt="${item.name} 이미지" onerror="this.onerror=null; this.src='images/_fallback.png';" />
        </div>
        <div class="card-content">
          <h2 class="title">${item.name}</h2>
          <div class="popular-dish"><span class="popular-dish-value">${subText}</span></div>
        </div>
      `;

      card.onclick = () => {
        window.location.href = `holiday.html?id=${encodeURIComponent(item.id)}`;
      };
      container.appendChild(card);
    });
  } 
  
  else if (activeTab === 'recipes') {
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      const ingredientNames = (item.ingredients || []).map(ing => ing.name).join(', ');
      const subText = `🥕 재료: ${ingredientNames}`;

      card.innerHTML = `
        <div class="thumb" aria-hidden="true">
          <img class="photo" src="images/${item.image || '_fallback.png'}" alt="${item.name} 이미지" onerror="this.onerror=null; this.src='images/_fallback.png';" />
        </div>
        <div class="card-content">
          <h2 class="title">${item.name}</h2>
          <div class="popular-dish"><span class="popular-dish-value">${subText}</span></div>
        </div>
      `;

      card.onclick = () => {
        window.location.href = `recipe.html#${encodeURIComponent(item.id)}`;
      };
      container.appendChild(card);
    });
  } 
  
  else if (activeTab === 'recommendations') {
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');

      const monthText = getMonthsRangeText(item.months);
      
      // 검색어가 매칭된 추천 대상 항목 찾아내기
      const query = SearchState.searchText.trim().toLowerCase();
      const matchedRec = item.recommended_for.find(rec => rec.toLowerCase().includes(query)) || item.recommended_for[0];

      card.innerHTML = `
        <div class="thumb" aria-hidden="true">
          <img class="photo" src="images/${item.image || '_fallback.png'}" alt="${item.name_ko} 이미지" onerror="this.onerror=null; this.src='images/_fallback.png';" />
        </div>
        <div class="card-content">
          <h2 class="title">${item.name_ko}</h2>
          <div class="popular-dish" style="margin-bottom: 2px;">
            <span class="popular-dish-value">🗓️ 제철: ${monthText}</span>
          </div>
          <div class="rec-badge-wrap" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
            <span class="recommended-badge" style="background: rgba(10, 123, 52, 0.08); color: #0A7B34; padding: 2px 8px; border-radius: 8px; font-size: 0.72rem; font-weight: 600;">👍 ${matchedRec}</span>
          </div>
        </div>
      `;

      card.onclick = () => {
        window.location.href = `ingredient.html?id=${encodeURIComponent(item.name_ko)}`;
      };
      container.appendChild(card);
    });
  }
}

// 탭 버튼 클릭 설정
function initTabs() {
  const tabs = document.querySelectorAll('.search-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      SearchState.currentTab = tab.dataset.tab;
      renderResults();
    });
  });
}

// 검색창 입력 이벤트 및 폼 서브밋 설정
function initSearchEvents() {
  const searchInput = document.getElementById('searchInput');
  const filtersForm = document.getElementById('filtersForm');

  if (!searchInput || !filtersForm) return;

  // 인풋 입력 시 실시간 반영
  searchInput.addEventListener('input', (e) => {
    SearchState.searchText = e.target.value;
    performSearch();
    updateTabCounts();
    renderResults();
  });

  // 엔터 누를 시 포커스 아웃 처리 (모바일 키보드 닫기)
  filtersForm.addEventListener('submit', (e) => {
    e.preventDefault();
    searchInput.blur();
  });
}

// 초기 로드 시 URL 파라미터 파싱
function parseQueryFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q') || '';
  SearchState.searchText = q;
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = q;
    searchInput.focus();
  }
}

// 메인 초기화
async function init() {
  applySeasonTheme();
  initTabs();
  initSearchEvents();

  // 대기 문구 렌더링
  const container = document.getElementById('searchResultList');
  container.innerHTML = '<div class="loading">데이터를 검색하는 중입니다...</div>';

  await loadAllData();
  parseQueryFromUrl();
  performSearch();
  updateTabCounts();
  renderResults();
}

document.addEventListener('DOMContentLoaded', init);
