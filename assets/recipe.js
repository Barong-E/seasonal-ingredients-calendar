// 레시피 페이지 스크립트

let currentRecipe = null;
let baseServings = 2;
let currentServings = 2;
let wakeLock = null;
let isWakeLockEnabled = true;

// 🕯️ 잠들지 않는 마법의 촛불 (Wake Lock API)
async function requestWakeLock() {
  if (!isWakeLockEnabled) {
    updateWakeLockUI(false);
    return;
  }
  if ('wakeLock' in navigator) {
    try {
      if (wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock 활성화 (화면 켜짐 유지)');
      updateWakeLockUI(true);
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock 해제됨');
        wakeLock = null;
        updateWakeLockUI(false);
      });
    } catch (err) {
      console.error('Wake Lock 요청 실패:', err);
      updateWakeLockUI(false);
    }
  } else {
    updateWakeLockUI(false);
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('Wake Lock 사용자 요청으로 해제됨');
    } catch (err) {
      console.error('Wake Lock 해제 실패:', err);
    }
  }
  updateWakeLockUI(false);
}

function updateWakeLockUI(isActive) {
  const badge = document.getElementById('wakeLockBadge');
  if (!badge) return;
  if (isActive) {
    badge.classList.add('active');
    badge.innerHTML = '<span class="badge-icon">💡</span>화면 켜짐 유지 중';
    badge.title = '요리 중 화면이 꺼지지 않도록 보호하고 있습니다.';
  } else {
    badge.classList.remove('active');
    badge.innerHTML = '<span class="badge-icon">🌙</span>화면 자동 꺼짐 (절전)';
    badge.title = '배터리 절전 모드이거나 브라우저에서 지원하지 않습니다.';
  }
}

// URL에서 레시피 ID 추출 (query, hash, path 모두 지원)
function getRecipeIdFromUrl() {
  const url = new URL(window.location.href);
  // 1) query ?id=...
  const fromQuery = url.searchParams.get('id');
  if (fromQuery) return fromQuery;
  // 2) hash #id 또는 #/id
  const hash = (url.hash || '').replace(/^#\/?/, '').trim();
  if (hash) return decodeURIComponent(hash);
  // 3) path /recipe/:id 또는 /recipe.html/:id 같은 형태 대비
  const m = url.pathname.match(/\/recipe(?:\.html)?\/([^/?#]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  return null;
}

// 레시피 데이터 로드
async function loadRecipe(recipeId) {
  try {
    const res = await fetch('data/recipes.json?v=v52');
    if (!res.ok) throw new Error('레시피 데이터 로드 실패');
    const recipes = await res.json();
    return recipes.find(recipe => recipe.id === recipeId);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 🔬 마법의 요리 저울 v2 — 스마트 파싱 및 계산 엔진
//
// 이 함수는 요리사가 쓰는 레시피 문자열을 마치
// "우리 반 수학 선생님"처럼 읽고 변환해 줘요.
//
// 예를 들어, 선생님이 칠판에 "소금 1꼬집" 이라고 쓰면
// 2인분으로 바꿀 때 "소금 2꼬집"이 되고,
// 4꼬집이 넘어가면 "소금 1T스푼"으로 자동으로 더 쉬운
// 계량 단위로 바꿔주는 식이에요.
//
// 📌 물/육수 계열은 80% 감쇠 공식 적용
//    (라면 물이 2배가 되면 국물이 한강이 되기 때문!)
// ─────────────────────────────────────────────────────────────
function parseAndCalculateAmount(name, amountStr, baseS, currS) {
  // 양이 없으면 빈 문자열 반환
  if (!amountStr) return '';
  // 인분 수가 같으면 바꿀 필요 없음
  if (baseS === currS) return amountStr;

  const str = amountStr.trim();

  // ─── 🌿 단계 1: 취향껏·기호껏 같은 완전 주관적 표현은 무조건 유지 ────
  // "취향껏" 넣는 건 아무도 정량화 못 해요!
  const absolutelySubjective = ['취향껏', '기호껏', '취향에 따라', '원하는 만큼', '알맞게 조절', '넉넉히 (찜통 깔기용, 생략 가능)', '적당량 (찜통 깔기용, 생략 가능)'];
  if (absolutelySubjective.includes(str)) return str;

  // ─── 🫙 단계 2: "1줌 / 한줌" → "종이컵" 단위로 표준화 후 계산 ──────────
  // "줌"은 사람 손 크기마다 달라서 너무 애매해요.
  // 1줌 = 약 1종이컵(약 100ml)으로 표준화합니다.
  let normalizedStr = str;
  if (str === '1줌' || str === '한줌') normalizedStr = '1종이컵';
  else if (str === '반줌') normalizedStr = '0.5종이컵';
  else if (str === '각 한 줌' || str === '각 1줌') normalizedStr = '각 1종이컵';
  // 이 아래 계산에서 normalizedStr을 사용



  // ─── 🧮 단계 4: 일반 숫자·분수 파싱 및 곱하기 ───────────────────────────
  // "200g", "1/2개", "1.5컵" 처럼 숫자가 있는 경우
  // 숫자와 단위(g, ml, 개 등)를 분리해서 계산해요.
  const match = normalizedStr.match(/^([\d/.]+)\s*(.*)$/);
  if (!match) return normalizedStr; // 숫자가 없으면 그냥 반환

  let numStr = match[1];
  const unit = match[2];

  // 분수 처리: "1/2" → 0.5로 변환
  // 마치 수학 시간에 분수를 소수로 바꾸는 것처럼!
  let numVal = 0;
  if (numStr.includes('/')) {
    const parts = numStr.split('/');
    if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
      numVal = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      return normalizedStr;
    }
  } else {
    numVal = parseFloat(numStr);
  }

  if (isNaN(numVal)) return normalizedStr;

  let calculated = 0;

  // ─── 💧 단계 5: 물/육수 계열은 80% 황금 감쇠 공식 ───────────────────────
  // 라면 국물의 비밀!
  // 냄비에서 수증기로 날아가는 물의 양은 인분 수에 비례하지 않아요.
  // 공식: 1인분 물의 양 × [ 1 + (인분수 - 1) × 0.8 ]
  const waterKeywords = ['물', '육수', '쌀뜨물', '다시마물', '멸치육수', '채수', '사골육수'];
  const isWater = waterKeywords.some(kw => name.includes(kw));

  if (isWater) {
    const oneServing = numVal / baseS;
    calculated = oneServing * (1 + (currS - 1) * 0.8);
  } else {
    // 일반 재료는 인분 비율 그대로 곱하기
    calculated = (numVal / baseS) * currS;
  }

  // ─── ⚖️ 단계 7: 무게(g) 단위일 때 저울 없는 사람을 위한 스마트 괄호 일상 단위 추가 ───
  let appendStr = '';
  if (unit.trim().startsWith('g')) {
    // 0.5 단위로 반올림하는 헬퍼 함수
    const roundHalf = val => Math.round(val * 2) / 2;

    if (name.includes('가루') || name.includes('밀가루') || name.includes('설탕') || name.includes('소금') || name.includes('된장') || name.includes('고추장') || name.includes('버터')) {
      if (calculated >= 50) {
        // 100g ≈ 1종이컵 (50g 이상일 때 0.5컵 단위 표기)
        const cups = roundHalf(calculated / 100);
        appendStr = ` (약 ${cups}종이컵)`;
      } else {
        // 1큰술 = 15g, 1작은술 = 5g (큰술의 1/3)
        let tbs = Math.floor(calculated / 15);
        let rem = calculated % 15;
        let tsp = Math.round(rem / 5); // 작은술 소수점 없이 반올림

        // 작은술이 3이 되면 1큰술로 승급!
        if (tsp >= 3) {
          tbs += 1;
          tsp = 0;
        }

        let parts = [];
        if (tbs > 0) parts.push(`${tbs}큰술`);
        if (tsp > 0) parts.push(`${tsp}작은술`);
        if (parts.length === 0) parts.push('1작은술');

        appendStr = ` (약 ${parts.join(' ')})`;
      }
    } else if (['감자', '양파', '고구마', '당근', '애호박', '오이', '사과', '배', '토마토', '피망', '파프리카'].some(kw => name.includes(kw))) {
      // 200g ≈ 1개
      const cnt = roundHalf(calculated / 200);
      appendStr = ` (약 ${cnt < 0.5 ? 0.5 : cnt}개)`;
    } else if (name.includes('무') || name.includes('배추') || name.includes('단호박')) {
      if (calculated >= 90) {
        // 180g ≈ 1종이컵 부피 (90g 이상일 때 0.5컵 단위 표기)
        const cups = roundHalf(calculated / 180);
        appendStr = ` (약 ${cups}종이컵 부피)`;
      } else {
        const tbs = Math.round((calculated / 15) * 2) / 2;
        appendStr = ` (약 ${tbs < 0.5 ? 0.5 : tbs}큰술)`;
      }
    } else if (['쑥', '냉이', '달래', '부추', '미나리', '깻잎', '상추', '시금치', '콩나물', '숙주', '고사리', '버섯', '파', '갓', '쪽파'].some(kw => name.includes(kw))) {
      // 50g ≈ 1줌
      const jum = roundHalf(calculated / 50);
      appendStr = ` (약 ${jum < 0.5 ? 0.5 : jum}줌)`;
    } else {
      // 육류 / 해산물 / 기타: 180g ≈ 1종이컵
      if (calculated >= 90) {
        // 90g 이상일 때 0.5컵 단위 표기
        const cups = roundHalf(calculated / 180);
        appendStr = ` (약 ${cups}종이컵)`;
      } else {
        const tbs = Math.round((calculated / 15) * 2) / 2;
        appendStr = ` (약 ${tbs < 0.5 ? 0.5 : tbs}큰술)`;
      }
    }
  }

  // ─── 🔧 단계 8: 모든 단위에 대한 소수점·작은 값 범용 후처리 ────────────────
  const cu = unit.trim();

  // ── 컵 / 종이컵 ──────────────────────────────────────────────────────────
  if (cu === '컵' || cu === '종이컵') {
    if (calculated < 0.5) {
      const tbs = Math.round((calculated * 16) * 2) / 2;
      return `약 ${tbs < 0.5 ? 0.5 : tbs}큰술`;
    }
    const halfCup = Math.round(calculated * 2) / 2;
    return `${halfCup}${cu}${appendStr}`;
  }

  // ── 큰술 ──────────────────────────────────────────────────────────────────
  if (cu === '큰술') {
    if (calculated < 0.5) {
      const tsp = Math.round(calculated * 3 * 2) / 2; // 작은술로 변환하되 0.5단위 반올림
      return `${tsp < 0.5 ? 0.5 : tsp}작은술`;
    }
    const halfTbs = Math.round(calculated * 2) / 2;
    return `${halfTbs}큰술`;
  }

  // ── 작은술 ────────────────────────────────────────────────────────────────
  if (cu === '작은술') {
    const tsp = Math.round(calculated * 2) / 2; // 0.5 단위 반올림
    return `${tsp < 0.5 ? 0.5 : tsp}작은술`;
  }

  // ── kg → g 변환 ───────────────────────────────────────────────────────────
  if (cu === 'kg') {
    if (calculated < 0.5) {
      const grams = Math.round(calculated * 1000);
      return `${grams}g`;
    }
    const halfKg = Math.round(calculated * 2) / 2;
    return `${halfKg}kg`;
  }

  // ── L → ml 변환 ───────────────────────────────────────────────────────────
  if (cu === 'L') {
    if (calculated < 0.5) {
      const ml = Math.round(calculated * 1000);
      return `${ml}ml`;
    }
    const halfL = Math.round(calculated * 2) / 2;
    return `${halfL}L`;
  }

  // ── ml ────────────────────────────────────────────────────────────────────
  if (cu === 'ml') {
    return `${Math.round(calculated)}ml`;
  }

  // ── 개 / 대 / 마리 / 장 / 알 / 송이 / 조각 / 쪽 / 모 / 토막 등 셀 수 있는 단위 ──
  const countUnits = ['개', '대', '마리', '장', '알', '송이', '조각', '쪽', '모', '토막', '공기', '봉지', '팩', '톨', '줄', '포기', '인분'];
  if (countUnits.includes(cu)) {
    const halfVal = Math.round(calculated * 2) / 2;
    return `${halfVal < 0.5 ? 0.5 : halfVal}${cu}`;
  }

  const finalVal = Math.round(calculated * 10) / 10;
  return `${finalVal}${unit}${appendStr}`;
}

// 레시피 렌더링
function renderRecipe(recipe) {
  hideLoading();
  if (!recipe) {
    showError();
    return;
  }

  // 기본 정보
  document.getElementById('recipeName').textContent = recipe.name;
  document.getElementById('recipeDescription').textContent = recipe.description;

  // 이미지 렌더링
  const recipeImg = document.getElementById('recipeImage');
  if (recipeImg) {
    if (recipe.image) {
      recipeImg.src = `images/${recipe.image}`;
      recipeImg.alt = `${recipe.name} 이미지`;
    } else {
      recipeImg.src = 'images/_fallback.png';
      recipeImg.alt = '이미지 준비 중';
    }
  }

  const unit = recipe.servingsUnit || '인분';
  document.getElementById('recipeServings').textContent = `${currentServings}${unit}`;
  document.getElementById('recipeCookTime').textContent = recipe.cookTime;
  document.getElementById('recipeDifficulty').textContent = recipe.difficulty;

  // 재료
  renderIngredients(recipe.ingredients);

  // 양념
  if (recipe.seasoning && recipe.seasoning.length > 0) {
    renderSeasoning(recipe.seasoning);
  }

  // 조리 과정
  renderSteps(recipe.steps);

  // 팁
  if (recipe.tips && recipe.tips.length > 0) {
    renderTips(recipe.tips);
  }

  document.title = `${recipe.name} 레시피 - 띵동 제철음식`;
}

// 재료 렌더링
function renderIngredients(ingredients) {
  const container = document.getElementById('ingredientsList');
  container.innerHTML = '';

  ingredients.forEach(ingredient => {
    const item = document.createElement('div');
    item.className = 'ingredient-item';

    // 제철 식재료 목록과 매칭 검사
    const matched = seasonalIngredientsList.find(s => s.name_ko === ingredient.name || ingredient.name.includes(s.name_ko));

    let nameHtml = `<span class="ingredient-name">${ingredient.name}</span>`;
    if (matched) {
      nameHtml = `<a href="ingredient.html?id=${encodeURIComponent(matched.name_ko)}" class="ingredient-name recipe-link-item" title="${matched.name_ko} 제철 정보 보기">${ingredient.name}</a>`;
    }

    const calcAmount = parseAndCalculateAmount(ingredient.name, ingredient.amount, baseServings, currentServings);

    item.innerHTML = `
      ${nameHtml}
      <span class="ingredient-amount">${calcAmount}</span>
    `;
    container.appendChild(item);
  });
}

// 양념 렌더링
function renderSeasoning(seasoning) {
  const section = document.getElementById('seasoningSection');
  const container = document.getElementById('seasoningList');
  section.style.display = 'block';
  container.innerHTML = '';

  seasoning.forEach(item => {
    const seasoningItem = document.createElement('div');
    seasoningItem.className = 'ingredient-item';
    const calcAmount = parseAndCalculateAmount(item.name, item.amount, baseServings, currentServings);
    seasoningItem.innerHTML = `
      <span class="ingredient-name">${item.name}</span>
      <span class="ingredient-amount">${calcAmount}</span>
    `;
    container.appendChild(seasoningItem);
  });
}

// 조리 과정 렌더링
function renderSteps(steps) {
  const container = document.getElementById('stepsList');
  container.innerHTML = '';

  steps.forEach((step, index) => {
    const item = document.createElement('div');
    item.className = 'step-item';
    item.innerHTML = `
      <div class="step-number">${step.step}</div>
      <div class="step-content">
        <p class="step-description">${step.description}</p>
      </div>
    `;
    container.appendChild(item);
  });
}

// 팁 렌더링
function renderTips(tips) {
  const section = document.getElementById('tipsSection');
  const container = document.getElementById('tipsList');
  section.style.display = 'block';
  container.innerHTML = '';

  tips.forEach(tip => {
    const item = document.createElement('li');
    item.className = 'tip-item';
    item.textContent = tip;
    container.appendChild(item);
  });
}

// 에러 표시
function showError() {
  hideLoading();
  const container = document.querySelector('.recipe-container');
  const error = document.createElement('div');
  error.className = 'recipe-error';
  error.innerHTML = `
      <div class="error-icon">😕</div>
      <p class="error-message">레시피를 찾을 수 없습니다.</p>
      <button class="error-button" onclick="goBack()">돌아가기</button>
  `;
  container.innerHTML = '';
  container.appendChild(error);
}

// 로딩 표시
function showLoading() {
  const container = document.querySelector('.recipe-container');
  if (!container) return;
  if (document.getElementById('recipeLoading')) return;
  const loading = document.createElement('div');
  loading.id = 'recipeLoading';
  loading.className = 'recipe-loading';
  loading.textContent = '로딩 중...';
  container.appendChild(loading);
}

function hideLoading() {
  const loading = document.getElementById('recipeLoading');
  if (loading) loading.remove();
}

// 뒤로 가기
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

// 제철 식재료 목록 로드 (단어장 매칭용)
let seasonalIngredientsList = [];

async function loadSeasonalIngredients() {
  try {
    const res = await fetch('data/ingredients.json?v=v52');
    if (res.ok) {
      seasonalIngredientsList = await res.json();
    }
  } catch (err) {
    console.error('제철 식재료 목록 로드 실패', err);
  }
}

// 단위 기반 분량 단계 및 한계점 구하기
function getServingsStep(recipe) {
  const unit = recipe.servingsUnit || '인분';
  if (unit === '개') return 5;
  if (unit === 'g') return 500;
  if (unit === 'ml') return 500;
  if (unit === 'kg') return 1;
  return 1;
}

function getServingsLimits(recipe) {
  const step = getServingsStep(recipe);
  return {
    min: step,
    max: step * 10
  };
}

// 초기화
async function init() {
  const recipeId = getRecipeIdFromUrl();

  if (!recipeId) {
    showError();
    return;
  }

  const header = document.querySelector('.app-header');
  if (header) {
    const headerH = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-offset', headerH + 'px');
  }

  showLoading();

  await loadSeasonalIngredients();

  currentRecipe = await loadRecipe(recipeId);
  if (!currentRecipe) {
    showError();
    return;
  }

  // 즐겨찾기 로직 추가
  const favBtn = document.getElementById('favoriteButton');
  if (favBtn) {
    const STORAGE_KEY = 'seasons:favorites:recipes';
    let favorites = [];
    try {
      favorites = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {}

    const isFav = favorites.includes(currentRecipe.id);
    if (isFav) {
      favBtn.classList.add('active');
      favBtn.setAttribute('aria-label', '즐겨찾기 해제');
    }

    favBtn.onclick = () => {
      try {
        favorites = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch {}

      const index = favorites.indexOf(currentRecipe.id);
      if (index > -1) {
        favorites.splice(index, 1);
        favBtn.classList.remove('active');
        favBtn.setAttribute('aria-label', '즐겨찾기 추가');
      } else {
        favorites.push(currentRecipe.id);
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-label', '즐겨찾기 해제');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    };
  }

  baseServings = currentRecipe.servings || 2;
  const step = getServingsStep(currentRecipe);
  const limits = getServingsLimits(currentRecipe);
  const savedServings = localStorage.getItem(`user_preferred_servings_${currentRecipe.id}`);
  currentServings = savedServings ? parseInt(savedServings, 10) : baseServings;
  if (isNaN(currentServings) || currentServings < limits.min || currentServings > limits.max || currentServings % step !== 0) {
    currentServings = baseServings;
  }

  renderRecipe(currentRecipe);

  // 뒤로 가기 버튼
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', goBack);
  }

  // 인분 조절 버튼 이벤트 리스너
  const btnMinus = document.getElementById('btnMinusServings');
  const btnPlus = document.getElementById('btnPlusServings');

  if (btnMinus) {
    btnMinus.addEventListener('click', () => {
      const step = getServingsStep(currentRecipe);
      const limits = getServingsLimits(currentRecipe);
      if (currentServings > limits.min) {
        currentServings -= step;
        localStorage.setItem(`user_preferred_servings_${currentRecipe.id}`, currentServings);
        document.getElementById('recipeServings').textContent = `${currentServings}${currentRecipe.servingsUnit || '인분'}`;
        renderIngredients(currentRecipe.ingredients);
        if (currentRecipe.seasoning && currentRecipe.seasoning.length > 0) renderSeasoning(currentRecipe.seasoning);
      }
    });
  }

  if (btnPlus) {
    btnPlus.addEventListener('click', () => {
      const step = getServingsStep(currentRecipe);
      const limits = getServingsLimits(currentRecipe);
      if (currentServings < limits.max) {
        currentServings += step;
        localStorage.setItem(`user_preferred_servings_${currentRecipe.id}`, currentServings);
        document.getElementById('recipeServings').textContent = `${currentServings}${currentRecipe.servingsUnit || '인분'}`;
        renderIngredients(currentRecipe.ingredients);
        if (currentRecipe.seasoning && currentRecipe.seasoning.length > 0) renderSeasoning(currentRecipe.seasoning);
      }
    });
  }

  // 화면 켜짐 유지 사용자 설정 로드 및 적용
  const savedWakeLock = localStorage.getItem('user_wakelock_enabled');
  isWakeLockEnabled = savedWakeLock !== 'false';

  const toggle = document.getElementById('wakeLockToggle');
  if (toggle) {
    toggle.checked = isWakeLockEnabled;
    toggle.addEventListener('change', async (e) => {
      isWakeLockEnabled = e.target.checked;
      localStorage.setItem('user_wakelock_enabled', isWakeLockEnabled);
      if (isWakeLockEnabled) {
        await requestWakeLock();
      } else {
        await releaseWakeLock();
      }
    });
  }

  // 화면 켜짐 유지 요청 및 가시성 변경 감지
  await requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

