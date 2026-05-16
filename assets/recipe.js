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

/**
 * 🧙‍♂️ [마법의 요리 저울 v2 - 인분 수 스마트 계산 엔진]
 * 
 * 초등학생 친구들도 이해하기 쉬운 작동 원리 설명:
 * 요리 레시피에 적힌 글자들("200g", "한 꼬집", "1줌", "소금 약간")을 자바스크립트 마법사가 돋보기로 관찰해요.
 * 
 * 1. 콤마(,)로 여러 개가 묶여 있다면? (예: "검은깨 1컵, 설탕 3큰술, 소금 약간")
 *    - 가위로 싹둑싹둑 잘라서 하나씩 계산한 다음, 다시 풀로 예쁘게 붙여줘요.
 * 
 * 2. '꼬집' 계산기 (소금 쥐기 마법)
 *    - 1인분에 1꼬집을 기본으로 잡고 곱해줘요. (2인분=2꼬집)
 *    - 만약 3~4꼬집 이상으로 많아지면 손가락으로 집기 힘드니까, 계량스푼 단위인 '1/4 t스푼', '1/2 t스푼'으로 친절하게 바꿔줘요!
 * 
 * 3. '줌' 계산기 (애매한 손크기 해결사)
 *    - 아빠 손과 내 손 크기가 달라서 헷갈리는 '1줌'을, 누구나 집에 있는 '1종이컵'으로 완벽하게 변신시켜서 곱해줘요.
 * 
 * 4. '약간', '적당량' 계산기 (빅데이터 요리사)
 *    - 애매한 말 대신, 요리사들의 평균 레시피 데이터를 보물창고에서 꺼내와서 정확한 숫자로 바꿔줘요.
 *      (예: 참깨 약간 -> 1인분당 0.5 t스푼 기준, 소금 약간 -> 1인분당 1꼬집 기준)
 * 
 * 5. 국물 요리 물양 계산기 (수증기 과학)
 *    - 물이나 육수는 2배, 3배로 넣으면 한강이 되니까, 1인분이 늘어날 때마다 80%만 늘려주는 마법 공식을 써요.
 */
function parseAndCalculateAmount(name, amountStr, baseS, currS) {
  if (!amountStr) return '';

  // 1. 콤마(,)로 여러 재료가 하나의 문자열에 들어있는 경우 (예: 송편 소 "검은깨 1컵, 설탕 3큰술, 소금 약간")
  if (amountStr.includes(',')) {
    return amountStr.split(',').map(part => parseAndCalculateAmount(name, part, baseS, currS)).join(', ');
  }

  let str = amountStr.trim();

  // 2. '줌' 정량화 로직 (애매한 손 크기 -> 표준 부피 '종이컵' 치환)
  // 예: '1줌', '한줌', '한 줌', '반줌', '반 줌', '두줌', '2줌', '검은깨 1줌'
  if (str.includes('줌')) {
    const m = str.match(/^(.*?)\s*([\d/.]+|한|두|세|네|반)?\s*줌/);
    const prefix = (m && m[1]) ? m[1].trim() + ' ' : '';
    const numStr = (m && m[2]) ? m[2] : '1';

    let handfuls = 1;
    if (numStr === '반') handfuls = 0.5;
    else if (numStr === '한') handfuls = 1;
    else if (numStr === '두') handfuls = 2;
    else if (numStr === '세') handfuls = 3;
    else if (numStr === '네') handfuls = 4;
    else handfuls = parseNumberOrFraction(numStr);

    // 1줌 = 1종이컵 기준으로 계산 (1인분당 handfuls / baseS 종이컵)
    const oneServingCups = handfuls / baseS;
    const totalCups = oneServingCups * currS;
    const roundedCups = Math.round(totalCups * 10) / 10;
    return `${prefix}${roundedCups}종이컵`;
  }

  // 3. '약간', '적당량', '취향껏', '톡톡', '조금', '적당히', '약간씩' 등의 애매한 표현 데이터 기반 정량화
  const emotionalWords = ['약간', '적당량', '취향껏', '톡톡', '조금', '적당히', '약간씩'];
  const hasEmotional = emotionalWords.some(w => str.includes(w));

  if (hasEmotional) {
    // 감성 표현 앞의 재료명 추출 (예: "소금 약간" -> prefix="소금 ")
    const emoMatch = str.match(/^(.*?)\s*(약간|적당량|취향껏|톡톡|조금|적당히|약간씩)/);
    const prefix = (emoMatch && emoMatch[1]) ? emoMatch[1].trim() + ' ' : '';
    const checkName = name + ' ' + prefix;

    // 소금 계열 -> 1인분당 1꼬집 기준 (아래 꼬집 로직으로 넘겨 스마트 단위 변환까지 적용)
    if (checkName.includes('소금')) {
      str = `${prefix}1꼬집`;
    } 
    // 후추 계열 -> 1인분당 1톡(약 1/8 t스푼)
    else if (checkName.includes('후추')) {
      const totalTok = (1 / baseS) * currS;
      if (totalTok >= 4) return `${prefix}${Math.round((totalTok/4)*10)/10} t스푼`;
      return `${prefix}${Math.round(totalTok*10)/10}톡 (약 ${Math.round((totalTok/8)*10)/10} t스푼)`;
    }
    // 참깨/깨소금 계열 -> 1인분당 0.5 t스푼
    else if (checkName.includes('깨') || checkName.includes('참깨')) {
      const totalTs = (0.5 / baseS) * currS;
      return `${prefix}${Math.round(totalTs * 10) / 10} t스푼`;
    }
    // 오일/기름/버터 계열 -> 1인분당 1큰술
    else if (checkName.includes('기름') || checkName.includes('유') || checkName.includes('버터')) {
      const totalTb = (1 / baseS) * currS;
      return `${prefix}${Math.round(totalTb * 10) / 10}큰술`;
    }
    // 설탕/청/당 계열 -> 1인분당 0.5큰술
    else if (checkName.includes('설탕') || checkName.includes('당') || checkName.includes('청')) {
      const totalTb = (0.5 / baseS) * currS;
      return `${prefix}${Math.round(totalTb * 10) / 10}큰술`;
    }
    // 마늘/파/생강 계열 -> 1인분당 0.5큰술
    else if (checkName.includes('마늘') || checkName.includes('파') || checkName.includes('생강')) {
      const totalTb = (0.5 / baseS) * currS;
      return `${prefix}${Math.round(totalTb * 10) / 10}큰술`;
    }
    // 솔잎 등 기타 -> 1인분당 0.5종이컵
    else if (checkName.includes('솔잎')) {
      const totalCups = (0.5 / baseS) * currS;
      return `${prefix}${Math.round(totalCups * 10) / 10}종이컵`;
    }
    // 그 외 알 수 없는 재료 -> 1인분당 0.5 t스푼
    else {
      const totalTs = (0.5 / baseS) * currS;
      return `${prefix}${Math.round(totalTs * 10) / 10} t스푼`;
    }
  }

  // 4. '꼬집' 정량화 및 스마트 단위 변환 로직
  // 예: '1꼬집', '한 꼬집', '두 꼬집', '소금 1꼬집(위에서 변환됨)'
  if (str.includes('꼬집')) {
    const m = str.match(/^(.*?)\s*([\d/.]+|한|두|세|네)?\s*꼬집/);
    const prefix = (m && m[1]) ? m[1].trim() + ' ' : '';
    const numStr = (m && m[2]) ? m[2] : '1';

    let pinches = 1;
    if (numStr === '한') pinches = 1;
    else if (numStr === '두') pinches = 2;
    else if (numStr === '세') pinches = 3;
    else if (numStr === '네') pinches = 4;
    else pinches = parseNumberOrFraction(numStr);

    // 인분 수에 따른 총 꼬집 수 계산
    const oneServingPinches = pinches / baseS;
    const totalPinches = oneServingPinches * currS;

    // 스마트 단위 변환 (계량스푼 자동 변환)
    // 12꼬집 이상 -> 1 t스푼 (티스푼)
    if (totalPinches >= 12) {
      const ts = totalPinches / 12;
      return `${prefix}${Math.round(ts * 10) / 10} t스푼`;
    }
    // 6꼬집 ~ 11꼬집 -> 1/2 t스푼
    else if (totalPinches >= 6) {
      return `${prefix}1/2 t스푼 (약 ${Math.round(totalPinches)}꼬집)`;
    }
    // 3꼬집 ~ 5꼬집 -> 1/4 t스푼 (T스푼 약 1/4)
    else if (totalPinches >= 3) {
      return `${prefix}1/4 t스푼 (약 ${Math.round(totalPinches)}꼬집)`;
    }
    // 3꼬집 미만 -> 그대로 꼬집으로 표시
    else {
      const roundedPinches = Math.round(totalPinches * 10) / 10;
      return `${prefix}${roundedPinches}꼬집`;
    }
  }

  if (baseS === currS) return amountStr;

  // 5. 일반 숫자 + 단위 분리 및 계산 (물양 80% 감쇠 공식 포함)
  // 재료명이 앞에 붙어있는 복합 문자열("검은깨 1컵")까지 완벽하게 분리하는 정규식
  const match = str.match(/^(.*?)?([\d/.]+)\s*(.*)$/);
  if (!match) return str;

  const prefix = match[1] ? match[1].trim() + ' ' : '';
  const numStr = match[2];
  const unit = match[3];
  let numVal = parseNumberOrFraction(numStr);

  if (isNaN(numVal)) return str;

  let calculated = 0;
  // 물/육수 계열 80% 황금 감쇠 공식 적용 (라면 한강 방지 과학)
  const waterKeywords = ['물', '육수', '쌀뜨물', '다시마물', '멸치육수', '채수', '사골육수'];
  const isWater = waterKeywords.some(kw => name.includes(kw) || prefix.includes(kw));

  if (isWater) {
    const oneServing = numVal / baseS;
    calculated = oneServing * (1 + (currS - 1) * 0.8);
  } else {
    calculated = (numVal / baseS) * currS;
  }

  const rounded = Math.round(calculated * 10) / 10;
  return `${prefix}${rounded}${unit}`;
}

// 분수나 소수 문자열을 숫자로 변환해주는 헬퍼 함수
function parseNumberOrFraction(str) {
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return 0;
  }
  return parseFloat(str);
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

