const f="notification:history";function a(){try{const t=localStorage.getItem(f),e=t?JSON.parse(t):[];return Array.isArray(e)?e:[]}catch{return[]}}function d(t){localStorage.setItem(f,JSON.stringify(t.slice(0,30)))}function M(t){const e={id:t.id||`n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,title:t.title||"알림",body:t.body||"",type:t.type||"general",url:t.url||"",createdAt:Date.now(),read:!1},n=a().filter(i=>i.id!==e.id);return n.unshift(e),d(n),l(),e}function h(t){const e=a().map(n=>n.id===t?{...n,read:!0}:n);d(e),l()}function m(){const t=a().map(e=>({...e,read:!0}));d(t),l()}function _(){return a().filter(t=>!t.read).length}function l(){const t=_();document.querySelectorAll("#notiHistoryBtn").forEach(e=>{t>0?e.classList.add("has-unread"):e.classList.remove("has-unread")})}function g(t){const e=Date.now()-t,n=Math.floor(e/6e4);if(n<1)return"방금";if(n<60)return`${n}분 전`;const i=Math.floor(n/60);if(i<24)return`${i}시간 전`;const o=Math.floor(i/24);if(o===1)return"어제";if(o<7)return`${o}일 전`;const s=new Date(t);return`${s.getMonth()+1}.${s.getDate()}`}function E(t){return t==="ingredient"?"🥦":t==="holiday"?"🌕":"🔔"}function v(t){return t.url?t.url:t.type==="ingredient"?"index.html":t.type==="holiday"?"holidays.html":""}function L(t){let e=document.getElementById("notiHistoryPanel");return e||(e=document.createElement("div"),e.id="notiHistoryPanel",e.className="noti-history",e.setAttribute("role","dialog"),e.setAttribute("aria-label","알림"),e.innerHTML=`
    <div class="noti-history__header">
      <h2 class="noti-history__title">🔔 알림</h2>
      <button type="button" class="noti-history__mark-read" id="notiMarkAllRead">모두 읽음</button>
    </div>
    <ul class="noti-history__list" id="notiHistoryList"></ul>
    <p class="noti-history__empty" id="notiHistoryEmpty" hidden>알림이 없습니다</p>
  `,t.appendChild(e),e)}function p(t){const e=t.querySelector("#notiHistoryList"),n=t.querySelector("#notiHistoryEmpty"),i=a();if(e.innerHTML="",!i.length){n.hidden=!1;return}n.hidden=!0,i.forEach(o=>{const s=document.createElement("li"),r=document.createElement("button");r.type="button",r.className=`noti-history__item${o.read?"":" is-unread"}`,r.innerHTML=`
      <div class="noti-history__item-top">
        <span class="noti-history__emoji" aria-hidden="true">${E(o.type)}</span>
        <div class="noti-history__item-body">
          <p class="noti-history__item-title"></p>
          <p class="noti-history__item-desc"></p>
          <div class="noti-history__meta">
            <span class="noti-history__time">${g(o.createdAt)}</span>
            ${o.read?"":'<span class="noti-history__badge-new">새</span>'}
          </div>
        </div>
      </div>
    `,r.querySelector(".noti-history__item-title").textContent=o.title,r.querySelector(".noti-history__item-desc").textContent=o.body||"",r.addEventListener("click",()=>{h(o.id),c(t);const u=v(o);u&&(window.location.href=u)}),s.appendChild(r),e.appendChild(s)})}function S(t){p(t),t.classList.add("is-open")}function c(t){t.classList.remove("is-open")}function y(){const t=document.getElementById("notiHistoryBtn");if(!t)return;const e=t.closest(".header-controls")||t.parentElement;e&&getComputedStyle(e).position==="static"&&(e.style.position="relative");const n=L(e);l(),t.addEventListener("click",i=>{i.stopPropagation(),n.classList.contains("is-open")?c(n):S(n)}),n.querySelector("#notiMarkAllRead").addEventListener("click",i=>{i.stopPropagation(),m(),p(n)}),document.addEventListener("click",i=>{n.classList.contains("is-open")&&(n.contains(i.target)||t.contains(i.target)||c(n))}),document.addEventListener("keydown",i=>{i.key==="Escape"&&c(n)})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",y):y();export{M as a};
