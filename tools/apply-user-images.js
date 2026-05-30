const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/barong/MyProjects/Seasonal Ingredients Calendar';
const brainDir = '/Users/barong/.gemini/antigravity-ide/brain/3c483077-b0a7-4b75-b7e6-e55f1c1395c2';
const queuePath = path.join(brainDir, 'scratch/missing_recipes_queue.json');
const recipesJsonPath = path.join(projectRoot, 'public/data/recipes.json');
const recipesImagesDir = path.join(projectRoot, 'public/images/recipes');
const scriptJsPath = path.join(projectRoot, 'assets/script.js');
const swJsPath = path.join(projectRoot, 'public/service-worker.js');

applyUserImages();

function applyUserImages() {
  console.log('🔍 사용자 입력 이미지 스캔 작업을 시작합니다...');

  if (!fs.existsSync(queuePath)) {
    console.error('오류: 큐 파일이 존재하지 않습니다:', queuePath);
    process.exit(1);
  }
  if (!fs.existsSync(recipesJsonPath)) {
    console.error('오류: recipes.json 파일이 존재하지 않습니다:', recipesJsonPath);
    process.exit(1);
  }
  if (!fs.existsSync(recipesImagesDir)) {
    console.error('오류: 레시피 이미지 디렉토리가 존재하지 않습니다:', recipesImagesDir);
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
  const recipes = JSON.parse(fs.readFileSync(recipesJsonPath, 'utf-8'));
  const folderFiles = fs.readdirSync(recipesImagesDir);

  if (queue.length === 0) {
    console.log('🎉 큐가 비어있습니다. 처리할 요리가 없습니다!');
    process.exit(0);
  }

  const processedIds = [];
  const appliedList = [];

  queue.forEach(item => {
    // targetImage에서 파일명만 추출 (예: "recipes/recipe-gamja-jorim.png" -> "recipe-gamja-jorim.png")
    const expectedFileName = item.targetImage.split('/').pop();
    
    // 폴더 내에 정확한 파일명이 존재하는지 검사 (대소문자 구분 없이 확인)
    const matchedFile = folderFiles.find(file => file.toLowerCase() === expectedFileName.toLowerCase());

    if (matchedFile) {
      const recipeIndex = recipes.findIndex(r => r.id === item.id);
      if (recipeIndex !== -1) {
        // recipes.json 데이터 갱신
        recipes[recipeIndex].image = item.targetImage;
        processedIds.push(item.id);
        appliedList.push({ id: item.id, name: item.name, file: matchedFile });
      } else {
        console.warn(`경고: recipes.json에 ID ${item.id}가 없어 데이터를 업데이트하지 못했습니다.`);
      }
    }
  });

  if (processedIds.length === 0) {
    console.log('ℹ️ 폴더에 매칭되는 새로운 요리 이미지가 없습니다. 이미지를 올바른 파일명으로 넣어주셨는지 확인해 주세요!');
    process.exit(0);
  }

  // 1. recipes.json 파일 저장
  fs.writeFileSync(recipesJsonPath, JSON.stringify(recipes, null, 2), 'utf-8');
  console.log(`\n💾 recipes.json 업데이트 완료. (총 ${processedIds.length}개 요리)`);
  appliedList.forEach(item => {
    console.log(`   - [연동 완료] ${item.name} (${item.file})`);
  });

  // 2. 큐 파일 업데이트
  const updatedQueue = queue.filter(item => !processedIds.includes(item.id));
  fs.writeFileSync(queuePath, JSON.stringify(updatedQueue, null, 2), 'utf-8');
  console.log(`💾 큐 업데이트 완료. 남은 미생성 레시피: ${updatedQueue.length}개`);

  // 3. 캐시 버전 자동으로 1씩 올리기
  bumpVersions();

  console.log('\n✨ 모든 연동 및 캐시 버전 갱신이 끝났습니다!');
  console.log('이제 안드로이드 동기화 및 Git Push를 진행해 주세요!');
}

function bumpVersions() {
  console.log('\n🔄 캐시 버전 갱신 작업을 진행합니다...');

  // 1) script.js 버전 갱신
  if (fs.existsSync(scriptJsPath)) {
    let content = fs.readFileSync(scriptJsPath, 'utf-8');
    const scriptRegex = /const CACHE_KEY = 'seasons:ingredients:v(\d+)';/;
    const match = content.match(scriptRegex);
    if (match) {
      const currentVersion = parseInt(match[1], 10);
      const nextVersion = currentVersion + 1;
      content = content.replace(scriptRegex, `const CACHE_KEY = 'seasons:ingredients:v${nextVersion}';`);
      fs.writeFileSync(scriptJsPath, content, 'utf-8');
      console.log(`   - assets/script.js: v${currentVersion} ➡️ v${nextVersion}`);
    } else {
      console.warn('   - 경고: assets/script.js에서 CACHE_KEY를 찾을 수 없습니다.');
    }
  }

  // 2) service-worker.js 버전 갱신
  if (fs.existsSync(swJsPath)) {
    let content = fs.readFileSync(swJsPath, 'utf-8');
    const swRegex = /const VERSION = 'v(\d+)';/;
    const match = content.match(swRegex);
    if (match) {
      const currentVersion = parseInt(match[1], 10);
      const nextVersion = currentVersion + 1;
      content = content.replace(swRegex, `const VERSION = 'v${nextVersion}';`);
      fs.writeFileSync(swJsPath, content, 'utf-8');
      console.log(`   - public/service-worker.js: v${currentVersion} ➡️ v${nextVersion}`);
    } else {
      console.warn('   - 경고: public/service-worker.js에서 VERSION을 찾을 수 없습니다.');
    }
  }
}
