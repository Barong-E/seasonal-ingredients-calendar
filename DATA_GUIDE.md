# 📚 제철 식재료 및 레시피 데이터 관리 가이드

이 문서는 '띵동 제철음식' 앱의 식재료와 레시피 데이터를 추가하거나 수정할 때 반드시 지켜야 할 규칙들을 정리한 **데이터 관리 비법서**입니다. 나중에 새로운 식재료를 추가할 때 이 문서를 참고하면 실수를 줄일 수 있습니다.

---

## 1. 📂 파일 위치 및 역할
- `public/data/ingredients.json`: 식재료의 기본 정보(이름, 효능, 보관법 등) 저장
- `public/data/recipes.json`: 요리법 상세 정보(재료, 조리 단계 등) 저장
- `assets/recipe-mapper.js`: 식재료 상세 페이지와 레시피 페이지를 연결해 주는 '단어장'
- `public/images/`: 식재료 및 레시피 프로필 이미지 저장소

---

## 2. 📝 데이터 규격 (JSON Schema)

### 🥬 식재료 (`ingredients.json`)
반드시 아래와 같은 이름표(Key)를 사용해야 합니다.
```json
{
  "name_ko": "식재료 이름(한글)",
  "category": "해산물/채소/과일/기타",
  "image": "image_name.png",
  "description_ko": "식재료 설명",
  "preparation_ko": "손질법",
  "storage_refrigerator": "냉장보관법",
  "months": [1, 2, 12], // 제철 달(월) 정보 (숫자 배열)
  "popular_dish": "대표 요리 이름 (쉼표로 구분)"
}
```

### 🍲 레시피 (`recipes.json`)
**[주의]** 식재료와 달리 한글 이름표(`_ko`)를 쓰지 않는 항목이 많으니 주의하세요!
```json
{
  "id": "recipe-unique-id", // 영문 소문자와 하이픈(-)만 사용 (예: hanchi-mulhoe)
  "name": "요리 이름", // name_ko가 아님!
  "category": "해산물 등",
  "description": "요리 요약 설명",
  "servings": 2, // 숫자만
  "cookTime": "20분", // 반드시 '분'을 포함한 문자열
  "difficulty": "하/중/상",
  "ingredients": [
    { "name": "재료명", "amount": "양(예: 100g)" }
  ],
  "steps": [
    { "step": 1, "description": "첫 번째 단계 설명" },
    { "step": 2, "description": "두 번째 단계 설명" }
  ]
}
```

---

## 3. 🖼️ 이미지 생성 가이드 (DALL-E 프롬프트)
식재료 이미지를 생성할 때는 기존 앱의 **만화/일러스트 톤앤매너**를 유지해야 합니다.
- **추천 프롬프트 스타일**: 
  > `Cute 2D cartoon style vector illustration of [식재료 영문명], bright colors, clean white background, simple outlines, food icon style`
- **⚠️ 중요 (여백 조절)**: 이미지가 너무 작게 보이지 않도록 **피사체가 화면에 꽉 차게(Filling the frame)** 생성해야 합니다. 프롬프트에 `close up`, `filling the frame with minimal margins`와 같은 키워드를 추가하여 여백이 너무 많이 남지 않도록 조절하세요.

---

## 4. 🔗 레시피 연결 (`recipe-mapper.js`)
새로운 식재료와 레시피를 추가한 후에는 반드시 이 파일에 **'요리 이름'**과 **'레시피 ID'**를 연결해줘야 합니다. 
여기에 등록되지 않으면 식재료 페이지에서 요리를 눌러도 레시피로 넘어가지 않습니다!

```javascript
const mapping = {
  '새로운 요리 이름': 'recipe-unique-id',
  ...
};
```

---

## 5. 🔄 반영 및 배포 절차 (필수!)
데이터를 수정한 후에는 다음 3단계를 **반드시 순서대로** 실행해야 합니다.

1.  **캐시 버전 올리기**: `assets/script.js`, `assets/ingredient.js`, `assets/recipe.js` 내의 `v14` 같은 버전 숫자를 한 단계 높입니다 (예: `v15`). 그래야 사용자의 폰에서 새 데이터를 즉시 불러옵니다.
2.  **안드로이드 동기화**: 터미널에서 `npm run build && npx cap sync`를 실행합니다.
3.  **저장소 업데이트**: `git add . && git commit -m "...내용..." && git push`를 실행하여 서버에 올립니다.

---

## 💡 자주 하는 실수 (Pitfalls)
- ❌ `cookTime`에 '20'만 쓰고 '분'을 안 쓰는 경우 (화면 출력 오류)
- ❌ 레시피의 `name`을 `name_ko`로 잘못 적는 경우 (데이터 로드 실패)
- ❌ `steps`를 그냥 글자 배열(`["1단계", "2단계"]`)로만 적는 경우 (기존 앱은 `{step: 1, description: ""}` 형태를 선호)
- ❌ 중복된 식재료(예: 두릅 vs 참두릅)를 추가하는 경우
