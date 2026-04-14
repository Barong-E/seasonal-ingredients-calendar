import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function p(){try{const e=await fetch("data/holidays.json");if(!e.ok)throw new Error("명절 데이터 로드 실패");return await e.json()}catch(e){return console.error(e),[]}}function y(e,n){const a=e.solar_overrides;if(!a)return null;const o=String(n),r=a[o];if(!r)return null;if(typeof r=="string"){const s=r.split("-");if(s.length!==2)return null;const t=parseInt(s[0],10),i=parseInt(s[1],10);return!t||!i?null:new Date(n,t-1,i)}return typeof r=="object"&&r.month&&r.day?new Date(n,r.month-1,r.day):null}function m(e){return e===2025?new Date(2025,11,22):e===2026?new Date(2026,11,22):new Date(e,11,22)}function v(e,n){const{type:a,month:o,day:r}=e.date,s=y(e,n);if(s)return s;if(e.id==="hansik"){const t=m(n-1);if(!t)return null;const i=new Date(t);return i.setDate(i.getDate()+105),i}if(a==="lunar"){const t=new g,i=!!e.date.intercalation;if(!t.setLunarDate(n,o,r,i))return null;const c=t.getSolarCalendar();return!c||!c.year||!c.month||!c.day?null:new Date(c.year,c.month-1,c.day)}return a==="solar"?new Date(n,o-1,r):m(n)}function D(e,n){const a=n.getFullYear();let o=v(e,a);return o||null}function w(e){const n=e.getFullYear(),a=e.getMonth()+1,o=e.getDate();return`${n}년 ${a}월 ${o}일`}async function u(e=""){const n=document.getElementById("holidayListContainer"),a=await p(),o=new Date;o.setHours(0,0,0,0);const r=e.trim().toLowerCase(),s=a.map(t=>{const i=D(t,o);return{...t,solarDate:i}}).filter(t=>t.solarDate===null?!1:r?`${t.name||""} ${t.main_food||""}`.toLowerCase().includes(r):!0);if(s.sort((t,i)=>t.solarDate.getTime()-i.solarDate.getTime()),n.innerHTML="",s.length===0){n.innerHTML='<p style="text-align: center; color: #666;">'+(r?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(t=>{const i=document.createElement("a");i.href=`holiday.html?id=${encodeURIComponent(t.id)}`,i.className="holiday-item",t.solarDate<o&&(i.style.opacity="0.6");const l=w(t.solarDate),c=t.image?`images/${t.image}`:"images/_fallback.png",f=(t.details?.foods||[]).map(d=>d.name),h=(t.details?.customs||[]).map(d=>d.name);i.innerHTML=`
      <div class="holiday-item-top">
        <img src="${c}" alt="${t.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${t.name}</h3>
          <span class="holiday-date">${l}</span>
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
        ${t.summary?`
          <div class="holiday-summary-bottom">
            <p class="summary-content">${t.summary}</p>
          </div>
        `:""}
        <div class="detail-link-text">
          자세히 보기 〉
        </div>
      </div>
    `,n.appendChild(i)}),L(),I(s,o)}function L(){const e={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},n=new IntersectionObserver(a=>{a.forEach(o=>{o.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(r=>{r!==o.target&&r.classList.remove("active")}),o.target.classList.add("active"))})},e);document.querySelectorAll(".holiday-item").forEach(a=>{n.observe(a)})}function I(e,n){let a=-1,o=1/0;const r=n.getTime();if(e.forEach((t,i)=>{if(!t.solarDate)return;const l=t.solarDate.getTime()-r;l>=0&&l<o&&(o=l,a=i)}),a===-1&&e.length>0&&(a=e.length-1),a!==-1){const t=document.querySelectorAll(".holiday-item");t[a]&&(document.querySelectorAll(".holiday-item.active").forEach(i=>i.classList.remove("active")),t[a].scrollIntoView({behavior:"instant",block:"center"}),t[a].classList.add("active"))}const s=document.getElementById("holidayListContainer");s&&requestAnimationFrame(()=>{s.classList.add("visible")})}function $(){const e=document.getElementById("searchInput");e&&e.addEventListener("input",n=>{u(n.target.value)})}function S(){const e=new URLSearchParams(window.location.search),n=e.get("redirectId");if(n){const a=e.get("fromNoti"),o=window.location.pathname;window.history.replaceState({},"",o);let r=`holiday.html?id=${encodeURIComponent(n)}`;a&&(r+="&fromNoti=true"),window.location.href=r}}document.addEventListener("DOMContentLoaded",()=>{S(),u(),$()});
