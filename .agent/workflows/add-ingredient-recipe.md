---
description: 새로운 제철 식재료와 레시피를 추가하는 표준 작업 절차입니다.
---

이 워크플로우는 '띵동 제철음식' 프로젝트에서 데이터와 에셋을 안전하게 추가하기 위한 단계별 가이드입니다.

1. **데이터 검증 및 분석**
   - 추가하려는 식재료가 `public/data/ingredients.json`에 이미 존재하는지 확인합니다. (중복 방지)
   - 식재료의 제철 달(months)과 효능 등을 신뢰할 수 있는 정보인지 검증합니다.

2. **식재료 데이터 추가**
   - `public/data/ingredients.json`의 끝에 새 항목을 추가합니다.
   - 키값 규칙: `name_ko`, `category`, `image`, `description_ko`, `preparation_ko`, `storage_refrigerator`, `months`, `popular_dish`.

3. **레시피 데이터 추가**
   - `public/data/recipes.json`의 끝에 새 항목을 추가합니다.
   - 키값 규칙: `id` (영문), `name` (한글), `cookTime` ("20분" 형태), `steps` (객체 배열).
// turbo
4. **이미지 생성**
   - `generate_image` 도구를 사용하여 만화풍 일러스트를 생성합니다.
   - 프롬프트: `Cute 2D cartoon style vector illustration of [English Name], bright colors, clean white background, simple outlines, food icon style`.
   - 생성된 이미지를 `public/images/` 폴더에 적절한 이름으로 저장합니다.

5. **레시피 매퍼 연결**
   - `assets/recipe-mapper.js`의 `mapping` 객체에 `요리 이름: 레시피 ID` 쌍을 추가합니다.

6. **캐시 버전 갱신**
   - `assets/script.js`, `assets/ingredient.js`, `assets/recipe.js` 파일에서 `CACHE_KEY` 또는 fetch URL의 `?v=vXX` 버전 숫자를 1 올립니다.

// turbo
7. **빌드 및 동기화**
   - `npm run build && npx cap sync` 명령어를 실행하여 안드로이드 앱에 반영합니다.
   - `git add . && git commit -m "[자동] ..." && git push` 명령어로 서버에 변경사항을 전송합니다.
