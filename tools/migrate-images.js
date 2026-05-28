// tools/migrate-images.js
// 이미지 폴더 분리 및 JSON 데이터 이미지 경로 일괄 업데이트 스크립트

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

// 1. 대상 디렉토리 정의 및 생성
const DIRS = {
  ingredients: path.join(IMAGES_DIR, 'ingredients'),
  recipes: path.join(IMAGES_DIR, 'recipes'),
  holidays: path.join(IMAGES_DIR, 'holidays')
};

console.log('1. 이미지 폴더 생성 중...');
for (const key in DIRS) {
  if (!fs.existsSync(DIRS[key])) {
    fs.mkdirSync(DIRS[key], { recursive: true });
    console.log(`- 생성됨: ${DIRS[key]}`);
  }
}

// 파일 안전 이동 헬퍼 함수
function moveFile(filename, category) {
  if (!filename) return false;
  
  // 이미 카테고리 프리픽스가 붙어있다면 파일명만 추출
  const cleanFilename = path.basename(filename);
  const srcPath = path.join(IMAGES_DIR, cleanFilename);
  const destPath = path.join(DIRS[category], cleanFilename);

  if (fs.existsSync(srcPath)) {
    try {
      fs.renameSync(srcPath, destPath);
      console.log(`  [이동 완료] ${cleanFilename} -> images/${category}/`);
      return true;
    } catch (e) {
      console.error(`  [이동 실패] ${cleanFilename}:`, e.message);
    }
  }
  return false;
}

// 2. 식재료 데이터 (ingredients.json) 처리
console.log('\n2. 식재료 이미지 처리 시작...');
const ingredientsPath = path.join(PUBLIC_DIR, 'data', 'ingredients.json');
if (fs.existsSync(ingredientsPath)) {
  const ingredients = JSON.parse(fs.readFileSync(ingredientsPath, 'utf8'));
  ingredients.forEach(item => {
    if (item.image && !item.image.startsWith('ingredients/')) {
      const oldImg = item.image;
      moveFile(oldImg, 'ingredients');
      item.image = `ingredients/${oldImg}`;
    }
  });
  fs.writeFileSync(ingredientsPath, JSON.stringify(ingredients, null, 2), 'utf8');
  console.log('✓ ingredients.json 업데이트 완료');
}

// 3. 레시피 데이터 (recipes.json) 처리
console.log('\n3. 레시피 이미지 처리 시작...');
const recipesPath = path.join(PUBLIC_DIR, 'data', 'recipes.json');

// 실물 이미지가 이미 있는 요리들의 ID 매핑 정의
const recipeImageMapping = {
  "bangeo-head-gui": "bangeo-head-gui.png",
  "bangeo-hoe": "bangeo-hoe.png",
  "channamul-muchim": "channamul-muchim.png",
  "chodang-corn-bap": "chodang-corn-bap.png",
  "corn-cheese": "corn-cheese.png",
  "dasima-bugak": "dasima-bugak.png",
  "enoki-mushroom-pancake": "enoki-pancake.png",
  "gondre-bap": "gondre-bap.png",
  "saturn-peach-ade": "saturn-peach-ade.png",
  "saturn-peach-salad": "saturn-peach-salad.png",
  "seaweed-soup": "seaweed-soup.png"
};

if (fs.existsSync(recipesPath)) {
  const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
  recipes.forEach(item => {
    // 1) 매핑 룰에 따라 실물 이미지가 있는 레시피들의 이미지 강제 매핑 및 이동
    if (recipeImageMapping[item.id]) {
      const imgFile = recipeImageMapping[item.id];
      moveFile(imgFile, 'recipes');
      item.image = `recipes/${imgFile}`;
    } 
    // 2) 기존에 이미지 필드가 있는 경우 경로 변경 및 파일 이동
    else if (item.image) {
      if (!item.image.startsWith('recipes/')) {
        const oldImg = item.image;
        moveFile(oldImg, 'recipes');
        item.image = `recipes/${oldImg}`;
      }
    }
  });
  fs.writeFileSync(recipesPath, JSON.stringify(recipes, null, 2), 'utf8');
  console.log('✓ recipes.json 업데이트 완료');
}

// 4. 명절/절기 데이터 (holidays.json) 처리
console.log('\n4. 명절/절기 이미지 처리 시작...');
const holidaysPath = path.join(PUBLIC_DIR, 'data', 'holidays.json');
if (fs.existsSync(holidaysPath)) {
  const holidays = JSON.parse(fs.readFileSync(holidaysPath, 'utf8'));
  holidays.forEach(item => {
    if (item.image && !item.image.startsWith('holidays/')) {
      const oldImg = item.image;
      moveFile(oldImg, 'holidays');
      item.image = `holidays/${oldImg}`;
    }
  });
  fs.writeFileSync(holidaysPath, JSON.stringify(holidays, null, 2), 'utf8');
  console.log('✓ holidays.json 업데이트 완료');
}

// 5. 기타 하드코딩된 기본 이미지(Fallback) 이동 처리
console.log('\n5. 기본 이미지(Fallback) 및 로고 이동 처리...');
moveFile('holiday-seollal.jpg', 'holidays');
moveFile('recipe-galchi-jorim.jpg', 'recipes');

console.log('\n✓ 마이그레이션 작업이 모두 끝났습니다!');
