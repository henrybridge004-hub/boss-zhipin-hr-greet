/**
 * CDP连接工具
 * 通过Chrome DevTools Protocol直连已登录的浏览器
 */
const http = require('http');

const CDP_PORT = 9222;

/**
 * 获取BOSS直聘标签页
 */
function getBossTab() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${CDP_PORT}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const tabs = JSON.parse(d);
          const bossTab = tabs.find(t => t.url.includes('zhipin.com'));
          if (!bossTab) {
            return reject(new Error('没找到BOSS直聘标签页，请确保浏览器已打开并登录BOSS直聘'));
          }
          resolve(bossTab);
        } catch (e) {
          reject(new Error('获取标签页列表失败：' + e.message));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 在页面上下文执行JS
 */
async function evalOnPage(expression) {
  const tab = await getBossTab();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.close();
        if (msg.result && msg.result.result) {
          resolve(msg.result.result.value);
        } else {
          reject(new Error(JSON.stringify(msg.result || msg).slice(0, 200)));
        }
      }
    };
    
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression,
        awaitPromise: true,
        returnByValue: true
      }
    }));
  });
}

module.exports = {
  getBossTab,
  evalOnPage,
  CDP_PORT
};
