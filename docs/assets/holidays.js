import{C as w}from"./app-back-button.js";import{K as u}from"./korean-lunar-calendar.js";async function D(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function p(t,e){const n=t.solar_overrides;if(!n)return null;const r=String(e),a=n[r];if(!a)return null;if(typeof a=="string"){const s=a.split("-");if(s.length!==2)return null;const o=parseInt(s[0],10),i=parseInt(s[1],10);return!o||!i?null:new Date(e,o-1,i)}return typeof a=="object"&&a.month&&a.day?new Date(e,a.month-1,a.day):null}function f(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function v(t){const e=new Date(2025,6,20),n=new Date(t.getFullYear(),t.getMonth(),t.getDate()),r=new Date(e.getFullYear(),e.getMonth(),e.getDate()),a=n.getTime()-r.getTime();return(Math.round(a/(1e3*60*60*24))%10+10)%10===0}function y(t){const e=t-2e3,n=4.861,r=Math.floor((e+3)/4),a=Math.floor(n+.242194*e-r);return new Date(t,1,a)}function b(t){const e=t-2e3,n=21.533,r=Math.floor(e/4),a=Math.floor(n+.242194*e-r);return new Date(t,5,a)}function L(t){const e=b(t);let n=new Date(e),r=0;for(;r<3;)n.setDate(n.getDate()+1),v(n)&&r++;return n}function S(t,e){const{type:n,month:r,day:a}=t.date,s=p(t,e);if(s)return s;if(t.id==="hansik"){const o=f(e-1);if(!o)return null;const i=new Date(o);return i.setDate(i.getDate()+105),i}if(t.id==="seotdal"){const o=new u;let i=o.setLunarDate(e,12,30,!1);if(i||(i=o.setLunarDate(e,12,29,!1)),!i)return null;const l=o.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}if(t.id==="ipchun")return y(e);if(t.id==="sambok")return L(e);if(n==="lunar"){const o=new u,i=!!t.date.intercalation;if(!o.setLunarDate(e,r,a,i))return null;const c=o.getSolarCalendar();return!c||!c.year||!c.month||!c.day?null:new Date(c.year,c.month-1,c.day)}return n==="solar"?new Date(e,r-1,a):t.date.name==="동지"?f(e):null}function E(t,e){const n=e.getFullYear();let r=S(t,n);return r||null}function I(t){const e=t.getFullYear(),n=t.getMonth()+1,r=t.getDate();return`${e}년 ${n}월 ${r}일`}async function m(t=""){const e=document.getElementById("holidayListContainer"),n=await D(),r=new Date;r.setHours(0,0,0,0);const a=t.trim().toLowerCase(),s=n.map(o=>{const i=E(o,r);return{...o,solarDate:i}}).filter(o=>o.solarDate===null?!1:a?`${o.name||""} ${o.main_food||""}`.toLowerCase().includes(a):!0);if(s.sort((o,i)=>o.solarDate.getTime()-i.solarDate.getTime()),e.innerHTML="",s.length===0){e.innerHTML='<p style="text-align: center; color: #666;">'+(a?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(o=>{const i=document.createElement("a");i.href=`holiday.html?id=${encodeURIComponent(o.id)}`,i.className="holiday-item",o.solarDate<r&&(i.style.opacity="0.6");const l=I(o.solarDate),c=o.image?`images/${o.image}`:"images/_fallback.png",g=(o.details?.foods||[]).map(d=>d.name),h=(o.details?.customs||[]).map(d=>d.name);i.innerHTML=`
      <div class="holiday-item-top">
        <img src="${c}" alt="${o.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${o.name}</h3>
          <span class="holiday-date">${l}</span>
          <div class="holiday-meta">
            <span class="meta-icon">🍲</span> ${g.join(", ")}
          </div>
          <div class="holiday-meta">
            <span class="meta-icon">🎎</span> ${h.join(", ")}
          </div>
        </div>
      </div>
      
      <!-- 동적 포커스 시 나타나는 확장 정보 -->
      <div class="holiday-expanded-info">
        ${o.summary?`
          <div class="holiday-summary-bottom">
            <p class="summary-content">${o.summary}</p>
          </div>
        `:""}
        <div class="detail-link-text">
          자세히 보기 〉
        </div>
      </div>
    `,e.appendChild(i)}),k(),C(s,r)}function k(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},e=new IntersectionObserver(n=>{n.forEach(r=>{r.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(a=>{a!==r.target&&a.classList.remove("active")}),r.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(n=>{e.observe(n)})}function C(t,e){let n=-1,r=1/0;const a=e.getTime();if(t.forEach((o,i)=>{if(!o.solarDate)return;const l=o.solarDate.getTime()-a;l>=0&&l<r&&(r=l,n=i)}),n===-1&&t.length>0&&(n=t.length-1),n!==-1){const o=document.querySelectorAll(".holiday-item");o[n]&&(document.querySelectorAll(".holiday-item.active").forEach(i=>i.classList.remove("active")),o[n].scrollIntoView({behavior:"instant",block:"center"}),o[n].classList.add("active"))}const s=document.getElementById("holidayListContainer");s&&requestAnimationFrame(()=>{s.classList.add("visible")})}function M(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",e=>{m(e.target.value)})}function Y(){const t=new URLSearchParams(window.location.search),e=t.get("redirectId");if(e){const n=t.get("fromNoti"),r=window.location.pathname;window.history.replaceState({},"",r);let a=`holiday.html?id=${encodeURIComponent(e)}`;n&&(a+="&fromNoti=true"),window.location.href=a}}function $(){const t=document.getElementById("settingButton"),e=document.querySelector(".brand");e&&e.addEventListener("click",()=>{window.location.href="index.html"}),t&&t.addEventListener("click",()=>{if(!w.isNativePlatform()){_();return}window.location.href="setting.html"})}function _(){const t=document.getElementById("webNotificationInfoModal");t&&t.remove();const e=document.createElement("div");e.id="webNotificationInfoModal",e.className="info-modal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.innerHTML=`
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;function n(){e.remove(),document.body.style.overflow=""}e.querySelector(".info-modal__backdrop").addEventListener("click",n),e.querySelector(".info-modal__close").addEventListener("click",n),document.body.appendChild(e),document.body.style.overflow="hidden"}function H(){const t=document.querySelector(".app-header");if(!t)return;let e=window.scrollY,n=!1;const r=()=>{const a=window.scrollY;a!==e&&(a<e||a<=50?t.classList.remove("header--hidden"):a>50&&t.classList.add("header--hidden")),e=a<=0?0:a,n=!1};window.addEventListener("scroll",()=>{n||(window.requestAnimationFrame(r),n=!0)})}document.addEventListener("DOMContentLoaded",()=>{Y(),m(),M(),$(),H()});
