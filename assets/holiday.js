// holiday.js
// 명절 상세 페이지 로직

async function loadHolidayData() {
  try {
    const res = await fetch('data/holidays.json?v=v11');
    if (!res.ok) throw new Error('Failed to load data');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

// 요리 이름을 레시피 ID로 매핑 (assets/script.js 참조)
function getRecipeIdFromDishName(dishName) {
  const mapping = {
    '떡국': 'tteokguk',
    '송편': 'songpyeon',
    '팥죽': 'patjuk',
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
    '갈비찜': 'galbijjim'
  };
  return mapping[dishName] || null;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    return;
  }

  const data = await loadHolidayData();
  if (!data) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = '데이터를 불러올 수 없습니다.';
    document.getElementById('error').style.display = 'block';
    return;
  }

  const item = data.find(i => i.id === id);
  if (!item) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    return;
  }

  // 렌더링
  document.title = `띵동 제철음식 - ${item.name}`;
  document.getElementById('loading').style.display = 'none';
  document.getElementById('detailContainer').style.display = 'block';

  document.getElementById('detailImage').src = `images/${item.image || '_fallback.png'}`;
  document.getElementById('detailImage').alt = item.name;
  document.getElementById('detailTitle').textContent = item.name;
  document.getElementById('detailDesc').textContent = item.summary || '';

  // 관련 이야기
  if (item.story) {
    document.getElementById('storySection').style.display = 'block';
    document.getElementById('storyContent').innerHTML = `<strong>${item.story.title}</strong><br>${item.story.content}`;
  }

  // 대표 음식
  if (item.details?.foods?.length > 0) {
    const foodSection = document.getElementById('foodSection');
    const foodContent = document.getElementById('foodContent');
    foodSection.style.display = 'block';
    
    item.details.foods.forEach(food => {
      const recipeId = getRecipeIdFromDishName(food.name);
      const div = document.createElement('div');
      div.className = 'item';
      
      const nameEl = document.createElement('span');
      nameEl.className = 'item__name';
      if (recipeId) {
        const link = document.createElement('a');
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
      
      div.appendChild(nameEl);
      div.appendChild(descEl);
      foodContent.appendChild(div);
    });
  }

  // 대표 풍습
  if (item.details?.customs?.length > 0) {
    const customSection = document.getElementById('customSection');
    const customContent = document.getElementById('customContent');
    customSection.style.display = 'block';
    
    item.details.customs.forEach(custom => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span class="item__name">${custom.name}</span>
        <p class="item__description">${custom.description}</p>
      `;
      customContent.appendChild(div);
    });
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
