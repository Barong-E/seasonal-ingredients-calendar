const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/barong/MyProjects/Seasonal Ingredients Calendar';
const brainDir = '/Users/barong/.gemini/antigravity-ide/brain/3c483077-b0a7-4b75-b7e6-e55f1c1395c2';
const queuePath = path.join(brainDir, 'scratch/missing_recipes_queue.json');
const scriptJsPath = path.join(projectRoot, 'assets/script.js');
const swJsPath = path.join(projectRoot, 'public/service-worker.js');

// 1. 버전 갱신 기능 (--bump-version)
if (process.argv.includes('--bump-version')) {
  bumpVersions();
  process.exit(0);
}

// 2. 상태 분석 기능
analyzeBatch();

function analyzeBatch() {
  if (!fs.existsSync(queuePath)) {
    console.error('오류: 큐 파일이 존재하지 않습니다:', queuePath);
    process.exit(1);
  }

  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
  if (queue.length === 0) {
    console.log(JSON.stringify({
      batch: [],
      allReady: true,
      missing: [],
      queueEmpty: true
    }, null, 2));
    return;
  }

  // 상위 10개만 추출
  const currentBatch = queue.slice(0, 10);
  
  // 아티팩트 디렉토리 내의 파일 목록 가져오기
  const brainFiles = fs.readdirSync(brainDir);
  
  const batchStatus = currentBatch.map(item => {
    // recipe_[id]_*.png 패턴에 맞는 파일 찾기
    // id가 대시(-)를 포함하는 경우 아티팩트 파일명은 언더스코어(_)로 변환되었을 수 있음 (예: gukwha-jeon -> recipe_gukwha_jeon_*.png)
    const normalizedId = item.id.replace(/-/g, '_');
    const pattern = new RegExp(`^recipe_${normalizedId}_\\d+\\.png$`);
    const matchedFile = brainFiles.find(file => pattern.test(file));
    
    return {
      id: item.id,
      name: item.name,
      prompt: item.prompt,
      artifactPath: matchedFile ? path.join(brainDir, matchedFile) : null,
      exists: !!matchedFile
    };
  });

  const missing = batchStatus.filter(item => !item.exists);
  const allReady = missing.length === 0;

  console.log(JSON.stringify({
    batch: batchStatus,
    allReady: allReady,
    missing: missing,
    queueEmpty: false
  }, null, 2));
}

function bumpVersions() {
  console.log('버전 갱신 작업을 시작합니다...');

  // 1. script.js 버전 갱신
  if (fs.existsSync(scriptJsPath)) {
    let content = fs.readFileSync(scriptJsPath, 'utf-8');
    // seasons:ingredients:v[숫자] 패턴 매칭
    const scriptRegex = /const CACHE_KEY = 'seasons:ingredients:v(\d+)';/;
    const match = content.match(scriptRegex);
    if (match) {
      const currentVersion = parseInt(match[1], 10);
      const nextVersion = currentVersion + 1;
      content = content.replace(scriptRegex, `const CACHE_KEY = 'seasons:ingredients:v${nextVersion}';`);
      fs.writeFileSync(scriptJsPath, content, 'utf-8');
      console.log(`성공: assets/script.js 버전을 v${currentVersion}에서 v${nextVersion}으로 올렸습니다.`);
    } else {
      console.warn('경고: assets/script.js에서 CACHE_KEY 버전을 찾을 수 없습니다.');
    }
  } else {
    console.error('오류: assets/script.js 파일이 없습니다.');
  }

  // 2. service-worker.js 버전 갱신
  if (fs.existsSync(swJsPath)) {
    let content = fs.readFileSync(swJsPath, 'utf-8');
    // const VERSION = 'v[숫자]'; 패턴 매칭
    const swRegex = /const VERSION = 'v(\d+)';/;
    const match = content.match(swRegex);
    if (match) {
      const currentVersion = parseInt(match[1], 10);
      const nextVersion = currentVersion + 1;
      content = content.replace(swRegex, `const VERSION = 'v${nextVersion}';`);
      fs.writeFileSync(swJsPath, content, 'utf-8');
      console.log(`성공: public/service-worker.js 버전을 v${currentVersion}에서 v${nextVersion}으로 올렸습니다.`);
    } else {
      console.warn('경고: public/service-worker.js에서 VERSION을 찾을 수 없습니다.');
    }
  } else {
    console.error('오류: public/service-worker.js 파일이 없습니다.');
  }
}
