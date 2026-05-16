// 레시피 페이지 스크립트

let currentRecipe = null;
let baseServings = 2;
let currentServings = 2;

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
    const res = await fetch('data/recipes.json?v=v39');
    if (!res.ok) throw new Error('레시피 데이터 로드 실패');
    const recipes = await res.json();
    return recipes.find(recipe => recipe.id === recipeId);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// 스마트 파싱 및 계산 엔진 (마법의 저울 + 물양 80% 감쇠 공식)
function parseAndCalculateAmount(name, amountStr, baseS, currS) {
  if (!amountStr) return '';
  if (baseS === currS) return amountStr;

  const str = amountStr.trim();
  // 숫자가 없는 감성 표현은 그대로 유지
  const emotionalWords = ['약간', '적당량', '취향껏', '한 꼬집', '톡톡', '조금', '약간씩', '적당히', '1줌', '한줌', '반줌'];
  if (emotionalWords.includes(str)) return str;

  // 숫자(또는 분수)와 단위 분리 정규식
  const match = str.match(/^([\d/.]+)\s*(.*)$/);
  if (!match) return str;

  let numStr = match[1];
  const unit = match[2];

  // 분수 처리 (예: "1/2" -> 0.5)
  let numVal = 0;
  if (numStr.includes('/')) {
    const parts = numStr.split('/');
    if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
      numVal = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      return str;
    }
  } else {
    numVal = parseFloat(numStr);
  }

  if (isNaN(numVal)) return str;

  let calculated = 0;
  // 물/육수 계열 80% 황금 감쇠 공식 적용
  const waterKeywords = ['물', '육수', '쌀뜨물', '다시마물', '멸치육수', '채수', '사골육수'];
  const isWater = waterKeywords.some(kw => name.includes(kw));

  if (isWater) {
    const oneServing = numVal / baseS;
    // 1인분일 때는 1인분양 그대로, 2인분 이상일 때 80%씩 추가
    calculated = oneServing * (1 + (currS - 1) * 0.8);
  } else {
    calculated = (numVal / baseS) * currS;
  }

  // 소수점 1자리까지 깔끔하게 반올림
  const rounded = Math.round(calculated * 10) / 10;
  return `${rounded}${unit}`;
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
  document.getElementById('recipeServings').textContent = `${currentServings}인분`;
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
    const res = await fetch('data/ingredients.json?v=v39');
    if (res.ok) {
      seasonalIngredientsList = await res.json();
    }
  } catch (err) {
    console.error('제철 식재료 목록 로드 실패', err);
  }
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

  baseServings = currentRecipe.servings || 2;
  const savedServings = localStorage.getItem('user_preferred_servings');
  currentServings = savedServings ? parseInt(savedServings, 10) : baseServings;
  if (isNaN(currentServings) || currentServings < 1) currentServings = 1;

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
      if (currentServings > 1) {
        currentServings--;
        localStorage.setItem('user_preferred_servings', currentServings);
        document.getElementById('recipeServings').textContent = `${currentServings}인분`;
        renderIngredients(currentRecipe.ingredients);
        if (currentRecipe.seasoning && currentRecipe.seasoning.length > 0) renderSeasoning(currentRecipe.seasoning);
      }
    });
  }

  if (btnPlus) {
    btnPlus.addEventListener('click', () => {
      if (currentServings < 20) {
        currentServings++;
        localStorage.setItem('user_preferred_servings', currentServings);
        document.getElementById('recipeServings').textContent = `${currentServings}인분`;
        renderIngredients(currentRecipe.ingredients);
        if (currentRecipe.seasoning && currentRecipe.seasoning.length > 0) renderSeasoning(currentRecipe.seasoning);
      }
    });
  }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

