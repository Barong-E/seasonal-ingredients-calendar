import json
import urllib.parse
import re

try:
    with open('public/data/ingredients.json', 'r', encoding='utf-8') as f:
        ingredients = json.load(f)

    missing_links = []
    mismatched_links = []
    valid_links_count = 0

    for item in ingredients:
        name = item.get('name_ko', '이름 없음')
        url = item.get('external_url', '')

        # 1. 링크가 없는 경우
        if not url or url.strip() == "":
            missing_links.append(name)
            continue

        # 2. 링크가 있는 경우 검색어 대조
        # 보통 쿠팡 검색 링크: https://www.coupang.com/np/search?q=%ED%8C%BD%EC%9D%B4%EB%B2%14%EC%84%AF...
        parsed_url = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed_url.query)
        
        search_query = params.get('q', [''])[0]
        
        if not search_query:
            # q 파라미터가 없는 엉뚱한 URL인 경우
            mismatched_links.append(f"{name} (URL에 검색어 파라미터 'q'가 없음: {url})")
        elif search_query.strip() != name.strip():
            # 검색어가 이름과 일치하지 않는 경우 (부분 일치 정도는 허용할지 검토 필요하나 일단 엄격 대조)
            # 예: '말린 팽이버섯' vs '팽이버섯' 처럼 의도적인 차이가 있을 수 있음
            mismatched_links.append(f"{name} (검색어: '{search_query}')")
        else:
            valid_links_count += 1

    print(f"총 식재료 수: {len(ingredients)}")
    print(f"정상 링크 수: {valid_links_count}")
    
    print("\n[1] 쿠팡 링크가 없는 식재료 (총 {}건):".format(len(missing_links)))
    if missing_links:
        print(", ".join(missing_links))
    else:
        print("없음")

    print("\n[2] 링크와 검색어가 불일치하거나 의심되는 식재료 (총 {}건):".format(len(mismatched_links)))
    if mismatched_links:
        for m in mismatched_links:
            print(f"- {m}")
    else:
        print("없음")

except Exception as e:
    print(f"에러 발생: {e}")
