// usage-limiter.js
// 하루 3번 무료 카메라 촬영 제한 및 서버 동기화 모듈
// - 비회원/오프라인: localStorage 기반 오늘 날짜 카운트
// - 회원(구글 로그인): Firestore 데이터베이스 기반 오늘 날짜 카운트 (우회 차단)

import { auth, db } from './firebase-init.js';
import { checkVIPStatusLocal } from './subscription.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * selectedDate(오늘)에 해당하는 YYYY-MM-DD 키 반환
 */
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 로컬 저장소에서 오늘 사용한 촬영 횟수를 읽어옴
 */
function getLocalUsageCount(todayStr) {
  const val = localStorage.getItem(`usage:count:${todayStr}`);
  return val ? parseInt(val, 10) : 0;
}

/**
 * 로컬 저장소의 오늘 사용 횟수를 1 증가시킴
 */
function incrementLocalUsageCount(todayStr) {
  const current = getLocalUsageCount(todayStr);
  localStorage.setItem(`usage:count:${todayStr}`, current + 1);
  return current + 1;
}

/**
 * 오늘 촬영 횟수를 가져옴 (로그인 시 서버 조회, 비로그인 시 로컬 조회)
 */
export async function getTodayUsageCount() {
  const todayStr = getTodayKey();
  
  if (auth.currentUser) {
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'limits', todayStr);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const count = docSnap.data().count || 0;
        // 로컬 캐시 동기화
        localStorage.setItem(`usage:count:${todayStr}`, count);
        return count;
      }
    } catch (e) {
      console.warn("서버 사용량 조회 실패(오프라인 가능성), 로컬 값으로 대체:", e);
    }
  }
  
  return getLocalUsageCount(todayStr);
}

/**
 * 오늘 촬영 횟수를 1 증가시킴 (로그인 시 서버 반영, 비로그인 시 로컬 반영)
 */
export async function incrementUsageCount() {
  const todayStr = getTodayKey();
  const nextCount = incrementLocalUsageCount(todayStr);

  if (auth.currentUser) {
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'limits', todayStr);
      await setDoc(docRef, {
        count: nextCount,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("서버 사용량 업데이트 실패(오프라인):", e);
    }
  }
  return nextCount;
}

/**
 * 카메라 촬영 전 권한 체크 및 카운팅 흐름 관리 함수
 * @param {Function} onAllowed - 촬영 가능할 때 실행할 카메라 구동 콜백
 * @param {Function} onNeedAd - 3회 초과되어 광고를 띄워야 할 때 실행할 콜백
 */
export async function checkUsageLimitAllowed(onAllowed, onNeedAd) {
  // 1. VIP 구독자이면 즉시 촬영 허가 (제한 무시)
  const isVip = checkVIPStatusLocal();
  if (isVip) {
    console.log("VIP 멤버십 회원: 무제한 패스");
    if (onAllowed) onAllowed();
    return;
  }

  // 2. 오늘 사용 횟수 확인
  try {
    const todayCount = await getTodayUsageCount();
    console.log(`오늘의 촬영 횟수: ${todayCount} / 3`);

    if (todayCount < 3) {
      // 3회 미만: 카운트를 1 증가시키고 즉시 촬영 실행
      await incrementUsageCount();
      if (onAllowed) onAllowed();
    } else {
      // 3회 완료(4번째 시도): 광고 보상이 필요함
      if (onNeedAd) {
        onNeedAd();
      } else {
        alert("오늘의 무료 촬영 횟수(3회)를 모두 사용하셨습니다. 정기 구독 시 광고 없이 무제한 사용 가능합니다.");
      }
    }
  } catch (error) {
    console.error("제한 체크 중 오류 발생:", error);
    // 에러 시 안전장치로 로컬 횟수로 한 번 더 판정
    const localCount = getLocalUsageCount(getTodayKey());
    if (localCount < 3) {
      incrementLocalUsageCount(getTodayKey());
      if (onAllowed) onAllowed();
    } else {
      if (onNeedAd) onNeedAd();
    }
  }
}
