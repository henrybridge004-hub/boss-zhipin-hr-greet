#!/usr/bin/env node
/**
 * BOSS直聘 HR招聘端 - 推荐牛人搜索工具
 * 通过 CDP 连接已登录的 Edge 浏览器，调用招聘端 API 拉取候选人列表
 * 
 * 用法:
 *   node search.js                    # 默认拉3页企业文化管培生（公办本科+27届校招）
 *   node search.js --pages 5          # 拉5页
 *   node search.js --job 人力资源管培生  # 指定职位（支持模糊匹配）
 *   node search.js --job 全部          # 批量拉所有职位
 *   node search.js --no-filter        # 不加任何筛选条件
 * 
 * 在招职位: 编辑/企业文化管培生/高招专家(产研)/招聘专家(猎头)/高招专家(综合)/人力资源管培生
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const CDP_PORT = 9222;
const DEFAULT_JOB_ID = 'b2050118d8107b3a0nx73N69GVBR'; // 人力资源管培生
const OUTPUT_DIR = path.join(__dirname, 'output');

// ========== 参数解析 ==========
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const pages = parseInt(getArg('pages', '3'));
const noFilter = args.includes('--no-filter');
const jobArg = getArg('job', '企业文化管培生');

// 默认筛选：公办本科(school=5) + 27届毕业(experience=3) + 只看第一学历(coverScreenMemory=1)
const school = getArg('school', noFilter ? '0' : '5');
const degree = getArg('degree', noFilter ? '0' : '0');
const experience = getArg('experience', noFilter ? '0' : '3');
const salary = getArg('salary', '0');
const coverScreenMemory = getArg('cover-screen', noFilter ? '0' : '1'); // 1=只看第一学历全日制本科

// 已知职位列表（从接口拉取）
const KNOWN_JOBS = {
  '编辑': '21c020c6b7e3d03d0nx82ty6GFNY',
  '企业文化管培生': 'b2050118d8107b3a0nx73N69GVBR',
  '高招专家（产研方向）': '70eb9c8e7b013ed00nx62du_FVVW',
  '招聘专家（猎头经验）': '664d7fd7421cc1bf0nNz0tW7F1ZY',
  '高招专家（综合类岗位）': 'ff31aa7e8b3a56340nNz0tW4FVdR',
  '人力资源管培生': '2f30beb2c8d2d12d0nNy092-EVJQ',
};

// 根据职位名匹配 jobId
function resolveJobId(name) {
  if (name === '全部') return 'ALL';
  // 精确匹配
  if (KNOWN_JOBS[name]) return KNOWN_JOBS[name];
  // 模糊匹配
  for (const [jobName, jid] of Object.entries(KNOWN_JOBS)) {
    if (jobName.includes(name) || name.includes(jobName)) return jid;
  }
  return DEFAULT_JOB_ID;
}

const jobId = resolveJobId(jobArg);

// ========== CDP 工具 ==========
function getTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const tabs = JSON.parse(data);
        const bossTab = tabs.find(t => t.url.includes('zhipin.com'));
        if (!bossTab) return reject(new Error('没找到 BOSS直聘标签页，请确保 Edge 调试模式已打开'));
        resolve(bossTab);
      });
    }).on('error', reject);
  });
}

function cdpEval(ws, expression) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', onMsg);
        if (msg.result && msg.result.result) resolve(msg.result.result.value);
        else reject(new Error(JSON.stringify(msg.result || msg)));
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
}

// ========== 业务逻辑 ==========
async function fetchPage(page, jid) {
  const tab = await getTab();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  const url = `/wapi/zpjob/rec/geek/list?age=16,-1&gender=0&activation=0&school=${school}&exchangeResumeWithColleague=0&recentNotView=0&major=0&switchJobFrequency=0&degree=${degree}&experience=${experience}&salary=${salary}&jobId=${jid}&page=${page}&coverScreenMemory=${coverScreenMemory}&cardType=0`;
  
  const js = `
    fetch('${url}', { credentials: 'include' })
      .then(r => r.json())
      .then(d => JSON.stringify(d))
  `;
  
  const result = await cdpEval(ws, js);
  ws.close();
  return JSON.parse(result);
}

function parseCandidate(geek) {
  const card = geek.geekCard || {};
  const eduList = card.geekEdus || geek.geekEdus || [];
  const workList = card.geekWorks || geek.geekWorks || [];
  const edu = eduList.map(e => `${e.school}·${e.major}·${e.degreeName}(${e.startDate}-${e.endDate})`).join('; ');
  const work = workList.map(w => `${w.company}·${w.positionName}(${w.startDate}-${w.endDate})`).join('; ');
  
  return {
    姓名: card.geekName || '',
    性别: card.geekGender === 0 ? '女' : '男',
    年龄: card.ageDesc || '',
    学历: card.geekDegree || '',
    毕业院校专业: edu,
    工作经历: work,
    最近职位: card.middleContent?.content || '',
    期望职位: card.expectPositionName || '',
    期望城市: card.expectLocationName || '',
    期望薪资: card.salary || '',
    工作年限: card.geekWorkYear || '',
    个人简介: card.geekDesc?.content?.substring(0, 200) || '',
    securityId: card.securityId || '',
    expectId: card.expectId || '',
  };
}

function toCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = s => `"${String(s || '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return '\ufeff' + lines.join('\n'); // BOM for Excel
}

// ========== 主流程 ==========
async function fetchJob(jobName, jid) {
  console.log(`\n--- 职位: ${jobName} ---`);
  const allCandidates = [];
  for (let i = 1; i <= pages; i++) {
    process.stdout.write(`  第 ${i}/${pages} 页...`);
    try {
      const data = await fetchPage(i, jid);
      const list = data?.zpData?.geekList || [];
      if (list.length === 0) {
        console.log(' 空列表，跳过');
        break;
      }
      const parsed = list.map(c => ({...parseCandidate(c), 招聘职位: jobName}));
      allCandidates.push(...parsed);
      console.log(` ${list.length} 人`);
      if (i < pages) await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(` 失败: ${e.message}`);
      break;
    }
  }
  return allCandidates;
}

(async () => {
  console.log(`=== BOSS直聘 HR 候选人搜索 ===`);
  console.log(`筛选: 公办本科 + 27届校招 + 只看第一学历`);
  console.log(`页数: 每页${pages}页`);

  let allCandidates = [];
  
  if (jobId === 'ALL') {
    // 批量拉所有职位
    for (const [name, jid] of Object.entries(KNOWN_JOBS)) {
      const list = await fetchJob(name, jid);
      allCandidates.push(...list);
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    // 拉单个职位
    const jobName = Object.keys(KNOWN_JOBS).find(k => KNOWN_JOBS[k] === jobId) || jobArg;
    const list = await fetchJob(jobName, jobId);
    allCandidates.push(...list);
  }

  if (allCandidates.length === 0) {
    console.log('\n没拿到任何候选人');
    process.exit(1);
  }

  // 去重
  const seen = new Set();
  const unique = allCandidates.filter(c => {
    const key = c.姓名 + c.毕业院校专业;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 导出
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const jobLabel = jobId === 'ALL' ? '全部职位' : jobArg;
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const csvPath = path.join(OUTPUT_DIR, `候选人_${jobLabel}_${ts}.csv`);
  fs.writeFileSync(csvPath, toCSV(unique), 'utf8');

  console.log('\n=== 完成 ===');
  console.log(`共 ${unique.length} 位候选人（去重后）`);
  console.log(`已保存: ${csvPath}`);
})();
