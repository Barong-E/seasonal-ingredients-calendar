const fs = require('fs');

const recipes = JSON.parse(fs.readFileSync('public/data/recipes.json', 'utf8'));

const soupKeywords = ['국', '탕', '찌개', '전골', '지리', '수제비', '칼국수', '만둣국', '샤브샤브', '완탕', '짬뽕', '우동', '라면', '스튜', '나베', '짜글이'];
const excludeKeywords = ['국화', '비빔국수', '막국수', '볶음', '튀김', '구이', '조림', '무침', '샐러드', '적', '찜', '떡볶이', '잡탕밥', '차', '청', '주', '술', '김치', '곶감', '편', '강정', '장아찌', '정과', '죽'];
const waterKeywords = ['물', '육수', '쌀뜨물', '다시마물', '멸치육수', '채수', '사골육수', '사골', '다시마', '국물', '티백', '사골 국물', '멸치 다시마 육수', '다시마 육수', '동치미'];

console.log("=== 전체 국물 요리 조사 결과 ===");

recipes.forEach(r => {
  const name = r.name || '';
  const hasSoupKw = soupKeywords.some(kw => name.includes(kw));
  const isExcluded = excludeKeywords.some(kw => name.includes(kw));
  
  if ((hasSoupKw && !isExcluded) || name.includes('칼국수') || name.includes('수제비')) {
    const allIngredients = [...(r.ingredients || []), ...(r.seasoning || [])];
    const waterIngs = allIngredients.filter(ing => {
      const ingName = ing.name || '';
      return waterKeywords.some(w => ingName.includes(w));
    });
    
    if (waterIngs.length > 0) {
      console.log(`[정상] ${name} -> 포함된 국물 재료: ${waterIngs.map(i => `${i.name}(${i.amount})`).join(', ')}`);
    } else {
      console.log(`[누락!!!] ${name} -> 물이나 육수 없음! (재료: ${allIngredients.map(i => i.name).join(', ')})`);
    }
  }
});
