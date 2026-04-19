import json
import urllib.parse
import subprocess
import time
import sys

def get_final_url(url):
    try:
        # Use curl to get the Location header from the redirect
        result = subprocess.run(['curl', '-Ls', '-o', '/dev/null', '-w', '%{url_effective}', url], 
                               capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except:
        return None

try:
    with open('public/data/ingredients.json', 'r', encoding='utf-8') as f:
        ingredients = json.load(f)

    report = []
    url_map = {} # To track duplicates

    print("전수 조사 중입니다 (약 1~2분 소요)...", file=sys.stderr)

    for i, item in enumerate(ingredients):
        name = item.get('name_ko')
        url = item.get('external_url', '')
        
        status = "OK"
        dest = ""
        
        if not url:
            status = "MISSING"
        else:
            # Check for duplicates of the shortened URL itself first
            if url in url_map:
                status = "DUPLICATE"
                url_map[url].append(name)
            else:
                url_map[url] = [name]
                # Follow redirect to find the actual search term
                dest = get_final_url(url)
                if dest:
                    # Decode destination to check for 'q' parameter
                    parsed = urllib.parse.urlparse(dest)
                    params = urllib.parse.parse_qs(parsed.query)
                    q = params.get('q', [''])[0]
                    if q and q != name:
                        status = "MISMATCH"
                        dest = f"연결된 검색어: '{q}'"
                    elif not q:
                        status = "UNVERIFIED"
                        dest = "검색어 확인 불가 (직접 클릭 확인 필요)"
                else:
                    status = "ERROR"
                    dest = "링크 접속 불가"

        report.append({
            "name": name,
            "url": url,
            "status": status,
            "dest_info": dest
        })
        
        # Progress indicator
        if (i+1) % 10 == 0:
            print(f"{i+1}/{len(ingredients)} 완료...", file=sys.stderr)

    # Re-process duplicates to list siblings
    for r in report:
        if r['status'] == "DUPLICATE" or (r['url'] and len(url_map.get(r['url'], [])) > 1):
            siblings = [s for s in url_map[r['url']] if s != r['name']]
            r['status'] = "DUPLICATE"
            r['dest_info'] = f"중복 사용됨 (함께 사용 중: {', '.join(siblings)})"

    print(json.dumps(report, ensure_ascii=False, indent=2))

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
