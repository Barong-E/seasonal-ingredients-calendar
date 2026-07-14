import { loginWithGoogle, logout, listenToAuthChanges } from './firebase-init.js';
import { checkVIPStatusLocal, syncVIPStatusFromServer, purchaseSubscription } from './subscription.js';

const NICK_KEY = 'user:nickname';

const els = {
  profile: document.getElementById('mypageProfile'),
  avatarImg: document.getElementById('mypageAvatarImg'),
  avatarPlaceholder: document.getElementById('mypageAvatarPlaceholder'),
  name: document.getElementById('mypageName'),
  email: document.getElementById('mypageEmail'),
  editBtn: document.getElementById('mypageEditProfile'),
  btnLogin: document.getElementById('mypageBtnLogin'),
  btnLogout: document.getElementById('mypageBtnLogout'),
  premiumBadge: document.getElementById('mypagePremiumBadge'),
  premiumDesc: document.getElementById('mypagePremiumDesc'),
  btnSubscribe: document.getElementById('mypageBtnSubscribe'),
  vipInfo: document.getElementById('mypageVipInfo'),
  vipExpire: document.getElementById('mypageVipExpire'),
  nickModal: document.getElementById('mypageNickModal'),
  nickInput: document.getElementById('mypageNickInput'),
  nickCancel: document.getElementById('mypageNickCancel'),
  nickSave: document.getElementById('mypageNickSave')
};

function getNickname(user) {
  const saved = localStorage.getItem(NICK_KEY);
  if (saved && saved.trim()) return saved.trim();
  if (user?.displayName) return user.displayName;
  return '게스트';
}

function setAvatar(user) {
  if (user?.photoURL) {
    els.avatarImg.src = user.photoURL;
    els.avatarImg.alt = user.displayName || '프로필';
    els.avatarImg.hidden = false;
    els.avatarPlaceholder.hidden = true;
  } else {
    els.avatarImg.hidden = true;
    els.avatarImg.removeAttribute('src');
    els.avatarPlaceholder.hidden = false;
  }
}

function renderProfile(user) {
  const isLoggedIn = !!user;
  els.profile?.classList.toggle('mypage-profile--guest', !isLoggedIn);
  els.profile?.classList.toggle('mypage-profile--user', isLoggedIn);

  if (isLoggedIn) {
    const nick = getNickname(user);
    els.name.textContent = `${nick}님`;
    els.email.textContent = user.email || '';
    els.editBtn.hidden = false;
    els.btnLogin.hidden = true;
    els.btnLogout.hidden = false;
  } else {
    els.name.textContent = '로그인이 필요해요';
    els.email.textContent = '데이터를 기기에 안전하게 보관하려면 로그인하세요';
    els.editBtn.hidden = true;
    els.btnLogin.hidden = false;
    els.btnLogout.hidden = true;
  }

  setAvatar(user);
}

function updateVipUI() {
  const isVip = checkVIPStatusLocal();
  if (isVip) {
    els.premiumBadge.textContent = 'VIP';
    els.premiumBadge.classList.add('is-vip');
    els.btnSubscribe.hidden = true;
    els.vipInfo.classList.add('is-visible');
    els.premiumDesc.textContent = '광고 없이 무제한으로 이용 중입니다.';
    const expireDate = localStorage.getItem('subscription:expires_at');
    if (expireDate) {
      const d = new Date(expireDate);
      els.vipExpire.textContent = `구독 만료일: ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }
  } else {
    els.premiumBadge.textContent = 'BASIC';
    els.premiumBadge.classList.remove('is-vip');
    els.btnSubscribe.hidden = false;
    els.vipInfo.classList.remove('is-visible');
    els.premiumDesc.textContent = '광고 없이 무제한 사용';
  }
}

function openNickModal(user) {
  els.nickInput.value = getNickname(user);
  els.nickModal.classList.add('is-open');
  els.nickInput.focus();
}

function closeNickModal() {
  els.nickModal.classList.remove('is-open');
}

let currentUser = null;

function init() {
  localStorage.setItem('lastTab', 'mypage.html');
  renderProfile(null);
  updateVipUI();

  els.btnLogin?.addEventListener('click', async () => {
    try {
      els.btnLogin.disabled = true;
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      alert('구글 로그인에 실패했습니다.\n(앱 설정이 완료된 실제 기기에서 작동합니다)');
    } finally {
      els.btnLogin.disabled = false;
    }
  });

  els.btnLogout?.addEventListener('click', async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    try {
      await logout();
      localStorage.removeItem('subscription:is_vip');
      localStorage.removeItem('subscription:expires_at');
      updateVipUI();
    } catch (err) {
      console.error(err);
      alert('로그아웃 실패: ' + err.message);
    }
  });

  els.editBtn?.addEventListener('click', () => openNickModal(currentUser));
  els.nickCancel?.addEventListener('click', closeNickModal);
  els.nickModal?.querySelector('.mypage-nick-modal__backdrop')?.addEventListener('click', closeNickModal);
  els.nickSave?.addEventListener('click', () => {
    const nick = els.nickInput.value.trim();
    if (!nick) {
      alert('닉네임을 입력해 주세요.');
      return;
    }
    localStorage.setItem(NICK_KEY, nick);
    closeNickModal();
    renderProfile(currentUser);
  });

  els.btnSubscribe?.addEventListener('click', async () => {
    try {
      els.btnSubscribe.disabled = true;
      els.btnSubscribe.textContent = '결제창 여는 중...';
      await purchaseSubscription(
        () => {
          alert('🎉 프리미엄 구독이 시작되었습니다! 이제 무제한으로 사용하실 수 있습니다.');
          updateVipUI();
        },
        (errMsg) => alert('결제 처리 실패: ' + errMsg)
      );
    } catch (err) {
      console.error(err);
    } finally {
      els.btnSubscribe.disabled = false;
      els.btnSubscribe.textContent = '무제한 구독하기 ₩2,900';
    }
  });

  listenToAuthChanges(async (user) => {
    currentUser = user;
    renderProfile(user);
    if (user) {
      try {
        await syncVIPStatusFromServer(user.uid);
      } catch (e) {
        console.error(e);
      }
    }
    updateVipUI();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
