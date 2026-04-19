const fs = require('fs');

const ingredients = JSON.parse(fs.readFileSync('public/data/ingredients.json', 'utf8'));
const recipes = JSON.parse(fs.readFileSync('public/data/recipes.json', 'utf8'));

const recipeMapperContent = fs.readFileSync('assets/recipe-mapper.js', 'utf8');
const mappingMatch = recipeMapperContent.match(/const mapping = (\{[\s\S]*?\});/);
let mapper = {};
if (mappingMatch && mappingMatch[1]) {
  // Use eval or new Function to parse the JS object
  mapper = new Function('return ' + mappingMatch[1])();
} else {
  console.log("Could not parse recipe-mapper.js");
  process.exit(1);
}

let unmappedDishes = [];
let missingRecipes = [];

ingredients.forEach(ing => {
  if (ing.popular_dish) {
    const dishes = ing.popular_dish.split(',').map(d => d.trim());
    dishes.forEach(dish => {
      const recipeId = mapper[dish];
      if (!recipeId) {
        unmappedDishes.push(`Ingredient '${ing.name_ko}': Dish '${dish}' is not mapped in recipe-mapper.js`);
      } else {
        const recipeExists = recipes.some(r => r.id === recipeId);
        if (!recipeExists) {
          missingRecipes.push(`Dish '${dish}' mapped to '${recipeId}', but not found in recipes.json`);
        }
      }
    });
  }
});

console.log("=== Unmapped Dishes ===");
console.log(unmappedDishes.join('\n'));
console.log("\n=== Missing Recipes ===");
console.log(missingRecipes.join('\n'));
