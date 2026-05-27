const fs = require('fs');

const originalPath = 'public/data/recipes.json';
const newBatchPath = 'scratch_recipes_batch_1.json';

const originalRecipes = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
const newBatch = JSON.parse(fs.readFileSync(newBatchPath, 'utf8'));

let updatedCount = 0;

newBatch.forEach(newRecipe => {
  const index = originalRecipes.findIndex(r => r.name === newRecipe.name);
  if (index !== -1) {
    // Keep category mapping or any other ID fields if they exist, but replace the core recipe
    const oldRecipe = originalRecipes[index];
    originalRecipes[index] = {
      ...oldRecipe,
      cookTime: newRecipe.cookTime,
      servings: newRecipe.servings,
      servingsUnit: newRecipe.servingsUnit,
      ingredients: newRecipe.ingredients,
      seasoning: newRecipe.seasoning,
      steps: newRecipe.steps
    };
    updatedCount++;
  } else {
    console.warn(`Recipe not found in original: ${newRecipe.name}`);
  }
});

fs.writeFileSync(originalPath, JSON.stringify(originalRecipes, null, 2), 'utf8');
console.log(`Successfully updated ${updatedCount} recipes from batch 1.`);
