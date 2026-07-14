import { LocalNotifications } from '@capacitor/local-notifications';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { loginWithGoogle, logout, listenToAuthChanges } from './firebase-init.js';
import { checkVIPStatusLocal, syncVIPStatusFromServer, purchaseSubscription } from './subscription.js';

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
    list: [] // { id: number, day: number, time: string }
  },
  holiday: {
    enabled: false,
    list: [] // { id: number, dDay: number, time: string }
  },
  editing: {
    type: null,
    id: null
  }
};

// 설정 로드
export async function loadSettings() {
  const saved = localStorage.getItem('app_settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    
    // 이전 단일 설정 데이터가 있을 경우 배열 구조로 마이그레이션
    if (parsed.ingredient && !parsed.ingredient.list) {
      const oldIng = parsed.ingredient;
      parsed.ingredient = {
        enabled: oldIng.enabled,
        list: oldIng.enabled ? [{ id: Date.now(), day: oldIng.day || 1, time: oldIng.time || '09:00' }] : []
      };
    }
    if (parsed.holiday && !parsed.holiday.list) {
      const oldHol = parsed.holiday;
      parsed.holiday = {
        enabled: oldHol.enabled,
        list: oldHol.enabled ? [{ id: Date.now() + 1, dDay: oldHol.dDay || 3, time: oldHol.time || '09:00' }] : []
      };
    }

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

// 알림 리스트 렌더링
function renderNotificationList(type) {
  const listContainer = document.getElementById(`${type}NotiList`);
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  const list = Settings[type].list;
  
  list.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'noti-item';
    
    let infoText = '';
    if (type === 'ingredient') {
      infoText = `매월 ${item.day}일 ${item.time}`;
    } else {
      infoText = `${item.dDay === 0 ? '당일' : item.dDay + '일 전'} ${item.time}`;
    }
    
    itemEl.innerHTML = `
      <span class="noti-item__info">${infoText}</span>
      <button class="noti-item__remove" type="button" data-id="${item.id}">-</button>
    `;

    // 알림 클릭 시 수정 모드로 전환
    const infoArea = itemEl.querySelector('.noti-item__info');
    infoArea.addEventListener('click', () => {
      loadToEditForm(type, item);
    });
    
    const removeBtn = itemEl.querySelector('.noti-item__remove');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 부모 클릭 이벤트 방지
      removeNotification(type, item.id);
    });
    
    listContainer.appendChild(itemEl);
  });
}

function loadToEditForm(type, item) {
  Settings.editing = { type, id: item.id };
  
  if (type === 'ingredient') {
    document.getElementById('ingredientNotiDay').value = item.day;
    document.getElementById('ingredientNotiTime').value = item.time;
    document.getElementById('addIngredientNoti').textContent = '수정';
  } else {
    document.getElementById('holidayNotiDday').value = item.dDay;
    document.getElementById('holidayNotiTime').value = item.time;
    document.getElementById('addHolidayNoti').textContent = '수정';
  }
  
  // 시각적으로 어떤 항목이 선택되었는지 강조 (옵션)
  document.querySelectorAll('.noti-item').forEach(el => el.classList.remove('editing'));
  const currentItems = document.querySelectorAll(`#${type}NotiList .noti-item`);
  const list = Settings[type].list;
  const idx = list.findIndex(i => i.id === item.id);
  if (idx !== -1 && currentItems[idx]) {
    currentItems[idx].classList.add('editing');
  }
}

function addNotification(type) {
  const dayValue = type === 'ingredient' 
    ? parseInt(document.getElementById('ingredientNotiDay').value)
    : parseInt(document.getElementById('holidayNotiDday').value);
  const timeValue = document.getElementById(`${type}NotiTime`).value || '09:00';
  
  // 수정 모드인 경우
  if (Settings.editing.type === type && Settings.editing.id) {
    const item = Settings[type].list.find(i => i.id === Settings.editing.id);
    if (item) {
      if (type === 'ingredient') item.day = dayValue;
      else item.dDay = dayValue;
      item.time = timeValue;
    }
    // 수정 모드 해제
    Settings.editing = { type: null, id: null };
    document.getElementById(type === 'ingredient' ? 'addIngredientNoti' : 'addHolidayNoti').textContent = '추가';
  } else {
    // 일반 추가 모드
    const newItem = {
      id: Date.now(),
      time: timeValue
    };
    
    if (type === 'ingredient') newItem.day = dayValue;
    else newItem.dDay = dayValue;
    
    Settings[type].list.push(newItem);
  }
  
  renderNotificationList(type);
}

function removeNotification(type, id) {
  if (Settings.editing.id === id) {
    Settings.editing = { type: null, id: null };
    document.getElementById(type === 'ingredient' ? 'addIngredientNoti' : 'addHolidayNoti').textContent = '추가';
  }
  Settings[type].list = Settings[type].list.filter(item => item.id !== id);
  renderNotificationList(type);
}

// UI 초기화
export function initSettingsPage() {
  const ingToggle = document.getElementById('ingredientNotiToggle');
  const ingDetail = document.getElementById('ingredientNotiDetail');
  const ingDaySelect = document.getElementById('ingredientNotiDay');
  const ingTimeInput = document.getElementById('ingredientNotiTime');
  const addIngBtn = document.getElementById('addIngredientNoti');
  
  const holiToggle = document.getElementById('holidayNotiToggle');
  const holiDetail = document.getElementById('holidayNotiDetail');
  const holiDdaySelect = document.getElementById('holidayNotiDday');
  const holiTimeInput = document.getElementById('holidayNotiTime');
  const addHoliBtn = document.getElementById('addHolidayNoti');
  
  const saveBtn = document.getElementById('saveSettingButton');

  // 계정 관리 관련 엘리먼트
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const btnGoogleLogout = document.getElementById('btnGoogleLogout');
  const userInfoContainer = document.getElementById('userInfoContainer');
  const userEmailText = document.getElementById('userEmailText');
  const accountDesc = document.getElementById('accountDesc');

  // 프리미엄 멤버십 관련 엘리먼트
  const btnSubscribe = document.getElementById('btnSubscribe');
  const premiumVipBadge = document.getElementById('premiumVipBadge');
  const vipActiveContainer = document.getElementById('vipActiveContainer');
  const vipExpireText = document.getElementById('vipExpireText');

  if (!ingToggle || !saveBtn) return;

  // 식재료 날짜 옵션 생성
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `매월 ${i}일`;
    ingDaySelect.appendChild(opt);
  }

  // 명절 d-day 옵션 생성
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
    renderNotificationList('ingredient');
    
    holiToggle.checked = Settings.holiday.enabled;
    holiDetail.style.display = Settings.holiday.enabled ? 'block' : 'none';
    renderNotificationList('holiday');
    
    // VIP UI 초기값 반영
    updateVipUI();
  });

  // 이벤트 리스너
  ingToggle.addEventListener('change', (e) => {
    ingDetail.style.display = e.target.checked ? 'block' : 'none';
  });

  holiToggle.addEventListener('change', (e) => {
    holiDetail.style.display = e.target.checked ? 'block' : 'none';
  });

  addIngBtn.addEventListener('click', () => addNotification('ingredient'));
  addHoliBtn.addEventListener('click', () => addNotification('holiday'));

  // 구글 로그인 / 로그아웃 이벤트 및 상태 수신
  if (btnGoogleLogin && btnGoogleLogout && userInfoContainer && userEmailText && accountDesc) {
    btnGoogleLogin.addEventListener('click', async () => {
      try {
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.style.opacity = '0.6';
        await loginWithGoogle();
      } catch (err) {
        console.error(err);
        alert('구글 로그인에 실패했습니다.\n(앱 설정이 완료된 실제 기기에서 작동합니다)');
      } finally {
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.style.opacity = '1';
      }
    });

    btnGoogleLogout.addEventListener('click', async () => {
      if (!confirm('로그아웃 하시겠습니까?')) return;
      try {
        btnGoogleLogout.disabled = true;
        await logout();
      } catch (err) {
        console.error(err);
        alert('로그아웃 실패: ' + err.message);
      } finally {
        btnGoogleLogout.disabled = false;
      }
    });

    listenToAuthChanges(async (user) => {
      if (user) {
        btnGoogleLogin.style.display = 'none';
        userInfoContainer.style.display = 'flex';
        userEmailText.textContent = user.email || '구글 로그인 완료';
        accountDesc.textContent = '로그인되었습니다. 데이터를 안전하게 백업 중입니다.';
        
        // 로그인 성공 시 서버에서 VIP 정보 동기화 및 UI 갱신
        try {
          await syncVIPStatusFromServer(user.uid);
          updateVipUI();
        } catch (e) {
          console.error(e);
        }
      } else {
        btnGoogleLogin.style.display = 'flex';
        userInfoContainer.style.display = 'none';
        userEmailText.textContent = '';
        accountDesc.textContent = '로그인하여 데이터를 안전하게 보관하세요.';
        
        // 로그아웃 시 로컬 VIP 정보 클리어 및 UI 갱신
        localStorage.removeItem('subscription:is_vip');
        localStorage.removeItem('subscription:expires_at');
        updateVipUI();
      }
    });
  }

  // VIP 구독 UI 제어 함수
  function updateVipUI() {
    const isVip = checkVIPStatusLocal();
    if (isVip) {
      if (premiumVipBadge) {
        premiumVipBadge.textContent = 'VIP';
        premiumVipBadge.classList.add('vip');
      }
      if (btnSubscribe) btnSubscribe.style.display = 'none';
      if (vipActiveContainer) vipActiveContainer.style.display = 'flex';
      
      const expireDate = localStorage.getItem('subscription:expires_at');
      if (vipExpireText && expireDate) {
        const d = new Date(expireDate);
        vipExpireText.textContent = `구독 만료일: ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      }
    } else {
      if (premiumVipBadge) {
        premiumVipBadge.textContent = 'BASIC';
        premiumVipBadge.classList.remove('vip');
      }
      if (btnSubscribe) btnSubscribe.style.display = 'block';
      if (vipActiveContainer) vipActiveContainer.style.display = 'none';
    }
  }

  // 구독하기 버튼 클릭 연동
  if (btnSubscribe) {
    btnSubscribe.addEventListener('click', async () => {
      try {
        btnSubscribe.disabled = true;
        btnSubscribe.textContent = "결제창 여는 중...";
        await purchaseSubscription(
          () => {
            // 결제 성공
            alert('🎉 프리미엄 구독이 시작되었습니다! 이제 무제한으로 사용하실 수 있습니다.');
            updateVipUI();
          },
          (errMsg) => {
            // 결제 에러/취소
            alert('결제 처리 실패: ' + errMsg);
          }
        );
      } catch (err) {
        console.error(err);
      } finally {
        btnSubscribe.disabled = false;
        btnSubscribe.textContent = "무제한 구독하기 (월 2,900원)";
      }
    });
  }

  // 저장 버튼
  saveBtn.addEventListener('click', async () => {
    const newSettings = {
      ingredient: {
        enabled: ingToggle.checked,
        list: Settings.ingredient.list
      },
      holiday: {
        enabled: holiToggle.checked,
        list: Settings.holiday.list
      }
    };
    
    try {
      await saveSettings(newSettings);
      const overlay = document.getElementById('savingOverlay');
      if (overlay) {
        overlay.classList.add('show');
        setTimeout(() => {
          overlay.classList.remove('show');
          history.back();
        }, 500);
      } else {
        alert('설정이 저장되고 알림이 예약되었습니다.');
        history.back();
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
  // 웹 브라우저 환경에서는 로컬 알림 스케줄 예약을 건너뜁니다.
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (!isNative) {
    console.log("웹 브라우저 환경: 로컬 알림 예약을 생략합니다.");
    return;
  }

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

  // 2. 식재료 알림 예약
  if (Settings.ingredient.enabled && Settings.ingredient.list.length > 0) {
    const allIngredients = await getIngredientsData();
    const now = new Date();

    Settings.ingredient.list.forEach((ingItem, listIdx) => {
      const ingredientTime = parseTimeString(ingItem.time, { hours: 9, minutes: 0 });
      const day = ingItem.day;

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
        const newIngredients = getNewIngredientsForMonth(month, allIngredients);
        
        if (newIngredients.length > 0) {
          const names = newIngredients.slice(0, 3).map(item => item.name_ko).join(', ');
          const count = newIngredients.length;
          const bodyText = count > 3 
            ? `${names} 등 ${count}가지가 제철이에요.` 
            : `${names}이(가) 제철이에요.`;

          notis.push({
            id: 10000 + (listIdx * 100) + i, // 리스트 인덱스별로 ID 대역 분리
            title: `${month}월의 제철 식재료 🥦`,
            body: `${month}월에는 ${bodyText}`,
            schedule: { at: targetDate },
            extra: { type: 'ingredient', month: month },
            channelId: 'default',
            smallIcon: 'ic_notification'
          });
        }
      }
    });
  }

  // 3. 명절 알림 예약
  if (Settings.holiday.enabled && Settings.holiday.list.length > 0) {
    const holidays = await getHolidaysData();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Settings.holiday.list.forEach((holItem, listIdx) => {
      const holidayTime = parseTimeString(holItem.time, { hours: 9, minutes: 0 });
      const dDay = holItem.dDay;

      holidays.forEach((holiday, idx) => {
        const solarDate = getHolidaySolarDate(holiday, today);
        if (!solarDate) return;

        const notiDate = new Date(solarDate);
        notiDate.setDate(notiDate.getDate() - dDay);
        notiDate.setHours(holidayTime.hours, holidayTime.minutes, 0);

        if (notiDate > new Date()) {
          const foodNames = holiday.details?.foods?.slice(0, 2).map(f => f.name).join(', ') || '맛있는 음식';
          const sMonth = solarDate.getMonth() + 1;
          const sDay = solarDate.getDate();
          
          let titleText = '';
          let bodyText = '';
          
          if (dDay === 0) {
            titleText = `오늘(${sMonth}/${sDay})은 ${holiday.name}입니다 🌕`;
            bodyText = `${holiday.name} 대표 음식인 ${foodNames}을(를) 맛보시는 건 어떨까요?`;
          } else {
            titleText = `${dDay}일 후(${sMonth}/${sDay})는 ${holiday.name}이에요 🌕`;
            bodyText = `${holiday.name}에는 대표적으로 ${foodNames}을(를) 먹어요.`;
          }

          notis.push({
            id: 20000 + (listIdx * 1000) + idx, // 리스트 인덱스별로 ID 대역 분리
            title: titleText,
            body: bodyText,
            schedule: { at: notiDate },
            extra: { 
              type: 'holiday', 
              name: holiday.name,
              url: `holidays.html?redirectId=${holiday.id}&fromNoti=true` // 목록을 거쳐 상세로 이동하도록 변경
            },
            channelId: 'default',
            smallIcon: 'ic_notification'
          });
        }
      });
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
    const months = item.months || [];
    const hasThisMonth = months.includes(month);
    
    let prevMonth = month - 1;
    if (prevMonth === 0) prevMonth = 12;
    const hasPrevMonth = months.includes(prevMonth);

    // 전달에는 없고 이번 달에만 있는 (새로 등장한) 식재료만 알림
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
