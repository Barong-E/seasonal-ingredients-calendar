---
description: 새로운 제철 식재료와 레시피를 추가하는 표준 작업 절차입니다.
---

이 워크플로우는 '띵동 제철음식' 프로젝트에서 데이터와 에셋을 안전하게 추가하기 위한 단계별 가이드입니다. 이 절차는 `DATA_GUIDE.md`의 규칙을 엄격히 따릅니다.

> [!NOTE]
> **📢 최근 규격 변경 요약 (2026년 5월)**
> 1. **꼬집 사용 절대 금지**: 모든 레시피에서 '꼬집' 단위를 완전히 삭제하고, 소량의 양념은 **`0.5작은술`**로 통일합니다. (작은술 단위에 한해 `0.5` 소수점 표현 공식 허용)
> 2. **카테고리별 분량 및 단위(`servingsUnit`) 준수**: 떡/전/말린 과일(`5개`), 김치(`1kg`), 장아찌(`500g`), 술/잼/청(`500ml`) 등 특수 규격 기준을 엄격하게 준수해야 합니다.

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
     - `recommended_for` (이 식재료를 추천하는 대상(질환자, 직업군 등)을 배열 형태로 2~3개 기입)
     - 보관법 3종: `storage_room_temp`, `storage_refrigerator`, `storage_freezer` (전수 조사하여 기입)
     - `popular_dish` (대표 요리는 반드시 레시피로 연결 가능해야 함)

3. **레시피 데이터 추가 (`recipes.json`)**
   - `public/data/recipes.json`에 `popular_dish`에 등록된 요리의 레시피를 추가합니다.
   - 주의: `cookTime`은 반드시 '분'을 포함(예: "20분"), `steps`는 배열 내 객체 형태로 작성.
   - **[계량 단위 필수 규칙]**:
     - 스푼 단위는 반드시 `큰술` / `작은술` 만 사용. (`t스푼`, `T스푼` 사용 금지)
     - **`꼬집` 단위 절대 금지**: 소량의 양념은 반드시 **`0.5작은술`**로 통일하여 작성해야 합니다.
     - `1~2큰술`, `3~4개` 같은 **범위 표현(`~`) 절대 금지** → 단일 숫자로 기입
     - 소수점은 `0.5작은술`에 한해서만 허용되며, 그 외에는 정수 표현 우선 (`0.5큰술` → `1작은술`로 변환)
     - **조리과정(steps) 내 분량 기입 금지**: 조리과정(`steps`의 `description`)에는 `물 350ml`, `간장 2큰술` 같이 고정된 계량 수치를 적지 않습니다. 사용자가 인분을 조절할 때 조리과정 텍스트는 자동으로 변하지 않아 데이터 불일치가 발생합니다. 반드시 '물', '간장' 등 재료 이름으로만 설명해야 합니다. (온도, 시간 등 조리 필수 수치는 예외적으로 기입 가능)
   - **[국물 요리 필수]**: 국, 탕, 찌개, 전골 등 국물 요리는 `ingredients`에 `물` 또는 `육수`를 반드시 기재
   - **[기준 분량 및 단위 가이드]**: 요리 카테고리별로 정해진 기본 분량(`servings`) 및 단위(`servingsUnit`) 규칙을 반드시 지켜주세요.
     - *일반 가정식*: `2`~`4` `인분` (생략 가능)
     - *명절 음식*: `4`~`6` `인분` (생략 가능)
     - *떡, 전, 말린 과일 종류*: `5` `개` (5개 단위)
     - *김치 종류*: `1` `kg` (1kg 단위)
     - *장아찌류*: `500` `g` (500g 단위)
     - *술(전통주 포함), 잼, 청 종류*: `500` `ml` (500ml 단위)

4. **이미지 생성 및 저장**
   - `generate_image` 도구를 사용하여 식재료와 레시피 이미지를 각각 생성합니다.
   - **식재료 이미지 프롬프트**: `Cute 2D cartoon style vector illustration of [식재료 영문명], close up, filling the frame with minimal margins, bright colors, clean white background, simple outlines, food icon style`
     - 저장 파일명: `public/images/[이미지명].png`
   - **레시피 이미지 프롬프트**: `Cute 2D cartoon style vector illustration of Korean food [요리 영문명] served on a plate, close up, filling the frame with minimal margins, bright colors, clean white background, simple outlines, food icon style, top-down view, centered`
     - 저장 파일명: `public/images/recipes/recipe-[요리ID].png` (이 경로를 `recipes.json`의 `image` 필드에 작성해야 함)

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
> - [ ] `amount` 필드에 `t스푼`, `T스푼`, **`꼬집`** 단위, 물결표(`~`) 범위 표현이 완전히 제거되었는가?
> - [ ] 조리과정(`steps`의 `description`) 내에 고정된 계량 수치(ml, g, 큰술 등)가 완전히 제거되고 재료명으로 대체되었는가?
> - [ ] 소량의 양념은 `꼬집` 대신 **`0.5작은술`**로 바르게 적용되었는가? (작은술 이외의 소수점은 없는가?)
> - [ ] 떡, 전, 김치, 장아찌, 술, 잼, 청 요리에 올바른 **`servings`와 `servingsUnit`**이 할당되었는가?
> - [ ] 국물 요리라면 `ingredients`에 `물` 또는 `육수`가 기재되어 있는가?
> - [ ] `popular_dish`의 모든 요리가 `recipe-mapper.js`에 연결되어 있는가?
> - [ ] 이미지 배경이 흰색이며 피사체가 꽉 차게 생성되었는가?
> - [ ] 새로 추가된 레시피의 요리 이미지(recipes/recipe-[요리ID].png)도 함께 생성되어 보관함에 들어갔으며, `recipes.json`의 `image` 필드에 바르게 연결되었는가?