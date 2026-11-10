/**
 * 自动打招呼
 */
const { evalOnPage } = require('./cdp');

/**
 * 给单个候选人打招呼
 * @param {object} candidate 候选人对象（需要包含encryptGeekId等字段）
 * @returns {Promise<{success: boolean, code: number, message: string}>}
 */
async function greetCandidate(candidate) {
  const js = `(async()=>{
    const pd=new URLSearchParams({
      gid:'${candidate.encryptGeekId}',
      jid:'${candidate.encryptJobId}',
      expectId:'${candidate.expectId}',
      lid:'${candidate.lid}',
      securityId:'${candidate.securityId}'
    });
    const r=await fetch('/wapi/zpjob/chat/start',{
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:pd.toString()
    });
    const d=await r.json();
    return JSON.stringify(d);
  })()`;
  
  try {
    const result = await evalOnPage(js);
    const data = JSON.parse(result);
    
    return {
      success: Number(data.code) === 0,
      code: data.code,
      message: data.message || (Number(data.code) === 0 ? '成功' : '失败')
    };
  } catch (e) {
    return {
      success: false,
      code: -1,
      message: e.message.slice(0, 100)
    };
  }
}

/**
 * 随机等待
 * @param {number} minMs 最小间隔（毫秒）
 * @param {number} maxMs 最大间隔（毫秒）
 */
async function randomWait(minMs = 2000, maxMs = 5000) {
  const wait = minMs + Math.floor(Math.random() * (maxMs - minMs));
  await new Promise(r => setTimeout(r, wait));
  return wait;
}

module.exports = {
  greetCandidate,
  randomWait
};
