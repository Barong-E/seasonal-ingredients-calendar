import{C as g}from"./app-back-button.js";import{K as v}from"./korean-lunar-calendar.js";async function y(){try{const e=await fetch("data/holidays.json");if(!e.ok)throw new Error("명절 데이터 로드 실패");return await e.json()}catch(e){return console.error(e),[]}}function p(e,t){const o=e.solar_overrides;if(!o)return null;const i=String(t),a=o[i];if(!a)return null;if(typeof a=="string"){const s=a.split("-");if(s.length!==2)return null;const n=parseInt(s[0],10),r=parseInt(s[1],10);return!n||!r?null:new Date(t,n-1,r)}return typeof a=="object"&&a.month&&a.day?new Date(t,a.month-1,a.day):null}function m(e){return e===2025?new Date(2025,11,22):e===2026?new Date(2026,11,22):new Date(e,11,22)}function w(e,t){const{type:o,month:i,day:a}=e.date,s=p(e,t);if(s)return s;if(e.id==="hansik"){const n=m(t-1);if(!n)return null;const r=new Date(n);return r.setDate(r.getDate()+105),r}if(o==="lunar"){const n=new v,r=!!e.date.intercalation;if(!n.setLunarDate(t,i,a,r))return null;const l=n.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}return o==="solar"?new Date(t,i-1,a):m(t)}function D(e,t){const o=t.getFullYear();let i=w(e,o);return i||null}function b(e){const t=e.getFullYear(),o=e.getMonth()+1,i=e.getDate();return`${t}년 ${o}월 ${i}일`}async function u(e=""){const t=document.getElementById("holidayListContainer"),o=await y(),i=new Date;i.setHours(0,0,0,0);const a=e.trim().toLowerCase(),s=o.map(n=>{const r=D(n,i);return{...n,solarDate:r}}).filter(n=>n.solarDate===null?!1:a?`${n.name||""} ${n.main_food||""}`.toLowerCase().includes(a):!0);if(s.sort((n,r)=>n.solarDate.getTime()-r.solarDate.getTime()),t.innerHTML="",s.length===0){t.innerHTML='<p style="text-align: center; color: #666;">'+(a?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(n=>{const r=document.createElement("a");r.href=`holiday.html?id=${encodeURIComponent(n.id)}`,r.className="holiday-item",n.solarDate<i&&(r.style.opacity="0.6");const c=b(n.solarDate),l=n.image?`images/${n.image}`:"images/_fallback.png",f=(n.details?.foods||[]).map(d=>d.name),h=(n.details?.customs||[]).map(d=>d.name);r.innerHTML=`
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
    `,t.appendChild(r)}),L(),S(s,i)}function L(){const e={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},t=new IntersectionObserver(o=>{o.forEach(i=>{i.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(a=>{a!==i.target&&a.classList.remove("active")}),i.target.classList.add("active"))})},e);document.querySelectorAll(".holiday-item").forEach(o=>{t.observe(o)})}function S(e,t){let o=-1,i=1/0;const a=t.getTime();if(e.forEach((n,r)=>{if(!n.solarDate)return;const c=n.solarDate.getTime()-a;c>=0&&c<i&&(i=c,o=r)}),o===-1&&e.length>0&&(o=e.length-1),o!==-1){const n=document.querySelectorAll(".holiday-item");n[o]&&(document.querySelectorAll(".holiday-item.active").forEach(r=>r.classList.remove("active")),n[o].scrollIntoView({behavior:"instant",block:"center"}),n[o].classList.add("active"))}const s=document.getElementById("holidayListContainer");s&&requestAnimationFrame(()=>{s.classList.add("visible")})}function E(){const e=document.getElementById("searchInput");e&&e.addEventListener("input",t=>{u(t.target.value)})}function I(){const e=new URLSearchParams(window.location.search),t=e.get("redirectId");if(t){const o=e.get("fromNoti"),i=window.location.pathname;window.history.replaceState({},"",i);let a=`holiday.html?id=${encodeURIComponent(t)}`;o&&(a+="&fromNoti=true"),window.location.href=a}}function k(){const e=document.getElementById("settingButton"),t=document.querySelector(".brand");t&&t.addEventListener("click",()=>{window.location.href="index.html"}),e&&e.addEventListener("click",()=>{if(!g.isNativePlatform()){$();return}window.location.href="setting.html"})}function $(){const e=document.getElementById("webNotificationInfoModal");e&&e.remove();const t=document.createElement("div");t.id="webNotificationInfoModal",t.className="info-modal",t.setAttribute("role","dialog"),t.setAttribute("aria-modal","true"),t.innerHTML=`
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;function o(){t.remove(),document.body.style.overflow=""}t.querySelector(".info-modal__backdrop").addEventListener("click",o),t.querySelector(".info-modal__close").addEventListener("click",o),document.body.appendChild(t),document.body.style.overflow="hidden"}function C(){const e=document.querySelector(".app-header");if(!e)return;let t=window.scrollY,o=!1;const i=()=>{const a=window.scrollY;a!==t&&(a<t||a<=50?e.classList.remove("header--hidden"):a>50&&e.classList.add("header--hidden")),t=a<=0?0:a,o=!1};window.addEventListener("scroll",()=>{o||(window.requestAnimationFrame(i),o=!0)})}document.addEventListener("DOMContentLoaded",()=>{I(),u(),E(),k(),C()});
