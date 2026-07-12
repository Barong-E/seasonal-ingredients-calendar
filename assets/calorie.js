import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

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

// 전역 날짜 상태 (기본값: 오늘)
let selectedDate = new Date();

// 식사 시간대 기준
const MEAL_TIME_RULES = [
  { key: 'breakfast', label: '🌅 아침', start: 5, end: 9 },
  { key: 'lunch',     label: '☀️ 점심', start: 10, end: 14 },
  { key: 'dinner',    label: '🌙 저녁', start: 15, end: 20 },
  { key: 'latenight', label: '🌃 야식', start: 21, end: 4 },
];
const SNACK_OPTION = { key: 'snack', label: '🍪 간식' };

// selectedDate 기준의 YYYY-MM-DD 키 반환
function getTodayKey() {
  const y = selectedDate.getFullYear();
  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 특정 Date 객체를 YYYY-MM-DD 형태로 변환
function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
function getTargetCalorie(dateStr) {
  const key = dateStr ? `calorie:target:${dateStr}` : `calorie:target:${getTodayKey()}`;
  const v = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY_TARGET);
  return v ? parseInt(v, 10) : DEFAULT_TARGET;
}

function setTargetCalorie(val, dateStr) {
  const key = dateStr ? `calorie:target:${dateStr}` : `calorie:target:${getTodayKey()}`;
  localStorage.setItem(key, val);
  localStorage.setItem(STORAGE_KEY_TARGET, val); // Fallback 기본값 동기화
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

let editingMealId = null;

function updateMeal(id, updatedFields) {
  const meals = getTodayMeals();
  const idx = meals.findIndex(m => m.id === id);
  if (idx !== -1) {
    meals[idx] = { ...meals[idx], ...updatedFields };
    saveTodayMeals(meals);
  }
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
          <div class="meal-card__top">
            <span class="meal-card__time-tag">${timeLabel} ${time}</span>
            <div class="meal-card__top-right">
              ${meal.portion && meal.portion !== 100 ? `<span class="meal-card__portion-tag">섭취 ${meal.portion}%</span>` : ''}
              <span class="meal-card__cal">${numberWithCommas(meal.calories || 0)} kcal</span>
              <button class="meal-card__delete-btn" data-delete="${meal.id}" aria-label="삭제">✕</button>
            </div>
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

  // 카드 클릭 이벤트 (수정 모드 바텀시트 연동)
  listEl.querySelectorAll('.meal-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // ✕(삭제 버튼)이나 재료 칩(a 링크) 클릭 시에는 바텀시트 열기를 건너뛴다
      if (e.target.closest('[data-delete]') || e.target.closest('a')) {
        return;
      }
      const id = card.dataset.id;
      const meals = getTodayMeals();
      const meal = meals.find(m => m.id === id);
      if (meal) {
        showResultSheet(meal, true, id);
      }
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
      
      <!-- 카메라 영역 (헤더와 하단 사이의 중앙 정렬 기준) -->
      <div class="scanner-camera-area">
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
      </div>

      <div class="scanner-bottom-area">
        <div class="scanner-action-buttons">
          <button class="scanner-gallery-btn" id="calorieGalleryBtn" type="button" aria-label="갤러리에서 사진 선택">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="#ffffff">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>
          <button class="scanner-shutter-btn" id="calorieShutterBtn" type="button">
            <span class="shutter-inner"></span>
          </button>
          <div style="width: 52px;"></div> <!-- 좌우 균형을 위한 더미 공간 -->
        </div>
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
  document.getElementById('calorieGalleryBtn').onclick = triggerGallerySelection;
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

let cropperInstance = null;

async function triggerGallerySelection(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  if (!isNativeApp || !FoodScanner) {
    // 웹 브라우저 환경 등 폴백

    const fileInput = document.getElementById('calorieGalleryInput');
    if (fileInput) {
      fileInput.value = ''; // 같은 이미지 재선택시에도 이벤트 발생 보장
      fileInput.click();
    }
    return;
  }

  try {

    const result = await FoodScanner.selectPhoto();

    if (result && result.photo) {
      openCropModal(result.photo);
    } else {
      console.warn('selectPhoto 결과에 photo가 없습니다.');
    }
  } catch (err) {
    console.warn('네이티브 사진 선택 취소 또는 실패:', err);

  }
}

function handleGalleryFileChange(e) {
  try {
    const file = e.target.files[0];
    if (!file) return;


    const imageUrl = URL.createObjectURL(file);
    openCropModal(imageUrl);
  } catch (err) {
    console.error('갤러리 이미지 처리 실패:', err);

  }
}

function openCropModal(imageUrl) {

  try {
    const modal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    if (!modal || !cropImage) {
      console.error('크롭 모달 요소를 찾을 수 없습니다.');
      return;
    }

    // [추가] 크롭 모달이 열리면 기존 카메라 오버레이 화면을 가려 렌더링 꼬임을 완전히 차단합니다.
    const scannerOverlay = document.getElementById('calorieScannerOverlay');
    if (scannerOverlay) {
      scannerOverlay.style.display = 'none';
    }

    cropImage.src = imageUrl;
    modal.style.display = 'flex';

    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    // ES 모듈 default export 안전장치

    const CropperClass = Cropper.default || Cropper;
    if (typeof CropperClass !== 'function') {
      throw new Error('Cropper 라이브러리 클래스를 불러오지 못했습니다.');
    }

    // 1:1 비율로 미려하고 둥근 핀치 줌 크롭 연동

    cropperInstance = new CropperClass(cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });


    // 버튼 이벤트 연결
    document.getElementById('cropModalExit').onclick = closeCropModal;
    document.getElementById('cropModalSubmit').onclick = submitCroppedImage;
  } catch (err) {
    console.error('크롭 인스턴스 생성 실패:', err);

  }
}

function closeCropModal() {
  const modal = document.getElementById('cropModal');
  if (modal) modal.style.display = 'none';

  // [추가] 크롭 창을 닫으면 다시 스캐너 카메라 화면이 비치도록 원복합니다.
  const scannerOverlay = document.getElementById('calorieScannerOverlay');
  if (scannerOverlay) {
    scannerOverlay.style.display = '';
  }

  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
}

async function submitCroppedImage() {
  if (!cropperInstance) return;

  const submitBtn = document.getElementById('cropModalSubmit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    // 520x520 해상도로 제한하여 이미지 토큰 비용을 아낌
    const canvas = cropperInstance.getCroppedCanvas({
      width: 520,
      height: 520,
    });

    if (!canvas) {
      throw new Error('이미지를 자르는 데 실패했습니다.');
    }

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // 모달창 닫기 및 카메라 끄기
    closeCropModal();
    await stopCalorieCamera();

    // 분석 오버레이에 자른 이미지 표시 및 분석 로딩 노출
    const analysisPhoto = document.getElementById('analysisPhoto');
    if (analysisPhoto) {
      analysisPhoto.src = croppedDataUrl;
    }
    showAnalysisOverlay();

    isAnalyzingCancelled = false;

    // AI 분석 실행 (Gemini API 호출)
    const result = await FoodScanner.analyzeCalorie({ photo: croppedDataUrl });

    if (isAnalyzingCancelled) return;

    if (!result || !result.is_food) {
      hideAnalysisOverlay();
      alert('음식이 인식되지 않았어요. 다시 촬영해 보세요! 📸');
      return;
    }

    // 분석 성공 → 결과 바텀시트
    completeAnalysisOverlay(() => {
      showResultSheet(result);
    });

  } catch (e) {
    hideAnalysisOverlay();
    console.error('분석 실패:', e);
    alert('분석에 실패했습니다: ' + (e.message || '다시 시도해주세요'));
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
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

        // 카메라 영상은 기기 너비에 꽉 차게 렌더링됨 (FIT_START)
        // 실제 화면에 보이는 이미지의 스케일은 원본 가로 / 화면 가로 비율
        const scale = imgW / screenW;
        
        // CSS에서 설정한 네모 박스 크기(340px)를 원본 해상도 스케일로 환산
        const cropSize = 340 * scale;
        
        // 정중앙 자르기
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

    // 분석 완료 → 결과 바텀시트 표시 (100% 완료 연출 포함)
    completeAnalysisOverlay(() => {
      showResultSheet(result);
    });
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

  // 가짜 프로그레스 (비선형 감속 연출)
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
    // 0~50%는 빠르게, 50~80%는 보통, 80~95%는 아주 느리게, 95% 이상은 극도로 느리게 증가
    let increment = 0;
    if (progress < 50) {
      increment = Math.random() * 5 + 3; // 3~8%
    } else if (progress < 80) {
      increment = Math.random() * 2 + 1; // 1~3%
    } else if (progress < 95) {
      increment = Math.random() * 0.5 + 0.1; // 0.1~0.6%
    } else {
      increment = Math.random() * 0.05 + 0.01; // 0.01~0.06%
    }
    progress = Math.min(progress + increment, 98); // 최대 98%까지 점진적으로 올라감

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

function completeAnalysisOverlay(callback) {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  
  const circumference = 2 * Math.PI * 26;
  const circle = document.getElementById('analysisProgressCircle');
  const text = document.getElementById('analysisProgressText');
  const status = document.getElementById('analysisStatus');
  
  if (circle) circle.style.strokeDashoffset = 0; // 100% 채움
  if (text) text.textContent = '100%';
  if (status) status.textContent = '🎉 분석 완료!';
  
  // 350ms 대기 후 오버레이 닫고 다음 단계 진행
  setTimeout(() => {
    const overlay = document.getElementById('analysisOverlay');
    if (overlay) overlay.style.display = 'none';
    if (callback) callback();
  }, 350);
}

// ============================================================
// 6. 결과 바텀시트
// ============================================================
let currentResult = null;
let selectedMealTime = null;

function showResultSheet(result, isEdit = false, mealId = null) {
  currentResult = result;
  editingMealId = isEdit ? mealId : null;

  const sheet = document.getElementById('resultSheet');
  if (!sheet) return;
  sheet.style.display = '';

  // 저장 버튼 텍스트 변경
  const saveBtn = document.getElementById('resultSaveBtn');
  if (saveBtn) {
    saveBtn.textContent = isEdit ? '✅ 수정하기' : '✅ 기록하기';
  }

  // 음식 이름
  document.getElementById('resultFoodName').textContent = result.name || '알 수 없는 음식';

  // 100% 기준의 원본 영양소 구하기 (슬라이더 조절 시 복원하기 위함)
  const origCal = result.originalCalories || (result.portion ? Math.round(result.calories / (result.portion / 100)) : result.calories) || 0;
  const origCarbs = result.originalCarbs || (result.portion ? Math.round(result.carbs / (result.portion / 100)) : result.carbs) || 0;
  const origProtein = result.originalProtein || (result.portion ? Math.round(result.protein / (result.portion / 100)) : result.protein) || 0;
  const origFat = result.originalFat || (result.portion ? Math.round(result.fat / (result.portion / 100)) : result.fat) || 0;

  // 섭취량 슬라이더 설정
  const initialPortion = isEdit ? (result.portion || 100) : 100;
  const slider = document.getElementById('portionSlider');
  const sliderVal = document.getElementById('portionValue');
  if (slider && sliderVal) {
    slider.value = initialPortion;
    sliderVal.textContent = initialPortion;
  }

  // 실시간 영양성분 갱신 헬퍼
  function updateDisplayedNutrients(portionPercent) {
    const factor = portionPercent / 100;
    const calories = Math.round(origCal * factor);
    const carbs = Math.round(origCarbs * factor);
    const protein = Math.round(origProtein * factor);
    const fat = Math.round(origFat * factor);

    document.getElementById('resultCalories').textContent = numberWithCommas(calories);
    document.getElementById('resultCarbs').textContent = carbs + 'g';
    document.getElementById('resultProtein').textContent = protein + 'g';
    document.getElementById('resultFat').textContent = fat + 'g';
  }

  // 슬라이더 이벤트 장착
  if (slider) {
    slider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      if (sliderVal) sliderVal.textContent = val;
      updateDisplayedNutrients(val);
    };
  }

  // 초기값 기준으로 수치 출력
  updateDisplayedNutrients(initialPortion);

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
  selectedMealTime = isEdit ? (result.mealTime || 'snack') : getMealTimeKey(new Date());
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

  // 과거 날짜 기록 시 연월일은 selectedDate 기준, 시분초는 현재 시간 기준 조합
  const now = new Date();
  const recordDate = new Date(selectedDate);
  recordDate.setHours(now.getHours());
  recordDate.setMinutes(now.getMinutes());
  recordDate.setSeconds(now.getSeconds());
  recordDate.setMilliseconds(now.getMilliseconds());

  const slider = document.getElementById('portionSlider');
  const portion = slider ? parseInt(slider.value, 10) : 100;
  const factor = portion / 100;

  // 100% 기준의 원본 영양소 구하기 (슬라이더 조절 시 복원하기 위함)
  const origCal = currentResult.originalCalories || (currentResult.portion ? Math.round(currentResult.calories / (currentResult.portion / 100)) : currentResult.calories) || 0;
  const origCarbs = currentResult.originalCarbs || (currentResult.portion ? Math.round(currentResult.carbs / (currentResult.portion / 100)) : currentResult.carbs) || 0;
  const origProtein = currentResult.originalProtein || (currentResult.portion ? Math.round(currentResult.protein / (currentResult.portion / 100)) : currentResult.protein) || 0;
  const origFat = currentResult.originalFat || (currentResult.portion ? Math.round(currentResult.fat / (currentResult.portion / 100)) : currentResult.fat) || 0;

  if (editingMealId) {
    const timestamp = currentResult.timestamp || new Date().toISOString();
    const mealUpdate = {
      name: currentResult.name || '알 수 없는 음식',
      calories: Math.round(origCal * factor),
      protein: Math.round(origProtein * factor),
      carbs: Math.round(origCarbs * factor),
      fat: Math.round(origFat * factor),
      originalCalories: origCal,
      originalProtein: origProtein,
      originalCarbs: origCarbs,
      originalFat: origFat,
      ingredients: currentResult.ingredients || [],
      mealTime: selectedMealTime || 'snack',
      timestamp: timestamp,
      portion: portion,
    };
    updateMeal(editingMealId, mealUpdate);
    showToast('✅ 기록이 수정되었어요!');
  } else {
    const meal = {
      name: currentResult.name || '알 수 없는 음식',
      calories: Math.round(origCal * factor),
      protein: Math.round(origProtein * factor),
      carbs: Math.round(origCarbs * factor),
      fat: Math.round(origFat * factor),
      originalCalories: origCal,
      originalProtein: origProtein,
      originalCarbs: origCarbs,
      originalFat: origFat,
      ingredients: currentResult.ingredients || [],
      mealTime: selectedMealTime || 'snack',
      timestamp: recordDate.toISOString(),
      portion: portion,
    };
    addMeal(meal);
    showToast('✅ 기록이 저장되었어요!');
  }

  hideResultSheet();
  renderMealList();
  updateGauge();
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
// 8.6. [추가] 월간 캘린더 모달 제어 로직
// ============================================================
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

function showCalendarModal() {
  const modal = document.getElementById('calendarModal');
  if (!modal) return;
  
  currentCalYear = selectedDate.getFullYear();
  currentCalMonth = selectedDate.getMonth();
  
  renderCalendar();
  modal.style.display = '';
}

function hideCalendarModal() {
  const modal = document.getElementById('calendarModal');
  if (modal) modal.style.display = 'none';
}

function handleMonthChange(offset) {
  currentCalMonth += offset;
  if (currentCalMonth < 0) {
    currentCalMonth = 11;
    currentCalYear -= 1;
  } else if (currentCalMonth > 11) {
    currentCalMonth = 0;
    currentCalYear += 1;
  }
  renderCalendar();
}

function renderCalendar() {
  const gridBody = document.getElementById('calendarGridBody');
  const title = document.getElementById('calendarMonthTitle');
  if (!gridBody || !title) return;

  title.textContent = `${currentCalYear}년 ${String(currentCalMonth + 1).padStart(2, '0')}월`;

  // 1일의 요일 (0: 일, 1: 월, ...)
  const firstDayIndex = new Date(currentCalYear, currentCalMonth, 1).getDay();
  // 해당 월의 마지막 날짜
  const lastDate = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();

  let html = '';

  // 1일 시작 전 공백 칸 채우기
  for (let i = 0; i < firstDayIndex; i++) {
    html += '<div class="calendar-day calendar-day--empty"></div>';
  }

  const todayStr = formatDateStr(new Date());
  const selectedStr = formatDateStr(selectedDate);

  // 날짜별 루프
  for (let d = 1; d <= lastDate; d++) {
    const iterDate = new Date(currentCalYear, currentCalMonth, d);
    const iterDateStr = formatDateStr(iterDate);

    // 해당 날짜의 총 칼로리 계산
    const mealsKey = STORAGE_KEY_MEALS_PREFIX + iterDateStr;
    const mealsData = localStorage.getItem(mealsKey);
    const meals = mealsData ? JSON.parse(mealsData) : [];
    const totalCal = meals.reduce((acc, m) => acc + (m.calories || 0), 0);

    const targetCal = getTargetCalorie(iterDateStr);

    const isToday = iterDateStr === todayStr;
    const isSelected = iterDateStr === selectedStr;
    const classes = ['calendar-day'];
    if (isToday) classes.push('calendar-day--today');
    if (isSelected) classes.push('calendar-day--selected');

    let calText = '';
    let dotHtml = '';
    
    if (totalCal > 0) {
      calText = `${numberWithCommas(totalCal)}`;
      // 목표 이하이면 초록불, 초과이면 빨간불
      const dotClass = totalCal <= targetCal ? 'calendar-day__dot--success' : 'calendar-day__dot--danger';
      dotHtml = `<div class="calendar-day__dot ${dotClass}"></div>`;
    }

    html += `
      <div class="${classes.join(' ')}" data-date="${iterDateStr}">
        <span class="calendar-day__num">${d}</span>
        <span class="calendar-day__cal">${calText}</span>
        ${dotHtml}
      </div>
    `;
  }

  gridBody.innerHTML = html;

  // 날짜 클릭 이벤트 바인딩
  gridBody.querySelectorAll('.calendar-day').forEach(el => {
    if (el.classList.contains('calendar-day--empty')) return;
    el.addEventListener('click', () => {
      const dateStr = el.dataset.date;
      if (dateStr) {
        changeDate(new Date(dateStr));
        hideCalendarModal();
      }
    });
  });
}

// ============================================================
// 8.7. [추가] 주간 통계 바텀시트 제어 로직
// ============================================================
function showStatsSheet() {
  const sheet = document.getElementById('statsBottomSheet');
  if (!sheet) return;

  // 최근 7일 날짜 데이터 준비
  const daysData = [];
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateStr(d);
    
    // 식사 데이터 합산
    const key = STORAGE_KEY_MEALS_PREFIX + dateStr;
    const mealsData = localStorage.getItem(key);
    const meals = mealsData ? JSON.parse(mealsData) : [];
    const calories = meals.reduce((acc, m) => acc + (m.calories || 0), 0);

    // 날짜별 목표 칼로리
    const target = getTargetCalorie(dateStr);

    daysData.push({
      dateStr,
      label: weekDays[d.getDay()],
      calories,
      target
    });
  }

  // 1. 차트 그리기
  drawStatsChart(daysData);

  // 2. 통계 텍스트 업데이트
  const totalCal = daysData.reduce((acc, d) => acc + d.calories, 0);
  const avgCal = Math.round(totalCal / 7);
  document.getElementById('statsAvgCal').textContent = `${numberWithCommas(avgCal)} kcal`;

  const successCount = daysData.filter(d => d.calories > 0 && d.calories <= d.target).length;
  document.getElementById('statsSuccessCount').textContent = `${successCount}회 / 7일`;

  sheet.style.display = '';
}

function hideStatsSheet() {
  const sheet = document.getElementById('statsBottomSheet');
  if (sheet) sheet.style.display = 'none';
}

function drawStatsChart(data) {
  const container = document.getElementById('statsChartContainer');
  if (!container) return;

  const width = 300;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 25;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Y축 최대 스케일 계산 (최소 2000)
  const maxVal = Math.max(...data.map(d => Math.max(d.calories, d.target)), 2000);

  // Y좌표 변환 헬퍼
  const getY = val => paddingTop + chartH * (1 - val / maxVal);
  // X좌표 변환 (7개 막대 균등 분할)
  const getX = index => paddingLeft + (chartW / 6) * index;

  // SVG 생성
  let svgHtml = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 초록색 그라데이션 (막대용) -->
        <linearGradient id="chartBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>
  `;

  // 1. 배경 가이드라인 (3개 수평선)
  const gridVals = [maxVal * 0.33, maxVal * 0.66, maxVal];
  gridVals.forEach(v => {
    const y = getY(v);
    svgHtml += `<line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />`;
    // Y축 라벨
    svgHtml += `<text x="${paddingLeft - 5}" y="${y + 3}" font-size="7" font-weight="600" fill="#9ca3af" text-anchor="end">${Math.round(v)}</text>`;
  });

  // 2. 막대 배경 및 막대 그래프 그리기
  const barWidth = 14;
  data.forEach((d, i) => {
    const x = getX(i);
    const barH = chartH * (d.calories / maxVal);
    const barY = getY(d.calories);
    const bgY = paddingTop;

    // 회색 배경 막대
    svgHtml += `
      <rect class="chart-bar-bg" x="${x - barWidth/2}" y="${bgY}" width="${barWidth}" height="${chartH}" />
    `;

    // 실제 칼로리 막대 (칼로리가 있는 경우만)
    if (d.calories > 0) {
      svgHtml += `
        <rect class="chart-bar-fill" x="${x - barWidth/2}" y="${barY}" width="${barWidth}" height="${barH}" />
        <!-- 칼로리 텍스트 -->
        <text class="chart-text chart-text--cal" x="${x}" y="${barY - 5}">${Math.round(d.calories)}</text>
      `;
    }

    // X축 요일 표시
    svgHtml += `
      <text class="chart-text chart-text--date" x="${x}" y="${height - paddingBottom + 16}">${d.label}</text>
    `;
  });

  // 3. 목표 칼로리 꺾은선 (Polyline/Path) 그리기
  let linePoints = [];
  data.forEach((d, i) => {
    const x = getX(i);
    const y = getY(d.target);
    linePoints.push(`${x},${y}`);
  });

  // 주황색 가이드라인 꺾은선
  svgHtml += `
    <polyline class="chart-target-line" points="${linePoints.join(' ')}" />
  `;

  // 목표 꺾은선 위의 도트들
  data.forEach((d, i) => {
    const x = getX(i);
    const y = getY(d.target);
    svgHtml += `
      <circle class="chart-target-point" cx="${x}" cy="${y}" r="3.5" />
    `;
  });

  svgHtml += '</svg>';
  container.innerHTML = svgHtml;
}

// ============================================================
// 8.5. [추가] 날짜 네비게이터 & 스와이프 제스처 핸들링
// ============================================================
function updateDateDisplay() {
  const dateText = document.getElementById('dateText');
  const todayTag = document.getElementById('dateTodayTag');
  
  if (!dateText) return;

  const y = selectedDate.getFullYear();
  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const d = String(selectedDate.getDate()).padStart(2, '0');
  dateText.textContent = `${y}.${m}.${d}`;

  // 오늘/어제 여부 태그 표시
  const todayStr = formatDateStr(new Date());
  const selectedStr = formatDateStr(selectedDate);

  if (todayStr === selectedStr) {
    if (todayTag) {
      todayTag.style.display = '';
      todayTag.textContent = '오늘';
    }
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateStr(yesterday);
    if (selectedStr === yesterdayStr) {
      if (todayTag) {
        todayTag.style.display = '';
        todayTag.textContent = '어제';
      }
    } else {
      if (todayTag) todayTag.style.display = 'none';
    }
  }

  // 내일 버튼 활성화 여부 (미래 날짜는 기록할 수 없도록 방지)
  const btnNextDate = document.getElementById('btnNextDate');
  if (btnNextDate) {
    const isToday = todayStr === selectedStr;
    btnNextDate.disabled = isToday;
    btnNextDate.style.opacity = isToday ? '0.3' : '1';
  }
}

function changeDate(offsetOrDate) {
  let newDate;
  let direction = 0; // -1: 어제, 1: 내일

  if (typeof offsetOrDate === 'number') {
    newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + offsetOrDate);
    direction = offsetOrDate;
  } else if (offsetOrDate instanceof Date) {
    newDate = offsetOrDate;
    direction = offsetOrDate.getTime() > selectedDate.getTime() ? 1 : -1;
  } else {
    return;
  }

  // 미래 날짜 선택 제한
  const today = new Date();
  today.setHours(0,0,0,0);
  const checkNew = new Date(newDate);
  checkNew.setHours(0,0,0,0);
  if (checkNew.getTime() > today.getTime()) {
    showToast('💡 미래 날짜는 미리 기록할 수 없어요!');
    return;
  }

  const mainEl = document.querySelector('.calorie-main');
  
  // 애니메이션 연출 (좌우 슥 사라지는 효과)
  if (mainEl) {
    mainEl.classList.remove('swipe-fade-in', 'swipe-left', 'swipe-right');
    void mainEl.offsetWidth; // 브라우저 리플로우 유도
    mainEl.classList.add(direction > 0 ? 'swipe-left' : 'swipe-right');
  }

  setTimeout(() => {
    selectedDate = newDate;
    
    // 데이터 로드 & UI 갱신
    updateGauge();
    renderMealList();
    updateDateDisplay();

    // 혹시 떠있을지 모르는 음식 결과 바텀시트는 닫기
    hideResultSheet();

    if (mainEl) {
      mainEl.classList.remove('swipe-left', 'swipe-right');
      mainEl.classList.add('swipe-fade-in');
    }
  }, 150);
}

// 스와이프 제스처 관련 전역 상태
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function initSwipeGestures() {
  const mainEl = document.querySelector('.calorie-main');
  if (!mainEl) return;

  mainEl.addEventListener('touchstart', (e) => {
    // 팝업 모달이나 분석 중 오버레이 등이 떠 있을 때는 날짜 스와이프 금지
    if (isModalOrSheetOpen()) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  mainEl.addEventListener('touchend', (e) => {
    if (isModalOrSheetOpen()) return;
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipeGesture();
  }, { passive: true });
}

function isModalOrSheetOpen() {
  const calendarModal = document.getElementById('calendarModal');
  const statsSheet = document.getElementById('statsBottomSheet');
  const targetModal = document.getElementById('targetModal');
  const resultSheet = document.getElementById('resultSheet');
  const scannerOverlay = document.getElementById('calorieScannerOverlay');
  const analysisOverlay = document.getElementById('analysisOverlay');

  return (calendarModal && calendarModal.style.display !== 'none') ||
         (statsSheet && statsSheet.style.display !== 'none') ||
         (targetModal && targetModal.style.display !== 'none') ||
         (resultSheet && resultSheet.style.display !== 'none') ||
         (scannerOverlay && scannerOverlay.style.display !== 'none') ||
         (analysisOverlay && analysisOverlay.style.display !== 'none');
}

function handleSwipeGesture() {
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // 가로 스와이프가 세로 스크롤보다 우세하고 60px 이상 이동 시 판정
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
    if (diffX > 0) {
      // 오른쪽으로 슉 -> 이전 날짜 (어제)
      changeDate(-1);
    } else {
      // 왼쪽으로 슉 -> 다음 날짜 (내일)
      changeDate(1);
    }
  }
}

// ============================================================
// 9. 초기화
// ============================================================
async function init() {
  localStorage.setItem('lastTab', 'calorie.html');
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

  // [추가] 날짜 네비게이션 버튼 연동
  const btnPrev = document.getElementById('btnPrevDate');
  if (btnPrev) btnPrev.addEventListener('click', () => changeDate(-1));
  const btnNext = document.getElementById('btnNextDate');
  if (btnNext) btnNext.addEventListener('click', () => changeDate(1));

  // [추가] 캘린더 모달 제어 이벤트 연동
  const dateDisplay = document.getElementById('dateDisplay');
  if (dateDisplay) dateDisplay.addEventListener('click', showCalendarModal);
  const calendarBackdrop = document.getElementById('calendarModalBackdrop');
  if (calendarBackdrop) calendarBackdrop.addEventListener('click', hideCalendarModal);
  const btnCloseCal = document.getElementById('btnCloseCalendar');
  if (btnCloseCal) btnCloseCal.addEventListener('click', hideCalendarModal);
  const btnPrevMonth = document.getElementById('btnPrevMonth');
  if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => handleMonthChange(-1));
  const btnNextMonth = document.getElementById('btnNextMonth');
  if (btnNextMonth) btnNextMonth.addEventListener('click', () => handleMonthChange(1));

  // [추가] 주간 통계 바텀시트 제어 이벤트 연동
  const btnOpenStats = document.getElementById('btnOpenStats');
  if (btnOpenStats) btnOpenStats.addEventListener('click', showStatsSheet);
  const statsBackdrop = document.getElementById('statsSheetBackdrop');
  if (statsBackdrop) statsBackdrop.addEventListener('click', hideStatsSheet);
  const btnCloseSt = document.getElementById('btnCloseStats');
  if (btnCloseSt) btnCloseSt.addEventListener('click', hideStatsSheet);

  // [추가] 날짜 표시 초기화 및 스와이프 이벤트 개시
  updateDateDisplay();
  initSwipeGestures();

  // 갤러리 파일 입력 이벤트 연동
  const galleryInput = document.getElementById('calorieGalleryInput');
  if (galleryInput) galleryInput.addEventListener('change', handleGalleryFileChange);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
