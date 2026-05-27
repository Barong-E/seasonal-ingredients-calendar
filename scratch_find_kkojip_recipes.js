const fs = require('fs');

const recipes = JSON.parse(fs.readFileSync('public/data/recipes.json', 'utf8'));
const targetRecipes = [];

recipes.forEach(recipe => {
  let hasHalfTsp = false;
  const ingredients = recipe.ingredients || [];
  const seasoning = recipe.seasoning || [];
  
  const allItems = [...ingredients, ...seasoning];
  allItems.forEach(item => {
    if (item.amount === "0.5작은술") {
      hasHalfTsp = true;
    }
  });

  if (hasHalfTsp) {
    targetRecipes.push(recipe.name);
  }
});

console.log(`Total target recipes: ${targetRecipes.length}`);
console.log(targetRecipes);
