import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function p(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function y(t,n){const o=t.solar_overrides;if(!o)return null;const a=String(n),r=o[a];if(!r)return null;if(typeof r=="string"){const s=r.split("-");if(s.length!==2)return null;const e=parseInt(s[0],10),i=parseInt(s[1],10);return!e||!i?null:new Date(n,e-1,i)}return typeof r=="object"&&r.month&&r.day?new Date(n,r.month-1,r.day):null}function m(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function v(t,n){const{type:o,month:a,day:r}=t.date,s=y(t,n);if(s)return s;if(t.id==="hansik"){const e=m(n-1);if(!e)return null;const i=new Date(e);return i.setDate(i.getDate()+105),i}if(o==="lunar"){const e=new g,i=!!t.date.intercalation;if(!e.setLunarDate(n,a,r,i))return null;const c=e.getSolarCalendar();return!c||!c.year||!c.month||!c.day?null:new Date(c.year,c.month-1,c.day)}return o==="solar"?new Date(n,a-1,r):m(n)}function D(t,n){const o=n.getFullYear();let a=v(t,o);return a||null}function w(t){const n=t.getFullYear(),o=t.getMonth()+1,a=t.getDate();return`${n}년 ${o}월 ${a}일`}async function u(t=""){const n=document.getElementById("holidayListContainer"),o=await p(),a=new Date;a.setHours(0,0,0,0);const r=t.trim().toLowerCase(),s=o.map(e=>{const i=D(e,a);return{...e,solarDate:i}}).filter(e=>e.solarDate===null?!1:r?`${e.name||""} ${e.main_food||""}`.toLowerCase().includes(r):!0);if(s.sort((e,i)=>e.solarDate.getTime()-i.solarDate.getTime()),n.innerHTML="",s.length===0){n.innerHTML='<p style="text-align: center; color: #666;">'+(r?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(e=>{const i=document.createElement("a");i.href=`holiday.html?id=${encodeURIComponent(e.id)}`,i.className="holiday-item",e.solarDate<a&&(i.style.opacity="0.6");const d=w(e.solarDate),c=e.image?`images/${e.image}`:"images/_fallback.png",f=(e.details?.foods||[]).map(l=>l.name),h=(e.details?.customs||[]).map(l=>l.name);i.innerHTML=`
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
    `,n.appendChild(i)}),L(),$(s,a)}function L(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},n=new IntersectionObserver(o=>{o.forEach(a=>{a.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(r=>{r!==a.target&&r.classList.remove("active")}),a.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(o=>{n.observe(o)})}function $(t,n){let o=-1,a=1/0;const r=n.getTime();if(t.forEach((s,e)=>{if(!s.solarDate)return;const i=s.solarDate.getTime()-r;i>=0&&i<a&&(a=i,o=e)}),o===-1&&t.length>0&&(o=t.length-1),o!==-1){const s=document.querySelectorAll(".holiday-item");s[o]&&setTimeout(()=>{document.querySelectorAll(".holiday-item.active").forEach(e=>e.classList.remove("active")),s[o].scrollIntoView({behavior:"smooth",block:"center"}),s[o].classList.add("active")},300)}}function I(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",n=>{u(n.target.value)})}function S(){const t=new URLSearchParams(window.location.search),n=t.get("redirectId");if(n){const o=t.get("fromNoti"),a=window.location.pathname;window.history.replaceState({},"",a);let r=`holiday.html?id=${encodeURIComponent(n)}`;o&&(r+="&fromNoti=true"),window.location.href=r}}document.addEventListener("DOMContentLoaded",()=>{S(),u(),I()});
