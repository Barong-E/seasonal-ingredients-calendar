import"./modulepreload-polyfill.js";/* empty css     */import{K as g}from"./korean-lunar-calendar.js";async function h(){try{const e=await fetch("data/holidays.json");if(!e.ok)throw new Error("명절 데이터 로드 실패");return await e.json()}catch(e){return console.error(e),[]}}function v(e,n){const a=e.solar_overrides;if(!a)return null;const r=String(n),s=a[r];if(!s)return null;if(typeof s=="string"){const i=s.split("-");if(i.length!==2)return null;const t=parseInt(i[0],10),o=parseInt(i[1],10);return!t||!o?null:new Date(n,t-1,o)}return typeof s=="object"&&s.month&&s.day?new Date(n,s.month-1,s.day):null}function f(e){return e===2025?new Date(2025,11,22):e===2026?new Date(2026,11,22):new Date(e,11,22)}function D(e,n){const{type:a,month:r,day:s}=e.date,i=v(e,n);if(i)return i;if(e.id==="hansik"){const t=f(n-1);if(!t)return null;const o=new Date(t);return o.setDate(o.getDate()+105),o}if(a==="lunar"){const t=new g,o=!!e.date.intercalation;if(!t.setLunarDate(n,r,s,o))return null;const l=t.getSolarCalendar();return!l||!l.year||!l.month||!l.day?null:new Date(l.year,l.month-1,l.day)}return a==="solar"?new Date(n,r-1,s):f(n)}function w(e,n){const a=n.getFullYear();let r=D(e,a);return r||null}function y(e){const n=e.getFullYear(),a=e.getMonth()+1,r=e.getDate();return`${n}년 ${a}월 ${r}일`}async function p(e=""){const n=document.getElementById("holidayListContainer"),a=await h(),r=new Date;r.setHours(0,0,0,0);const s=e.trim().toLowerCase(),i=a.map(t=>{const o=w(t,r);return{...t,solarDate:o}}).filter(t=>t.solarDate===null?!1:s?`${t.name||""} ${t.main_food||""}`.toLowerCase().includes(s):!0);if(i.sort((t,o)=>t.solarDate.getTime()-o.solarDate.getTime()),n.innerHTML="",i.length===0){n.innerHTML='<p style="text-align: center; color: #666;">'+(s?"검색 결과가 없습니다.":"데이터를 불러올 수 없습니다.")+"</p>";return}i.forEach(t=>{const o=document.createElement("a");o.href=`holiday.html?id=${encodeURIComponent(t.id)}`,o.className="holiday-item",t.solarDate<r&&(o.style.opacity="0.6");const d=y(t.solarDate),l=t.image?`images/${t.image}`:"images/_fallback.png",u=(t.foods||[]).map(c=>c.name),m=(t.customs||[]).map(c=>c.name);o.innerHTML=`
      <img src="${l}" alt="${t.name}" class="holiday-thumb" loading="lazy">
      <div class="holiday-info">
        <h3 class="holiday-name">${t.name}</h3>
        <span class="holiday-date">${d}</span>
        <p class="holiday-desc">${t.main_food}</p>
        
        <!-- 동적 포커스 시 나타나는 확장 정보 -->
        <div class="holiday-expanded-info">
          ${t.summary?`
            <div class="expanded-section">
              <span class="expanded-label">이야기</span>
              <p class="expanded-content">${t.summary}</p>
            </div>
          `:""}
          
          ${u.length>0?`
            <div class="expanded-section">
              <span class="expanded-label">대표 음식</span>
              <div class="expanded-tags">
                ${u.map(c=>`<span class="expanded-tag">${c}</span>`).join("")}
              </div>
            </div>
          `:""}

          ${m.length>0?`
            <div class="expanded-section">
              <span class="expanded-label">대표 풍습</span>
              <div class="expanded-tags">
                ${m.map(c=>`<span class="expanded-tag">${c}</span>`).join("")}
              </div>
            </div>
          `:""}
          <div style="margin-top: 12px; font-size: 0.8rem; color: var(--primary); font-weight: bold;">
            자세히 보기 〉
          </div>
        </div>
      </div>
    `,n.appendChild(o)}),$(),L(i,r)}function $(){const e={root:null,rootMargin:"-40% 0% -40% 0%",threshold:0},n=new IntersectionObserver(a=>{a.forEach(r=>{r.isIntersecting&&(document.querySelectorAll(".holiday-item.active").forEach(s=>s.classList.remove("active")),r.target.classList.add("active"))})},e);document.querySelectorAll(".holiday-item").forEach(a=>{n.observe(a)})}function L(e,n){let a=-1,r=1/0;const s=n.getTime();if(e.forEach((i,t)=>{if(!i.solarDate)return;const o=i.solarDate.getTime()-s;o>=0&&o<r&&(r=o,a=t)}),a===-1&&e.length>0&&(a=e.length-1),a!==-1){const i=document.querySelectorAll(".holiday-item");i[a]&&setTimeout(()=>{i[a].scrollIntoView({behavior:"smooth",block:"center"}),i[a].classList.add("active")},300)}}function x(){const e=document.getElementById("searchInput");e&&e.addEventListener("input",n=>{p(n.target.value)})}function I(){const e=new URLSearchParams(window.location.search),n=e.get("redirectId");if(n){const a=e.get("fromNoti"),r=window.location.pathname;window.history.replaceState({},"",r);let s=`holiday.html?id=${encodeURIComponent(n)}`;a&&(s+="&fromNoti=true"),window.location.href=s}}document.addEventListener("DOMContentLoaded",()=>{I(),p(),x()});
