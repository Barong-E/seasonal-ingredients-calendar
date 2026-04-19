import json

new_links = {
    "팽이버섯": "https://link.coupang.com/a/er9NYa",
    "명이나물": "https://link.coupang.com/a/er9OG3",
    "한치": "https://link.coupang.com/a/er9QLv",
    "낙지": "https://link.coupang.com/a/er9RHd",
    "방어": "https://link.coupang.com/a/er9Sha",
    "포도": "https://link.coupang.com/a/er9SOk",
    "살구": "https://link.coupang.com/a/er9TKD",
    "앵두": "https://link.coupang.com/a/er9UuH",
    "한라봉": "https://link.coupang.com/a/er9UVm"
}

try:
    with open('public/data/ingredients.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated_count = 0
    for item in data:
        name = item.get('name_ko')
        if name in new_links:
            item['external_url'] = new_links[name]
            updated_count += 1

    with open('public/data/ingredients.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"총 {updated_count}개의 링크를 업데이트했습니다.")

except Exception as e:
    print(f"에러 발생: {e}")
