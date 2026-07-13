// subscription.js
// 정기 결제(인앱 구독) 및 VIP 상태 관리 모듈
// - 네이티브 환경: cordova-plugin-purchase API 연동 (Google Play Billing)
// - 웹 브라우저 환경: 가상 결제창 모달을 띄워 결제 시뮬레이션 작동
// - 공통: 로그인 시 결제 영수증 정보를 Firestore 서버에 안전하게 백업

import { auth, db } from './firebase-init.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PRODUCT_ID = 'premium_monthly'; // 구글 플레이 콘솔에 등록할 정기 구독 상품 ID
let store = null;
let isNative = false;

// VIP 상태 전역 캐시
let isVipCached = false;
let vipExpiresAtCached = null;

/**
 * 인앱 결제 상점 초기화
 */
async function initStore() {
  if (window.CdvPurchase && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    isNative = true;
    store = window.CdvPurchase.store;
    
    // 1. 상품 등록
    store.register({
      id: PRODUCT_ID,
      type: window.CdvPurchase.ProductType.PAID_SUBSCRIPTION,
      platform: window.CdvPurchase.Platform.GOOGLE_PLAY,
    });

    // 2. 구매 완료 및 갱신 이벤트 핸들러
    store.when()
      .approved(async (transaction) => {
        console.log("구매 승인됨:", transaction);
        // 결제 완료(영수증 검증 등) 처리 후 거래 완료 선언 필수
        await handleSuccessfulPurchase(transaction.id, transaction.purchaseToken);
        await transaction.verify();
        transaction.finish();
      })
      .verified((receipt) => {
        console.log("영수증 검증 성공:", receipt);
        receipt.finish();
      });

    // 3. 스토어 초기 로드 시작
    store.initialize([window.CdvPurchase.Platform.GOOGLE_PLAY]);
    console.log("네이티브 인앱 스토어 초기화 완료");
  } else {
    console.warn("인앱 스토어 초기화 건너뜀 (웹 브라우저 테스트 환경)");
  }
}

// 스크립트 로드 시 즉시 초기화
initStore();

/**
 * 로컬 저장소에서 VIP 상태를 즉시 읽어오는 동기식 헬퍼 함수
 */
export function checkVIPStatusLocal() {
  const isVip = localStorage.getItem('subscription:is_vip') === 'true';
  const expiresAt = localStorage.getItem('subscription:expires_at');
  
  if (isVip && expiresAt) {
    const expireTime = new Date(expiresAt).getTime();
    const nowTime = new Date().getTime();
    if (expireTime > nowTime) {
      return true; // 아직 만료되지 않은 유효한 VIP
    } else {
      // 기간 만료 처리
      localStorage.removeItem('subscription:is_vip');
      localStorage.removeItem('subscription:expires_at');
    }
  }
  return false;
}

/**
 * 로그인 상태인 경우 서버(Firestore)에서 최신 VIP 구독 상태를 동기화하여 가져옴
 */
export async function syncVIPStatusFromServer(userId) {
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'subscription');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const expiresAt = data.expiresAt;
      if (expiresAt) {
        const expireTime = new Date(expiresAt).getTime();
        const nowTime = new Date().getTime();
        if (expireTime > nowTime) {
          localStorage.setItem('subscription:is_vip', 'true');
          localStorage.setItem('subscription:expires_at', expiresAt);
          return true;
        }
      }
    }
  } catch (error) {
    console.warn('서버 VIP 상태 조회 실패(오프라인 가능성):', error);
  }
  return checkVIPStatusLocal();
}

/**
 * 결제 구매 처리 호출 함수
 */
export async function purchaseSubscription(onSuccess, onError) {
  if (isNative && store) {
    // 📱 실제 구글 플레이 결제창 띄우기
    try {
      const product = store.get(PRODUCT_ID);
      if (product && product.canPurchase) {
        store.order(PRODUCT_ID);
      } else {
        throw new Error("상품을 현재 구매할 수 없는 상태입니다. (스토어 확인 필요)");
      }
    } catch (e) {
      console.error("구매 요청 실패:", e);
      if (onError) onError(e.message || "구매를 시작할 수 없습니다.");
    }
  } else {
    // 🖥️ 웹 브라우저 테스트 환경: 가상 결제창 모달 띄우기
    showWebSimulatedPayment(onSuccess, onError);
  }
}

/**
 * 결제 성공 후 VIP 상태 갱신 및 서버 업로드 공통 로직
 */
async function handleSuccessfulPurchase(transactionId, purchaseToken) {
  // 오늘 날짜 기준 30일 뒤 만료 설정 (테스트용 한 달 구독권)
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 30);
  const expiresAtStr = expireDate.toISOString();

  // 1. 로컬 저장소 갱신
  localStorage.setItem('subscription:is_vip', 'true');
  localStorage.setItem('subscription:expires_at', expiresAtStr);

  // 2. 구글 로그인 상태라면 파이어베이스 서버 데이터베이스에 백업
  if (auth.currentUser) {
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'profile', 'subscription');
      await setDoc(docRef, {
        isVip: true,
        expiresAt: expiresAtStr,
        transactionId: transactionId || 'simulated_tx_id',
        purchaseToken: purchaseToken || 'simulated_token',
        updatedAt: new Date().toISOString()
      });
      console.log("VIP 구독 정보 서버 저장 완료");
    } catch (e) {
      console.error("VIP 정보 서버 동기화 에러:", e);
    }
  }
}

/**
 * 웹 환경에서 결제를 모사해주는 가상 결제창 모달
 */
function showWebSimulatedPayment(onSuccess, onError) {
  const modalId = "webSimulatedPaymentModal";
  let existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'pay-sim-modal';

  const styleId = "webSimulatedPayStyle";
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .pay-sim-modal {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        font-family: sans-serif; padding: 20px;
      }
      .pay-sim-box {
        background: #ffffff; border-radius: 20px;
        padding: 30px; max-width: 420px; width: 100%;
        box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        color: #1f2937;
      }
      .pay-sim-header {
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid #f3f4f6; padding-bottom: 15px; margin-bottom: 20px;
      }
      .pay-sim-title { font-size: 1.25rem; font-weight: 800; color: #111827; margin: 0; }
      .pay-sim-close-x { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #9ca3af; }
      
      .pay-sim-info-card {
        background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px;
        padding: 16px; margin-bottom: 24px;
      }
      .pay-sim-item-name { font-size: 1.05rem; font-weight: bold; margin: 0 0 4px; }
      .pay-sim-item-desc { font-size: 0.85rem; color: #6b7280; margin: 0 0 12px; }
      .pay-sim-price { font-size: 1.4rem; font-weight: 800; color: #10b981; }

      .pay-sim-method {
        display: flex; align-items: center; gap: 12px;
        border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin-bottom: 24px;
      }
      .pay-sim-method-icon { font-size: 1.5rem; }
      .pay-sim-method-text { font-size: 0.9rem; font-weight: 600; }
      
      .pay-sim-btn-pay {
        width: 100%; background: #10b981; color: #ffffff; border: none;
        border-radius: 12px; padding: 14px; font-size: 1rem; font-weight: bold;
        cursor: pointer; transition: background 0.2s;
      }
      .pay-sim-btn-pay:hover { background: #059669; }
    `;
    document.head.appendChild(style);
  }

  modal.innerHTML = `
    <div class="pay-sim-box">
      <div class="pay-sim-header">
        <h3 class="pay-sim-title">💳 가상 인앱 결제</h3>
        <button class="pay-sim-close-x" id="paySimCloseX">✕</button>
      </div>
      <div class="pay-sim-info-card">
        <p class="pay-sim-item-name">👑 프리미엄 한 달 무제한 이용권</p>
        <p class="pay-sim-item-desc">하루 3회 제한 및 광고 시청 없이 제철 식재료 카메라와 칼로리 분석 기능을 무제한으로 사용해 보세요.</p>
        <span class="pay-sim-price">월 2,900원</span>
      </div>
      <div class="pay-sim-method">
        <span class="pay-sim-method-icon">🦖</span>
        <div class="pay-sim-method-info">
          <p class="pay-sim-method-text" style="margin:0;">구글 플레이 계정 테스트 카드</p>
          <span style="font-size:0.75rem; color:#9ca3af;">visa-4242-test</span>
        </div>
      </div>
      <button class="pay-sim-btn-pay" id="paySimBtn">구독하기</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('paySimCloseX');
  const payBtn = document.getElementById('paySimBtn');

  closeBtn.onclick = () => {
    modal.remove();
    if (onError) onError("사용자가 결제를 취소했습니다.");
  };

  payBtn.onclick = async () => {
    try {
      payBtn.disabled = true;
      payBtn.textContent = "결제 승인 중...";
      
      // 500ms 결제 모사 연출 후 상태 갱신
      setTimeout(async () => {
        await handleSuccessfulPurchase('sim_tx_' + Date.now().toString(36), 'sim_token_' + Math.random().toString(36).substr(2));
        modal.remove();
        if (onSuccess) onSuccess();
      }, 500);
    } catch (err) {
      modal.remove();
      if (onError) onError(err.message || err);
    }
  };
}
