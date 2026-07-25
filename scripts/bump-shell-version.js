#!/usr/bin/env node
/*
 * 피더 SPA 셸(tools/shell/) 캐시버스팅 버전(`?v=N`) 관리 스크립트.
 *
 * 사용법:
 *   node scripts/bump-shell-version.js          변경된 셸 파일이 있을 때: 버전을 자동으로 +1 올리고 검사
 *   node scripts/bump-shell-version.js --check  버전을 올리지 않고 현재 상태만 검사(빠뜨린 참조 있는지)
 *
 * 왜 필요한가: 이 사이트는 빌드 없이 정적 파일을 그대로 배포하고, Cloudflare가 정적 파일을
 * 4시간 캐시한다(HTML만 max-age=0). 그래서 tools/shell/ 안의 공유 JS/CSS를 고칠 때마다
 * 그 파일을 참조하는 모든 곳(진입 HTML의 <script>/<link> 태그, JS의 정적/동적 import)의
 * `?v=N` 쿼리를 한꺼번에 올려야 캐시가 확실히 갱신된다. 손으로 sed를 돌리다 보면
 * (1) 일부 참조만 올리고 빠뜨리거나 (2026-07-22 "알 수 없는 화면" 백지 장애),
 * (2) 애초에 새로 만든 참조에 버전 쿼리 자체를 안 붙이는(2026-07-25 gongsu-calendar.css
 * 캐시 버그) 실수가 반복됐다. 이 스크립트는 그 두 가지를 기계적으로 방지한다.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(REPO_ROOT, 'tools');
const SHELL_DIR = path.join(TOOLS_DIR, 'shell');
const VENDOR_DIR = path.join(SHELL_DIR, 'vendor');

const SCAN_EXTS = new Set(['.html', '.js']);
const VERSIONABLE_EXTS = new Set(['.js', '.css']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (full === path.join(REPO_ROOT, '.git')) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function isUnderVendor(absPath) {
  return absPath.startsWith(VENDOR_DIR + path.sep);
}

function isShellAsset(absPath) {
  const ext = path.extname(absPath);
  return absPath.startsWith(SHELL_DIR + path.sep) && VERSIONABLE_EXTS.has(ext) && !isUnderVendor(absPath);
}

// 파일 안에서 '...js'/'...css' 형태의 따옴표 문자열 참조를 전부 찾는다 (?v=N 있든 없든)
const REF_RE = /(['"])((?:\.{1,2}\/|\/)?[A-Za-z0-9_\-./]+\.(?:js|css))(\?v=(\d+))?\1/g;

function findAllRefs(files) {
  const refs = []; // { file, matchStart, matchEnd, rawPath, version(str|null), resolvedAbs }
  for (const file of files) {
    const ext = path.extname(file);
    if (!SCAN_EXTS.has(ext)) continue;
    const text = fs.readFileSync(file, 'utf8');
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text))) {
      const rawPath = m[2];
      const version = m[4] || null;
      const baseDir = path.dirname(file);
      const resolvedAbs = rawPath.startsWith('/')
        ? path.join(REPO_ROOT, rawPath)
        : path.resolve(baseDir, rawPath);
      refs.push({ file, rawPath, version, resolvedAbs, index: m.index, match: m[0] });
    }
  }
  return refs;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const allFiles = walk(REPO_ROOT);
  const refs = findAllRefs(allFiles);

  // 셸 자산(vendor 제외)을 가리키는 참조만 추린다
  const shellRefs = refs.filter(r => isShellAsset(r.resolvedAbs));

  const versions = shellRefs.map(r => r.version).filter(Boolean).map(Number);
  const currentMax = versions.length ? Math.max(...versions) : 0;

  const missing = shellRefs.filter(r => !r.version);
  if (missing.length) {
    console.error(`\n[FAIL] 버전 쿼리(?v=N)가 없는 셸 참조 ${missing.length}건 발견:`);
    for (const r of missing) {
      console.error(`  - ${path.relative(REPO_ROOT, r.file)} → "${r.rawPath}"`);
    }
    console.error('\n새로 추가한 참조라면 반드시 ?v=N을 붙이세요 (N은 현재 최신 버전).');
    console.error(`현재 감지된 최신 버전: ?v=${currentMax}\n`);
    process.exit(1);
  }

  console.log(`[OK] 셸 참조 ${shellRefs.length}건 전부 ?v= 버전 쿼리 보유. 현재 버전: ?v=${currentMax}`);

  if (checkOnly) {
    process.exit(0);
  }

  if (!currentMax) {
    console.error('[FAIL] 셸 참조를 하나도 찾지 못했습니다. REPO 구조가 바뀌었는지 확인하세요.');
    process.exit(1);
  }

  const nextVersion = currentMax + 1;
  const targetFiles = new Set(shellRefs.filter(r => Number(r.version) === currentMax).map(r => r.file));

  let changedCount = 0;
  for (const file of targetFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const replaced = text.split(`?v=${currentMax}`).join(`?v=${nextVersion}`);
    if (replaced !== text) {
      fs.writeFileSync(file, replaced, 'utf8');
      changedCount++;
    }
  }
  console.log(`[DONE] ?v=${currentMax} → ?v=${nextVersion} 로 ${changedCount}개 파일 갱신.`);

  // 갱신 후 재검사 — 놓친 곳이 없는지 스스로 확인
  const filesAfter = walk(REPO_ROOT);
  const refsAfter = findAllRefs(filesAfter).filter(r => isShellAsset(r.resolvedAbs));
  const staleOld = refsAfter.filter(r => Number(r.version) === currentMax);
  const missingAfter = refsAfter.filter(r => !r.version);
  if (staleOld.length || missingAfter.length) {
    console.error(`\n[FAIL] 갱신 후에도 구버전(${staleOld.length}건)/버전없음(${missingAfter.length}건) 잔재 발견 — 수동 확인 필요:`);
    for (const r of staleOld) console.error(`  구버전 잔재: ${path.relative(REPO_ROOT, r.file)} → "${r.rawPath}?v=${r.version}"`);
    for (const r of missingAfter) console.error(`  버전없음: ${path.relative(REPO_ROOT, r.file)} → "${r.rawPath}"`);
    process.exit(1);
  }
  console.log(`[OK] 재검사 통과 — 모든 셸 참조가 ?v=${nextVersion}로 일관됨.`);
}

main();
