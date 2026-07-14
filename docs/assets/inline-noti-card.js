const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/setting3.js","assets/app-back-button.js","assets/app-back-button.css","assets/index.js","assets/korean-lunar-calendar.js","assets/firebase-init.js","assets/subscription.js"])))=>i.map(i=>d[i]);
import{C as p,_ as y}from"./app-back-button.js";async function S(){const{loadSettings:n}=await y(async()=>{const{loadSettings:e}=await import("./setting3.js");return{loadSettings:e}},__vite__mapDeps([0,1,2,3,4,5,6]));return n()}async function w(n){const{saveSettings:e}=await y(async()=>{const{saveSettings:t}=await import("./setting3.js");return{saveSettings:t}},__vite__mapDeps([0,1,2,3,4,5,6]));return e(n)}function E(){const n=document.getElementById("webNotificationInfoModal");n&&n.remove();const e=document.createElement("div");e.id="webNotificationInfoModal",e.className="info-modal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.innerHTML=`
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <div class="info-modal__buttons">
        <button type="button" class="info-modal__btn info-modal__btn--ios" disabled>iOS (준비중)</button>
        <a href="https://play.google.com/store/apps/details?id=net.seasonalfood.app&referrer=utm_source%3Dseasonalfood_web%26utm_medium%3Dinternal%26utm_campaign%3Dinline_noti" target="_blank" rel="noopener noreferrer" class="info-modal__btn info-modal__btn--android">Android 설치</a>
      </div>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;function t(){e.remove(),document.body.style.overflow=""}e.querySelector(".info-modal__backdrop").addEventListener("click",t),e.querySelector(".info-modal__close").addEventListener("click",t),document.body.appendChild(e),document.body.style.overflow="hidden"}function L(){let n="";for(let e=1;e<=28;e++)n+=`<option value="${e}">매월 ${e}일</option>`;return n}function D(){return`
    <option value="0">당일</option>
    <option value="1">1일 전</option>
    <option value="3">3일 전</option>
    <option value="7">7일 전</option>
  `}function N(n){const e=n==="ingredient",t=e?"제철 식재료 알림":"명절·절기 알림",i=document.createElement("section");return i.className="inline-noti-card",i.setAttribute("aria-label",`${t} 설정`),i.innerHTML=`
    <div class="inline-noti-card__row">
      <span class="inline-noti-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      </span>
      <div class="inline-noti-card__text">
        <h2 class="inline-noti-card__title">${t}</h2>
      </div>
      <label class="switch">
        <input type="checkbox" class="inline-noti-toggle" aria-label="${t} 켜기">
        <span class="slider round"></span>
      </label>
    </div>
    <div class="inline-noti-card__detail">
      <div class="inline-noti-card__fields">
        <div class="inline-noti-card__field">
          <label for="inlineNotiSelect_${n}">${e?"알림 날짜":"알림 시점"}</label>
          <select id="inlineNotiSelect_${n}" class="inline-noti-select">
            ${e?L():D()}
          </select>
        </div>
        <div class="inline-noti-card__field">
          <label for="inlineNotiTime_${n}">알림 시간</label>
          <input id="inlineNotiTime_${n}" class="inline-noti-time" type="time" step="300" value="09:00">
        </div>
      </div>
      <a class="inline-noti-card__more" href="setting.html">알림 자세히 관리</a>
    </div>
  `,i}async function $(n,e){const t=await S(),i=n.querySelector(".inline-noti-toggle"),l=n.querySelector(".inline-noti-card__detail"),s=n.querySelector(".inline-noti-select"),f=n.querySelector(".inline-noti-time"),d=t[e];i.checked=!!d.enabled,d.enabled&&l.classList.add("is-open");const c=d.list&&d.list[0];c&&(e==="ingredient"?s.value=String(c.day||1):s.value=String(c.dDay??3),f.value=c.time||"09:00");async function m(o){const r={ingredient:{...t.ingredient},holiday:{...t.holiday}},a=r[e];if(a.enabled=o,o){const u=parseInt(s.value,10),_=f.value||"09:00";!a.list||!a.list.length?a.list=[{id:Date.now(),...e==="ingredient"?{day:u||1}:{dDay:u},time:_}]:a.list=a.list.map((v,h)=>h!==0?v:e==="ingredient"?{...v,day:u||1,time:_}:{...v,dDay:u,time:_})}t[e]=a,await w(r)}i.addEventListener("change",async()=>{if(!p.isNativePlatform()){i.checked=!1,l.classList.remove("is-open"),E();return}const o=i.checked;o?l.classList.add("is-open"):l.classList.remove("is-open");try{await m(o)}catch(r){console.error(r),alert("알림 설정 저장에 실패했습니다.")}});async function g(){if(i.checked&&p.isNativePlatform())try{await m(!0)}catch(o){console.error(o)}}s.addEventListener("change",g),f.addEventListener("change",g)}async function b(){const n=document.querySelectorAll("[data-inline-noti]");for(const e of n){const t=e.getAttribute("data-inline-noti");if(t!=="ingredient"&&t!=="holiday"||e.querySelector(".inline-noti-card"))continue;const i=N(t);e.appendChild(i),await $(i,t)}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",b):b();
