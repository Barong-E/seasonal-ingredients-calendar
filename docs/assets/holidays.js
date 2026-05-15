import{C as g}from"./app-back-button.js";import{K as v}from"./korean-lunar-calendar.js";async function y(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function p(t,e){const o=t.solar_overrides;if(!o)return null;const a=String(e),i=o[a];if(!i)return null;if(typeof i=="string"){const s=i.split("-");if(s.length!==2)return null;const n=parseInt(s[0],10),r=parseInt(s[1],10);return!n||!r?null:new Date(e,n-1,r)}return typeof i=="object"&&i.month&&i.day?new Date(e,i.month-1,i.day):null}function m(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function w(t,e){const{type:o,month:a,day:i}=t.date,s=p(t,e);if(s)return s;if(t.id==="hansik"){const n=m(e-1);if(!n)return null;const r=new Date(n);return r.setDate(r.getDate()+105),r}if(o==="lunar"){const n=new v,r=!!t.date.intercalation;if(!n.setLunarDate(e,a,i,r))return null;const l=n.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}return o==="solar"?new Date(e,a-1,i):m(e)}function D(t,e){const o=e.getFullYear();let a=w(t,o);return a||null}function b(t){const e=t.getFullYear(),o=t.getMonth()+1,a=t.getDate();return`${e}년 ${o}월 ${a}일`}async function u(t=""){const e=document.getElementById("holidayListContainer"),o=await y(),a=new Date;a.setHours(0,0,0,0);const i=t.trim().toLowerCase(),s=o.map(n=>{const r=D(n,a);return{...n,solarDate:r}}).filter(n=>n.solarDate===null?!1:i?`${n.name||""} ${n.main_food||""}`.toLowerCase().includes(i):!0);if(s.sort((n,r)=>n.solarDate.getTime()-r.solarDate.getTime()),e.innerHTML="",s.length===0){e.innerHTML='<p style="text-align: center; color: #666;">'+(i?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(n=>{const r=document.createElement("a");r.href=`holiday.html?id=${encodeURIComponent(n.id)}`,r.className="holiday-item",n.solarDate<a&&(r.style.opacity="0.6");const c=b(n.solarDate),l=n.image?`images/${n.image}`:"images/_fallback.png",f=(n.details?.foods||[]).map(d=>d.name),h=(n.details?.customs||[]).map(d=>d.name);r.innerHTML=`
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
    `,e.appendChild(r)}),L(),E(s,a)}function L(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},e=new IntersectionObserver(o=>{o.forEach(a=>{a.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(i=>{i!==a.target&&i.classList.remove("active")}),a.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(o=>{e.observe(o)})}function E(t,e){let o=-1,a=1/0;const i=e.getTime();if(t.forEach((n,r)=>{if(!n.solarDate)return;const c=n.solarDate.getTime()-i;c>=0&&c<a&&(a=c,o=r)}),o===-1&&t.length>0&&(o=t.length-1),o!==-1){const n=document.querySelectorAll(".holiday-item");n[o]&&(document.querySelectorAll(".holiday-item.active").forEach(r=>r.classList.remove("active")),n[o].scrollIntoView({behavior:"instant",block:"center"}),n[o].classList.add("active"))}const s=document.getElementById("holidayListContainer");s&&requestAnimationFrame(()=>{s.classList.add("visible")})}function I(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",e=>{u(e.target.value)})}function S(){const t=new URLSearchParams(window.location.search),e=t.get("redirectId");if(e){const o=t.get("fromNoti"),a=window.location.pathname;window.history.replaceState({},"",a);let i=`holiday.html?id=${encodeURIComponent(e)}`;o&&(i+="&fromNoti=true"),window.location.href=i}}function k(){const t=document.getElementById("settingButton"),e=document.querySelector(".brand");e&&e.addEventListener("click",()=>{window.location.href="index.html"}),t&&t.addEventListener("click",()=>{if(!g.isNativePlatform()){$();return}window.location.href="setting.html"})}function $(){const t=document.getElementById("webNotificationInfoModal");t&&t.remove();const e=document.createElement("div");e.id="webNotificationInfoModal",e.className="info-modal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.innerHTML=`
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림은 앱에서만 받을 수 있습니다. 스토어에서 설치해주세요.</p>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;function o(){e.remove(),document.body.style.overflow=""}e.querySelector(".info-modal__backdrop").addEventListener("click",o),e.querySelector(".info-modal__close").addEventListener("click",o),document.body.appendChild(e),document.body.style.overflow="hidden"}document.addEventListener("DOMContentLoaded",()=>{S(),u(),I(),k()});
