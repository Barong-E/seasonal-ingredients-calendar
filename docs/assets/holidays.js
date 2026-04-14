import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function v(){try{const t=await fetch("data/holidays.json");if(!t.ok)throw new Error("명절 데이터 로드 실패");return await t.json()}catch(t){return console.error(t),[]}}function p(t,o){const e=t.solar_overrides;if(!e)return null;const a=String(o),r=e[a];if(!r)return null;if(typeof r=="string"){const s=r.split("-");if(s.length!==2)return null;const n=parseInt(s[0],10),i=parseInt(s[1],10);return!n||!i?null:new Date(o,n-1,i)}return typeof r=="object"&&r.month&&r.day?new Date(o,r.month-1,r.day):null}function m(t){return t===2025?new Date(2025,11,22):t===2026?new Date(2026,11,22):new Date(t,11,22)}function w(t,o){const{type:e,month:a,day:r}=t.date,s=p(t,o);if(s)return s;if(t.id==="hansik"){const n=m(o-1);if(!n)return null;const i=new Date(n);return i.setDate(i.getDate()+105),i}if(e==="lunar"){const n=new g,i=!!t.date.intercalation;if(!n.setLunarDate(o,a,r,i))return null;const c=n.getSolarCalendar();return!c||!c.year||!c.month||!c.day?null:new Date(c.year,c.month-1,c.day)}return e==="solar"?new Date(o,a-1,r):m(o)}function y(t,o){const e=o.getFullYear();let a=w(t,e);return a||null}function D(t){const o=t.getFullYear(),e=t.getMonth()+1,a=t.getDate();return`${o}년 ${e}월 ${a}일`}async function u(t=""){const o=document.getElementById("holidayListContainer"),e=await v(),a=new Date;a.setHours(0,0,0,0);const r=t.trim().toLowerCase(),s=e.map(n=>{const i=y(n,a);return{...n,solarDate:i}}).filter(n=>n.solarDate===null?!1:r?`${n.name||""} ${n.main_food||""}`.toLowerCase().includes(r):!0);if(s.sort((n,i)=>n.solarDate.getTime()-i.solarDate.getTime()),o.innerHTML="",s.length===0){o.innerHTML='<p style="text-align: center; color: #666;">'+(r?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}s.forEach(n=>{const i=document.createElement("a");i.href=`holiday.html?id=${encodeURIComponent(n.id)}`,i.className="holiday-item",n.solarDate<a&&(i.style.opacity="0.6");const d=D(n.solarDate),c=n.image?`images/${n.image}`:"images/_fallback.png",f=(n.details?.foods||[]).map(l=>l.name),h=(n.details?.customs||[]).map(l=>l.name);i.innerHTML=`
      <div class="holiday-item-top">
        <img src="${c}" alt="${n.name}" class="holiday-thumb" loading="lazy">
        <div class="holiday-info">
          <h3 class="holiday-name">${n.name}</h3>
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
        ${n.summary?`
          <div class="holiday-summary-bottom">
            <p class="summary-content">${n.summary}</p>
          </div>
        `:""}
        <div class="detail-link-text">
          자세히 보기 〉
        </div>
      </div>
    `,o.appendChild(i)}),L(),I(s,a)}function L(){const t={root:null,rootMargin:"-45% 0% -45% 0%",threshold:0},o=new IntersectionObserver(e=>{e.forEach(a=>{a.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(r=>{r!==a.target&&r.classList.remove("active")}),a.target.classList.add("active"))})},t);document.querySelectorAll(".holiday-item").forEach(e=>{o.observe(e)}),window.addEventListener("scroll",()=>{const e=document.querySelectorAll(".holiday-item");if(e.length!==0){if(window.scrollY<50)e[0].classList.contains("active")||(e.forEach(a=>a.classList.remove("active")),e[0].classList.add("active"));else if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-50){const a=e.length-1;e[a].classList.contains("active")||(e.forEach(r=>r.classList.remove("active")),e[a].classList.add("active"))}}},{passive:!0})}function I(t,o){let e=-1,a=1/0;const r=o.getTime();if(t.forEach((s,n)=>{if(!s.solarDate)return;const i=s.solarDate.getTime()-r;i>=0&&i<a&&(a=i,e=n)}),e===-1&&t.length>0&&(e=t.length-1),e!==-1){const s=document.querySelectorAll(".holiday-item");s[e]&&setTimeout(()=>{s[e].scrollIntoView({behavior:"smooth",block:"center"}),s[e].classList.add("active")},300)}}function $(){const t=document.getElementById("searchInput");t&&t.addEventListener("input",o=>{u(o.target.value)})}function E(){const t=new URLSearchParams(window.location.search),o=t.get("redirectId");if(o){const e=t.get("fromNoti"),a=window.location.pathname;window.history.replaceState({},"",a);let r=`holiday.html?id=${encodeURIComponent(o)}`;e&&(r+="&fromNoti=true"),window.location.href=r}}document.addEventListener("DOMContentLoaded",()=>{E(),u(),$()});
