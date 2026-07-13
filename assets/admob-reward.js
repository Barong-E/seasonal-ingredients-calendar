// admob-reward.js
// 구글 애드몹 보상형 광고(Reward Ad) 제어 모듈
// - 네이티브 환경: 실제 AdMob SDK를 구동하여 5초 광고 시청 후 콜백 수신
// - 웹 브라우저 환경: 5초짜리 임시 광고 카운트다운 모달을 띄워 광고 동작 시뮬레이션

let AdMob = null;
let isNative = false;

// ⚠️ 대표님의 실제 광고단위 ID가 준비되면 여기에 교체해 넣습니다.
// (현재는 구글 공식 안드로이드 보상형 광고 테스트 ID입니다)
const REWARD_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

/**
 * AdMob 플러그인 초기화 및 세팅
 */
async function initAdMob() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      isNative = true;
      const { AdMob: admobPlugin } = await import('@capacitor-community/admob');
      AdMob = admobPlugin;
      await AdMob.initialize();
      console.log("AdMob SDK 초기화 완료");
    }
  } catch (e) {
    console.warn("AdMob SDK 초기화 실패 (일반 웹 브라우저 환경):", e);
  }
}

// 스크립트 로드 시 즉시 초기화
initAdMob();

/**
 * 리워드 광고를 사전에 로드해두는 함수 (광고 로딩 딜레이 방지)
 */
export async function prepareRewardAd() {
  if (!isNative || !AdMob) return;
  try {
    await AdMob.prepareRewardAd({
      adId: REWARD_AD_UNIT_ID,
      // 필요한 경우 사용자 지정 데이터 전달 가능
    });
    console.log("리워드 광고 로드 준비 완료");
  } catch (e) {
    console.error("리워드 광고 준비 중 에러:", e);
  }
}

/**
 * 리워드 광고 표시 및 시청 보상 획득 처리 함수
 * @param {Function} onRewardSuccess - 5초 시청 완료 시 실행할 촬영 허가 콜백
 * @param {Function} onRewardCancel - 도중 종료/실패 시 실행할 안내 콜백
 */
export async function showRewardAd(onRewardSuccess, onRewardCancel) {
  if (isNative && AdMob) {
    // 📱 실제 네이티브 앱 광고 띄우기
    try {
      // 1. 광고 다시 한 번 준비 (만약의 유실 대비)
      await prepareRewardAd();

      let rewardEarned = false;

      // 2. 보상 획득 이벤트 리스너 등록
      const rewardListener = await AdMob.addListener('onAdMobRewardAdReward', (info) => {
        console.log("사용자가 보상을 획득했습니다! 보상 종류:", info.type, "금액:", info.amount);
        rewardEarned = true;
      });

      // 3. 광고 종료 이벤트 리스너 등록 (닫혔을 때)
      const dismissListener = await AdMob.addListener('onAdMobRewardAdDismissed', () => {
        // 리스너 비우기
        rewardListener.remove();
        dismissListener.remove();

        if (rewardEarned) {
          if (onRewardSuccess) onRewardSuccess();
        } else {
          if (onRewardCancel) onRewardCancel("광고를 끝까지 시청하지 않아 혜택을 받을 수 없습니다.");
        }
      });

      // 4. 광고 실행
      await AdMob.showRewardAd();
    } catch (e) {
      console.error("AdMob 광고 실행 실패, 웹 모사 모드로 전환:", e);
      showWebSimulatedAd(onRewardSuccess, onRewardCancel);
    }
  } else {
    // 🖥️ 웹 브라우저 테스트 환경: 5초 가짜 광고 팝업창 모사
    showWebSimulatedAd(onRewardSuccess, onRewardCancel);
  }
}

/**
 * 웹 환경에서 5초 광고 시청 상황을 모사해주는 가상 광고창 모달
 */
function showWebSimulatedAd(onSuccess, onCancel) {
  const modalId = "webSimulatedAdModal";
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ad-sim-modal';
  
  // 가상 광고 스타일을 동적 삽입
  const styleId = "webSimulatedAdStyle";
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .ad-sim-modal {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.9); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: #fff; font-family: sans-serif; padding: 20px; text-align: center;
      }
      .ad-sim-box {
        background: #1e1e1e; border: 2px solid #333; border-radius: 16px;
        padding: 30px; max-width: 400px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }
      .ad-sim-title { font-size: 1.4rem; font-weight: 800; color: #10b981; margin: 0 0 10px; }
      .ad-sim-subtitle { font-size: 0.9rem; color: #9ca3af; margin: 0 0 20px; }
      .ad-sim-media {
        background: #2d2d2d; height: 180px; border-radius: 8px; margin: 0 0 20px;
        display: flex; align-items: center; justify-content: center; font-size: 2.5rem;
        border: 1px dashed #444; position: relative; overflow: hidden;
      }
      .ad-sim-media::after {
        content: "ADVERTISEMENT"; position: absolute; top: 8px; left: 8px;
        font-size: 0.6rem; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px;
        color: #9ca3af; font-weight: bold;
      }
      .ad-sim-counter {
        font-size: 1.1rem; font-weight: bold; margin: 0 0 20px; color: #f59e0b;
      }
      .ad-sim-btn-close {
        background: #ef4444; color: #fff; border: none; border-radius: 8px;
        padding: 10px 20px; font-size: 0.95rem; font-weight: bold; cursor: pointer;
        opacity: 0.5; pointer-events: none; transition: all 0.3s;
      }
      .ad-sim-btn-close.active { opacity: 1; pointer-events: all; }
    `;
    document.head.appendChild(style);
  }

  modal.innerHTML = `
    <div class="ad-sim-box">
      <h3 class="ad-sim-title">📺 무료 촬영 기회 획득</h3>
      <p class="ad-sim-subtitle">광고를 5초 동안 끝까지 시청해 주세요.</p>
      <div class="ad-sim-media">🥑🥦🍎</div>
      <div class="ad-sim-counter" id="adSimCounter">남은 시간: 5초</div>
      <button class="ad-sim-btn-close" id="adSimCloseBtn" type="button">닫기 (건너뛰기)</button>
    </div>
  `;

  document.body.appendChild(modal);

  let secondsLeft = 5;
  const counterEl = document.getElementById('adSimCounter');
  const closeBtn = document.getElementById('adSimCloseBtn');

  const timer = setInterval(() => {
    secondsLeft--;
    if (secondsLeft > 0) {
      if (counterEl) counterEl.textContent = `남은 시간: ${secondsLeft}초`;
    } else {
      clearInterval(timer);
      if (counterEl) counterEl.textContent = `🎉 보상 획득 가능!`;
      if (closeBtn) {
        closeBtn.textContent = "✅ 시청 완료 (촬영하기)";
        closeBtn.classList.add('active');
      }
    }
  }, 1000);

  // 닫기 클릭 시 시청 여부 확인 후 콜백 분기
  closeBtn.onclick = () => {
    clearInterval(timer);
    modal.remove();
    if (secondsLeft <= 0) {
      if (onSuccess) onSuccess();
    } else {
      if (onCancel) onCancel("광고 시청이 완료되지 않아 보상을 획득할 수 없습니다.");
    }
  };
}
