// ingredient.js
// 식재료 상세 페이지 로직
import { getRecipeIdFromDishName } from './recipe-mapper.js';


async function loadIngredientData() {
  try {
    const res = await fetch('data/ingredients.json?v=v14', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load data');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}



function showCoupangRedirectOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'coupangRedirectOverlay';
  overlay.className = 'redirect-overlay';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `
    <p class="redirect-overlay__text"><span class="redirect-overlay__highlight">쿠팡</span>으로 이동 중이에요</p>
    <div class="redirect-overlay__arrow" aria-hidden="true"></div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('redirect-overlay--visible'));
}

function removeCoupangRedirectOverlay() {
  const overlay = document.getElementById('coupangRedirectOverlay');
  if (overlay) {
    overlay.classList.remove('redirect-overlay--visible');
    setTimeout(() => overlay.remove(), 200);
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    return;
  }

  const data = await loadIngredientData();
  if (!data) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = '데이터를 불러올 수 없습니다.';
    document.getElementById('error').style.display = 'block';
    return;
  }

  const item = data.find(i => i.name_ko === id);
  if (!item) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    return;
  }

  // 렌더링
  document.title = `띵동 제철음식 - ${item.name_ko}`;
  document.getElementById('loading').style.display = 'none';
  document.getElementById('detailContainer').style.display = 'block';

  document.getElementById('detailImage').src = `images/${item.image || '_fallback.png'}`;
  document.getElementById('detailImage').alt = item.name_ko;
  document.getElementById('detailTitle').textContent = item.name_ko;
  document.getElementById('detailDesc').textContent = item.description_ko || '';

  // 계절 테마 설정
  if (item.months && item.months.length > 0) {
    const firstMonth = item.months[0];
    let season = 'autumn';
    if (firstMonth === 12 || firstMonth <= 2) season = 'winter';
    else if (firstMonth >= 3 && firstMonth <= 5) season = 'spring';
    else if (firstMonth >= 6 && firstMonth <= 8) season = 'summer';
    document.body.classList.add(`theme-${season}`);
  }

  // 칼로리 설정
  if (item.calories_per_100g) {
    document.getElementById('caloriesSection').style.display = 'block';
    document.getElementById('caloriesPer100g').textContent = `${item.calories_per_100g}kcal`;
    document.getElementById('caloriesPerServing').textContent = item.calories_per_serving || '';
  }

  // 손질법
  if (item.preparation_ko) {
    document.getElementById('prepSection').style.display = 'block';
    document.getElementById('prepText').textContent = item.preparation_ko;
  }

  // 보관법
  if (item.storage_room_temp || item.storage_refrigerator || item.storage_freezer) {
    document.getElementById('storageSection').style.display = 'block';
    const storageEl = document.getElementById('storageContent');
    
    const types = [
      { t: '실온', i: '🏠', m: item.storage_room_temp },
      { t: '냉장', i: '🧊', m: item.storage_refrigerator },
      { t: '냉동', i: '❄️', m: item.storage_freezer }
    ];
    
    types.forEach(s => {
      if (s.m) {
        const div = document.createElement('div');
        div.className = 'modal__storage-item'; // CSS reuse
        div.innerHTML = `<span class="modal__storage-type">${s.i} ${s.t}</span><span class="modal__storage-method">${s.m}</span>`;
        storageEl.appendChild(div);
      }
    });
  }

  // 대표 요리
  if (item.popular_dish) {
    document.getElementById('dishSection').style.display = 'block';
    const dishEl = document.getElementById('dishText');
    const dishes = item.popular_dish.split(',').map(d => d.trim());
    
    dishes.forEach((dish, index) => {
      const recipeId = getRecipeIdFromDishName(dish);
      if (recipeId) {
        const a = document.createElement('a');
        a.href = `recipe.html#${recipeId}`;
        a.className = 'dish-link';
        a.textContent = dish;
        dishEl.appendChild(a);
      } else {
        const text = document.createTextNode(dish);
        dishEl.appendChild(text);
      }
      if (index < dishes.length - 1) {
        dishEl.appendChild(document.createTextNode(', '));
      }
    });
  }

  // 구매하기
  if (item.external_url) {
    document.getElementById('bottomBar').style.display = 'flex';
    document.getElementById('btnPurchase').onclick = () => {
      showCoupangRedirectOverlay();
      setTimeout(() => {
        window.open(item.external_url, '_blank', 'noopener,noreferrer');
        setTimeout(removeCoupangRedirectOverlay, 400);
      }, 600);
    };
  }
}

window.handleSmartBack = function(defaultUrl) {
  const params = new URLSearchParams(window.location.search);
  const fromNoti = params.get('fromNoti');
  
  // 알림을 통해 들어왔거나 히스토리가 없는 경우 강제 이동
  if (fromNoti === 'true' || window.history.length <= 1) {
    window.location.href = defaultUrl || 'index.html';
  } else {
    window.history.back();
  }
};

document.addEventListener('DOMContentLoaded', init);
