/**
 * 拉取推荐牛人列表
 */
const { evalOnPage } = require('./cdp');

/**
 * 拉取某岗位的推荐牛人列表
 * @param {string} jobId 职位ID
 * @param {number} page 页码（从1开始）
 * @param {object} extraParams 额外筛选参数（可选）
 * @returns {Promise<Array>} 候选人列表
 */
async function fetchRecommendList(jobId, page = 1, extraParams = {}) {
  // 拼接查询参数
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
    throw new Error(`拉取失败：${data.message || '未知错误'}`);
  }
  
  return data.zpData?.geekList || [];
}

/**
 * 解析单个候选人的简历信息
 */
function parseCandidate(geek) {
  const card = geek.geekCard || {};
  
  // 教育经历
  const eduList = card.geekEdus || [];
  const edus = eduList.map(e => ({
    school: e.school || '',
    major: e.major || '',
    degree: e.degreeName || '',
    startDate: e.startDate || '',
    endDate: e.endDate || ''
  }));
  
  // 工作经历
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
    // 打招呼需要的ID
    encryptGeekId: card.encryptGeekId || '',
    encryptJobId: card.encryptJobId || '',
    expectId: card.expectId || '',
    lid: card.lid || '',
    securityId: card.securityId || ''
  };
}

module.exports = {
  fetchRecommendList,
  parseCandidate
};
