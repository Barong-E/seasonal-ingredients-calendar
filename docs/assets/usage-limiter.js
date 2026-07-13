const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index2.js","assets/app-back-button.js","assets/app-back-button.css"])))=>i.map(i=>d[i]);
import{_ as h}from"./app-back-button.js";import{a as l,d as x,e as y,g as v,s as I}from"./firebase-init.js";import{c as S}from"./subscription.js";let i=null,f=!1;const A="ca-app-pub-3940256099942544/5224354917";async function C(){try{if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()){f=!0;const{AdMob:t}=await h(async()=>{const{AdMob:e}=await import("./index2.js").then(o=>o.i);return{AdMob:e}},__vite__mapDeps([0,1,2]));i=t,await i.initialize(),console.log("AdMob SDK 초기화 완료")}}catch(t){console.warn("AdMob SDK 초기화 실패 (일반 웹 브라우저 환경):",t)}}C();async function M(){if(!(!f||!i))try{await i.prepareRewardAd({adId:A}),console.log("리워드 광고 로드 준비 완료")}catch(t){console.error("리워드 광고 준비 중 에러:",t)}}async function k(t,e){if(f&&i)try{await M();let o=!1;const a=await i.addListener("onAdMobRewardAdReward",s=>{console.log("사용자가 보상을 획득했습니다! 보상 종류:",s.type,"금액:",s.amount),o=!0}),n=await i.addListener("onAdMobRewardAdDismissed",()=>{a.remove(),n.remove(),o?t&&t():e&&e("광고를 끝까지 시청하지 않아 혜택을 받을 수 없습니다.")});await i.showRewardAd()}catch(o){console.error("AdMob 광고 실행 실패, 웹 모사 모드로 전환:",o),b(t,e)}else b(t,e)}function b(t,e){const o="webSimulatedAdModal";let a=document.getElementById(o);a&&a.remove();const n=document.createElement("div");n.id=o,n.className="ad-sim-modal";const s="webSimulatedAdStyle";if(!document.getElementById(s)){const u=document.createElement("style");u.id=s,u.innerHTML=`
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
    `,document.head.appendChild(u)}n.innerHTML=`
    <div class="ad-sim-box">
      <h3 class="ad-sim-title">📺 무료 촬영 기회 획득</h3>
      <p class="ad-sim-subtitle">광고를 5초 동안 끝까지 시청해 주세요.</p>
      <div class="ad-sim-media">🥑🥦🍎</div>
      <div class="ad-sim-counter" id="adSimCounter">남은 시간: 5초</div>
      <button class="ad-sim-btn-close" id="adSimCloseBtn" type="button">닫기 (건너뛰기)</button>
    </div>
  `,document.body.appendChild(n);let r=5;const d=document.getElementById("adSimCounter"),c=document.getElementById("adSimCloseBtn"),g=setInterval(()=>{r--,r>0?d&&(d.textContent=`남은 시간: ${r}초`):(clearInterval(g),d&&(d.textContent="🎉 보상 획득 가능!"),c&&(c.textContent="✅ 시청 완료 (촬영하기)",c.classList.add("active")))},1e3);c.onclick=()=>{clearInterval(g),n.remove(),r<=0?t&&t():e&&e("광고 시청이 완료되지 않아 보상을 획득할 수 없습니다.")}}function m(){const t=new Date,e=t.getFullYear(),o=String(t.getMonth()+1).padStart(2,"0"),a=String(t.getDate()).padStart(2,"0");return`${e}-${o}-${a}`}function p(t){const e=localStorage.getItem(`usage:count:${t}`);return e?parseInt(e,10):0}function w(t){const e=p(t);return localStorage.setItem(`usage:count:${t}`,e+1),e+1}async function E(){const t=m();if(l.currentUser)try{const e=x(y,"users",l.currentUser.uid,"limits",t),o=await v(e);if(o.exists()){const a=o.data().count||0;return localStorage.setItem(`usage:count:${t}`,a),a}}catch(e){console.warn("서버 사용량 조회 실패(오프라인 가능성), 로컬 값으로 대체:",e)}return p(t)}async function D(){const t=m(),e=w(t);if(l.currentUser)try{const o=x(y,"users",l.currentUser.uid,"limits",t);await I(o,{count:e,updatedAt:new Date().toISOString()})}catch(o){console.warn("서버 사용량 업데이트 실패(오프라인):",o)}return e}async function z(t,e){if(S()){console.log("VIP 멤버십 회원: 무제한 패스"),t&&t();return}try{const a=await E();console.log(`오늘의 촬영 횟수: ${a} / 3`),a<3?(await D(),t&&t()):e?e():alert("오늘의 무료 촬영 횟수(3회)를 모두 사용하셨습니다. 정기 구독 시 광고 없이 무제한 사용 가능합니다.")}catch(a){console.error("제한 체크 중 오류 발생:",a),p(m())<3?(w(m()),t&&t()):e&&e()}}export{z as c,k as s};
