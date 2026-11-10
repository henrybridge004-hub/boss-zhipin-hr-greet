/**
 * 拉取候选人列表（市场调研）
 * 用法：node scripts/fetch-list.js --job 岗位名 --pages 10
 */
const fs = require('fs');
const path = require('path');
const { fetchRecommendList, parseCandidate } = require('../core/fetch-list');
const { randomWait } = require('../core/greet');

// 解析参数
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const jobName = getArg('job', '');
const pages = parseInt(getArg('pages', '5'));

if (!jobName) {
  console.error('请指定岗位名：node scripts/fetch-list.js --job 你的岗位名');
  process.exit(1);
}

// 读取岗位配置
const configPath = path.join(__dirname, '..', 'config', 'jobs', `${jobName}.json`);
if (!fs.existsSync(configPath)) {
  console.error(`找不到岗位配置：${configPath}`);
  console.error('请先在 config/jobs/ 下创建你的岗位配置文件');
  process.exit(1);
}

const jobConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

(async () => {
  console.log(`=== 拉取候选人列表：${jobConfig.name} ===`);
  console.log(`拉取页数：${pages}\n`);
  
  const allCandidates = [];
  
  for (let i = 1; i <= pages; i++) {
    process.stdout.write(`第 ${i}/${pages} 页...`);
    
    try {
      const list = await fetchRecommendList(jobConfig.jobId, i);
      
      if (list.length === 0) {
        console.log(' 空列表，停止');
        break;
      }
      
      const parsed = list.map(geek => parseCandidate(geek));
      allCandidates.push(...parsed);
      
      console.log(` ${list.length} 人`);
      
      // 间隔3-5秒
      if (i < pages) {
        await randomWait(3000, 5000);
      }
      
    } catch (e) {
      console.log(` 失败：${e.message}`);
      break;
    }
  }
  
  // 去重
  const seen = new Set();
  const unique = allCandidates.filter(c => {
    const key = c.name + c.edus[0]?.school;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // 保存
  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outPath = path.join(outDir, `候选人_${jobName}_${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf8');
  
  console.log(`\n=== 完成 ===`);
  console.log(`共 ${unique.length} 位候选人（去重后）`);
  console.log(`已保存：${outPath}`);
})();
