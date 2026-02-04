# Reminder App 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个提醒管理 Web 应用，支持企业微信群机器人推送，部署到 1Panel。

**Architecture:** Next.js 全栈应用 + 独立 Worker 进程，使用 Prisma ORM 连接 MySQL，pnpm workspace 管理 Monorepo，Docker Compose 编排部署。

**Tech Stack:** Next.js 14, React 18, shadcn/ui, Tailwind CSS, Prisma, MySQL 8, node-cron, Docker

---

## Phase 1: 项目初始化

### Task 1: 初始化 pnpm workspace Monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: 创建 workspace 配置**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Step 2: 创建根 package.json**

```json
{
  "name": "reminder",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "db:generate": "pnpm --filter @reminder/database generate",
    "db:push": "pnpm --filter @reminder/database push",
    "db:studio": "pnpm --filter @reminder/database studio"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Step 3: 创建 .gitignore**

```
node_modules
.env
.env.local
.next
dist
*.log
.DS_Store
```

**Step 4: 创建 .env.example**

```
DATABASE_URL="mysql://root:password@localhost:3306/reminder"
WECOM_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"
```

**Step 5: 安装依赖并提交**

```bash
pnpm install
git add .
git commit -m "chore: initialize pnpm workspace monorepo"
```

---

### Task 2: 创建 database 共享包

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/tsconfig.json`

**Step 1: 创建 package.json**

```json
{
  "name": "@reminder/database",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "push": "prisma db push",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6.3.0"
  },
  "devDependencies": {
    "prisma": "^6.3.0"
  }
}
```

**Step 2: 创建 Prisma schema**

```prisma
// packages/database/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Reminder {
  id           Int       @id @default(autoincrement())
  title        String    @db.VarChar(200)
  content      String?   @db.Text
  remindAt     DateTime  @map("remind_at")
  status       Status    @default(pending)
  webhookId    Int       @map("webhook_id")
  webhook      Webhook   @relation(fields: [webhookId], references: [id])
  errorMessage String?   @map("error_message") @db.Text
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@index([remindAt, status])
  @@map("reminders")
}

model Webhook {
  id        Int        @id @default(autoincrement())
  name      String     @db.VarChar(100)
  url       String     @db.VarChar(500)
  isDefault Boolean    @default(false) @map("is_default")
  createdAt DateTime   @default(now()) @map("created_at")
  reminders Reminder[]

  @@map("webhooks")
}

enum Status {
  pending
  sent
  failed
}
```

**Step 3: 创建导出文件**

```typescript
// packages/database/src/index.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

**Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 5: 安装依赖并提交**

```bash
pnpm install
git add .
git commit -m "feat: add database package with Prisma schema"
```

---

### Task 3: 创建 Next.js Web 应用

**Files:**
- Create: `apps/web/` (Next.js 项目)

**Step 1: 创建 Next.js 应用**

```bash
cd apps && pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

**Step 2: 添加 database 依赖到 web**

修改 `apps/web/package.json`，添加：
```json
{
  "dependencies": {
    "@reminder/database": "workspace:*"
  }
}
```

**Step 3: 安装 shadcn/ui**

```bash
cd apps/web && pnpm dlx shadcn@latest init -d
```

**Step 4: 安装常用组件**

```bash
cd apps/web && pnpm dlx shadcn@latest add button card dialog form input label select table textarea toast
```

**Step 5: 提交**

```bash
git add .
git commit -m "feat: create Next.js web app with shadcn/ui"
```

---

### Task 4: 创建 Worker 应用

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/tsconfig.json`

**Step 1: 创建 package.json**

```json
{
  "name": "@reminder/worker",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@reminder/database": "workspace:*",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: 创建 Worker 入口文件**

```typescript
// apps/worker/src/index.ts
import cron from 'node-cron'
import { prisma, Status } from '@reminder/database'

async function sendWecomMessage(webhookUrl: string, title: string, content: string | null) {
  const message = content ? `⏰ 提醒：${title}\n${content}` : `⏰ 提醒：${title}`

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'text',
      text: { content: message }
    })
  })

  const result = await response.json()
  if (result.errcode !== 0) {
    throw new Error(result.errmsg || 'Failed to send message')
  }
  return result
}

async function processReminders() {
  const now = new Date()
  console.log(`[${now.toISOString()}] Checking for pending reminders...`)

  const reminders = await prisma.reminder.findMany({
    where: {
      status: Status.pending,
      remindAt: { lte: now }
    },
    include: { webhook: true },
    take: 100
  })

  console.log(`Found ${reminders.length} reminders to process`)

  for (const reminder of reminders) {
    try {
      await sendWecomMessage(reminder.webhook.url, reminder.title, reminder.content)
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: Status.sent }
      })
      console.log(`✓ Sent reminder: ${reminder.title}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: Status.failed, errorMessage }
      })
      console.error(`✗ Failed to send reminder: ${reminder.title}`, errorMessage)
    }
  }
}

// 每分钟执行一次
cron.schedule('* * * * *', processReminders)

console.log('🚀 Reminder Worker started')
console.log('⏰ Checking for reminders every minute...')

// 启动时立即检查一次
processReminders()
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: 安装依赖并提交**

```bash
pnpm install
git add .
git commit -m "feat: create worker app with cron scheduler"
```

---

## Phase 2: Web 应用 API 开发

### Task 5: 实现 Webhook API

**Files:**
- Create: `apps/web/src/app/api/webhooks/route.ts`
- Create: `apps/web/src/app/api/webhooks/[id]/route.ts`

**Step 1: 创建 Webhook 列表和创建 API**

```typescript
// apps/web/src/app/api/webhooks/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@reminder/database'

export async function GET() {
  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(webhooks)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, url, isDefault } = body

  if (!name || !url) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
  }

  // 如果设为默认，先取消其他默认
  if (isDefault) {
    await prisma.webhook.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    })
  }

  const webhook = await prisma.webhook.create({
    data: { name, url, isDefault: isDefault || false }
  })

  return NextResponse.json(webhook, { status: 201 })
}
```

**Step 2: 创建单个 Webhook 删除 API**

```typescript
// apps/web/src/app/api/webhooks/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@reminder/database'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const webhookId = parseInt(id)

  // 检查是否有关联的提醒
  const count = await prisma.reminder.count({
    where: { webhookId }
  })

  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} reminders are using this webhook` },
      { status: 400 }
    )
  }

  await prisma.webhook.delete({ where: { id: webhookId } })
  return NextResponse.json({ success: true })
}
```

**Step 3: 提交**

```bash
git add .
git commit -m "feat: add webhook API endpoints"
```

---

### Task 6: 实现 Reminder API

**Files:**
- Create: `apps/web/src/app/api/reminders/route.ts`
- Create: `apps/web/src/app/api/reminders/[id]/route.ts`
- Create: `apps/web/src/app/api/reminders/[id]/retry/route.ts`

**Step 1: 创建 Reminder 列表和创建 API**

```typescript
// apps/web/src/app/api/reminders/route.ts
import { NextResponse } from 'next/server'
import { prisma, Status } from '@reminder/database'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as Status | null
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')

  const where = status ? { status } : {}

  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      include: { webhook: { select: { id: true, name: true } } },
      orderBy: { remindAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.reminder.count({ where })
  ])

  return NextResponse.json({
    data: reminders,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { title, content, remindAt, webhookId } = body

  if (!title || !remindAt || !webhookId) {
    return NextResponse.json(
      { error: 'Title, remindAt, and webhookId are required' },
      { status: 400 }
    )
  }

  const reminder = await prisma.reminder.create({
    data: {
      title,
      content,
      remindAt: new Date(remindAt),
      webhookId: parseInt(webhookId)
    },
    include: { webhook: { select: { id: true, name: true } } }
  })

  return NextResponse.json(reminder, { status: 201 })
}
```

**Step 2: 创建单个 Reminder 操作 API**

```typescript
// apps/web/src/app/api/reminders/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma, Status } from '@reminder/database'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const reminderId = parseInt(id)
  const body = await request.json()
  const { title, content, remindAt, webhookId } = body

  // 只有 pending 状态可以编辑
  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } })
  if (!existing) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
  }
  if (existing.status !== Status.pending) {
    return NextResponse.json({ error: 'Only pending reminders can be edited' }, { status: 400 })
  }

  const reminder = await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      title,
      content,
      remindAt: remindAt ? new Date(remindAt) : undefined,
      webhookId: webhookId ? parseInt(webhookId) : undefined
    },
    include: { webhook: { select: { id: true, name: true } } }
  })

  return NextResponse.json(reminder)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.reminder.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
```

**Step 3: 创建重试 API**

```typescript
// apps/web/src/app/api/reminders/[id]/retry/route.ts
import { NextResponse } from 'next/server'
import { prisma, Status } from '@reminder/database'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const reminderId = parseInt(id)

  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } })
  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
  }
  if (reminder.status !== Status.failed) {
    return NextResponse.json({ error: 'Only failed reminders can be retried' }, { status: 400 })
  }

  // 重置状态为 pending，Worker 会重新处理
  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: Status.pending, errorMessage: null }
  })

  return NextResponse.json(updated)
}
```

**Step 4: 提交**

```bash
git add .
git commit -m "feat: add reminder API endpoints"
```

---

## Phase 3: Web 应用前端开发

### Task 7: 创建布局和导航

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/components/nav.tsx`

**Step 1: 创建导航组件**

```typescript
// apps/web/src/components/nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function Nav() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: '提醒列表' },
    { href: '/settings', label: '设置' }
  ]

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            ⏰ Reminder
          </Link>
          <div className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm transition-colors hover:text-foreground/80',
                  pathname === link.href ? 'text-foreground font-medium' : 'text-foreground/60'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
```

**Step 2: 更新 layout.tsx**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reminder - 提醒管理',
  description: '企业微信提醒推送管理系统'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  )
}
```

**Step 3: 提交**

```bash
git add .
git commit -m "feat: add navigation and layout"
```

---

### Task 8: 创建提醒列表页面

**Files:**
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/components/reminder-list.tsx`
- Create: `apps/web/src/components/reminder-form.tsx`
- Create: `apps/web/src/lib/api.ts`

**Step 1: 创建 API 客户端**

```typescript
// apps/web/src/lib/api.ts
import { Status } from '@reminder/database'

export interface Webhook {
  id: number
  name: string
  url: string
  isDefault: boolean
}

export interface Reminder {
  id: number
  title: string
  content: string | null
  remindAt: string
  status: Status
  webhookId: number
  webhook: { id: number; name: string }
  errorMessage: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// Webhooks
export async function getWebhooks(): Promise<Webhook[]> {
  const res = await fetch('/api/webhooks')
  return res.json()
}

export async function createWebhook(data: Omit<Webhook, 'id'>): Promise<Webhook> {
  const res = await fetch('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function deleteWebhook(id: number): Promise<void> {
  await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
}

// Reminders
export async function getReminders(
  params?: { status?: Status; page?: number }
): Promise<PaginatedResponse<Reminder>> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', params.page.toString())
  const res = await fetch(`/api/reminders?${searchParams}`)
  return res.json()
}

export async function createReminder(data: {
  title: string
  content?: string
  remindAt: string
  webhookId: number
}): Promise<Reminder> {
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function updateReminder(
  id: number,
  data: Partial<{ title: string; content: string; remindAt: string; webhookId: number }>
): Promise<Reminder> {
  const res = await fetch(`/api/reminders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return res.json()
}

export async function deleteReminder(id: number): Promise<void> {
  await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
}

export async function retryReminder(id: number): Promise<Reminder> {
  const res = await fetch(`/api/reminders/${id}/retry`, { method: 'POST' })
  return res.json()
}
```

**Step 2: 创建提醒表单组件**

```typescript
// apps/web/src/components/reminder-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { getWebhooks, createReminder, updateReminder, Webhook, Reminder } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface ReminderFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder | null
  onSuccess: () => void
}

export function ReminderForm({ open, onOpenChange, reminder, onSuccess }: ReminderFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    remindAt: '',
    webhookId: ''
  })

  useEffect(() => {
    if (open) {
      getWebhooks().then(setWebhooks)
      if (reminder) {
        setFormData({
          title: reminder.title,
          content: reminder.content || '',
          remindAt: new Date(reminder.remindAt).toISOString().slice(0, 16),
          webhookId: reminder.webhookId.toString()
        })
      } else {
        setFormData({ title: '', content: '', remindAt: '', webhookId: '' })
      }
    }
  }, [open, reminder])

  // 设置默认 webhook
  useEffect(() => {
    if (!formData.webhookId && webhooks.length > 0) {
      const defaultWebhook = webhooks.find((w) => w.isDefault) || webhooks[0]
      setFormData((prev) => ({ ...prev, webhookId: defaultWebhook.id.toString() }))
    }
  }, [webhooks, formData.webhookId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (reminder) {
        await updateReminder(reminder.id, {
          ...formData,
          webhookId: parseInt(formData.webhookId)
        })
        toast({ title: '更新成功' })
      } else {
        await createReminder({
          ...formData,
          webhookId: parseInt(formData.webhookId)
        })
        toast({ title: '创建成功' })
      }
      onOpenChange(false)
      onSuccess()
    } catch {
      toast({ title: '操作失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reminder ? '编辑提醒' : '新建提醒'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remindAt">提醒时间 *</Label>
              <Input
                id="remindAt"
                type="datetime-local"
                value={formData.remindAt}
                onChange={(e) => setFormData({ ...formData, remindAt: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook">推送群 *</Label>
              <Select
                value={formData.webhookId}
                onValueChange={(value) => setFormData({ ...formData, webhookId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择推送群" />
                </SelectTrigger>
                <SelectContent>
                  {webhooks.map((webhook) => (
                    <SelectItem key={webhook.id} value={webhook.id.toString()}>
                      {webhook.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 3: 创建提醒列表组件**

```typescript
// apps/web/src/components/reminder-list.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ReminderForm } from './reminder-form'
import {
  getReminders,
  deleteReminder,
  retryReminder,
  Reminder,
  PaginatedResponse
} from '@/lib/api'
import { Status } from '@reminder/database'
import { useToast } from '@/hooks/use-toast'

const statusLabels: Record<Status, string> = {
  pending: '待推送',
  sent: '已推送',
  failed: '失败'
}

const statusColors: Record<Status, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  sent: 'text-green-600 bg-green-50',
  failed: 'text-red-600 bg-red-50'
}

export function ReminderList() {
  const { toast } = useToast()
  const [data, setData] = useState<PaginatedResponse<Reminder> | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const fetchData = useCallback(async () => {
    const result = await getReminders({
      status: statusFilter === 'all' ? undefined : statusFilter
    })
    setData(result)
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setFormOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个提醒吗？')) return
    await deleteReminder(id)
    toast({ title: '删除成功' })
    fetchData()
  }

  const handleRetry = async (id: number) => {
    await retryReminder(id)
    toast({ title: '已重新排队，等待推送' })
    fetchData()
  }

  const handleCreate = () => {
    setEditingReminder(null)
    setFormOpen(true)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">提醒列表</h1>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as Status | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待推送</SelectItem>
              <SelectItem value="sent">已推送</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate}>新建提醒</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>提醒时间</TableHead>
              <TableHead>推送群</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data.map((reminder) => (
              <TableRow key={reminder.id}>
                <TableCell className="font-medium">{reminder.title}</TableCell>
                <TableCell>{formatDate(reminder.remindAt)}</TableCell>
                <TableCell>{reminder.webhook.name}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-sm ${statusColors[reminder.status]}`}
                  >
                    {statusLabels[reminder.status]}
                  </span>
                  {reminder.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{reminder.errorMessage}</p>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {reminder.status === 'pending' && (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(reminder)}>
                      编辑
                    </Button>
                  )}
                  {reminder.status === 'failed' && (
                    <Button variant="ghost" size="sm" onClick={() => handleRetry(reminder.id)}>
                      重试
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDelete(reminder.id)}
                  >
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  暂无提醒
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ReminderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        reminder={editingReminder}
        onSuccess={fetchData}
      />
    </div>
  )
}
```

**Step 4: 创建首页**

```typescript
// apps/web/src/app/page.tsx
import { ReminderList } from '@/components/reminder-list'

export default function Home() {
  return <ReminderList />
}
```

**Step 5: 提交**

```bash
git add .
git commit -m "feat: add reminder list page with CRUD operations"
```

---

### Task 9: 创建设置页面

**Files:**
- Create: `apps/web/src/app/settings/page.tsx`
- Create: `apps/web/src/components/webhook-list.tsx`

**Step 1: 创建 Webhook 列表组件**

```typescript
// apps/web/src/components/webhook-list.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { getWebhooks, createWebhook, deleteWebhook, Webhook } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export function WebhookList() {
  const { toast } = useToast()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', url: '', isDefault: false })

  const fetchWebhooks = async () => {
    const data = await getWebhooks()
    setWebhooks(data)
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await createWebhook(formData)
      toast({ title: '添加成功' })
      setFormOpen(false)
      setFormData({ name: '', url: '', isDefault: false })
      fetchWebhooks()
    } catch {
      toast({ title: '添加失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 Webhook 吗？')) return
    try {
      await deleteWebhook(id)
      toast({ title: '删除成功' })
      fetchWebhooks()
    } catch {
      toast({ title: '删除失败，可能有提醒正在使用', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">企业微信 Webhook</h2>
        <Button onClick={() => setFormOpen(true)}>添加 Webhook</Button>
      </div>

      <div className="grid gap-4">
        {webhooks.map((webhook) => (
          <Card key={webhook.id}>
            <CardHeader className="py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2">
                  {webhook.name}
                  {webhook.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => handleDelete(webhook.id)}
                >
                  删除
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-0 pb-4">
              <code className="text-xs text-muted-foreground break-all">{webhook.url}</code>
            </CardContent>
          </Card>
        ))}
        {webhooks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无 Webhook，请先添加
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 Webhook</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  placeholder="如：产品群"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <Label htmlFor="isDefault">设为默认</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '添加中...' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 2: 创建设置页面**

```typescript
// apps/web/src/app/settings/page.tsx
import { WebhookList } from '@/components/webhook-list'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>
      <WebhookList />
    </div>
  )
}
```

**Step 3: 提交**

```bash
git add .
git commit -m "feat: add settings page with webhook management"
```

---

## Phase 4: Docker 部署配置

### Task 10: 创建 Docker 配置

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: 创建 Web Dockerfile**

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @reminder/database generate
RUN pnpm --filter @reminder/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

**Step 2: 创建 Worker Dockerfile**

```dockerfile
# apps/worker/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY . .
RUN pnpm --filter @reminder/database generate
RUN pnpm --filter @reminder/worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/

CMD ["node", "apps/worker/dist/index.js"]
```

**Step 3: 创建 docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://reminder:reminder123@mysql:3306/reminder
    depends_on:
      mysql:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      - DATABASE_URL=mysql://reminder:reminder123@mysql:3306/reminder
    depends_on:
      mysql:
        condition: service_healthy
    restart: always

  mysql:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=root123
      - MYSQL_DATABASE=reminder
      - MYSQL_USER=reminder
      - MYSQL_PASSWORD=reminder123
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql_data:
```

**Step 4: 创建 .dockerignore**

```
node_modules
.next
dist
.env
.env.local
*.log
.git
.gitignore
README.md
docs
```

**Step 5: 更新 next.config 支持 standalone**

修改 `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
};

export default nextConfig;
```

**Step 6: 提交**

```bash
git add .
git commit -m "feat: add Docker configuration for deployment"
```

---

## Phase 5: 本地测试 & 部署

### Task 11: 本地开发测试

**Step 1: 启动本地 MySQL（使用 Docker）**

```bash
docker run -d --name reminder-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=reminder \
  mysql:8
```

**Step 2: 配置环境变量**

创建 `.env`:
```
DATABASE_URL="mysql://root:root123@localhost:3306/reminder"
```

**Step 3: 初始化数据库**

```bash
pnpm db:generate
pnpm db:push
```

**Step 4: 启动开发服务**

```bash
pnpm dev
```

**Step 5: 测试功能**
- 访问 http://localhost:3000/settings 添加 Webhook
- 访问 http://localhost:3000 创建提醒
- 确认 Worker 能正常推送

---

### Task 12: 推送到 GitHub

**Step 1: 创建 GitHub 仓库**

```bash
gh repo create reminder --public --source=. --push
```

---

### Task 13: 部署到 1Panel

**Step 1: 在 1Panel 创建 MySQL 数据库**
- 名称：reminder
- 用户名：reminder
- 密码：自定义安全密码

**Step 2: 在服务器克隆代码**

```bash
git clone https://github.com/YOUR_USERNAME/reminder.git
cd reminder
```

**Step 3: 配置环境变量**

创建 `.env` 文件，配置正确的数据库连接。

**Step 4: 使用 docker-compose 部署**

```bash
docker compose up -d --build
```

**Step 5: 配置 1Panel 反向代理**
- 添加网站 → 反向代理
- 代理地址：http://127.0.0.1:3000

---

**Plan complete and saved to `docs/plans/2025-02-04-implementation-plan.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
