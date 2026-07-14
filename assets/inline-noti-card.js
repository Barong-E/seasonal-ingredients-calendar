/**
 * 인라인 알림 설정 카드 (재료/세시 페이지)
 * data-inline-noti="ingredient" | "holiday" 컨테이너에 카드 주입
 */
import { Capacitor } from '@capacitor/core';

async function loadSettings() {
  const { loadSettings: load } = await import('./setting.js');
  return load();
}

async function saveSettings(next) {
  const { saveSettings: save } = await import('./setting.js');
  return save(next);
}

function showWebOnlyModal() {
  const existing = document.getElementById('webNotificationInfoModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'webNotificationInfoModal';
  modal.className = 'info-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="info-modal__backdrop"></div>
    <div class="info-modal__content">
      <p class="info-modal__message">알림 기능은 앱에서 이용하실 수 있어요. 앱을 설치하고 제철 식재료 소식을 받아보세요! 🌱</p>
      <div class="info-modal__buttons">
        <button type="button" class="info-modal__btn info-modal__btn--ios" disabled>iOS (준비중)</button>
        <a href="https://play.google.com/store/apps/details?id=net.seasonalfood.app&referrer=utm_source%3Dseasonalfood_web%26utm_medium%3Dinternal%26utm_campaign%3Dinline_noti" target="_blank" rel="noopener noreferrer" class="info-modal__btn info-modal__btn--android">Android 설치</a>
      </div>
      <button type="button" class="info-modal__close">닫기</button>
    </div>
  `;
  function close() {
    modal.remove();
    document.body.style.overflow = '';
  }
  modal.querySelector('.info-modal__backdrop').addEventListener('click', close);
  modal.querySelector('.info-modal__close').addEventListener('click', close);
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function buildDayOptions() {
  let html = '';
  for (let d = 1; d <= 28; d++) {
    html += `<option value="${d}">매월 ${d}일</option>`;
  }
  return html;
}

function buildDdayOptions() {
  return `
    <option value="0">당일</option>
    <option value="1">1일 전</option>
    <option value="3">3일 전</option>
    <option value="7">7일 전</option>
  `;
}

function createCard(type) {
  const isIngredient = type === 'ingredient';
  const title = isIngredient ? '제철 식재료 알림' : '명절·절기 알림';
  const card = document.createElement('section');
  card.className = 'inline-noti-card';
  card.setAttribute('aria-label', `${title} 설정`);
  card.innerHTML = `
    <div class="inline-noti-card__row">
      <span class="inline-noti-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
      </span>
      <div class="inline-noti-card__text">
        <h2 class="inline-noti-card__title">${title}</h2>
      </div>
      <label class="switch">
        <input type="checkbox" class="inline-noti-toggle" aria-label="${title} 켜기">
        <span class="slider round"></span>
      </label>
    </div>
    <div class="inline-noti-card__detail">
      <div class="inline-noti-card__fields">
        <div class="inline-noti-card__field">
          <label for="inlineNotiSelect_${type}">${isIngredient ? '알림 날짜' : '알림 시점'}</label>
          <select id="inlineNotiSelect_${type}" class="inline-noti-select">
            ${isIngredient ? buildDayOptions() : buildDdayOptions()}
          </select>
        </div>
        <div class="inline-noti-card__field">
          <label for="inlineNotiTime_${type}">알림 시간</label>
          <input id="inlineNotiTime_${type}" class="inline-noti-time" type="time" step="300" value="09:00">
        </div>
      </div>
      <a class="inline-noti-card__more" href="setting.html">알림 자세히 관리</a>
    </div>
  `;
  return card;
}

async function bindCard(card, type) {
  const settings = await loadSettings();
  const toggle = card.querySelector('.inline-noti-toggle');
  const detail = card.querySelector('.inline-noti-card__detail');
  const selectEl = card.querySelector('.inline-noti-select');
  const timeEl = card.querySelector('.inline-noti-time');

  const conf = settings[type];
  toggle.checked = !!conf.enabled;
  if (conf.enabled) detail.classList.add('is-open');

  const first = conf.list && conf.list[0];
  if (first) {
    if (type === 'ingredient') {
      selectEl.value = String(first.day || 1);
    } else {
      selectEl.value = String(first.dDay ?? 3);
    }
    timeEl.value = first.time || '09:00';
  }

  async function persistFromUi(enabled) {
    const next = {
      ingredient: { ...settings.ingredient },
      holiday: { ...settings.holiday }
    };
    const target = next[type];
    target.enabled = enabled;

    if (enabled) {
      const value = parseInt(selectEl.value, 10);
      const time = timeEl.value || '09:00';
      if (!target.list || !target.list.length) {
        target.list = [{
          id: Date.now(),
          ...(type === 'ingredient' ? { day: value || 1 } : { dDay: value }),
          time
        }];
      } else {
        target.list = target.list.map((item, idx) => {
          if (idx !== 0) return item;
          return type === 'ingredient'
            ? { ...item, day: value || 1, time }
            : { ...item, dDay: value, time };
        });
      }
    }

    settings[type] = target;
    await saveSettings(next);
  }

  toggle.addEventListener('change', async () => {
    if (!Capacitor.isNativePlatform()) {
      toggle.checked = false;
      detail.classList.remove('is-open');
      showWebOnlyModal();
      return;
    }

    const enabled = toggle.checked;
    if (enabled) detail.classList.add('is-open');
    else detail.classList.remove('is-open');

    try {
      await persistFromUi(enabled);
    } catch (err) {
      console.error(err);
      alert('알림 설정 저장에 실패했습니다.');
    }
  });

  async function onDetailChange() {
    if (!toggle.checked) return;
    if (!Capacitor.isNativePlatform()) return;
    try {
      await persistFromUi(true);
    } catch (err) {
      console.error(err);
    }
  }

  selectEl.addEventListener('change', onDetailChange);
  timeEl.addEventListener('change', onDetailChange);
}

async function initInlineNotiCards() {
  const mounts = document.querySelectorAll('[data-inline-noti]');
  for (const mount of mounts) {
    const type = mount.getAttribute('data-inline-noti');
    if (type !== 'ingredient' && type !== 'holiday') continue;
    if (mount.querySelector('.inline-noti-card')) continue;
    const card = createCard(type);
    mount.appendChild(card);
    await bindCard(card, type);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInlineNotiCards);
} else {
  initInlineNotiCards();
}
