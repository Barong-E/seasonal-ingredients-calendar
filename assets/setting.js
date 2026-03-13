import { LocalNotifications } from '@capacitor/local-notifications';
import KoreanLunarCalendar from 'korean-lunar-calendar';

// 전역 데이터 캐시 (로컬 스토리지에 캐시할 수도 있지만, 설정 팝업에서 간단히 메모리로 사용)
let cachedIngredients = null;
let cachedHolidays = null;

async function getIngredientsData() {
  if (cachedIngredients) return cachedIngredients;
  try {
    const res = await fetch('data/ingredients.json');
    cachedIngredients = await res.json();
    return cachedIngredients;
  } catch (err) {
    console.error('식재료 데이터 로드 실패:', err);
    return [];
  }
}

async function getHolidaysData() {
  if (cachedHolidays) return cachedHolidays;
  try {
    const res = await fetch('data/holidays.json');
    cachedHolidays = await res.json();
    return cachedHolidays;
  } catch (err) {
    console.error('명절 데이터 로드 실패:', err);
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

function getHolidaySolarDate(holiday, today) {
  const baseYear = today.getFullYear();
  let date = getHolidaySolarDateForYear(holiday, baseYear);
  if (!date) return null;
  if (date < today) {
    date = getHolidaySolarDateForYear(holiday, baseYear + 1);
  }
  return date;
}

// 설정 상태 관리
const Settings = {
  ingredient: {
    enabled: false,
    day: 1,
    time: '09:00'
  },
  holiday: {
    enabled: false,
    dDay: 3,
    time: '09:00'
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
export function initSettingsPage() {
  const ingToggle = document.getElementById('ingredientNotiToggle');
  const ingDetail = document.getElementById('ingredientNotiDetail');
  const ingDaySelect = document.getElementById('ingredientNotiDay');
  const ingTimeInput = document.getElementById('ingredientNotiTime');
  
  const holiToggle = document.getElementById('holidayNotiToggle');
  const holiDetail = document.getElementById('holidayNotiDetail');
  const holiDdaySelect = document.getElementById('holidayNotiDday');
  const holiTimeInput = document.getElementById('holidayNotiTime');
  
  const saveBtn = document.getElementById('saveSettingButton');

  // 요소가 없으면 중단
  if (!ingToggle || !saveBtn) return;

  // 식재료 날짜 옵션 생성 (1~31)
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `매월 ${i}일`;
    ingDaySelect.appendChild(opt);
  }

  // 명절 d-day 옵션 생성 (0~30)
  for (let i = 0; i <= 30; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 0 ? '당일' : `${i}일 전`;
    holiDdaySelect.appendChild(opt);
  }

  // 초기값 반영
  loadSettings().then(() => {
    ingToggle.checked = Settings.ingredient.enabled;
    ingDetail.style.display = Settings.ingredient.enabled ? 'block' : 'none';
    ingDaySelect.value = Settings.ingredient.day;
    ingTimeInput.value = Settings.ingredient.time || '09:00';
    
    holiToggle.checked = Settings.holiday.enabled;
    holiDetail.style.display = Settings.holiday.enabled ? 'block' : 'none';
    holiDdaySelect.value = Settings.holiday.dDay;
    holiTimeInput.value = Settings.holiday.time || '09:00';
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
        day: parseInt(ingDaySelect.value),
        time: ingTimeInput.value || '09:00'
      },
      holiday: {
        enabled: holiToggle.checked,
        dDay: parseInt(holiDdaySelect.value),
        time: holiTimeInput.value || '09:00'
      }
    };
    
    try {
      await saveSettings(newSettings);
      const overlay = document.getElementById('savingOverlay');
      if (overlay) {
        overlay.classList.add('show');
        setTimeout(() => {
          overlay.classList.remove('show');
          history.back(); // 뒤로가기
        }, 500);
      } else {
        alert('설정이 저장되고 알림이 예약되었습니다.');
        history.back(); // 뒤로가기
      }
    } catch (error) {
      console.error('알림 설정 저장 실패:', error);
      alert('알림 권한이 필요합니다.\n기기 설정에서 알림을 허용해주세요.');
    }
  });
}

// 스크립트가 로드되면 자동 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsPage);
} else {
  initSettingsPage();
}

// --------------------------------------------------------
// [핵심 로직] 알림 스케줄링
// --------------------------------------------------------

async function updateNotificationSchedule() {
  // 0. LocalNotifications 권한 확인 및 요청
  const permStatus = await LocalNotifications.checkPermissions();
  if (permStatus.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== 'granted') {
      console.error('LocalNotifications 권한이 거부되었습니다.');
      throw new Error('알림 권한이 필요합니다.');
    }
  }

  // 0-1. LocalNotifications용 채널 생성 (Android 필수)
  try {
    await LocalNotifications.createChannel({
      id: 'default',
      name: '기본 알림',
      description: '띵동 제철음식 로컬 알림',
      importance: 4, // 높음 (소리 + 팝업)
      visibility: 1, // 공개
      sound: 'default'
    });
    console.log('LocalNotifications 채널 생성 완료');
  } catch (e) {
    console.warn('채널 생성 실패 (이미 존재하거나 웹 환경):', e);
  }

  // 1. 기존 알림 모두 취소 (ID 10000~19999: 식재료, 20000~29999: 명절)
  // 단순화를 위해 전체 취소 후 재등록
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
    console.log(`기존 알림 ${pending.notifications.length}개 취소됨`);
  }

  const notis = [];
  const ingredientTime = parseTimeString(Settings.ingredient.time, { hours: 9, minutes: 0 });
  const holidayTime = parseTimeString(Settings.holiday.time, { hours: 9, minutes: 0 });

  // 2. 식재료 알림 예약 (향후 12개월 치)
  if (Settings.ingredient.enabled) {
    const day = Settings.ingredient.day;
    const now = new Date();
    
    // 식재료 데이터 가져오기
    const allIngredients = await getIngredientsData();
    
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth() + i,
        day,
        ingredientTime.hours,
        ingredientTime.minutes,
        0
      );
      
      if (targetDate.getMonth() !== (now.getMonth() + i) % 12) {
        targetDate.setDate(0); 
      }

      if (targetDate < now) continue;

      const month = targetDate.getMonth() + 1;
      // 독립적인 allIngredients 변수를 파라미터로 넘겨 새 제철 음식을 검색합니다.
      const newIngredients = getNewIngredientsForMonth(month, allIngredients);
      
      if (newIngredients.length > 0) {
        const names = newIngredients.slice(0, 3).map(item => item.name_ko).join(', ');
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
          channelId: 'default',
          smallIcon: 'ic_notification'
        });
      }
    }
  }

  // 3. 명절 알림 예약 (향후 1년 치)
  if (Settings.holiday.enabled) {
    const dDay = Settings.holiday.dDay;
    const holidays = await getHolidaysData();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    holidays.forEach((holiday, idx) => {
      // 위에서 선언한 날짜 계산 로직을 사용해서 solarDate 산출
      const solarDate = getHolidaySolarDate(holiday, today);
      if (!solarDate) return;

      const notiDate = new Date(solarDate);
      notiDate.setDate(notiDate.getDate() - dDay);
      notiDate.setHours(holidayTime.hours, holidayTime.minutes, 0);

      if (notiDate > new Date()) {
        const foodNames = holiday.details?.foods?.slice(0, 2).map(f => f.name).join(', ') || '맛있는 음식';
        
        notis.push({
          id: 20000 + idx,
          title: `곧 ${holiday.name}입니다 🌕`,
          body: `${holiday.name}에는 ${foodNames}을(를) 먹어요.`,
          schedule: { at: notiDate },
          extra: { type: 'holiday', name: holiday.name },
          channelId: 'default',
          smallIcon: 'ic_notification'
        });
      }
    });
  }

  if (notis.length > 0) {
    await LocalNotifications.schedule({ notifications: notis });
    console.log(`✅ ${notis.length}개의 알림이 예약되었습니다.`);
    
    // 디버깅: 예약된 알림 상세 출력
    console.log('📅 예약된 알림 목록:');
    notis.forEach(n => {
      const date = new Date(n.schedule.at);
      console.log(`  - [${n.id}] ${n.title} | ${date.toLocaleString('ko-KR')}`);
    });
    
    // 최종 확인: 실제 예약된 알림 목록
    const confirmedPending = await LocalNotifications.getPending();
    console.log(`📋 시스템에 등록된 알림 수: ${confirmedPending.notifications.length}개`);
  } else {
    console.warn('⚠️ 예약할 알림이 0개입니다. (AppState.allIngredients 비어있거나 조건 미충족)');
    console.log('  - AppState.allIngredients 길이:', window.AppState?.allIngredients?.length || 0);
    console.log('  - 식재료 알림 활성화:', Settings.ingredient.enabled);
    console.log('  - 명절 알림 활성화:', Settings.holiday.enabled);
  }
}

// 헬퍼: 해당 월에 "새로 시작하는" 식재료 찾기 (allIngredients를 주입받아 처리)
function getNewIngredientsForMonth(month, allIngredients) {
  const all = allIngredients || [];
  return all.filter(item => {
    const periods = item.periods || [];
    const hasThisMonth = periods.some(p => p.month === month);
    
    let prevMonth = month - 1;
    if (prevMonth === 0) prevMonth = 12;
    const hasPrevMonth = periods.some(p => p.month === prevMonth);

    return hasThisMonth && !hasPrevMonth;
  });
}

function parseTimeString(timeValue, fallback) {
  if (!timeValue || typeof timeValue !== 'string') return fallback;
  const [hoursStr, minutesStr] = timeValue.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  return { hours, minutes };
}
