/**
 * 高质量打招呼：逐页扫描，按新标准筛选
 * 标准：27届 + 非海归 + 招聘≥2段 + （谈薪/产研加分）
 */
const http = require('http');

const CDP_PORT = 9222;
const JOB_ID = '2f30beb2c8d2d12d0nNy092-EVJQ'; // 人力资源管培生
const TARGET = 50; // 目标打招呼数量

function getTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const t = JSON.parse(d).find(t => t.url.includes('zhipin.com'));
        t ? resolve(t) : reject(new Error('无BOSS标签页'));
      });
    }).on('error', reject);
  });
}

async function cdpEval(expr) {
  const tab = await getTab();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.close();
        m.result?.result ? resolve(m.result.result.value) : reject(new Error(JSON.stringify(m.result).slice(0,150)));
      }
    };
    ws.send(JSON.stringify({id, method:'Runtime.evaluate', params:{expression:expr, awaitPromise:true, returnByValue:true}}));
  });
}

// 判断是否值得打
function isWorthGreeting(edus, works) {
  // 1. 非海归：学校不能有海外
  const schools = edus.map(e => e.school || '').join('');
  if(/伦敦|新加坡|香港|UCLA|多伦多|海外|留学|英国|美国|澳洲|加拿大/.test(schools)){
    return { pass: false, reason: '海归' };
  }
  
  // 2. 数有几段招聘
  let recruitCount = 0;
  let hasTech = false;
  let hasSalary = false;
  
  for(const w of works){
    const desc = (w.responsibility || w.workDesc || '') + ' ' + (w.positionName || '');
    const isRecruit = desc.includes('招聘') || desc.includes('简历') || desc.includes('面试');
    
    if(isRecruit){
      recruitCount++;
      if(/产研|技术|研发|工程师|开发|产品|算法|基模|大模型/.test(desc)) hasTech = true;
      if(/谈薪|薪酬|offer|薪资谈判/.test(desc)) hasSalary = true;
    }
  }
  
  // 3. 招聘≥2段
  if(recruitCount < 2){
    return { pass: false, reason: `只有${recruitCount}段招聘` };
  }
  
  return { 
    pass: true, 
    reason: `${recruitCount}段招聘`,
    hasTech,
    hasSalary
  };
}

(async () => {
  console.log(`=== 高质量打招呼（目标${TARGET}个）===\n`);
  
  let greeted = 0;
  let page = 1;
  
  while(greeted < TARGET && page <= 20){
    console.log(`--- 第${page}页 ---`);
    
    const js = `(async()=>{
      const r=await fetch('/wapi/zpjob/rec/geek/list?jobId=${JOB_ID}&page=${page}',{credentials:'include'});
      const d=await r.json();
      const list=d.zpData.geekList||[];
      let s='';
      for(const item of list){
        const c=item.geekCard;
        if(!c.geekWorkYear.includes('27')) continue;
        
        // 教育经历
        let edus = [];
        for(const e of (c.geekEdus||[])){
          edus.push(e.school||'');
        }
        
        // 工作经历
        let works = [];
        for(const w of (c.geekWorks||[])){
          works.push({
            company: w.company||'',
            positionName: w.positionName||'',
            desc: (w.responsibility||w.workDesc||'').substring(0,200)
          });
        }
        
        s += c.geekName + '|' + c.encryptGeekId + '|' + c.expectId + '|' + c.lid + '|' + c.securityId + '|' + (c.encryptJobId||'${JOB_ID}') + '\\n';
        s += 'EDU:' + edus.join(';') + '\\n';
        s += 'WORK:' + JSON.stringify(works) + '\\n---\\n';
      }
      return s;
    })()`;
    
    const result = await cdpEval(js);
    if(!result || result.length < 10){
      console.log('  没数据了');
      break;
    }
    
    const blocks = result.trim().split('---').filter(Boolean);
    
    for(const block of blocks){
      if(greeted >= TARGET) break;
      
      const lines = block.trim().split('\n');
      if(lines.length < 3) continue;
      
      const [name, gid, expectId, lid, securityId, jid] = lines[0].split('|');
      const edus = lines[1].replace('EDU:','').split(';').filter(Boolean).map(s => ({school: s}));
      const works = JSON.parse(lines[2].replace('WORK:',''));
      
      const check = isWorthGreeting(edus, works);
      
      if(!check.pass){
        console.log(`  ✗ ${name}: ${check.reason}`);
        continue;
      }
      
      const tags = [];
      if(check.hasTech) tags.push('产研');
      if(check.hasSalary) tags.push('谈薪');
      console.log(`  ✓ ${name}: ${check.reason} ${tags.length ? '['+tags.join('+')+']' : ''}`);
      
      process.stdout.write(`    打招呼...`);
      
      try {
        const gj = `(async()=>{
          const pd=new URLSearchParams({
            gid:'${gid}', jid:'${jid}', expectId:'${expectId}', lid:'${lid}', securityId:'${securityId}'
          });
          const r=await fetch('/wapi/zpjob/chat/start',{
            method:'POST', credentials:'include',
            headers:{'Content-Type':'application/x-www-form-urlencoded'},
            body:pd.toString()
          });
          const d=await r.json();
          return d.code;
        })()`;
        const code = await cdpEval(gj);
        if(Number(code) === 0){
          greeted++;
          console.log(` ✓ 成功（第${greeted}个）`);
        } else {
          console.log(` ✗ code=${code}`);
        }
      } catch(e) {
        console.log(` ✗ ${e.message.slice(0,40)}`);
      }
      
      // 随机间隔2-5秒
      const wait = 2000 + Math.floor(Math.random() * 3000);
      await new Promise(r => setTimeout(r, wait));
    }
    
    page++;
  }
  
  console.log(`\n完成：打了${greeted}个高质量候选人`);
})();
