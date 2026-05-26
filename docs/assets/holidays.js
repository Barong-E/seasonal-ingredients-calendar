import{C as g}from"./app-back-button.js";import{K as v}from"./korean-lunar-calendar.js";async function y(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function p(t,e){const o=t.solar_overrides;if(!o)return null;const i=String(e),a=o[i];if(!a)return null;if(typeof a=="string"){const s=a.split("-");if(s.length!==2)return null;const n=parseInt(s[0],10),r=parseInt(s[1],10);return!n||!r?null:new Date(e,n-1,r)}return typeof a=="object"&&a.month&&a.day?new Date(e,a.month-1,a.day):null}function m(t){const o={2025:21,2026:21,2027:22,2028:21,2029:21,2030:22}[t]||21;return new Date(t,11,o)}function w(t,e){const{type:o,month:i,day:a}=t.date,s=p(t,e);if(s)return s;if(t.id==="hansik"){const n=m(e-1);if(!n)return null;const r=new Date(n);return r.setDate(r.getDate()+105),r}if(o==="lunar"){const n=new v,r=!!t.date.intercalation;if(!n.setLunarDate(e,i,a,r))return null;const l=n.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}return o==="solar"?new Date(e,i-1,a):m(e)}function D(t,e){const o=e.getFullYear();let i=w(t,o);return i||null}function b(t){const e=t.getFullYear(),o=t.getMonth()+1,i=t.getDate();return`${e}년 ${o}월 ${i}일`}async function u(t=""){const e=document.getElementById("holidayListContainer"),o=await y(),i=new Date;i.setHours(0,0,0,0);const a=t.trim().toLowerCase(),s=o.map(n=>{const r=D(n,i);return{...n,solarDate:r}}).filter(n=>n.solarDate===null?!1:a?`${n.name||""} ${n.main_food||""}`.toLowerCase().includes(a):!0);if(s.sort((n,r)=>n.solarDate.getTime()-r.solarDate.getTime()),e.innerHTML="",s.length===0){e.innerHTML='<p style="text-align: center; color: #666;">'+(a?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(n=>{const r=document.createElement("a");r.href=`holiday.html?id=${encodeURIComponent(n.id)}`,r.className="holiday-item",n.solarDate<i&&(r.style.opacity="0.6");const c=b(n.solarDate),l=n.image?`images/${n.image}`:"images/_fallback.png",f=(n.details?.foods||[]).map(d=>d.name),h=(n.details?.customs||[]).map(d=>d.name);r.innerHTML=`
      <div class="holiday-item-top">
        <img src="${l}" alt="${n.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${n.name}</h3>
          <span class="holiday-date">${c}</span>
          <div class="holiday-meta">
            <span class="meta-icon">🍲</span> ${f.join(", ")}
          </div>
          <div class="holiday-meta">
            <span class="meta-icon">🎎</span> ${h.join(", ")}
          </div>
        </div>
      </div>
      
      <!-- 동적 포커스 시 나타나는 확장 정보 -->
      <div class="holiday-expanded-info">
        ${n.summary?`
          <div class="holiday-summary-bottom">
            <p class="summary-content">${n.summary}</p>
          </div>
        `:""}
        <div class="detail-link-text">
          자세히 보기 〉
        </div>
      </div>
    `,e.appendChild(r)}),L(),S(s,i)}function L(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},e=new IntersectionObserver(o=>{o.forEach(i=>{i.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(a=>{a!==i.target&&a.classList.remove("active")}),i.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(o=>{e.observe(o)})}function S(t,e){let o=-1,i=1/0;const a=e.getTime();if(t.forEach((n,r)=>{if(!n.solarDate)return;const c=n.solarDate.getTime()-a;c>=0&&c<i&&(i=c,o=r)}),o===-1&&t.length>0&&(o=t.length-1),o!==-1){const n=document.querySelectorAll(".holiday-item");n[o]&&(document.querySelectorAll(".holiday-item.active").forEach(r=>r.classList.remove("active")),n[o].scrollIntoView({behavior:"instant",block:"center"}),n[o].classList.add("active"))}const s=document.getElementById("holidayListContainer");s&&requestAnimationFrame(()=>{s.classList.add("visible")})}function E(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",e=>{u(e.target.value)})}function I(){const t=new URLSearchParams(window.location.search),e=t.get("redirectId");if(e){const o=t.get("fromNoti"),i=window.location.pathname;window.history.replaceState({},"",i);let a=`holiday.html?id=${encodeURIComponent(e)}`;o&&(a+="&fromNoti=true"),window.location.href=a}}function k(){const t=document.getElementById("settingButton"),e=document.querySelector(".brand");e&&e.addEventListener("click",()=>{window.location.href="index.html"}),t&&t.addEventListener("click",()=>{if(!g.isNativePlatform()){$();return}window.location.href="setting.html"})}function $(){const t=document.getElementById("webNotificationInfoModal");t&&t.remove();const e=document.createElement("div");e.id="webNotificationInfoModal",e.className="info-modal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.innerHTML=`
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;function o(){e.remove(),document.body.style.overflow=""}e.querySelector(".info-modal__backdrop").addEventListener("click",o),e.querySelector(".info-modal__close").addEventListener("click",o),document.body.appendChild(e),document.body.style.overflow="hidden"}function C(){const t=document.querySelector(".app-header");if(!t)return;let e=window.scrollY,o=!1;const i=()=>{const a=window.scrollY;a!==e&&(a<e||a<=50?t.classList.remove("header--hidden"):a>50&&t.classList.add("header--hidden")),e=a<=0?0:a,o=!1};window.addEventListener("scroll",()=>{o||(window.requestAnimationFrame(i),o=!0)})}document.addEventListener("DOMContentLoaded",()=>{I(),u(),E(),k(),C()});
