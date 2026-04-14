import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function p(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function y(t,n){const a=t.solar_overrides;if(!a)return null;const r=String(n),i=a[r];if(!i)return null;if(typeof i=="string"){const s=i.split("-");if(s.length!==2)return null;const e=parseInt(s[0],10),o=parseInt(s[1],10);return!e||!o?null:new Date(n,e-1,o)}return typeof i=="object"&&i.month&&i.day?new Date(n,i.month-1,i.day):null}function u(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function D(t,n){const{type:a,month:r,day:i}=t.date,s=y(t,n);if(s)return s;if(t.id==="hansik"){const e=u(n-1);if(!e)return null;const o=new Date(e);return o.setDate(o.getDate()+105),o}if(a==="lunar"){const e=new g,o=!!t.date.intercalation;if(!e.setLunarDate(n,r,i,o))return null;const l=e.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}return a==="solar"?new Date(n,r-1,i):u(n)}function v(t,n){const a=n.getFullYear();let r=D(t,a);return r||null}function w(t){const n=t.getFullYear(),a=t.getMonth()+1,r=t.getDate();return`${n}년 ${a}월 ${r}일`}async function m(t=""){const n=document.getElementById("holidayListContainer"),a=await p(),r=new Date;r.setHours(0,0,0,0);const i=t.trim().toLowerCase(),s=a.map(e=>{const o=v(e,r);return{...e,solarDate:o}}).filter(e=>e.solarDate===null?!1:i?`${e.name||""} ${e.main_food||""}`.toLowerCase().includes(i):!0);if(s.sort((e,o)=>e.solarDate.getTime()-o.solarDate.getTime()),n.innerHTML="",s.length===0){n.innerHTML='<p style="text-align: center; color: #666;">'+(i?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(e=>{const o=document.createElement("a");o.href=`holiday.html?id=${encodeURIComponent(e.id)}`,o.className="holiday-item",e.solarDate<r&&(o.style.opacity="0.6");const d=w(e.solarDate),l=e.image?`images/${e.image}`:"images/_fallback.png",f=(e.foods||[]).map(c=>c.name),h=(e.customs||[]).map(c=>c.name);o.innerHTML=`
      <div class="holiday-item-top">
        <img src="${l}" alt="${e.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${e.name}</h3>
          <span class="holiday-date">${d}</span>
          <div class="holiday-meta">
            <span class="meta-label">대표 음식:</span> ${f.join(", ")}
          </div>
          <div class="holiday-meta">
            <span class="meta-label">대표 풍습:</span> ${h.join(", ")}
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
    `,n.appendChild(o)}),L(),$(s,r)}function L(){const t={root:null,rootMargin:"-40% 0% -40% 0%",threshold:0},n=new IntersectionObserver(a=>{a.forEach(r=>{r.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(i=>i.classList.remove("active")),r.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(a=>{n.observe(a)})}function $(t,n){let a=-1,r=1/0;const i=n.getTime();if(t.forEach((s,e)=>{if(!s.solarDate)return;const o=s.solarDate.getTime()-i;o>=0&&o<r&&(r=o,a=e)}),a===-1&&t.length>0&&(a=t.length-1),a!==-1){const s=document.querySelectorAll(".holiday-item");s[a]&&setTimeout(()=>{s[a].scrollIntoView({behavior:"smooth",block:"center"}),s[a].classList.add("active")},300)}}function I(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",n=>{m(n.target.value)})}function S(){const t=new URLSearchParams(window.location.search),n=t.get("redirectId");if(n){const a=t.get("fromNoti"),r=window.location.pathname;window.history.replaceState({},"",r);let i=`holiday.html?id=${encodeURIComponent(n)}`;a&&(i+="&fromNoti=true"),window.location.href=i}}document.addEventListener("DOMContentLoaded",()=>{S(),m(),I()});
