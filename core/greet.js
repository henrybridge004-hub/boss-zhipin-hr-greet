/**
 * 自动打招呼
 */
const { evalOnPage } = require('./cdp');

// 风控类错误码（遇到这些立刻停止，避免火上浇油）
const RISK_CODES = new Set([
  1001,   // 账号异常/被限制
  1002,   // 需要验证
  4001,   // 权限不足
  4003,   // 禁止操作
  403,    // 禁止
]);

function isRiskCode(code) {
  return RISK_CODES.has(Number(code));
}

async function greetCandidate(candidate) {
  if (!candidate.encryptGeekId || !candidate.expectId) {
    return {
      success: false,
      code: -2,
      message: '候选人缺少打招呼必需的字段',
      isRisk: false
    };
  }

  const js = `(async()=>{
    const pd=new URLSearchParams({
      gid:'${candidate.encryptGeekId}',
      jid:'${candidate.encryptJobId || ''}',
      expectId:'${candidate.expectId}',
      lid:'${candidate.lid || ''}',
      securityId:'${candidate.securityId || ''}'
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
    const code = Number(data.code);
    return {
      success: code === 0,
      code: code,
      message: data.message || (code === 0 ? '成功' : '失败'),
      isRisk: isRiskCode(code)
    };
  } catch (e) {
    return {
      success: false,
      code: -1,
      message: e.message.slice(0, 100),
      isRisk: false
    };
  }
}

async function randomWait(minMs = 10000, maxMs = 15000) {
  const wait = minMs + Math.floor(Math.random() * (maxMs - minMs));
  await new Promise(r => setTimeout(r, wait));
  return wait;
}

module.exports = {
  greetCandidate,
  randomWait,
  isRiskCode,
  RISK_CODES
};