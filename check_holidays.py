import json
import re
import sys

try:
    with open('public/data/holidays.json', 'r', encoding='utf-8') as f:
        holidays = json.load(f)
        
    with open('assets/recipe-mapper.js', 'r', encoding='utf-8') as f:
        mapper_ctx = f.read()
        
    match = re.search(r'const mapping = (\{[\s\S]*?\});', mapper_ctx)
    mapping_str = match.group(1)
    lines = mapping_str.split('\n')
    mapper = {}
    for line in lines:
        m = re.search(r"'([^']+)':\s*'([^']+)'", line)
        if m:
            mapper[m.group(1).strip()] = m.group(2).strip()
            
    unmapped = []
    
    for hol in holidays:
        if 'details' in hol and 'foods' in hol['details']:
            for food in hol['details']['foods']:
                name = food['name'].strip()
                if name not in mapper:
                    unmapped.append(f"[Holiday: {hol.get('name')}] Food '{name}' is NOT MAPPED")
                    
    for u in unmapped:
        print(u)
        
except Exception as e:
    print("Error:", e)
