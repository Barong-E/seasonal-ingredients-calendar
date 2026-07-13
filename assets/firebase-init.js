import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCredential, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ============================================================
// ⚠️ 대표님께서 진짜 Firebase를 만드시면 교체할 임시 설정값입니다.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyFakeApiKey_PlaceholderForTestingOnly",
  authDomain: "seasons-ingredients-calendar.firebaseapp.com",
  projectId: "seasons-ingredients-calendar",
  storageBucket: "seasons-ingredients-calendar.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:fakeappid1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * 구글 로그인 실행 함수 (웹/안드로이드 네이티브 자동 판별)
 */
export async function loginWithGoogle() {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

  if (isNative) {
    // 📱 안드로이드/iOS 네이티브 구글 로그인 실행
    try {
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      
      // 실제 구글 클라우드 콘솔의 OAuth '웹 클라이언트 ID'를 사용해야 합니다.
      // 일단 빌드와 디버깅을 위해 임시 자리를 만듭니다.
      const webClientId = "123456789012-fakeclientid.apps.googleusercontent.com"; 

      const result = await GoogleSignIn.signIn({
        clientId: webClientId,
      });

      if (result.idToken) {
        const credential = GoogleAuthProvider.credential(result.idToken);
        return await signInWithCredential(auth, credential);
      } else {
        throw new Error("구글 로그인 토큰을 가져오지 못했습니다.");
      }
    } catch (error) {
      console.error("네이티브 구글 로그인 에러:", error);
      throw error;
    }
  } else {
    // 🖥️ 웹 브라우저 환경 로그인 실행 (팝업)
    try {
      const provider = new GoogleAuthProvider();
      // 모바일 웹 뷰 환경에서는 팝업 대신 리다이렉트가 안정적일 수 있으나 일반 브라우저 테스트는 팝업이 간편함
      return await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("웹 구글 로그인 에러:", error);
      throw error;
    }
  }
}

/**
 * 로그아웃 실행 함수
 */
export async function logout() {
  try {
    await signOut(auth);
    // 네이티브 구글 로그인 세션도 함께 비워줍니다.
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    if (isNative) {
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      await GoogleSignIn.signOut();
    }
  } catch (error) {
    console.error("로그아웃 에러:", error);
    throw error;
  }
}

/**
 * 사용자의 로그인 상태 변화 감지 리스너 등록
 */
export function listenToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}
