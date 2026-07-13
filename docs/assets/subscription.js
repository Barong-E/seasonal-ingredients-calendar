import{a as m,d as l,e as f,s as g,g as b}from"./firebase-init.js";const p="premium_monthly";let a=null,u=!1;async function x(){window.CdvPurchase&&window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()?(u=!0,a=window.CdvPurchase.store,a.register({id:p,type:window.CdvPurchase.ProductType.PAID_SUBSCRIPTION,platform:window.CdvPurchase.Platform.GOOGLE_PLAY}),a.when().approved(async e=>{console.log("구매 승인됨:",e),await y(e.id,e.purchaseToken),await e.verify(),e.finish()}).verified(e=>{console.log("영수증 검증 성공:",e),e.finish()}),a.initialize([window.CdvPurchase.Platform.GOOGLE_PLAY]),console.log("네이티브 인앱 스토어 초기화 완료")):console.warn("인앱 스토어 초기화 건너뜀 (웹 브라우저 테스트 환경)")}x();function h(){const e=localStorage.getItem("subscription:is_vip")==="true",t=localStorage.getItem("subscription:expires_at");if(e&&t){const i=new Date(t).getTime(),o=new Date().getTime();if(i>o)return!0;localStorage.removeItem("subscription:is_vip"),localStorage.removeItem("subscription:expires_at")}return!1}async function S(e){try{const t=l(f,"users",e,"profile","subscription"),i=await b(t);if(i.exists()){const s=i.data().expiresAt;if(s){const r=new Date(s).getTime(),c=new Date().getTime();if(r>c)return localStorage.setItem("subscription:is_vip","true"),localStorage.setItem("subscription:expires_at",s),!0}}}catch(t){console.warn("서버 VIP 상태 조회 실패(오프라인 가능성):",t)}return h()}async function I(e,t){if(u&&a)try{const i=a.get(p);if(i&&i.canPurchase)a.order(p);else throw new Error("상품을 현재 구매할 수 없는 상태입니다. (스토어 확인 필요)")}catch(i){console.error("구매 요청 실패:",i),t&&t(i.message||"구매를 시작할 수 없습니다.")}else w(e,t)}async function y(e,t){const i=new Date;i.setDate(i.getDate()+30);const o=i.toISOString();if(localStorage.setItem("subscription:is_vip","true"),localStorage.setItem("subscription:expires_at",o),m.currentUser)try{const s=l(f,"users",m.currentUser.uid,"profile","subscription");await g(s,{isVip:!0,expiresAt:o,transactionId:e||"simulated_tx_id",purchaseToken:t||"simulated_token",updatedAt:new Date().toISOString()}),console.log("VIP 구독 정보 서버 저장 완료")}catch(s){console.error("VIP 정보 서버 동기화 에러:",s)}}function w(e,t){const i="webSimulatedPaymentModal";let o=document.getElementById(i);o&&o.remove();const s=document.createElement("div");s.id=i,s.className="pay-sim-modal";const r="webSimulatedPayStyle";if(!document.getElementById(r)){const n=document.createElement("style");n.id=r,n.innerHTML=`
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
    `,document.head.appendChild(n)}s.innerHTML=`
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
  `,document.body.appendChild(s);const c=document.getElementById("paySimCloseX"),d=document.getElementById("paySimBtn");c.onclick=()=>{s.remove(),t&&t("사용자가 결제를 취소했습니다.")},d.onclick=async()=>{try{d.disabled=!0,d.textContent="결제 승인 중...",setTimeout(async()=>{await y("sim_tx_"+Date.now().toString(36),"sim_token_"+Math.random().toString(36).substr(2)),s.remove(),e&&e()},500)}catch(n){s.remove(),t&&t(n.message||n)}}}export{h as c,I as p,S as s};
