import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function p(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function y(t,n){const a=t.solar_overrides;if(!a)return null;const o=String(n),r=a[o];if(!r)return null;if(typeof r=="string"){const s=r.split("-");if(s.length!==2)return null;const e=parseInt(s[0],10),i=parseInt(s[1],10);return!e||!i?null:new Date(n,e-1,i)}return typeof r=="object"&&r.month&&r.day?new Date(n,r.month-1,r.day):null}function u(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function v(t,n){const{type:a,month:o,day:r}=t.date,s=y(t,n);if(s)return s;if(t.id==="hansik"){const e=u(n-1);if(!e)return null;const i=new Date(e);return i.setDate(i.getDate()+105),i}if(a==="lunar"){const e=new g,i=!!t.date.intercalation;if(!e.setLunarDate(n,o,r,i))return null;const c=e.getSolarCalendar();return!c||!c.year||!c.month||!c.day?null:new Date(c.year,c.month-1,c.day)}return a==="solar"?new Date(n,o-1,r):u(n)}function D(t,n){const a=n.getFullYear();let o=v(t,a);return o||null}function w(t){const n=t.getFullYear(),a=t.getMonth()+1,o=t.getDate();return`${n}년 ${a}월 ${o}일`}async function m(t=""){const n=document.getElementById("holidayListContainer"),a=await p(),o=new Date;o.setHours(0,0,0,0);const r=t.trim().toLowerCase(),s=a.map(e=>{const i=D(e,o);return{...e,solarDate:i}}).filter(e=>e.solarDate===null?!1:r?`${e.name||""} ${e.main_food||""}`.toLowerCase().includes(r):!0);if(s.sort((e,i)=>e.solarDate.getTime()-i.solarDate.getTime()),n.innerHTML="",s.length===0){n.innerHTML='<p style="text-align: center; color: #666;">'+(r?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(e=>{const i=document.createElement("a");i.href=`holiday.html?id=${encodeURIComponent(e.id)}`,i.className="holiday-item",e.solarDate<o&&(i.style.opacity="0.6");const d=w(e.solarDate),c=e.image?`images/${e.image}`:"images/_fallback.png",f=(e.details?.foods||[]).map(l=>l.name),h=(e.details?.customs||[]).map(l=>l.name);i.innerHTML=`
      <div class="holiday-item-top">
        <img src="${c}" alt="${e.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${e.name}</h3>
          <span class="holiday-date">${d}</span>
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
        ${e.summary?`
          <div class="holiday-summary-bottom">
            <p class="summary-content">${e.summary}</p>
          </div>
        `:""}
        <div class="detail-link-text">
          자세히 보기 〉
        </div>
      </div>
    `,n.appendChild(i)}),L(),$(s,o)}function L(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},n=new IntersectionObserver(a=>{a.forEach(o=>{o.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(r=>{r!==o.target&&r.classList.remove("active")}),o.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(a=>{n.observe(a)})}function $(t,n){let a=-1,o=1/0;const r=n.getTime();if(t.forEach((s,e)=>{if(!s.solarDate)return;const i=s.solarDate.getTime()-r;i>=0&&i<o&&(o=i,a=e)}),a===-1&&t.length>0&&(a=t.length-1),a!==-1){const s=document.querySelectorAll(".holiday-item");s[a]&&setTimeout(()=>{document.querySelectorAll(".holiday-item.active").forEach(e=>e.classList.remove("active")),s[a].scrollIntoView({behavior:"instant",block:"center"}),s[a].classList.add("active")},500)}}function I(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",n=>{m(n.target.value)})}function S(){const t=new URLSearchParams(window.location.search),n=t.get("redirectId");if(n){const a=t.get("fromNoti"),o=window.location.pathname;window.history.replaceState({},"",o);let r=`holiday.html?id=${encodeURIComponent(n)}`;a&&(r+="&fromNoti=true"),window.location.href=r}}document.addEventListener("DOMContentLoaded",()=>{S(),m(),I()});
