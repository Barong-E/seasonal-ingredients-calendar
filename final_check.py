import json

try:
    with open('public/data/ingredients.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    missing = []
    url_to_names = {}

    for item in data:
        name = item.get('name_ko')
        url = item.get('external_url', '').strip()
        
        if not url:
            missing.append(name)
        else:
            if url in url_to_names:
                url_to_names[url].append(name)
            else:
                url_to_names[url] = [name]

    duplicates = {url: names for url, names in url_to_names.items() if len(names) > 1}

    print(f"전체 식재료 수: {len(data)}")
    print(f"누락된 식재료 (0개여야 함): {len(missing)}")
    if missing:
        print(f" - 대상: {', '.join(missing)}")

    print(f"중복된 링크 사용 (0개여야 함): {len(duplicates)}")
    for url, names in duplicates.items():
        print(f" - [{url}] 함께 사용 중인 식재료: {', '.join(names)}")

except Exception as e:
    print(f"에러: {e}")
