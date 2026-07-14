/**
 * 검색 오버레이 + 최근 검색 히스토리 (localStorage)
 */
const STORAGE_KEY = 'search:history';
const MAX_HISTORY = 10;

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(query) {
  const q = String(query || '').trim();
  if (!q) return;
  const prev = getSearchHistory().filter((item) => item !== q);
  prev.unshift(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, MAX_HISTORY)));
}

export function removeSearchHistoryItem(query) {
  const next = getSearchHistory().filter((item) => item !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearSearchHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function goSearch(query) {
  const q = String(query || '').trim();
  if (!q) return;
  saveSearchHistory(q);
  window.location.href = `search.html?q=${encodeURIComponent(q)}`;
}

function ensureOverlay() {
  let root = document.getElementById('searchOverlay');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'searchOverlay';
  root.className = 'search-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="search-overlay__backdrop" data-close></div>
    <div class="search-overlay__panel" role="dialog" aria-modal="true" aria-label="검색">
      <div class="search-overlay__bar">
        <button type="button" class="search-overlay__back" data-close aria-label="검색 닫기">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <form class="search-overlay__form" id="searchOverlayForm" role="search">
          <input id="searchOverlayInput" class="search-overlay__input" type="search"
            placeholder="이름·설명 검색" autocomplete="off" inputmode="search" enterkeyhint="search">
        </form>
        <button type="submit" form="searchOverlayForm" class="search-overlay__submit" aria-label="검색 실행">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </div>
      <div class="search-overlay__body">
        <div class="search-overlay__history-head">
          <h2 class="search-overlay__history-title">최근 검색</h2>
          <button type="button" class="search-overlay__clear-all" id="searchHistoryClearAll" aria-label="최근 검색 전체 삭제" title="전체 삭제">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
        <ul class="search-overlay__history-list" id="searchHistoryList"></ul>
        <p class="search-overlay__empty" id="searchHistoryEmpty" hidden>최근 검색어가 없습니다</p>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function renderHistory(root) {
  const listEl = root.querySelector('#searchHistoryList');
  const emptyEl = root.querySelector('#searchHistoryEmpty');
  const clearBtn = root.querySelector('#searchHistoryClearAll');
  const history = getSearchHistory();

  listEl.innerHTML = '';
  if (!history.length) {
    emptyEl.hidden = false;
    clearBtn.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  clearBtn.hidden = false;

  history.forEach((q) => {
    const li = document.createElement('li');
    li.className = 'search-overlay__history-item';
    li.innerHTML = `
      <button type="button" class="search-overlay__history-query">
        <svg class="search-overlay__history-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
        </svg>
        <span class="search-overlay__history-text"></span>
      </button>
      <button type="button" class="search-overlay__history-remove" aria-label="삭제">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;
    li.querySelector('.search-overlay__history-text').textContent = q;
    li.querySelector('.search-overlay__history-query').addEventListener('click', () => goSearch(q));
    li.querySelector('.search-overlay__history-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeSearchHistoryItem(q);
      renderHistory(root);
    });
    listEl.appendChild(li);
  });
}

function openOverlay(root) {
  renderHistory(root);
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const input = root.querySelector('#searchOverlayInput');
  requestAnimationFrame(() => {
    input.focus();
  });
}

function closeOverlay(root) {
  root.classList.remove('is-open');
  root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  const input = root.querySelector('#searchOverlayInput');
  if (input) input.blur();
}

function initSearchOverlay() {
  const openBtn = document.getElementById('searchIconBtn');
  if (!openBtn) return;

  const root = ensureOverlay();
  const form = root.querySelector('#searchOverlayForm');
  const input = root.querySelector('#searchOverlayInput');
  const clearAll = root.querySelector('#searchHistoryClearAll');

  openBtn.addEventListener('click', () => openOverlay(root));

  root.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeOverlay(root));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    goSearch(input.value);
  });

  clearAll.addEventListener('click', () => {
    if (!getSearchHistory().length) return;
    if (!confirm('최근 검색어를 모두 삭제할까요?')) return;
    clearSearchHistory();
    renderHistory(root);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) {
      closeOverlay(root);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearchOverlay);
} else {
  initSearchOverlay();
}
