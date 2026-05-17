---
description: 새로운 제철 식재료와 레시피를 추가하는 표준 작업 절차입니다.
---

이 워크플로우는 '띵동 제철음식' 프로젝트에서 데이터와 에셋을 안전하게 추가하기 위한 단계별 가이드입니다. 이 절차는 `DATA_GUIDE.md`의 규칙을 엄격히 따릅니다.

0. **데이터 관리 가이드 정독 및 식재료 선정**
   - 최상위 경로의 `DATA_GUIDE.md` 파일을 정독합니다.
   - **[핵심 사전 단계]**: 후보를 선정하기 전에 `public/data/ingredients.json`에서 해당 식재료 이름을 명시적으로 검색(`grep_search` 등)하고, **"중복 결과가 없음"을 사용자에게 먼저 보고**합니다.
   - `DATA_GUIDE.md`의 선정 기준을 반영하여, 3가지 식재료 후보를 추천 이유와 함께 사용자에게 제안합니다.
   - 사용자의 명시적인 승인('진행해', '승인' 등)을 받은 후 다음 단계를 진행합니다.

1. **데이터 중복 확인 및 검증 (최종)**
   - 승인된 식재료에 대해 `public/data/ingredients.json`에서 다시 한번 철저히 검색하여 실수가 없음을 확정합니다.

2. **식재료 데이터 추가 (`ingredients.json`)**
   - `public/data/ingredients.json`의 끝에 새 항목을 추가합니다.
   - **[가이드라인 필수 사항]**: 
     - `calories_per_100g`, `calories_per_serving` (검색을 통해 정확히 기입)
     - 보관법 3종: `storage_room_temp`, `storage_refrigerator`, `storage_freezer` (전수 조사하여 기입)
     - `popular_dish` (대표 요리는 반드시 레시피로 연결 가능해야 함)

3. **레시피 데이터 추가 (`recipes.json`)**
   - `public/data/recipes.json`에 `popular_dish`에 등록된 요리의 레시피를 추가합니다.
   - 주의: `cookTime`은 반드시 '분'을 포함(예: "20분"), `steps`는 배열 내 객체 형태로 작성.
   - **[계량 단위 필수 규칙]**:
     - 스푼 단위는 반드시 `큰술` / `작은술` 만 사용. (`t스푼`, `T스푼` 사용 금지)
     - `1~2큰술`, `3~4개` 같은 **범위 표현(`~`) 절대 금지** → 단일 숫자로 기입
     - 소수점보다 정수 우선 (`0.5큰술` → `1작은술`로 변환)
   - **[국물 요리 필수]**: 국, 탕, 찌개, 전골 등 국물 요리는 `ingredients`에 `물` 또는 `육수`를 반드시 기재
   - **[기준 인분 가이드]**: 일반 가정식 2~4인분 / 명절 음식 4~6인분 / 보존식(청·잼·장아찌) 10~20인분 권장

// turbo
4. **이미지 생성 및 저장**
   - `generate_image` 도구를 사용하여 일러스트를 생성합니다.
   - 프롬프트: `Cute 2D cartoon style vector illustration of [English Name], close up, filling the frame with minimal margins, bright colors, clean white background, simple outlines, food icon style`

5. **레시피 매퍼 연결 (`recipe-mapper.js`)**
   - `assets/recipe-mapper.js`의 `mapping` 객체에 `요리 이름: 레시피 ID`를 반드시 연결합니다. (가이드라인 핵심: 누락 시 링크 불가)

6. **캐시 버전 갱신 (매우 중요)**
   - `assets/script.js`, `assets/ingredient.js`, `assets/recipe.js` 내의 버전(예: `v14` -> `v15`)을 올립니다.
   - **[가이드라인 필수 사항]**: 최상단 `service-worker.js`의 `const VERSION = 'vX';` 버전도 반드시 함께 올립니다.

// turbo
7. **빌드 및 배포**
   - `npm run build && npx cap sync` 실행 (안드로이드 반영)
   - `git add . && git commit -m "[자동] 식재료/레시피 추가 (상세 내용)" && git push` 실행 (저장소 반영)

8. **[사용자 안내] 쿠팡 파트너스 URL 추가 리마인드**
   - 모든 과정이 끝나면 사용자에게 명시적으로 "모든 배포가 완료되었습니다. 꼭 온라인에서 쿠팡 파트너스 URL을 생성하여 해당 레시피에 추가해 주세요!"라고 안내합니다.

---

> **📋 배포 전 최종 확인 (Quick Checklist)**
> - [ ] `amount` 필드에 `t스푼`, `T스푼`, 물결표(`~`) 범위 표현이 없는가?
> - [ ] 국물 요리라면 `ingredients`에 `물` 또는 `육수`가 기재되어 있는가?
> - [ ] `popular_dish`의 모든 요리가 `recipe-mapper.js`에 연결되어 있는가?
> - [ ] 이미지 배경이 흰색이며 피사체가 꽉 차게 생성되었는가?