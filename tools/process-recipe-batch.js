const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/barong/MyProjects/Seasonal Ingredients Calendar';
const recipesJsonPath = path.join(projectRoot, 'public/data/recipes.json');
const publicDir = path.join(projectRoot, 'public');
const queuePath = '/Users/barong/.gemini/antigravity-ide/brain/3c483077-b0a7-4b75-b7e6-e55f1c1395c2/scratch/missing_recipes_queue.json';

// 매개변수로 아티팩트 이미지들의 절대경로 리스트를 JSON 형태로 받음
// 형식: node process-recipe-batch.js '[{"id": "tteokguk", "artifactPath": "/path/to/img"}]'
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('오류: 이미지 아티팩트 매핑 리스트가 전달되지 않았습니다.');
  process.exit(1);
}

let artifactMappings = [];
try {
  artifactMappings = JSON.parse(args[0]);
} catch (e) {
  console.error('오류: JSON 인자 파싱 실패:', e.message);
  process.exit(1);
}

if (!fs.existsSync(recipesJsonPath)) {
  console.error('recipes.json 파일을 찾을 수 없습니다.');
  process.exit(1);
}
if (!fs.existsSync(queuePath)) {
  console.error('큐 파일을 찾을 수 없습니다.');
  process.exit(1);
}

const recipes = JSON.parse(fs.readFileSync(recipesJsonPath, 'utf-8'));
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));

const processedIds = [];

artifactMappings.forEach(mapping => {
  const { id, artifactPath } = mapping;
  
  // 1. 큐에서 대상 정보 조회
  const queueItem = queue.find(item => item.id === id);
  if (!queueItem) {
    console.warn(`경고: ID ${id}는 큐 목록에 존재하지 않아 건너뜁니다.`);
    return;
  }
  
  const targetImage = queueItem.targetImage; // 예: "recipes/recipe-tteokguk.png"
  const absoluteDestPath = path.join(publicDir, 'images', targetImage);
  
  // 디렉토리 존재 확인
  const destDir = path.dirname(absoluteDestPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // 2. 이미지 파일 복사 (아티팩트 -> public/images/recipes/xxx.png)
  if (fs.existsSync(artifactPath)) {
    fs.copyFileSync(artifactPath, absoluteDestPath);
    console.log(`성공: ${id} 이미지 복사 완료 (${artifactPath} -> ${absoluteDestPath})`);
  } else {
    console.error(`오류: 이미지 아티팩트를 찾을 수 없습니다: ${artifactPath}`);
    return;
  }
  
  // 3. recipes.json 데이터 수정
  const recipeIndex = recipes.findIndex(r => r.id === id);
  if (recipeIndex !== -1) {
    recipes[recipeIndex].image = targetImage;
    console.log(`성공: recipes.json 데이터 갱신 (${id} -> ${targetImage})`);
  } else {
    console.warn(`경고: recipes.json에 ID ${id}가 존재하지 않습니다.`);
  }
  
  processedIds.push(id);
});

// 4. 수정한 recipes.json 저장
fs.writeFileSync(recipesJsonPath, JSON.stringify(recipes, null, 2), 'utf-8');
console.log('recipes.json 파일 저장 완료.');

// 5. 큐 파일에서 처리한 ID 제거 후 저장
const updatedQueue = queue.filter(item => !processedIds.includes(item.id));
fs.writeFileSync(queuePath, JSON.stringify(updatedQueue, null, 2), 'utf-8');
console.log(`큐 업데이트 완료. 남은 누락 레시피: ${updatedQueue.length}개`);
