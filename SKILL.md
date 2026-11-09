---
name: boss-zhipin-hr-greet
description: BOSS直聘HR端自动搜索候选人并批量打招呼工具。通过CDP调试浏览器接口，实现推荐牛人列表拉取、简历深度筛选（工作经历/教育背景/招聘段数/产研/谈薪）、自动打招呼。适用于HR批量校招、社招触达场景。
---

# BOSS直聘HR自动打招呼工具

通过CDP（Chrome DevTools Protocol）直连已登录的Edge浏览器，调用BOSS直聘HR端API，实现候选人筛选与自动打招呼。

## 前置条件

1. Edge浏览器已开启远程调试端口：`--remote-debugging-port=9222`
2. BOSS直聘HR端已登录，且在推荐牛人页面
3. Node.js v18+（内置WebSocket，无需安装ws模块）

## 快速开始

### 1. 启动调试浏览器

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\19895\AppData\Local\Temp\edge-debug-boss"
```

### 2. 拉取候选人列表

```powershell
node scripts/search.js --job <jobId> --pages 5
```

### 3. 自动打招呼（按筛选标准）

```powershell
node scripts/greet-high-quality.js
```

## 核心脚本

| 脚本 | 功能 |
|------|------|
| `search.js` | 拉取推荐牛人列表，导出CSV |
| `greet-high-quality.js` | 高质量打招呼：按筛选标准逐页扫描，符合条件自动打招呼 |

## 筛选标准（可配置）

在 `greet-high-quality.js` 顶部修改：

```javascript
const CONFIG = {
  // 硬性条件
  must27Grad: true,        // 必须27届
  excludeOverseas: true,   // 排除留学生
  minRecruitExperiences: 2, // 至少2段招聘经历
  
  // 加分项（不强制，有更好）
  preferTechRecruit: true,  // 产研岗位招聘
  preferSalaryNeg: true,   // 有谈薪经验
  
  // 反爬
  minInterval: 2000,       // 最小间隔2秒
  maxInterval: 5000,       // 最大间隔5秒
};
```

## 关键接口

详见 [references/api.md](references/api.md)

## 筛选口径

详见 [references/screening-criteria.md](references/screening-criteria.md)

## 注意事项

- 推荐列表是动态的，每次请求返回的人选和顺序都不同
- 打招呼间隔随机2-5秒，不要固定间隔（反爬）
- 每天打招呼有上限（约200个），不要超量
- `geekDesc` 是对象不是字符串，内容在 `geekDesc.content`
- `geekWorks` / `geekEdus` 包含完整工作/教育经历，可直接用于深度筛选
