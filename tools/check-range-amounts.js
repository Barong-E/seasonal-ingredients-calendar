const fs = require('fs');

const recipes = JSON.parse(fs.readFileSync('public/data/recipes.json', 'utf8'));

const rangeRecipes = [];

recipes.forEach(r => {
  const allIngredients = [...(r.ingredients || []), ...(r.seasoning || [])];
  const rangeItems = allIngredients.filter(ing => {
    const amt = ing.amount || '';
    // 물결표(~)나 하이픈(-) 등 범위 표현이 있는지 확인 (단, -가 단어에 쓰이는 경우 제외, 보통 숫자와 숫자 사이의 ~ 또는 -)
    return amt.includes('~');
  });
  
  if (rangeItems.length > 0) {
    rangeRecipes.push({
      id: r.id,
      name: r.name,
      items: rangeItems.map(i => `${i.name}: ${i.amount}`)
    });
  }
});

console.log(JSON.stringify(rangeRecipes, null, 2));
console.log(`총 ${rangeRecipes.length}개의 레시피에서 범위(~) 계량 발견.`);
