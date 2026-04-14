import KoreanLunarCalendar from 'korean-lunar-calendar';

async function loadHolidays() {
  try {
    const res = await fetch('data/holidays.json');
    if (!res.ok) throw new Error('명절 데이터 로드 실패');
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

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
  return getDongjiDateForYear(year);
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

async function renderHolidaysList(searchText = '') {
  const container = document.getElementById('holidayListContainer');
  const holidays = await loadHolidays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalized = searchText.trim().toLowerCase();

  // 날짜 계산 및 배열에 추가
  const parsedHolidays = holidays.map(h => {
    const solarDate = getHolidaySolarDate(h, today);
    return { ...h, solarDate };
  }).filter(h => {
    if (h.solarDate === null) return false;
    if (!normalized) return true;
    
    const hay = `${h.name || ''} ${h.main_food || ''}`.toLowerCase();
    return hay.includes(normalized);
  });

  // 날짜 순 정렬 (올해 기준)
  parsedHolidays.sort((a, b) => a.solarDate.getTime() - b.solarDate.getTime());

  container.innerHTML = ''; // Clear loading state or previous data
  
  if (parsedHolidays.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">' + (normalized ? '검색 결과가 없습니다.' : '데이터를 불러올 수 없습니다.') + '</p>';
    return;
  }

  parsedHolidays.forEach(holiday => {
    const link = document.createElement('a');
    link.href = `holiday.html?id=${encodeURIComponent(holiday.id)}`;
    link.className = 'holiday-item';
    
    // 이미 다 지난 명절은 약간 흐리게 표시할지 여부 (일단 기본 스타일 유지)
    if (holiday.solarDate < today) {
      link.style.opacity = '0.6';
    }

    const dateStr = formatDateString(holiday.solarDate);
    const imgSrc = holiday.image ? `images/${holiday.image}` : `images/_fallback.png`;

    // 대표 음식/풍습 이름만 추출
    const foodNames = (holiday.foods || []).map(f => f.name);
    const customNames = (holiday.customs || []).map(c => c.name);

    link.innerHTML = `
      <img src="${imgSrc}" alt="${holiday.name}" class="holiday-thumb" loading="lazy">
      <div class="holiday-info">
        <h3 class="holiday-name">${holiday.name}</h3>
        <span class="holiday-date">${dateStr}</span>
        <p class="holiday-desc">${holiday.main_food}</p>
        
        <!-- 동적 포커스 시 나타나는 확장 정보 -->
        <div class="holiday-expanded-info">
          ${holiday.summary ? `
            <div class="expanded-section">
              <span class="expanded-label">이야기</span>
              <p class="expanded-content">${holiday.summary}</p>
            </div>
          ` : ''}
          
          ${foodNames.length > 0 ? `
            <div class="expanded-section">
              <span class="expanded-label">대표 음식</span>
              <div class="expanded-tags">
                ${foodNames.map(name => `<span class="expanded-tag">${name}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${customNames.length > 0 ? `
            <div class="expanded-section">
              <span class="expanded-label">대표 풍습</span>
              <div class="expanded-tags">
                ${customNames.map(name => `<span class="expanded-tag">${name}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          <div style="margin-top: 12px; font-size: 0.8rem; color: var(--primary); font-weight: bold;">
            자세히 보기 〉
          </div>
        </div>
      </div>
    `;

    container.appendChild(link);
  });

  // 동적 포커스 감지 로직 (Intersection Observer)
  initFocusObserver();
  
  // 가장 가까운 명절로 스크롤 및 포커스
  scrollToClosestHoliday(parsedHolidays, today);
}

function initFocusObserver() {
  const options = {
    root: null,
    rootMargin: '-40% 0% -40% 0%', // 화면 중앙 부근 감지
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 기존 active 제거
        document.querySelectorAll('.holiday-item.active').forEach(el => el.classList.remove('active'));
        // 현재 아이템 active 추가
        entry.target.classList.add('active');
      }
    });
  }, options);

  document.querySelectorAll('.holiday-item').forEach(item => {
    observer.observe(item);
  });
}

function scrollToClosestHoliday(holidays, today) {
  let closestIndex = -1;
  let minDiff = Infinity;

  const now = today.getTime();
  
  holidays.forEach((h, index) => {
    if (!h.solarDate) return;
    const diff = h.solarDate.getTime() - now;
    // 오늘 이후이면서 가장 가까운 것 우선
    if (diff >= 0 && diff < minDiff) {
      minDiff = diff;
      closestIndex = index;
    }
  });

  // 만약 오늘 이후 명절이 없다면 마지막 명절
  if (closestIndex === -1 && holidays.length > 0) {
    closestIndex = holidays.length - 1;
  }

  if (closestIndex !== -1) {
    const items = document.querySelectorAll('.holiday-item');
    if (items[closestIndex]) {
      setTimeout(() => {
        items[closestIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        items[closestIndex].classList.add('active');
      }, 300);
    }
  }
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    renderHolidaysList(e.target.value);
  });
}

function handleRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectId = urlParams.get('redirectId');
  if (redirectId) {
    const fromNoti = urlParams.get('fromNoti');
    // 히스토리에서 파라미터 제거 (뒤로가기 시 무한 루프 방지)
    const newUrl = window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    // 상세 페이지로 이동 (fromNoti 플래그 전달)
    let detailUrl = `holiday.html?id=${encodeURIComponent(redirectId)}`;
    if (fromNoti) detailUrl += `&fromNoti=true`;
    window.location.href = detailUrl;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  handleRedirect(); // 리다이렉트 체크 우선 실행
  renderHolidaysList();
  initSearch();
});
