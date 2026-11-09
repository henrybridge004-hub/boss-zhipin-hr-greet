# BOSS直聘HR端接口文档

## 基础信息

- 域名：`https://www.zhipin.com`
- 认证：Cookie（已登录状态）
- 调用方式：CDP Runtime.evaluate 在页面上下文直接 fetch

## 核心接口

### 1. 推荐牛人列表

```
GET /wapi/zpjob/rec/geek/list?jobId={jobId}&page={page}
```

**返回字段（geekCard）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `geekName` | string | 姓名 |
| `geekWorkYear` | string | 工作年限（如"27年应届生"） |
| `geekDesc` | object | 个人简介（内容在`.content`） |
| `geekWorks` | array | 工作经历列表 |
| `geekEdus` | array | 教育经历列表 |
| `encryptGeekId` | string | 候选人加密ID（打招呼用） |
| `encryptJobId` | string | 职位加密ID |
| `expectId` | string | 期望ID（打招呼用） |
| `lid` | string | lid（打招呼用） |
| `securityId` | string | 安全ID（打招呼用） |
| `expectPositionName` | string | 期望职位 |
| `expectLocationName` | string | 期望城市 |
| `salary` | string | 期望薪资 |

**geekWorks 子字段：**

| 字段 | 说明 |
|------|------|
| `company` | 公司名 |
| `positionName` | 职位名 |
| `startDate` / `endDate` | 开始/结束时间 |
| `responsibility` / `workDesc` | 工作描述 |

**geekEdus 子字段：**

| 字段 | 说明 |
|------|------|
| `school` | 学校名 |
| `major` | 专业 |
| `degreeName` | 学历（本科/硕士/博士） |

### 2. 打招呼

```
POST /wapi/zpjob/chat/start
Content-Type: application/x-www-form-urlencoded
```

**参数：**

| 参数 | 说明 |
|------|------|
| `gid` | encryptGeekId |
| `jid` | encryptJobId |
| `expectId` | expectId |
| `lid` | lid |
| `securityId` | securityId |

**返回：** `{ code: 0, success: true }`

### 3. 职位列表

```
GET /wapi/zpjob/job/search/job/list?page=1&pageSize=20
```

## 注意事项

1. **geekDesc 是对象不是字符串**：个人简介在 `geekDesc.content`
2. **推荐列表是动态的**：每次请求返回的人选和顺序都不同
3. **打招呼有上限**：每天约200个，不要超量
4. **反爬**：间隔随机2-5秒，不要固定间隔
5. **字段陷阱**：`geekWorks` / `geekEdus` 不是空数组，包含完整数据
