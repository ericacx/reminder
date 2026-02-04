import dotenv from 'dotenv'
import path from 'path'

// 加载根目录的 .env 文件
dotenv.config({ path: path.join(__dirname, '../../../.env') })

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
