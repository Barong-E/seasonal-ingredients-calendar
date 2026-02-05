import { LocalNotifications } from '@capacitor/local-notifications';

// 설정 상태 관리
const Settings = {
  ingredient: {
    enabled: false,
    day: 1
  },
  holiday: {
    enabled: false,
    dDay: 3
  }
};

// 설정 로드
export async function loadSettings() {
  const saved = localStorage.getItem('app_settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    Settings.ingredient = { ...Settings.ingredient, ...parsed.ingredient };
    Settings.holiday = { ...Settings.holiday, ...parsed.holiday };
  }
  return Settings;
}

// 설정 저장
export async function saveSettings(newSettings) {
  Settings.ingredient = newSettings.ingredient;
  Settings.holiday = newSettings.holiday;
  localStorage.setItem('app_settings', JSON.stringify(Settings));
  
  // 알림 스케줄 업데이트
  await updateNotificationSchedule();
}

// UI 초기화
export function initSettingModal() {
  const modal = document.getElementById('settingModal');
  const closeBtn = modal.querySelector('.modal__close');
  const backdrop = modal.querySelector('.modal__backdrop');
  
  const ingToggle = document.getElementById('ingredientNotiToggle');
  const ingDetail = document.getElementById('ingredientNotiDetail');
  const ingDaySelect = document.getElementById('ingredientNotiDay');
  
  const holiToggle = document.getElementById('holidayNotiToggle');
  const holiDetail = document.getElementById('holidayNotiDetail');
  const holiDdaySelect = document.getElementById('holidayNotiDday');
  
  const saveBtn = document.getElementById('saveSettingButton');

  // 날짜 옵션 생성 (1~31)
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `매월 ${i}일`;
    ingDaySelect.appendChild(opt);
  }

  // 초기값 반영
  loadSettings().then(() => {
    ingToggle.checked = Settings.ingredient.enabled;
    ingDetail.style.display = Settings.ingredient.enabled ? 'block' : 'none';
    ingDaySelect.value = Settings.ingredient.day;
    
    holiToggle.checked = Settings.holiday.enabled;
    holiDetail.style.display = Settings.holiday.enabled ? 'block' : 'none';
    holiDdaySelect.value = Settings.holiday.dDay;
  });

  // 토글 이벤트
  ingToggle.addEventListener('change', (e) => {
    ingDetail.style.display = e.target.checked ? 'block' : 'none';
  });

  holiToggle.addEventListener('change', (e) => {
    holiDetail.style.display = e.target.checked ? 'block' : 'none';
  });

  // 저장 버튼
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      ingredient: {
        enabled: ingToggle.checked,
        day: parseInt(ingDaySelect.value)
      },
      holiday: {
        enabled: holiToggle.checked,
        dDay: parseInt(holiDdaySelect.value)
      }
    };
    
    await saveSettings(newSettings);
    closeSettingModal();
    alert('설정이 저장되고 알림이 예약되었습니다.');
  });

  // 닫기 이벤트
  const close = () => {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  
  window.openSettingModal = () => {
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  window.closeSettingModal = close;
}

// --------------------------------------------------------
// [핵심 로직] 알림 스케줄링
// --------------------------------------------------------

async function updateNotificationSchedule() {
  // 1. 기존 알림 모두 취소 (ID 10000~19999: 식재료, 20000~29999: 명절)
  // 단순화를 위해 전체 취소 후 재등록
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }

  const notis = [];

  // 2. 식재료 알림 예약 (향후 12개월 치)
  if (Settings.ingredient.enabled) {
    const day = Settings.ingredient.day;
    const now = new Date();
    
    // 이달에 아직 날짜가 안 지났으면 이번 달부터, 지났으면 다음 달부터
    // (간단히 다음 달부터 12개월 예약으로 구현)
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, day, 9, 0, 0); // 오전 9시
      
      // 만약 해당 월에 그 날짜가 없으면 (예: 2월 31일), 그 달의 마지막 날로 조정
      if (targetDate.getMonth() !== (now.getMonth() + i) % 12) {
        targetDate.setDate(0); // 전달 마지막 날 = 원래 달의 마지막 날
      }

      if (targetDate < now) continue; // 이미 지난 시간 제외

      // 해당 월의 "새로운" 식재료 찾기
      const month = targetDate.getMonth() + 1;
      const newIngredients = getNewIngredientsForMonth(month);
      
      if (newIngredients.length > 0) {
        const names = newIngredients.slice(0, 3).map(i => i.name_ko).join(', ');
        const count = newIngredients.length;
        const bodyText = count > 3 
          ? `${names} 등 ${count}가지가 제철이에요.` 
          : `${names}이(가) 제철이에요.`;

        notis.push({
          id: 10000 + i,
          title: `${month}월의 제철 식재료 🥦`,
          body: `${month}월에는 ${bodyText}`,
          schedule: { at: targetDate },
          extra: { type: 'ingredient', month: month },
          smallIcon: 'ic_stat_icon_config_sample'
        });
      }
    }
  }

  // 3. 명절 알림 예약 (향후 1년 치)
  if (Settings.holiday.enabled) {
    const dDay = Settings.holiday.dDay;
    // holidays.json 데이터 필요 (전역 AppState 등에서 접근 가능해야 함)
    // 여기서는 fetch로 다시 가져오거나 window.AppState 사용
    const holidays = window.AppState?.holidays || []; // script.js에서 AppState.holidays 저장 필요
    
    holidays.forEach((holiday, idx) => {
      // 명절 날짜 계산 (태양력/음력 변환 로직은 script.js에 있음 - 여기선 solarDate 활용)
      // *주의: script.js의 getUpcomingHoliday 로직 재사용 필요*
      // 간단히: 현재 시점 이후의 명절 날짜를 구했다고 가정
      
      // *실제 구현을 위해선 script.js의 로직을 모듈화하거나, 여기서 직접 계산해야 함*
      // 여기서는 window.AppState.holidays에 이미 계산된 solarDate가 있다고 가정하고 진행
      // (script.js 수정 필요: loadHolidays 시 solarDate 계산해서 저장해두기)
      
      if (!holiday.solarDate) return;

      const notiDate = new Date(holiday.solarDate);
      notiDate.setDate(notiDate.getDate() - dDay);
      notiDate.setHours(9, 0, 0);

      if (notiDate > new Date()) {
        const foodNames = holiday.details?.foods?.slice(0, 2).map(f => f.name).join(', ') || '맛있는 음식';
        
        notis.push({
          id: 20000 + idx,
          title: `곧 ${holiday.name}입니다 🌕`,
          body: `${holiday.name}에는 ${foodNames}을(를) 먹어요.`,
          schedule: { at: notiDate },
          extra: { type: 'holiday', name: holiday.name },
          smallIcon: 'ic_stat_icon_config_sample'
        });
      }
    });
  }

  if (notis.length > 0) {
    await LocalNotifications.schedule({ notifications: notis });
    console.log(`${notis.length}개의 알림이 예약되었습니다.`);
  }
}

// 헬퍼: 해당 월에 "새로 시작하는" 식재료 찾기
function getNewIngredientsForMonth(month) {
  // AppState.allIngredients 사용
  const all = window.AppState?.allIngredients || [];
  return all.filter(item => {
    // periods 배열 중 "시작 월"이 month인 것이 있는지 확인
    // (단순화: periods의 첫 번째 요소의 month가 이번 달인 경우)
    // 더 정확히는: 직전 달(month-1)에는 없었는데 이번 달(month)에는 있는 것
    const periods = item.periods || [];
    const hasThisMonth = periods.some(p => p.month === month);
    
    let prevMonth = month - 1;
    if (prevMonth === 0) prevMonth = 12;
    const hasPrevMonth = periods.some(p => p.month === prevMonth);

    return hasThisMonth && !hasPrevMonth;
  });
}
