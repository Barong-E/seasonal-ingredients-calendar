/*
  Verify that dish names displayed in the app are correctly mapped to recipe IDs,
  and those IDs exist in data/recipes.json.

  Output JSON summary with:
  - totalRecipes
  - totalMappings
  - dishesMissingMapping (grouped by source)
  - mappedButMissingRecipe (dish -> id)
  - recipesUnreferencedByMapping (ids present in recipes but not referenced by mapping)
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function readJson(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function extractMappingFromScript(scriptSource) {
  const re = /function\s+getRecipeIdFromDishName\s*\([\s\S]*?const\s+mapping\s*=\s*\{([\s\S]*?)\};/m;
  const m = re.exec(scriptSource);
  if (!m) throw new Error('Failed to locate mapping object in assets/script.js');
  // Remove inline comments to prevent syntax issues
  let body = m[1]
    .split('\n')
    .map((line) => line.replace(/\s*\/\/.*$/, ''))
    .join('\n');
  const code = `(function(){ return {${body}}; })()`;
  const sandbox = {};
  return vm.runInNewContext(code, sandbox, { timeout: 1000 });
}

function main() {
  const ingredients = readJson('data/ingredients.json');
  const holidays = readJson('data/holidays.json');
  const recipes = readJson('data/recipes.json');
  const scriptSrc = fs.readFileSync('assets/script.js', 'utf8');

  const mapping = extractMappingFromScript(scriptSrc);
  const mapKeys = Object.keys(mapping);
  const mapValues = Object.values(mapping);
  const recipeIdSet = new Set(recipes.map((r) => r.id));

  // Gather dishes
  const ingredientDishes = new Set();
  ingredients.forEach((it) => {
    const raw = it.popular_dish || '';
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((d) => ingredientDishes.add(d));
  });

  const holidayDishes = new Set();
  holidays.forEach((h) => {
    const foods = (h.details && h.details.foods) || [];
    foods.forEach((f) => {
      if (f && typeof f.name === 'string' && f.name.trim()) {
        holidayDishes.add(f.name.trim());
      }
    });
    // also include main_food if present
    if (h.main_food && typeof h.main_food === 'string') {
      holidayDishes.add(h.main_food.trim());
    }
  });

  // Compute missing mappings by source
  const dishesMissingMappingIngredients = [...ingredientDishes].filter((d) => !mapping[d]);
  const dishesMissingMappingHolidays = [...holidayDishes].filter((d) => !mapping[d]);

  // Compute mapped but recipe missing
  const mappedButMissingRecipe = Object.entries(mapping)
    .filter(([, id]) => !recipeIdSet.has(id))
    .map(([dish, id]) => ({ dish, id }));

  // Recipes that have no incoming mapping (not necessarily an error, but useful)
  const mapIdSet = new Set(mapValues);
  const recipesUnreferencedByMapping = recipes
    .map((r) => r.id)
    .filter((id) => !mapIdSet.has(id));

  const result = {
    totalRecipes: recipes.length,
    totalMappings: mapKeys.length,
    dishesMissingMapping: {
      ingredients: dishesMissingMappingIngredients.sort(),
      holidays: dishesMissingMappingHolidays.sort(),
    },
    mappedButMissingRecipe,
    recipesUnreferencedByMapping,
  };

  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (err) {
  console.error('[check-recipes-mapping] Error:', err.message);
  process.exit(1);
}



