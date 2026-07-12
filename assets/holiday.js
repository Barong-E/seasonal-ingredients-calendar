// holiday.js
// 명절 상세 페이지 로직
import { getRecipeIdFromDishName } from './recipe-mapper.js';
import KoreanLunarCalendar from 'korean-lunar-calendar';

// 명절/절기 날짜 계산 로직 모음
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
  return new Date(year, 1, dayVal); // 2월은 index 1
}

function getHajiDateForYear(year) {
  const dY = year - 2000;
  const base = 21.533;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 5, dayVal); // 6월은 index 5
}

function getIpchuDateForYear(year) {
  const dY = year - 2000;
  const base = 7.65;
  const leapCount = Math.floor(dY / 4);
  const dayVal = Math.floor(base + 0.242194 * dY - leapCount);
  return new Date(year, 7, dayVal); // 8월은 index 7
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

  // 섣달그믐: 음력 12월 마지막 날
  if (holiday.id === 'seotdal') {
    const calendar = new KoreanLunarCalendar();
    let ok = calendar.setLunarDate(year, 12, 30, false);
    if (!ok) ok = calendar.setLunarDate(year, 12, 29, false);
    if (!ok) return null;
    const solar = calendar.getSolarCalendar();
    if (!solar || !solar.year || !solar.month || !solar.day) return null;
    return new Date(solar.year, solar.month - 1, solar.day);
  }

  // 입춘: 절기 공식으로 자동 계산
  if (holiday.id === 'ipchun') {
    return getIpchunDateForYear(year);
  }

  // 초복: 하지 후 3번째 경일로 자동 계산
  if (holiday.id === 'chobok') {
    return getChobokDateForYear(year);
  }

  // 중복: 하지 후 4번째 경일로 자동 계산
  if (holiday.id === 'jungbok') {
    return getJungbokDateForYear(year);
  }

  // 말복: 입추 후 1번째 경일로 자동 계산
  if (holiday.id === 'malbok') {
    return getMalbokDateForYear(year);
  }

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
  // 'dynamic' — 동지 또는 solar_overrides 전용
  if (holiday.date.name === '동지') return getDongjiDateForYear(year);
  return null;
}

// 당해 년도를 기준으로 날짜 계산
function getHolidaySolarDate(holiday, today) {
  const baseYear = today.getFullYear();
  let date = getHolidaySolarDateForYear(holiday, baseYear);
  if (!date) return null;
  return date;
}

function formatDateString(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}


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

  // 올해 날짜 정보 표시
  const today = new Date();
  const solarDate = getHolidaySolarDate(item, today);
  const dateEl = document.getElementById('detailDate');
  if (solarDate && dateEl) {
    dateEl.textContent = formatDateString(solarDate);
  } else if (dateEl) {
    dateEl.style.display = 'none';
  }

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

  // 즐겨찾기 로직 추가
  const favBtn = document.getElementById('favoriteButton');
  if (favBtn) {
    const STORAGE_KEY = 'seasons:favorites:holidays';
    let favorites = [];
    try {
      favorites = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {}

    const isFav = favorites.includes(item.id);
    if (isFav) {
      favBtn.classList.add('active');
      favBtn.setAttribute('aria-label', '즐겨찾기 해제');
    }

    favBtn.onclick = () => {
      try {
        favorites = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch {}

      const index = favorites.indexOf(item.id);
      if (index > -1) {
        favorites.splice(index, 1);
        favBtn.classList.remove('active');
        favBtn.setAttribute('aria-label', '즐겨찾기 추가');
      } else {
        favorites.push(item.id);
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-label', '즐겨찾기 해제');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    };
  }

  // 스크롤 복원
  const savedScroll = sessionStorage.getItem('scrollPos_' + window.location.href);
  if (savedScroll) {
    setTimeout(() => {
      window.scrollTo(0, parseInt(savedScroll, 10));
      sessionStorage.removeItem('scrollPos_' + window.location.href);
    }, 100);
  }
}

window.handleSmartBack = function (defaultUrl) {
  const params = new URLSearchParams(window.location.search);
  const fromNoti = params.get('fromNoti');

  // 알림을 통해 들어왔거나 히스토리가 없는 경우 강제 이동
  if (fromNoti === 'true' || window.history.length <= 1) {
    window.location.href = defaultUrl || 'index.html';
  } else {
    window.history.back();
  }
};

window.addEventListener('pagehide', () => {
  sessionStorage.setItem('scrollPos_' + window.location.href, window.scrollY);
});

document.addEventListener('DOMContentLoaded', init);
