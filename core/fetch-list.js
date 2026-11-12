/**
 * 拉取推荐牛人列表
 */
const { evalOnPage } = require('./cdp');

async function fetchRecommendList(jobId, page = 1, extraParams = {}) {
  const params = new URLSearchParams({
    jobId,
    page,
    ...extraParams
  });
  
  const js = `(async()=>{
    const r=await fetch('/wapi/zpjob/rec/geek/list?${params.toString()}',{credentials:'include'});
    const d=await r.json();
    return JSON.stringify(d);
  })()`;
  
  const result = await evalOnPage(js);
  const data = JSON.parse(result);
  
  if (data.code !== 0) {
    throw new Error(`拉取失败：${data.message || '未知错误'}（code: ${data.code}）`);
  }
  
  return data.zpData?.geekList || [];
}

function parseCandidate(geek) {
  const card = geek.geekCard || {};
  
  const eduList = card.geekEdus || [];
  const edus = eduList.map(e => ({
    school: e.school || '',
    major: e.major || '',
    degree: e.degreeName || '',
    startDate: e.startDate || '',
    endDate: e.endDate || ''
  }));
  
  const workList = card.geekWorks || [];
  const works = workList.map(w => ({
    company: w.company || '',
    position: w.positionName || '',
    desc: w.responsibility || w.workDesc || '',
    startDate: w.startDate || '',
    endDate: w.endDate || ''
  }));
  
  return {
    name: card.geekName || '',
    gender: card.geekGender === 0 ? '女' : '男',
    age: card.ageDesc || '',
    degree: card.geekDegree || '',
    expectPosition: card.expectPositionName || '',
    expectCity: card.expectLocationName || '',
    expectSalary: card.salary || '',
    workYear: card.geekWorkYear || '',
    desc: card.geekDesc?.content || '',
    edus,
    works,
    encryptGeekId: card.encryptGeekId || '',
    encryptJobId: card.encryptJobId || '',
    expectId: card.expectId || '',
    lid: card.lid || '',
    securityId: card.securityId || ''
  };
}

function toGreetSnapshot(candidates) {
  return candidates.map(c => ({
    name: c.name,
    age: c.age,
    workYear: c.workYear,
    expectPosition: c.expectPosition,
    encryptGeekId: c.encryptGeekId,
    encryptJobId: c.encryptJobId,
    expectId: c.expectId,
    lid: c.lid,
    securityId: c.securityId,
    desc: (c.desc || '').slice(0, 200),
    edus: c.edus,
    works: c.works
  }));
}

module.exports = {
  fetchRecommendList,
  parseCandidate,
  toGreetSnapshot
};