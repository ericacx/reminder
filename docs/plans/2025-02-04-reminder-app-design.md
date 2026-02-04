# Reminder App 设计文档

> 创建时间：2025-02-04

## 概述

一个跨端的提醒应用：PC端 Web 应用管理提醒事件，通过企业微信群机器人推送到手机端。

## 需求总结

| 项目 | 选择 |
|------|------|
| 产品定位 | 面向公众，先小范围验证 |
| PC端 | Web 应用 |
| 推送渠道 | 企业微信群机器人 |
| 提醒类型 | 一次性提醒 |
| 用户体系 | 暂不做 |
| 技术栈 | Next.js (React) + MySQL |
| 部署 | Docker + DigitalOcean |

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    DigitalOcean VPS                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Docker Compose                      │   │
│  │                                                  │   │
│  │   ┌──────────────┐      ┌──────────────┐       │   │
│  │   │   Next.js    │      │    Worker    │       │   │
│  │   │   Web App    │      │   (Node.js)  │       │   │
│  │   │   :3000      │      │   定时扫描    │       │   │
│  │   └──────┬───────┘      └──────┬───────┘       │   │
│  │          │                      │               │   │
│  │          └──────────┬───────────┘               │   │
│  │                     ▼                           │   │
│  │            ┌──────────────┐                     │   │
│  │            │    MySQL     │                     │   │
│  │            │    :3306     │                     │   │
│  │            └──────────────┘                     │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          ▼
              ┌──────────────────────┐
              │  企业微信群机器人     │
              │  (Webhook 推送)      │
              └──────────────────────┘
```

**三个容器**：Next.js Web 应用、Worker 定时任务、MySQL 数据库，通过 Docker Compose 编排。

## 数据模型

```sql
-- 提醒事件表
CREATE TABLE reminders (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  title         VARCHAR(200) NOT NULL,      -- 提醒标题
  content       TEXT,                        -- 提醒内容（可选）
  remind_at     DATETIME NOT NULL,           -- 提醒时间
  status        ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  webhook_url   VARCHAR(500) NOT NULL,       -- 企业微信机器人 Webhook
  error_message TEXT,                        -- 推送失败时的错误信息
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_remind_at_status (remind_at, status)  -- 加速 Worker 查询
);

-- Webhook 配置表
CREATE TABLE webhooks (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,       -- Webhook 名称（如：产品群、运营群）
  url           VARCHAR(500) NOT NULL,       -- Webhook URL
  is_default    BOOLEAN DEFAULT FALSE,       -- 是否默认
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Web 应用功能

### 页面结构

```
/                     # 首页 - 提醒列表
├── 新建提醒按钮 → 弹窗表单
├── 提醒列表（表格形式）
│   ├── 标题 | 提醒时间 | 状态 | 操作
│   └── 支持筛选：全部 / 待推送 / 已推送 / 失败
└── 操作：编辑 / 删除 / 重新推送（针对失败的）

/settings             # 设置页
└── 企业微信 Webhook 配置（设置默认 Webhook）
```

### 核心功能

1. **创建提醒** - 标题、内容（可选）、提醒时间、选择 Webhook
2. **查看列表** - 分页展示，按时间倒序
3. **编辑/删除** - 待推送状态的可以修改
4. **失败重试** - 推送失败的可以手动重试
5. **Webhook 管理** - 可配置多个群机器人

### UI 方案

使用 **shadcn/ui** 组件库，简洁现代，开发效率高。

## Worker 定时任务

### 运行逻辑

```
每分钟执行一次
    │
    ▼
查询 reminders 表
WHERE status = 'pending'
  AND remind_at <= NOW()
    │
    ▼
遍历每条记录
    │
    ├─→ 调用企业微信 Webhook 发送消息
    │       │
    │       ├─ 成功 → status = 'sent'
    │       └─ 失败 → status = 'failed', 记录错误信息
    │
    └─→ 处理下一条
```

### 关键设计

- 使用 **node-cron** 实现定时调度
- 每次最多处理 100 条，避免堆积时卡死
- 失败时记录错误原因到 `error_message` 字段
- 发送前先用 `SELECT ... FOR UPDATE` 锁定，防止重复发送

### 企业微信消息格式

```json
{
  "msgtype": "text",
  "text": {
    "content": "⏰ 提醒：{title}\n{content}"
  }
}
```

## 项目结构

```
reminder-app/
├── docker-compose.yml
├── apps/
│   ├── web/                 # Next.js 应用
│   │   ├── Dockerfile
│   │   └── ...
│   └── worker/              # Worker 定时任务
│       ├── Dockerfile
│       └── ...
├── packages/
│   └── database/            # 共享的数据库连接和模型
└── .env                     # 环境变量
```

使用 **pnpm workspace** 管理 Monorepo。

## 技术选型

| 层级 | 选择 | 说明 |
|------|------|------|
| **前端** | Next.js 14 + React 18 | App Router 模式 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 现代简洁风格 |
| **后端 API** | Next.js API Routes | 内置，无需单独服务 |
| **ORM** | Prisma | 类型安全，迁移方便 |
| **定时任务** | node-cron | 轻量可靠 |
| **数据库** | MySQL 8 | Docker 容器部署 |
| **包管理** | pnpm + workspace | Monorepo 管理 |
| **部署** | Docker Compose | 一键启动所有服务 |

## API 设计

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/reminders` | 获取列表（分页、筛选） |
| POST | `/api/reminders` | 创建提醒 |
| PUT | `/api/reminders/:id` | 编辑提醒 |
| DELETE | `/api/reminders/:id` | 删除提醒 |
| POST | `/api/reminders/:id/retry` | 重试失败的推送 |
| GET | `/api/webhooks` | 获取 Webhook 列表 |
| POST | `/api/webhooks` | 添加 Webhook |
| DELETE | `/api/webhooks/:id` | 删除 Webhook |

## 错误处理

- **Worker 推送失败** → 状态设为 `failed`，记录错误信息，支持手动重试
- **Webhook 无效** → 验证 URL 格式，首次添加时发送测试消息
- **Worker 进程挂掉** → Docker `restart: always` 自动重启

## 后续可扩展

- ✅ 用户体系 → 加 `users` 表 + `user_id` 外键
- ✅ 重复提醒 → 加 `recurrence` 字段，Worker 推送后生成下一条
- ✅ 多渠道推送 → 加 `channel` 字段，支持邮件/短信/钉钉等
- ✅ 提醒分组 → 加 `groups` 表，按项目或类别管理
