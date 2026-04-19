import json
import re
import sys

try:
    with open('public/data/ingredients.json', 'r', encoding='utf-8') as f:
        ingredients = json.load(f)
    
    with open('public/data/recipes.json', 'r', encoding='utf-8') as f:
        recipes = json.load(f)
        
    with open('assets/recipe-mapper.js', 'r', encoding='utf-8') as f:
        mapper_ctx = f.read()
        
    # Extract mapping object
    match = re.search(r'const mapping = (\{[\s\S]*?\});', mapper_ctx)
    if not match:
        print("Could not find mapping block")
        sys.exit(1)
        
    mapping_str = match.group(1)
    # Parse standard js object to python dict
    lines = mapping_str.split('\n')
    mapper = {}
    for line in lines:
        m = re.search(r"'([^']+)':\s*'([^']+)'", line)
        if m:
            mapper[m.group(1).strip()] = m.group(2).strip()
            
    unmapped = []
    missing_recipes = []
    recipe_ids = {r['id'] for r in recipes}
    
    total_dishes = set()
    total_ingredients = 0
    
    for ing in ingredients:
        if 'popular_dish' in ing and ing['popular_dish']:
            total_ingredients += 1
            # Split and strip spaces
            dishes = [d.strip() for d in ing['popular_dish'].split(',')]
            for dish in dishes:
                total_dishes.add(dish)
                if dish not in mapper:
                    unmapped.append(f"[{ing.get('name_ko')}] '{dish}' mapper 누락")
                else:
                    rid = mapper[dish]
                    if rid not in recipe_ids:
                        missing_recipes.append(f"'{dish}' -> '{rid}' 레시피 누락")
                        
    print(f"Total mapped dishes in recipe-mapper.js: {len(mapper)}")
    print(f"Total unique dishes in ingredients.json: {len(total_dishes)}")
    print(f"Total ingredients with dishes: {total_ingredients}")
    print("=== Mapper 누락 ===")
    for u in unmapped:
        print(u)
        
    print("\n=== Recipe 누락 ===")
    for r in missing_recipes:
        print(r)
        
except Exception as e:
    print("Error:", e)
