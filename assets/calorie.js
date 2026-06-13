/**
 * 칼로리 분석 페이지 전체 로직
 * - localStorage 기반 일일 칼로리 데이터 CRUD
 * - 네이티브 FoodScanner 플러그인 연동 (카메라 촬영 → AI 분석)
 * - 원형 게이지 & 매크로 바 실시간 갱신
 * - 식사 시간대 자동 분류 + 간식 변경
 * - 스와이프 삭제
 * - 등록된 식재료 링크 연동
 */

// ============================================================
// 0. 상수 & 유틸리티
// ============================================================
const STORAGE_KEY_TARGET = 'calorie:target';
const STORAGE_KEY_MEALS_PREFIX = 'calorie:meals:';
const DEFAULT_TARGET = 2000;

// 식사 시간대 기준
const MEAL_TIME_RULES = [
  { key: 'breakfast', label: '🌅 아침', start: 5, end: 9 },
  { key: 'lunch',     label: '☀️ 점심', start: 10, end: 14 },
  { key: 'dinner',    label: '🌙 저녁', start: 15, end: 20 },
  { key: 'latenight', label: '🌃 야식', start: 21, end: 4 },
];
const SNACK_OPTION = { key: 'snack', label: '🍪 간식' };

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMealTimeKey(date) {
  const h = date.getHours();
  for (const rule of MEAL_TIME_RULES) {
    if (rule.start <= rule.end) {
      if (h >= rule.start && h <= rule.end) return rule.key;
    } else {
      // 야식: 21~4 (자정을 넘김)
      if (h >= rule.start || h <= rule.end) return rule.key;
    }
  }
  return 'snack';
}

function getMealTimeLabel(key) {
  const found = MEAL_TIME_RULES.find(r => r.key === key);
  if (found) return found.label;
  if (key === 'snack') return SNACK_OPTION.label;
  return '🍽️ 식사';
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function numberWithCommas(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// 1. 데이터 관리 (localStorage)
// ============================================================
function getTargetCalorie() {
  const v = localStorage.getItem(STORAGE_KEY_TARGET);
  return v ? parseInt(v, 10) : DEFAULT_TARGET;
}

function setTargetCalorie(val) {
  localStorage.setItem(STORAGE_KEY_TARGET, val);
}

function getTodayMeals() {
  const key = STORAGE_KEY_MEALS_PREFIX + getTodayKey();
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveTodayMeals(meals) {
  const key = STORAGE_KEY_MEALS_PREFIX + getTodayKey();
  localStorage.setItem(key, JSON.stringify(meals));
}

function addMeal(meal) {
  const meals = getTodayMeals();
  meal.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  meals.unshift(meal); // 최신순
  saveTodayMeals(meals);
  return meal;
}

function deleteMeal(id) {
  const meals = getTodayMeals().filter(m => m.id !== id);
  saveTodayMeals(meals);
}

// 매크로 합계 계산
function calcTotals() {
  const meals = getTodayMeals();
  return meals.reduce((acc, m) => {
    acc.calories += (m.calories || 0);
    acc.protein += (m.protein || 0);
    acc.carbs += (m.carbs || 0);
    acc.fat += (m.fat || 0);
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ============================================================
// 2. 등록된 식재료 목록 로드 (제철 연동)
// ============================================================
let registeredIngredients = [];

async function loadRegisteredIngredients() {
  try {
    const res = await fetch('/data/ingredients.json');
    if (!res.ok) return;
    const data = await res.json();
    registeredIngredients = data.map(item => ({
      name: item.name,
      months: item.months || [],
    }));
  } catch (e) {
    console.warn('식재료 데이터 로드 실패:', e);
  }
}

function findRegisteredIngredient(name) {
  if (!name) return null;
  return registeredIngredients.find(i =>
    i.name && (name.includes(i.name) || i.name.includes(name))
  );
}

function isCurrentlySeasonal(months) {
  if (!months || months.length === 0) return false;
  const currentMonth = new Date().getMonth() + 1;
  return months.includes(currentMonth);
}

// ============================================================
// 3. UI 업데이트
// ============================================================
function updateGauge() {
  const target = getTargetCalorie();
  const totals = calcTotals();
  const ratio = Math.min(totals.calories / target, 1);

  // 원형 게이지
  const circumference = 2 * Math.PI * 52; // r=52
  const offset = circumference * (1 - ratio);
  const gaugeFill = document.getElementById('gaugeFill');
  if (gaugeFill) gaugeFill.style.strokeDashoffset = offset;

  // 텍스트
  const currentEl = document.getElementById('gaugeCurrentCal');
  if (currentEl) currentEl.textContent = numberWithCommas(totals.calories);
  const targetEl = document.getElementById('gaugeTargetCal');
  if (targetEl) targetEl.textContent = numberWithCommas(target);

  // 매크로 바 (대략적 목표: 단 50g, 탄 250g, 지 65g per 2000kcal 비례)
  const macroTargets = {
    protein: Math.round(target * 50 / 2000),
    carbs: Math.round(target * 250 / 2000),
    fat: Math.round(target * 65 / 2000),
  };

  document.getElementById('macroProtein').textContent = `${totals.protein}g`;
  document.getElementById('macroCarbs').textContent = `${totals.carbs}g`;
  document.getElementById('macroFat').textContent = `${totals.fat}g`;

  const pFill = document.getElementById('macroProteinFill');
  if (pFill) pFill.style.width = Math.min(totals.protein / macroTargets.protein * 100, 100) + '%';
  const cFill = document.getElementById('macroCarbsFill');
  if (cFill) cFill.style.width = Math.min(totals.carbs / macroTargets.carbs * 100, 100) + '%';
  const fFill = document.getElementById('macroFatFill');
  if (fFill) fFill.style.width = Math.min(totals.fat / macroTargets.fat * 100, 100) + '%';
}

function renderMealList() {
  const meals = getTodayMeals();
  const listEl = document.getElementById('mealList');
  const emptyEl = document.getElementById('mealEmptyState');

  if (!listEl) return;

  if (meals.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = meals.map(meal => {
    const timeLabel = getMealTimeLabel(meal.mealTime || 'snack');
    const time = meal.timestamp ? formatTime(meal.timestamp) : '';

    // 재료 칩 생성
    let ingredientChips = '';
    if (meal.ingredients && meal.ingredients.length > 0) {
      ingredientChips = '<div class="meal-card__ingredients">' +
        meal.ingredients.map(ing => {
          const reg = findRegisteredIngredient(ing.name);
          if (reg) {
            const seasonal = isCurrentlySeasonal(reg.months);
            const cls = seasonal ? 'ingredient-chip ingredient-chip--seasonal' : 'ingredient-chip';
            return `<a href="ingredient.html?name=${encodeURIComponent(reg.name)}" class="${cls}">${ing.name}</a>`;
          }
          return `<span class="ingredient-chip">${ing.name}</span>`;
        }).join('') +
        '</div>';
    }

    return `
      <div class="meal-card" data-id="${meal.id}">
        <div class="meal-card__inner">
          <button class="meal-card__delete-btn" data-delete="${meal.id}" aria-label="삭제">✕</button>
          <div class="meal-card__top">
            <span class="meal-card__time-tag">${timeLabel} ${time}</span>
            <span class="meal-card__cal">${numberWithCommas(meal.calories || 0)} kcal</span>
          </div>
          <p class="meal-card__name">${meal.name || '알 수 없는 음식'}</p>
          <div class="meal-card__macros">
            <span>탄 ${meal.carbs || 0}g</span>
            <span>단 ${meal.protein || 0}g</span>
            <span>지 ${meal.fat || 0}g</span>
          </div>
          ${ingredientChips}
        </div>
      </div>
    `;
  }).join('');

  // 삭제 버튼 이벤트
  listEl.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('이 기록을 정말 삭제하시겠습니까?')) return;
      const id = btn.dataset.delete;
      const card = btn.closest('.meal-card');
      if (card) {
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s ease';
      }
      setTimeout(() => {
        deleteMeal(id);
        renderMealList();
        updateGauge();
      }, 300);
    });
  });
}

// ============================================================
// 4. 카메라 & AI 분석
// ============================================================
let isNativeApp = false;
let FoodScanner = null;

function initNativePlugin() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      isNativeApp = true;
      FoodScanner = window.Capacitor.Plugins.FoodScanner;
    }
  } catch (e) {
    console.warn('네이티브 플러그인 초기화 실패:', e);
  }
}

async function startCalorieCamera() {
  if (!isNativeApp || !FoodScanner) {
    showCameraFallbackToast();
    return;
  }

  try {
    // 카메라 시작
    await FoodScanner.startCamera();

    // 스캐너 오버레이 표시 (기존 index.html의 scanner-overlay 재활용 안 함, 자체 처리)
    document.documentElement.classList.add('body-transparent');
    showScannerOverlay();
  } catch (e) {
    console.error('카메라 시작 실패:', e);
    alert('카메라를 시작할 수 없습니다: ' + (e.message || ''));
  }
}

function showScannerOverlay() {
  // 간단한 스캐너 오버레이를 동적으로 생성
  let overlay = document.getElementById('calorieScannerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'calorieScannerOverlay';
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `
      <div class="scanner-header">
        <button class="scanner-exit-btn" id="calorieScannerExit" type="button">✕</button>
        <h2 class="scanner-title">🔥 칼로리 분석</h2>
      </div>
      
      <!-- 네모 가이드라인 (CalAI 스타일) -->
      <div class="scanner-frame-container">
        <div class="scanner-frame">
          <div class="corner corner-tl"></div>
          <div class="corner corner-tr"></div>
          <div class="corner corner-bl"></div>
          <div class="corner corner-br"></div>
        </div>
      </div>

      <p class="scanner-guide-text">음식을 화면 중앙에 맞추고<br>아래 버튼을 눌러주세요</p>
      <div class="scanner-bottom-area">
        <button class="scanner-shutter-btn" id="calorieShutterBtn" type="button">
          <span class="shutter-inner"></span>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = '';

  const fab = document.getElementById('fabCamera');
  if (fab) fab.style.display = 'none';
  const gnb = document.querySelector('.gnb');
  if (gnb) gnb.style.display = 'none';

  // 이벤트 바인딩
  document.getElementById('calorieShutterBtn').onclick = takePhotoAndAnalyze;
  document.getElementById('calorieScannerExit').onclick = stopCalorieCamera;
}

async function stopCalorieCamera() {
  try {
    if (FoodScanner) await FoodScanner.stopCamera();
  } catch (e) { /* ignore */ }
  document.documentElement.classList.remove('body-transparent');
  const overlay = document.getElementById('calorieScannerOverlay');
  if (overlay) overlay.style.display = 'none';

  const fab = document.getElementById('fabCamera');
  if (fab) fab.style.display = '';
  const gnb = document.querySelector('.gnb');
  if (gnb) gnb.style.display = '';
}

function cropImageToScannerFrame(photoDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 고화질 크롭 이미지용 해상도 설정 (520x520)
        const targetSize = 520;
        canvas.width = targetSize;
        canvas.height = targetSize;

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const imgW = img.width;
        const imgH = img.height;

        const screenRatio = screenW / screenH;
        const imgRatio = imgW / imgH;

        let scale = 1;
        if (imgRatio > screenRatio) {
          // 이미지가 가로로 넓음
          scale = imgH / screenH;
        } else {
          // 이미지가 세로로 김
          scale = imgW / screenW;
        }

        const cropSize = 260 * scale;
        const cropX = (imgW - cropSize) / 2;
        const cropY = (imgH - cropSize) / 2;

        ctx.drawImage(
          img,
          cropX, cropY, cropSize, cropSize,
          0, 0, targetSize, targetSize
        );

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('촬영된 이미지 데이터를 분석 범위에 맞추어 처리하는 데 실패했습니다.'));
    img.src = photoDataUrl;
  });
}

let isAnalyzingCancelled = false;

async function takePhotoAndAnalyze() {
  if (!FoodScanner) return;

  const shutterBtn = document.getElementById('calorieShutterBtn');
  if (shutterBtn) shutterBtn.disabled = true;
  isAnalyzingCancelled = false;

  try {
    // 1. 촬영 실행 (카메라가 켜진 상태에서 즉시 캡처)
    const captureResult = await FoodScanner.capturePhoto();
    if (!captureResult || !captureResult.photo) {
      throw new Error('사진 촬영에 실패했습니다.');
    }
    const rawPhotoData = captureResult.photo;

    // 2. 가이드라인 상자 부분 크롭 실행
    let photoData;
    try {
      photoData = await cropImageToScannerFrame(rawPhotoData);
    } catch (cropErr) {
      console.warn('이미지 크롭 실패, 원본 전송 시도:', cropErr);
      photoData = rawPhotoData; // 실패 시 안전장치로 원본 사용
    }

    // 3. 카메라 끄기
    await stopCalorieCamera();

    // 4. 분석 오버레이에 크롭된 이미지 설정 후 오버레이 노출
    const analysisPhoto = document.getElementById('analysisPhoto');
    if (analysisPhoto) {
      analysisPhoto.src = photoData;
    }
    showAnalysisOverlay();

    // 5. Gemini API 분석 실행 (비동기)
    const result = await FoodScanner.analyzeCalorie({ photo: photoData });

    if (isAnalyzingCancelled) return; // 분석 중 취소된 경우 무시

    if (!result || !result.is_food) {
      hideAnalysisOverlay();
      alert('음식이 인식되지 않았어요. 다시 촬영해 보세요! 📸');
      return;
    }

    // 분석 완료 → 결과 바텀시트 표시
    hideAnalysisOverlay();
    showResultSheet(result);
  } catch (e) {
    hideAnalysisOverlay();
    await stopCalorieCamera();
    console.error('분석 실패:', e);
    alert('분석에 실패했습니다: ' + (e.message || '다시 시도해주세요'));
  } finally {
    if (shutterBtn) shutterBtn.disabled = false;
  }
}

// ============================================================
// 5. 분석 중 오버레이 제어
// ============================================================
let progressInterval = null;

function showAnalysisOverlay() {
  const overlay = document.getElementById('analysisOverlay');
  if (!overlay) return;
  overlay.style.display = '';

  // 가짜 프로그레스 (0% → 90%를 3초에 걸쳐)
  let progress = 0;
  const circumference = 2 * Math.PI * 26;
  const circle = document.getElementById('analysisProgressCircle');
  const text = document.getElementById('analysisProgressText');
  const status = document.getElementById('analysisStatus');

  const messages = [
    '🔥 음식을 분석하고 있어요...',
    '🥩 단백질 확인 중...',
    '🍚 탄수화물 계산 중...',
    '🧈 지방 측정 중...',
    '✨ 거의 다 됐어요!'
  ];

  progressInterval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 8, 90);
    const offset = circumference * (1 - progress / 100);
    if (circle) circle.style.strokeDashoffset = offset;
    if (text) text.textContent = Math.round(progress) + '%';

    const msgIdx = Math.min(Math.floor(progress / 20), messages.length - 1);
    if (status) status.textContent = messages[msgIdx];
  }, 200);

  // 취소 버튼
  document.getElementById('analysisCancelBtn').onclick = () => {
    isAnalyzingCancelled = true;
    hideAnalysisOverlay();
    stopCalorieCamera();
  };
}

function hideAnalysisOverlay() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  const overlay = document.getElementById('analysisOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// 6. 결과 바텀시트
// ============================================================
let currentResult = null;
let selectedMealTime = null;

function showResultSheet(result) {
  currentResult = result;
  const sheet = document.getElementById('resultSheet');
  if (!sheet) return;
  sheet.style.display = '';

  // 음식 이름
  document.getElementById('resultFoodName').textContent = result.name || '알 수 없는 음식';
  document.getElementById('resultCalories').textContent = numberWithCommas(result.calories || 0);
  document.getElementById('resultProtein').textContent = (result.protein || 0) + 'g';
  document.getElementById('resultCarbs').textContent = (result.carbs || 0) + 'g';
  document.getElementById('resultFat').textContent = (result.fat || 0) + 'g';

  // 재료 목록
  const ingredientsEl = document.getElementById('resultIngredients');
  if (ingredientsEl && result.ingredients && result.ingredients.length > 0) {
    ingredientsEl.innerHTML = `
      <p class="result-ingredients__title">📋 주요 재료</p>
      <div class="result-ingredients__list">
        ${(result.ingredients || []).map(ing => {
          if (!ing || !ing.name) return '';
          const reg = findRegisteredIngredient(ing.name);
          if (reg) {
            const seasonal = isCurrentlySeasonal(reg.months);
            return `<a href="ingredient.html?name=${encodeURIComponent(reg.name)}" class="result-ingredient-chip result-ingredient-chip--linked">
              ${ing.name}${seasonal ? ' 🌱' : ''}
              <span class="result-ingredient-chip__cal">${ing.calories || ''}kcal</span>
            </a>`;
          }
          return `<span class="result-ingredient-chip">${ing.name} <span class="result-ingredient-chip__cal">${ing.calories || ''}kcal</span></span>`;
        }).join('')}
      </div>
    `;
  } else {
    ingredientsEl.innerHTML = '';
  }

  // 식사 시간대 자동 선택
  selectedMealTime = getMealTimeKey(new Date());
  updateMealTimeTags();

  // 백드롭 클릭
  document.getElementById('resultBackdrop').onclick = hideResultSheet;
}

function hideResultSheet() {
  const sheet = document.getElementById('resultSheet');
  if (sheet) sheet.style.display = 'none';
  currentResult = null;
}

function updateMealTimeTags() {
  const tags = document.querySelectorAll('#mealtimeTags .mealtime-tag');
  tags.forEach(tag => {
    tag.classList.toggle('active', tag.dataset.time === selectedMealTime);
  });
}

function initMealTimeTags() {
  const tags = document.querySelectorAll('#mealtimeTags .mealtime-tag');
  tags.forEach(tag => {
    tag.addEventListener('click', () => {
      selectedMealTime = tag.dataset.time;
      updateMealTimeTags();
    });
  });
}

// 기록하기
function handleSaveMeal() {
  if (!currentResult) return;

  const meal = {
    name: currentResult.name || '알 수 없는 음식',
    calories: currentResult.calories || 0,
    protein: currentResult.protein || 0,
    carbs: currentResult.carbs || 0,
    fat: currentResult.fat || 0,
    ingredients: currentResult.ingredients || [],
    mealTime: selectedMealTime || 'snack',
    timestamp: new Date().toISOString(),
  };

  addMeal(meal);
  hideResultSheet();
  renderMealList();
  updateGauge();

  // 저장 성공 토스트
  showToast('✅ 기록이 저장되었어요!');
}

// ============================================================
// 7. 목표 칼로리 설정 모달
// ============================================================
function showTargetModal() {
  const modal = document.getElementById('targetModal');
  if (!modal) return;
  modal.style.display = '';
  const input = document.getElementById('targetCalorieInput');
  if (input) input.value = getTargetCalorie();
}

function hideTargetModal() {
  const modal = document.getElementById('targetModal');
  if (modal) modal.style.display = 'none';
}

function handleSaveTarget() {
  const input = document.getElementById('targetCalorieInput');
  if (!input) return;
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 500) val = 500;
  if (val > 10000) val = 10000;
  setTargetCalorie(val);
  hideTargetModal();
  updateGauge();
  showToast('⚙️ 목표 칼로리가 변경되었어요!');
}

// ============================================================
// 8. 토스트 메시지 및 앱 설치 유도 모달
// ============================================================
function showToast(message) {
  const existing = document.querySelector('.camera-fallback-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'camera-fallback-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showCameraFallbackModal() {
  const existing = document.getElementById('webCameraInfoModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'webCameraInfoModal';
  modal.className = 'info-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">📷 음식 칼로리 분석은 모바일 앱 전용 기능이에요. 지금 바로 앱을 다운로드받아 인공지능 음식 인식 및 칼로리 기록 기능을 경험해 보세요! 🌱</p>
      <div class="info-modal__buttons">
        <button type="button" class="info-modal__btn info-modal__btn--ios" disabled>iOS (준비중)</button>
        <a href="https://play.google.com/store/apps/details?id=net.seasonalfood.app&referrer=utm_source%3Dseasonalfood_web%26utm_medium%3Dinternal%26utm_campaign%3Dcalorie_scan_popup" target="_blank" rel="noopener noreferrer" class="info-modal__btn info-modal__btn--android">Android 설치</a>
      </div>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;

  function close() {
    modal.remove();
    document.body.style.overflow = '';
  }

  modal.querySelector('.info-modal__backdrop').addEventListener('click', close);
  modal.querySelector('.info-modal__close').addEventListener('click', close);

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function showCameraFallbackToast() {
  showCameraFallbackModal();
}

// ============================================================
// 9. 초기화
// ============================================================
async function init() {
  initNativePlugin();
  await loadRegisteredIngredients();
  updateGauge();
  renderMealList();
  initMealTimeTags();

  // FAB 카메라 버튼
  const fabBtn = document.getElementById('fabCamera');
  if (fabBtn) fabBtn.addEventListener('click', startCalorieCamera);

  // 목표 칼로리 설정
  const targetBtn = document.getElementById('btnTargetSetting');
  if (targetBtn) targetBtn.addEventListener('click', showTargetModal);
  const targetCancelBtn = document.getElementById('targetCancelBtn');
  if (targetCancelBtn) targetCancelBtn.addEventListener('click', hideTargetModal);
  const targetSaveBtn = document.getElementById('targetSaveBtn');
  if (targetSaveBtn) targetSaveBtn.addEventListener('click', handleSaveTarget);
  const targetBackdrop = document.getElementById('targetModalBackdrop');
  if (targetBackdrop) targetBackdrop.addEventListener('click', hideTargetModal);

  // 결과 저장 버튼
  const saveBtn = document.getElementById('resultSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', handleSaveMeal);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
