/**
 * GNB MY 탭: 로그인 시 유튜브처럼 원형 프로필 사진 표시
 */
import { listenToAuthChanges } from './firebase-init.js';

function applyAvatar(user) {
  document.querySelectorAll('.gnb__item--my').forEach((item) => {
    const img = item.querySelector('.gnb__avatar');
    const icon = item.querySelector('.gnb__icon--person');
    if (!img) return;

    if (user && user.photoURL) {
      img.src = user.photoURL;
      img.alt = user.displayName || '내 프로필';
      img.hidden = false;
      if (icon) icon.hidden = true;
      item.classList.add('gnb__item--avatar');
    } else {
      img.removeAttribute('src');
      img.alt = '';
      img.hidden = true;
      if (icon) icon.hidden = false;
      item.classList.remove('gnb__item--avatar');
    }
  });
}

try {
  listenToAuthChanges(applyAvatar);
} catch (err) {
  console.warn('GNB 아바타 초기화 실패:', err);
}
