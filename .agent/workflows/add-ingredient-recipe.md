---
description: 새로운 제철 식재료와 레시피를 추가하는 표준 작업 절차입니다.
---

이 워크플로우는 '띵동 제철음식' 프로젝트에서 데이터와 에셋을 안전하게 추가하기 위한 **단계별 실행 가이드**입니다.
**이 파일 하나로 작업을 완수할 수 있습니다.** `DATA_GUIDE.md`는 규칙의 상세한 배경이나 예시가 궁금할 때만 참고하세요.

> [!NOTE]
> **📢 최근 규격 변경 요약 (2026년 5월)**
> 1. **꼬집 사용 절대 금지**: 모든 레시피에서 '꼬집' 단위를 완전히 삭제하고, 소량의 양념은 **`0.5작은술`**로 통일합니다. (작은술 단위에 한해 `0.5` 소수점 표현 공식 허용)
> 2. **카테고리별 분량 및 단위(`servingsUnit`) 준수**: 떡/전/말린 과일(`5개`), 김치(`1kg`), 장아찌(`500g`), 술/잼/청(`500ml`) 등 특수 규격 기준을 엄격하게 준수해야 합니다.

---

## [준비] 후보 선정 및 사용자 승인

### ① 중복 검증 (필수)
- `public/data/ingredients.json`에서 후보로 떠오르는 식재료 이름을 **리터럴 단독 한글명**(예: "참외", "장어")으로 검색합니다.
- 복잡한 정규식 검색은 JSON 공백/따옴표 차이로 누락될 수 있으므로 **절대 사용하지 않습니다.**
- 검색 결과가 없더라도 비슷한 이름(예: '두릅' vs '참두릅')이 있는지 전체 목록을 직접 훑어보며 더블 체크합니다.

### ② 후보 3가지 선정
식재료와 레시피를 한 번에 **3개 세트씩** 추가합니다. 후보 선정 우선순위는 다음과 같습니다:

- **1순위 (대중성)**: 대한민국 국민이 가장 많이 소비하고 친숙하게 느끼는 식재료를 최우선으로 선정합니다.
- **2순위 (월별 균형, 동점 시 적용)**: 1순위 점수가 비슷한 후보들 사이에서는 `ingredients.json`의 전체 월별 데이터 수량을 분석하여 상대적으로 데이터가 부족한 달의 식재료를 우선 선택합니다. **현재 달에만 국한할 필요는 없습니다.**

### ③ 후보 제안 (이 단계에서 조사·이미지 생성 절대 금지)
> [!CAUTION]
> 이 단계에서는 서브 에이전트(`invoke_subagent`) 실행이나 DALL-E 이미지 생성을 **절대로 시작하지 않습니다.** 승인 전에 리소스를 먼저 쓰는 것은 금지입니다.
> 
> * **[제안 전 피크타임 1차 검색 필수]**: 제안서에 기재하는 '제철 피크타임 월'은 짐작이나 상상으로 채우지 마세요. 무거운 상세 조사나 이미지 생성은 승인 전 금지이지만, 제철 시기의 신뢰도를 위해 **제안 전에 구글 검색으로 피크타임 달을 직접 교차 검증하는 가벼운 사전 검색은 반드시 실행해야 합니다.** (예: 느타리버섯 제철을 짐작으로 10~11월로 제안하지 말고, 사전 검색을 통해 9~10월이 최적기임을 검증하여 제안해야 합니다.)

후보를 제안할 때는 각 식재료마다 아래 항목을 **반드시 짝지어** 작성합니다:
- 식재료명
- **대중성 근거** (필수): 단순히 "인기 있다"가 아니라, 구체적인 근거를 명시해야 합니다.
  - (예시) "국내 연간 소비량 상위권", "전국 마트·전통시장 판매 상위권", "한국인 식탁 출현 빈도 최상위", "한국인이 가장 즐겨 먹는 X 중 하나" 등
  - ⚠️ **월별 균형만을 선정 이유로 적는 것은 금지입니다.** 월별 균형은 대중성이 비슷한 후보들 사이의 타이브레이커일 뿐입니다.
- 제철 피크타임 월
- **함께 추가할 레시피 후보 1~3개** (요리명 + 간단한 설명)
  - 유명하거나 현재 트렌드에 맞는 레시피가 여러 개라면 최대 3개까지 올릴 수 있습니다.

**별도의 취소/변경 언급이 없으면, 제안한 후보 3개 세트 전부를 추가하는 것이 기본 원칙입니다.**
사용자의 명시적인 승인('진행해', '승인' 등)을 받은 후 다음 단계로 넘어갑니다.

---

## 1. 상세 조사 및 리소스 생성 (승인 후 개시)
- 승인된 식재료에 대해서만 서브 에이전트들을 소환하여 영양 정보 조사, 레시피 탐색, DALL-E 이미지 생성을 **병렬로** 실행합니다.
- **[엄격한 제철 월 결정]**: 웹 검색을 통해 해당 식재료가 가장 맛있는 '피크타임'에 해당하는 달만 엄격하게 식별합니다. 단순히 수확/유통되는 전체 기간을 기입하는 실수를 절대 피하세요. 영양이 가득 차고 맛이 절정에 달하는 진짜 제철 월만 기입해야 합니다. (예: 꽈리고추는 유통 6~10월이나 피크인 7, 8, 9월만 등록 / 새송이버섯은 재배 9~12월이나 피크인 10, 11월만 등록)
- 조사 결과와 이미지를 바탕으로 `implementation_plan.md`를 작성한 뒤 사용자의 최종 결재('진행해' 등)를 받고 2단계로 넘어갑니다.


---

## 2. 식재료 데이터 추가 (`ingredients.json`)
`public/data/ingredients.json`의 끝에 새 항목을 추가합니다. 아래 필드를 **빠짐없이** 기입합니다:

```json
{
  "name_ko": "식재료 이름(한글)",
  "category": "해산물/채소/과일/기타",
  "image": "ingredients/이미지명.png",
  "description_ko": "식재료 설명",
  "recommended_for": ["추천 대상 1", "추천 대상 2"],
  "preparation_ko": "손질법",
  "storage_room_temp": "실온 보관법",
  "storage_refrigerator": "냉장 보관법",
  "storage_freezer": "냉동 보관법 (불가능하면 빈 문자열 \"\")",
  "months": [6, 7],
  "popular_dish": "대표 요리명 (쉼표 구분)",
  "calories_per_100g": 숫자,
  "calories_per_serving": "1회 제공량 기준 칼로리 설명"
}
```

> [!WARNING]
> - `calories_per_100g`, `calories_per_serving`: 검색을 통해 정확히 기입합니다.
> - `recommended_for`: 질환자, 직업군 등 2~3개 배열로 기입합니다.
> - 보관법 3종(`storage_room_temp`, `storage_refrigerator`, `storage_freezer`)을 전수 조사하여 기입합니다.
> - `popular_dish`에 적힌 모든 요리는 반드시 레시피로 연결 가능해야 합니다.

---

## 3. 레시피 데이터 추가 (`recipes.json`)
`public/data/recipes.json`에 `popular_dish`에 등록된 요리의 레시피를 추가합니다.

```json
{
  "id": "recipe-unique-id",
  "name": "요리 이름",
  "category": "카테고리",
  "description": "요리 요약 설명",
  "servings": 2,
  "servingsUnit": "인분",
  "cookTime": "20분",
  "difficulty": "하/중/상",
  "ingredients": [
    { "name": "재료명", "amount": "100g" }
  ],
  "seasoning": [
    { "name": "양념명", "amount": "1큰술" }
  ],
  "steps": [
    { "step": 1, "description": "첫 번째 단계 설명" }
  ]
}
```

> [!CAUTION]
> **절대 지켜야 할 레시피 규칙**
> - `name`을 사용합니다. (`name_ko` 절대 금지)
> - `cookTime`은 반드시 '분' 포함 문자열 (예: `"20분"`)
> - `steps`는 `[{step: 1, description: "..."}, ...]` 객체 배열 형태
> - 주재료(`ingredients`)와 양념(`seasoning`)을 반드시 분리
> - `꼬집` 단위 절대 금지 → `0.5작은술`로 대체
> - 범위 표현(`~`) 절대 금지 → 단일 숫자로 기입 (예: `"2큰술"`)
> - `0.5큰술` 금지 → `1작은술`로 변환 (소수점은 `0.5작은술`에만 허용)
> - 조리과정(`steps`의 `description`) 안에 계량 수치 기입 금지 → 재료 이름으로만 설명 (온도·시간은 예외)
> - 국·탕·찌개·전골 요리는 `ingredients`에 `물` 또는 `육수` 반드시 기재

**카테고리별 기준 분량 및 단위 (`servings` / `servingsUnit`)**

| 요리 카테고리 | servings | servingsUnit |
|---|---|---|
| 일반 가정식 (볶음, 국, 무침 등) | 2~4 | 인분 |
| 명절 음식 | 4~6 | 인분 |
| 떡, 전, 말린 과일 | 5 | 개 |
| 김치 종류 | 1 | kg |
| 장아찌류 | 500 | g |
| 술, 잼, 청 종류 | 500 | ml |

---

## 4. 이미지 생성 및 저장
`generate_image` 도구를 사용하여 식재료와 레시피 이미지를 각각 생성합니다.

**식재료 이미지 프롬프트**:
> `Cute 2D cartoon style vector illustration of [식재료 영문명], close up, filling the frame with minimal margins, bright colors, clean white background, simple outlines, food icon style`
- 저장 파일명: `public/images/ingredients/이미지명.png`

> [!WARNING]
> **한국인 식문화 비주얼 엄수**: 한국인에게 익숙한 생김새로 묘사해야 합니다. 단순 영단어(예: `lettuce`)를 쓰면 서양식 모양으로 생성될 수 있으므로 구체적인 묘사를 추가합니다. (예: `Korean red leaf lettuce stack, individual loose fresh wavy leaves stacked`)

**레시피 이미지 프롬프트**:
> `Cute 2D cartoon style vector illustration of Korean food [요리 영문명] served on a plate, close up, filling the frame with minimal margins, bright colors, clean white background, simple outlines, food icon style, top-down view, centered`
- 저장 파일명: `public/images/recipes/recipe-[요리ID].png` (이 경로를 `recipes.json`의 `image` 필드에 기재)

---

## 5. 레시피 매퍼 연결 (`recipe-mapper.js`)
`assets/recipe-mapper.js`의 `mapping` 객체에 `'요리 이름': 'recipe-id'` 형태로 **누락 없이** 연결합니다.
(`popular_dish`에 적힌 요리 이름과 `recipes.json`의 `name`이 **띄어쓰기까지 100% 일치**해야 합니다.)

```javascript
const mapping = {
  '정확하게 일치하는 요리 이름': 'recipe-unique-id',
};
```

---

## 6. 캐시 버전 갱신 (매우 중요)
- `assets/script.js`, `assets/ingredient.js`, `assets/recipe.js` 내의 버전 숫자(예: `v14` → `v15`)를 올립니다.
- 최상단 `service-worker.js`의 `const VERSION = 'vX';` 버전도 **반드시 함께** 올립니다.

---

## 7. 빌드 및 배포
- `npm run build && npx cap sync` 실행 (안드로이드 반영)
- `git add . && git commit -m "[자동] 식재료/레시피 추가 (상세 내용)" && git push` 실행 (저장소 반영)

---

## 8. [사용자 안내] 쿠팡 파트너스 URL 추가 리마인드
모든 과정이 끝나면 사용자에게 다음 메시지를 반드시 안내합니다:
> "모든 배포가 완료되었습니다. 꼭 온라인에서 쿠팡 파트너스 URL을 생성하여 해당 레시피에 추가해 주세요!"

---

> **📋 배포 전 최종 확인 (Quick Checklist)**
> - [ ] `amount` 필드에 `t스푼`, `T스푼`, **`꼬집`** 단위, 물결표(`~`) 범위 표현이 완전히 제거되었는가?
> - [ ] 조리과정(`steps`의 `description`) 내에 고정된 계량 수치(ml, g, 큰술 등)가 완전히 제거되고 재료명으로 대체되었는가?
> - [ ] 소량의 양념은 `꼬집` 대신 **`0.5작은술`**로 바르게 적용되었는가? (작은술 이외의 소수점은 없는가?)
> - [ ] 떡, 전, 김치, 장아찌, 술, 잼, 청 요리에 올바른 **`servings`와 `servingsUnit`**이 할당되었는가?
> - [ ] 국물 요리라면 `ingredients`에 `물` 또는 `육수`가 기재되어 있는가?
> - [ ] `popular_dish`의 모든 요리가 `recipe-mapper.js`에 연결되어 있는가?
> - [ ] 이미지 배경이 흰색이며 피사체가 꽉 차게 생성되었는가?
> - [ ] 새로 추가된 레시피의 요리 이미지(`recipes/recipe-[요리ID].png`)도 함께 생성되어 `recipes.json`의 `image` 필드에 바르게 연결되었는가?