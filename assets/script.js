/**
 * Seasonal Ingredients Calendar Project
 * Design Theme: Emerald Noir Editorial
 */

// 데이터: 제철 식재료 목록 (예시)
const ingredients = [
    { id: 1, name: '딸기', category: 'fruit', peak: '1월-5월', img: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&q=80&w=400', info: '비타민 C가 풍부한 딸기는 늦겨울부터 봄까지 가장 달고 맛있습니다.' },
    { id: 2, name: '냉이', category: 'vegetable', peak: '3월-4월', img: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&q=80&w=400', info: '향긋한 냉이는 봄나물의 대표주자로 원기 회복에 탁월합니다.' },
    { id: 3, name: '주꾸미', category: 'seafood', peak: '3월-5월', img: 'https://images.unsplash.com/photo-1628102434054-d8df0fb36873?auto=format&fit=crop&q=80&w=400', info: '3월의 주꾸미는 산란기를 맞아 알이 꽉 차고 쫄깃한 식감이 일품입니다.' },
    { id: 4, name: '달래', category: 'vegetable', peak: '3월-4월', img: 'https://images.unsplash.com/photo-1594968374534-8dd9f27715ec?auto=format&fit=crop&q=80&w=400', info: '춘곤증 예방에 좋은 달래는 알싸한 맛으로 입맛을 돋워줍니다.' },
    { id: 5, name: '참다랑어', category: 'seafood', peak: '12월-4월', img: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?auto=format&fit=crop&q=80&w=400', info: '바다의 닭고기라 불리는 고단백의 참다랑어는 한겨울부터 이른 봄까지 최고입니다.' },
    { id: 6, name: '쑥', category: 'vegetable', peak: '3월', img: 'https://images.unsplash.com/photo-1540304322409-f5387494ce83?auto=format&fit=crop&q=80&w=400', info: '혈액순환을 돕는 쑥은 국이나 떡으로 즐기기에 좋은 봄의 전령입니다.' }
];

// 화면 초기화
document.addEventListener('DOMContentLoaded', () => {
    renderIngredients('all');
    console.log("Emerald Noir Editorial Theme Activated.");
});

// 섹션 전환 함수 (SPA 방식)
function switchView(viewName) {
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(sec => sec.classList.remove('active'));
    
    const activeSection = document.getElementById(`view-${viewName}`);
    if (activeSection) {
        activeSection.classList.add('active');
        window.scrollTo(0, 0); // 맨 위로
    }

    // 네비게이션 아이콘 활성화 상태 업데이트
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const targetNav = Array.from(navItems).find(item => item.textContent.trim().toLowerCase().includes(viewName === 'home' ? '홈' : viewName === 'calendar' ? '캘린더' : '절기'));
    if (targetNav) targetNav.classList.add('active');
}

// 식재료 리스트 렌더링
function renderIngredients(filter) {
    const listContainer = document.getElementById('ingredient-list');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // 초기화

    const filtered = filter === 'all' ? ingredients : ingredients.filter(i => i.category === filter);

    filtered.forEach((ing, index) => {
        const card = document.createElement('div');
        card.className = 'item-card fade-in';
        card.style.animationDelay = `${index * 0.1}s`;
        card.onclick = () => showDetail(ing);

        card.innerHTML = `
            <img src="${ing.img}" class="item-img" alt="${ing.name}">
            <div class="item-info">
                <p class="item-tag">${ing.category}</p>
                <h3 class="item-name">${ing.name}</h3>
                <p style="font-size: 0.75rem; opacity: 0.8;">제철: ${ing.peak}</p>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// 카테고리 필터링
function filterCategory(category) {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(c => c.classList.remove('active'));

    event.target.classList.add('active');
    renderIngredients(category);
}

// 상세 페이지 보이기
function showDetail(ing) {
    const detailContent = document.getElementById('ingredient-detail-content');
    if (!detailContent) return;

    detailContent.innerHTML = `
        <div class="hero">
            <img src="${ing.img}" class="hero-img" alt="${ing.name}">
            <div class="hero-content">
                <span class="item-tag" style="background: var(--accent-emerald); color: #000;">In Peak Season</span>
                <h1 class="section-title" style="margin-top: 10px;">${ing.name} <br><span class="editorial-italic">The Natural Gift</span></h1>
            </div>
        </div>
        <div class="section" style="padding-top: 2rem;">
            <div class="glass-card">
                <h3 class="editorial-italic" style="color: var(--accent-emerald); border-bottom: 2px solid var(--accent-emerald-dim); display: inline-block; padding-bottom: 4px; margin-bottom: 1rem;">Information</h3>
                <p style="font-size: 1rem; line-height: 1.8;">${ing.info}</p>
            </div>

            <div class="glass-card" style="margin-top: 2rem;">
                <h3 class="editorial-italic" style="color: var(--accent-emerald); margin-bottom: 1rem;">Chef's Notes</h3>
                <p class="editorial-italic" style="opacity: 0.9; font-size: 0.95rem;">"이 식재료는 조리하지 않고 생으로 먹었을 때 본연의 풍미가 가장 잘 살아납니다. 소금 한 꼬집과 신선한 올리브유만 있으면 충분합니다."</p>
            </div>

            <div style="margin-top: 2rem; text-align: center;">
                <button class="chip active" style="padding: 1rem 3rem; font-size: 1rem; border-radius: 99px; box-shadow: 0 10px 20px rgba(80, 200, 120, 0.3);" onclick="switchView('home')">메인으로 돌아가기</button>
            </div>
        </div>
    `;

    switchView('detail');
}

// 안드로이드 하드웨어 백버튼 처리 시뮬레이션
window.onpopstate = function() {
    switchView('home');
};