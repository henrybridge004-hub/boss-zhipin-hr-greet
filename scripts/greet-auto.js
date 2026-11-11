/**
 * 自动打招呼
 * 用法：node scripts/greet-auto.js --job 岗位名 --count 5
 */
const fs = require('fs');
const path = require('path');
const { fetchRecommendList, parseCandidate } = require('../core/fetch-list');
const { greetCandidate, randomWait } = require('../core/greet');

// 解析参数
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}

const jobName = getArg('job', '');
const target = parseInt(getArg('count', '5')); // 默认每次5个（安全模式）

if (!jobName) {
  console.error('请指定岗位名：node scripts/greet-auto.js --job 你的岗位名 --count 5');
  process.exit(1);
}

// 读取岗位配置
const configPath = path.join(__dirname, '..', 'config', 'jobs', `${jobName}.json`);
if (!fs.existsSync(configPath)) {
  console.error(`找不到岗位配置：${configPath}`);
  process.exit(1);
}

const jobConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * 判断候选人是否符合条件（简单版本，用户可以自己改）
 */
function isWorthGreeting(candidate, config) {
  // 排除否定关键词
  const desc = candidate.desc;
  if (config.excludeKeywords) {
    for (const kw of config.excludeKeywords) {
      if (desc.includes(kw)) {
        return { pass: false, reason: `排除关键词：${kw}` };
      }
    }
  }
  
  // 这里可以加你自己的筛选逻辑
  // 比如：必须有某段经验、必须是某个专业、必须是某个学校等
  
  return { pass: true, reason: '符合条件' };
}

(async () => {
  console.log(`=== 自动打招呼：${jobConfig.name} ===`);
  console.log(`目标：${target} 人\n`);
  
  let greeted = 0;
  let page = 1;
  
  while (greeted < target && page <= 20) {
    console.log(`--- 第 ${page} 页 ---`);
    
    try {
      const list = await fetchRecommendList(jobConfig.jobId, page);
      
      if (list.length === 0) {
        console.log('  没数据了');
        break;
      }
      
      for (const geek of list) {
        if (greeted >= target) break;
        
        const candidate = parseCandidate(geek);
        const check = isWorthGreeting(candidate, jobConfig);
        
        if (!check.pass) {
          console.log(`  ✗ ${candidate.name}：${check.reason}`);
          continue;
        }
        
        console.log(`  ✓ ${candidate.name}：${check.reason}`);
        process.stdout.write('    打招呼...');
        
        const result = await greetCandidate(candidate);
        
        if (result.success) {
          greeted++;
          console.log(` ✓ 成功（第${greeted}个）`);
        } else {
          console.log(` ✗ ${result.message}`);
        }
        
        // 随机间隔10-15秒（安全模式，模拟真人思考时间）
        await randomWait(10000, 15000);
      }
      
      page++;
      
      // 翻页间隔3-5秒
      if (greeted < target && page <= 20) {
        await randomWait(3000, 5000);
      }
      
    } catch (e) {
      console.log(`  失败：${e.message}`);
      break;
    }
  }
  
  console.log(`\n=== 完成 ===`);
  console.log(`成功打招呼：${greeted} 个`);
  
  // 更新进度
  jobConfig.progress = jobConfig.progress || {};
  jobConfig.progress.greeted = (jobConfig.progress.greeted || 0) + greeted;
  fs.writeFileSync(configPath, JSON.stringify(jobConfig, null, 2), 'utf8');
  console.log(`已更新岗位配置中的打招呼进度`);
})();
