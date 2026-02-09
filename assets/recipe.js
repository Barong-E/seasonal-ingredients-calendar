// 레시피 페이지 스크립트

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
    const res = await fetch('data/recipes.json?v=v10');
    if (!res.ok) throw new Error('레시피 데이터 로드 실패');
    const recipes = await res.json();
    return recipes.find(recipe => recipe.id === recipeId);
  } catch (err) {
    console.error(err);
    return null;
  }
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
  document.getElementById('recipeServings').textContent = `${recipe.servings}인분`;
  document.getElementById('recipeCookTime').textContent = recipe.cookTime;
  document.getElementById('recipeDifficulty').textContent = recipe.difficulty;

  // 이미지 섹션 제거됨

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

  // 관련 정보 섹션은 사용하지 않음 (삭제)

  // 페이지 타이틀 업데이트
  document.title = `${recipe.name} 레시피 - 제철 알리미`;
}

// 재료 렌더링
function renderIngredients(ingredients) {
  const container = document.getElementById('ingredientsList');
  container.innerHTML = '';

  ingredients.forEach(ingredient => {
    const item = document.createElement('div');
    item.className = 'ingredient-item';
    item.innerHTML = `
      <span class="ingredient-name">${ingredient.name}</span>
      <span class="ingredient-amount">${ingredient.amount}</span>
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
    seasoningItem.innerHTML = `
      <span class="ingredient-name">${item.name}</span>
      <span class="ingredient-amount">${item.amount}</span>
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

// 관련 정보 렌더링
// (관련 정보 렌더링 로직 제거)

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
  // 이미 있으면 중복 추가 방지
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

// 초기화
async function init() {
  const recipeId = getRecipeIdFromUrl();
  
  if (!recipeId) {
    showError();
    return;
  }

  // 헤더 높이만큼 상단 오프셋 적용
  const header = document.querySelector('.app-header');
  if (header) {
    const headerH = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-offset', headerH + 'px');
  }

  showLoading();
  
  const recipe = await loadRecipe(recipeId);
  renderRecipe(recipe);

  // 뒤로 가기 버튼
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', goBack);
  }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

