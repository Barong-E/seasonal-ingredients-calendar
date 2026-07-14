/**
 * 알림 히스토리 (수신 알림 목록) — localStorage
 */
const STORAGE_KEY = 'notification:history';
const MAX_ITEMS = 30;

export function getNotificationHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}

/**
 * @param {{ title: string, body?: string, type?: string, url?: string, id?: string }} noti
 */
export function addNotificationHistory(noti) {
  const item = {
    id: noti.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: noti.title || '알림',
    body: noti.body || '',
    type: noti.type || 'general',
    url: noti.url || '',
    createdAt: Date.now(),
    read: false
  };
  const list = getNotificationHistory().filter((x) => x.id !== item.id);
  list.unshift(item);
  persist(list);
  updateNotiDot();
  return item;
}

export function markNotificationRead(id) {
  const list = getNotificationHistory().map((item) =>
    item.id === id ? { ...item, read: true } : item
  );
  persist(list);
  updateNotiDot();
}

export function markAllNotificationsRead() {
  const list = getNotificationHistory().map((item) => ({ ...item, read: true }));
  persist(list);
  updateNotiDot();
}

export function getUnreadNotificationCount() {
  return getNotificationHistory().filter((item) => !item.read).length;
}

export function updateNotiDot() {
  const count = getUnreadNotificationCount();
  document.querySelectorAll('#notiHistoryBtn').forEach((btn) => {
    if (count > 0) btn.classList.add('has-unread');
    else btn.classList.remove('has-unread');
  });
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function typeEmoji(type) {
  if (type === 'ingredient') return '🥦';
  if (type === 'holiday') return '🌕';
  return '🔔';
}

function resolveUrl(item) {
  if (item.url) return item.url;
  if (item.type === 'ingredient') return 'index.html';
  if (item.type === 'holiday') return 'holidays.html';
  return '';
}

function ensureDropdown(anchorParent) {
  let panel = document.getElementById('notiHistoryPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'notiHistoryPanel';
  panel.className = 'noti-history';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '알림');
  panel.innerHTML = `
    <div class="noti-history__header">
      <h2 class="noti-history__title">🔔 알림</h2>
      <button type="button" class="noti-history__mark-read" id="notiMarkAllRead">모두 읽음</button>
    </div>
    <ul class="noti-history__list" id="notiHistoryList"></ul>
    <p class="noti-history__empty" id="notiHistoryEmpty" hidden>알림이 없습니다</p>
  `;
  anchorParent.appendChild(panel);
  return panel;
}

function renderList(panel) {
  const listEl = panel.querySelector('#notiHistoryList');
  const emptyEl = panel.querySelector('#notiHistoryEmpty');
  const items = getNotificationHistory();

  listEl.innerHTML = '';
  if (!items.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  items.forEach((item) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `noti-history__item${item.read ? '' : ' is-unread'}`;
    btn.innerHTML = `
      <div class="noti-history__item-top">
        <span class="noti-history__emoji" aria-hidden="true">${typeEmoji(item.type)}</span>
        <div class="noti-history__item-body">
          <p class="noti-history__item-title"></p>
          <p class="noti-history__item-desc"></p>
          <div class="noti-history__meta">
            <span class="noti-history__time">${formatRelativeTime(item.createdAt)}</span>
            ${item.read ? '' : '<span class="noti-history__badge-new">새</span>'}
          </div>
        </div>
      </div>
    `;
    btn.querySelector('.noti-history__item-title').textContent = item.title;
    btn.querySelector('.noti-history__item-desc').textContent = item.body || '';
    btn.addEventListener('click', () => {
      markNotificationRead(item.id);
      closePanel(panel);
      const url = resolveUrl(item);
      if (url) window.location.href = url;
    });
    li.appendChild(btn);
    listEl.appendChild(li);
  });
}

function openPanel(panel) {
  renderList(panel);
  panel.classList.add('is-open');
}

function closePanel(panel) {
  panel.classList.remove('is-open');
}

function initNotificationHistory() {
  const btn = document.getElementById('notiHistoryBtn');
  if (!btn) return;

  const parent = btn.closest('.header-controls') || btn.parentElement;
  if (parent && getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  const panel = ensureDropdown(parent);
  updateNotiDot();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.classList.contains('is-open')) closePanel(panel);
    else openPanel(panel);
  });

  panel.querySelector('#notiMarkAllRead').addEventListener('click', (e) => {
    e.stopPropagation();
    markAllNotificationsRead();
    renderList(panel);
  });

  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('is-open')) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    closePanel(panel);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel(panel);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationHistory);
} else {
  initNotificationHistory();
}
