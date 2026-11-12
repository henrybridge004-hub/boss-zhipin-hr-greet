/**
 * 自动打招呼
 * 用法：
 *   node scripts/greet-auto.js --job 岗位名 --count 5              # 实时拉列表打招呼
 *   node scripts/greet-auto.js --job 岗位名 --snapshot --count 5   # 从快照文件读名单打招呼（推荐）
 *   node scripts/greet-auto.js --job 岗位名 --dry-run              # 只列名单不真发
 */
const fs = require('fs');
const path = require('path');
const { fetchRecommendList, parseCandidate } = require('../core/fetch-list');
const { greetCandidate, randomWait, isRiskCode } = require('../core/greet');

const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
function hasArg(name) {
  return args.includes('--' + name);
}

const jobName = getArg('job', '');
const target = parseInt(getArg('count', '5'));
const useSnapshot = hasArg('snapshot');
const dryRun = hasArg('dry-run');

if (!jobName) {
  console.error('请指定岗位名：node scripts/greet-auto.js --job 你的岗位名 --count 5');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'config', 'jobs', `${jobName}.json`);
if (!fs.existsSync(configPath)) {
  console.error(`找不到岗位配置：${configPath}`);
  process.exit(1);
}

const jobConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function isWorthGreeting(candidate, config) {
  const desc = candidate.desc || '';
  if (config.excludeKeywords) {
    for (const kw of config.excludeKeywords) {
      if (desc.includes(kw)) {
        return { pass: false, reason: `排除关键词：${kw}` };
      }
    }
  }
  return { pass: true, reason: '符合条件' };
}

function logToCsv(entry) {
  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const logPath = path.join(outDir, '打招呼日志.csv');
  const isNew = !fs.existsSync(logPath);
  
  const line = [
    entry.time,
    entry.jobName,
    entry.name,
    entry.encryptGeekId,
    entry.success,
    entry.code,
    entry.message
  ].map(s => `"${String(s || '').replace(/"/g, '""')}"`).join(',');
  
  const header = '时间,岗位,姓名,候选人ID,成功,错误码,备注\n';
  fs.appendFileSync(logPath, (isNew ? header : '') + line + '\n', 'utf8');
}

function loadSnapshot(jobName) {
  const snapshotPath = path.join(__dirname, '..', 'output', `快照_${jobName}_latest.json`);
  if (!fs.existsSync(snapshotPath)) {
    console.error(`找不到快照文件：${snapshotPath}`);
    console.error('请先运行 fetch-list.js 拉取列表');
    process.exit(1);
  }
  
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const ageMs = Date.now() - new Date(snapshot.createdAt).getTime();
  
  console.log(`快照创建时间：${snapshot.createdAt}`);
  console.log(`快照包含：${snapshot.count} 人`);
  
  if (ageMs > 30 * 60 * 1000) {
    console.log(`⚠️  快照已超过30分钟，可能已过期`);
    console.log(`建议重新拉取列表（推荐列表是动态的）\n`);
  } else {
    console.log(`\n`);
  }
  
  return snapshot.candidates;
}

(async () => {
  console.log(`=== 打招呼：${jobConfig.name} ===`);
  console.log(`目标：${target} 人`);
  console.log(`模式：${dryRun ? 'DRY-RUN（只列不打）' : '真实打招呼'}`);
  console.log(`名单来源：${useSnapshot ? '快照文件' : '实时拉取列表'}\n`);
  
  let candidates = [];
  
  if (useSnapshot) {
    candidates = loadSnapshot(jobName);
  } else {
    console.log('从推荐列表拉取候选人...\n');
    const list = await fetchRecommendList(jobConfig.jobId, 1);
    candidates = list.map(geek => parseCandidate(geek));
  }
  
  const qualified = [];
  for (const c of candidates) {
    const check = isWorthGreeting(c, jobConfig);
    if (check.pass) {
      qualified.push({ candidate: c, reason: check.reason });
    }
  }
  
  console.log(`筛选结果：${qualified.length} 人符合条件\n`);
  
  if (qualified.length === 0) {
    console.log('没有符合条件的候选人');
    process.exit(0);
  }
  
  const toGreet = qualified.slice(0, target);
  
  console.log(`--- 准备打招呼的 ${toGreet.length} 人 ---`);
  for (let i = 0; i < toGreet.length; i++) {
    const { candidate, reason } = toGreet[i];
    console.log(`${i + 1}. ${candidate.name} | ${candidate.age} | ${candidate.workYear} | ${candidate.expectPosition}`);
    console.log(`   理由：${reason}`);
    console.log(`   ID：${candidate.encryptGeekId?.slice(0, 8)}...`);
  }
  console.log('');
  
  if (dryRun) {
    console.log('=== DRY-RUN 模式：没有真的打招呼 ===');
    console.log('去掉 --dry-run 参数即可真实执行');
    process.exit(0);
  }
  
  let greeted = 0;
  let stoppedByRisk = false;
  
  for (let i = 0; i < toGreet.length; i++) {
    const { candidate, reason } = toGreet[i];
    
    console.log(`[${i + 1}/${toGreet.length}] 给 ${candidate.name} 打招呼...`);
    
    const result = await greetCandidate(candidate);
    
    const logEntry = {
      time: new Date().toISOString(),
      jobName: jobConfig.name,
      name: candidate.name,
      encryptGeekId: candidate.encryptGeekId,
      success: result.success,
      code: result.code,
      message: result.message
    };
    logToCsv(logEntry);
    
    if (result.success) {
      greeted++;
      console.log(`  ✓ 成功（累计${greeted}个）`);
    } else if (result.isRisk) {
      console.log(`  ✗ 风控错误：${result.message}（code: ${result.code}）`);
      console.log(`  ⚠️  检测到风控信号，停止后续打招呼`);
      console.log(`  请到浏览器里检查账号状态，确认没问题再继续`);
      stoppedByRisk = true;
      break;
    } else {
      console.log(`  ✗ 失败：${result.message}（code: ${result.code}）`);
    }
    
    if (i < toGreet.length - 1 && !stoppedByRisk) {
      const waitSec = await randomWait(10000, 15000);
      console.log(`  等待 ${Math.round(waitSec / 1000)} 秒...`);
    }
  }
  
  console.log(`\n=== 完成 ===`);
  console.log(`成功打招呼：${greeted} 个`);
  if (stoppedByRisk) {
    console.log(`⚠️  因风控信号提前停止`);
  }
  
  jobConfig.progress = jobConfig.progress || {};
  jobConfig.progress.greeted = (jobConfig.progress.greeted || 0) + greeted;
  fs.writeFileSync(configPath, JSON.stringify(jobConfig, null, 2), 'utf8');
  console.log(`已更新岗位配置中的打招呼进度`);
})();