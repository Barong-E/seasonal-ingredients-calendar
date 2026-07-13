import { db, auth } from './firebase-init.js';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  writeBatch 
} from 'firebase/firestore';

/**
 * 폰의 localStorage 데이터를 Firestore 서버로 이사(마이그레이션)시키는 함수
 */
export async function migrateLocalDataToServer(userId) {
  const migrationKey = `migration_done:${userId}`;
  if (localStorage.getItem(migrationKey) === 'true') {
    return; // 이미 이사 완료됨
  }

  try {
    const batch = writeBatch(db);
    let hasDataToMigrate = false;

    // 1. 식사 일기 이사 (calorie:meals:*)
    const mealKeys = Object.keys(localStorage).filter(k => k.startsWith('calorie:meals:'));
    for (const key of mealKeys) {
      const dateStr = key.replace('calorie:meals:', ''); // YYYY-MM-DD
      const mealsData = localStorage.getItem(key);
      if (mealsData) {
        const meals = JSON.parse(mealsData);
        if (meals.length > 0) {
          const docRef = doc(db, 'users', userId, 'meals', dateStr);
          batch.set(docRef, { meals, updatedAt: new Date().toISOString() });
          hasDataToMigrate = true;
        }
      }
    }

    // 2. 목표 칼로리 이사 (calorie:target:*)
    const targetKeys = Object.keys(localStorage).filter(k => k.startsWith('calorie:target:'));
    for (const key of targetKeys) {
      const dateStr = key.replace('calorie:target:', '');
      const targetVal = localStorage.getItem(key);
      if (targetVal) {
        const docRef = doc(db, 'users', userId, 'targets', dateStr);
        batch.set(docRef, { target: parseInt(targetVal, 10), updatedAt: new Date().toISOString() });
        hasDataToMigrate = true;
      }
    }

    // 기본 목표 칼로리 이사
    const defaultTarget = localStorage.getItem('calorie:target');
    if (defaultTarget) {
      const docRef = doc(db, 'users', userId, 'profile', 'settings');
      batch.set(docRef, { defaultTarget: parseInt(defaultTarget, 10) }, { merge: true });
      hasDataToMigrate = true;
    }

    // 3. 찜 목록 이사 (favorites)
    const favoriteTypes = ['ingredients', 'recipes', 'holidays'];
    const favoritesObj = {};
    let hasFavorites = false;
    for (const type of favoriteTypes) {
      const favData = localStorage.getItem(`favorites:${type}`);
      if (favData) {
        favoritesObj[type] = JSON.parse(favData);
        hasFavorites = true;
        hasDataToMigrate = true;
      }
    }
    if (hasFavorites) {
      const favDocRef = doc(db, 'users', userId, 'profile', 'favorites');
      batch.set(favDocRef, { ...favoritesObj, updatedAt: new Date().toISOString() });
    }

    if (hasDataToMigrate) {
      await batch.commit();
      console.log('🎉 로컬 데이터를 Firebase 서버로 이전했습니다!');
    }

    // 이사 완료 표식 남기기
    localStorage.setItem(migrationKey, 'true');
  } catch (error) {
    console.error('데이터 이전 중 에러 발생:', error);
    throw error;
  }
}

/**
 * 특정 날짜의 식사 기록을 서버에 저장
 */
export async function saveMealsToServer(userId, dateStr, meals) {
  try {
    const docRef = doc(db, 'users', userId, 'meals', dateStr);
    await setDoc(docRef, { 
      meals, 
      updatedAt: new Date().toISOString() 
    });
  } catch (error) {
    console.warn('서버 식사 기록 저장 실패(오프라인 가능성):', error);
  }
}

/**
 * 특정 날짜의 식사 기록을 서버에서 가져오기
 */
export async function getMealsFromServer(userId, dateStr) {
  try {
    const docRef = doc(db, 'users', userId, 'meals', dateStr);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().meals || [];
    }
  } catch (error) {
    console.warn('서버 식사 기록 가져오기 실패(오프라인 가능성):', error);
  }
  return null;
}

/**
 * 특정 날짜의 목표 칼로리를 서버에 저장
 */
export async function saveTargetCalorieToServer(userId, dateStr, target) {
  try {
    const docRef = doc(db, 'users', userId, 'targets', dateStr);
    await setDoc(docRef, { 
      target, 
      updatedAt: new Date().toISOString() 
    });
  } catch (error) {
    console.warn('서버 목표 칼로리 저장 실패:', error);
  }
}

/**
 * 특정 날짜의 목표 칼로리를 서버에서 가져오기
 */
export async function getTargetCalorieFromServer(userId, dateStr) {
  try {
    const docRef = doc(db, 'users', userId, 'targets', dateStr);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().target || null;
    }
  } catch (error) {
    console.warn('서버 목표 칼로리 가져오기 실패:', error);
  }
  return null;
}

/**
 * 찜 목록(즐겨찾기)을 서버에 저장
 */
export async function saveFavoritesToServer(userId, favorites) {
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'favorites');
    await setDoc(docRef, { 
      ...favorites, 
      updatedAt: new Date().toISOString() 
    });
  } catch (error) {
    console.warn('서버 즐겨찾기 저장 실패:', error);
  }
}

/**
 * 찜 목록(즐겨찾기)을 서버에서 가져오기
 */
export async function getFavoritesFromServer(userId) {
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'favorites');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ingredients: data.ingredients || [],
        recipes: data.recipes || [],
        holidays: data.holidays || []
      };
    }
  } catch (error) {
    console.warn('서버 즐겨찾기 가져오기 실패:', error);
  }
  return null;
}
