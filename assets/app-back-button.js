import { App } from '@capacitor/app';

// DOMContentLoaded 이후에 이벤트 리스너를 등록합니다.
document.addEventListener('DOMContentLoaded', () => {
  // 브라우저 환경이 아닌 Capacitor 앱(Android/iOS)인지 확인
  const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

  if (isCapacitor) {
    App.addListener('backButton', ({ canGoBack }) => {
      // 1. 모달이나 열려있는 팝업이 있다면 먼저 닫기 (우선순위)
      const modal = document.querySelector('.modal.active') || document.querySelector('.dialog[open]');
      if (modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.classList.remove('active');
        }
        return; // 뒤로가기 처리를 여기서 마침
      }

      // 2. 현재 페이지가 메인화면(제철 식재료 탭 또는 명절 탭)인지 확인
      const path = window.location.pathname;
      const isMainPage = path.endsWith('index.html') || 
                         path.endsWith('holidays.html') || 
                         path.endsWith('setting.html') || 
                         path === '/';

      if (isMainPage) {
        // 메인 화면에서는 종료 의사 확인
        const confirmExit = window.confirm('앱을 종료하시겠습니까?');
        if (confirmExit) {
          App.exitApp();
        }
      } else {
        // 상세 페이지(ingredient.html, recipe.html 등)에서는 뒤로 가기
        if (canGoBack) {
          window.history.back();
        } else {
          // 브라우저 히스토리가 없는 경우 기본 메인 페이지로 이동
          window.location.href = 'index.html';
        }
      }
    });
  }
});
