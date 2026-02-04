import { NextResponse } from 'next/server'
import { prisma, Status } from '@reminder/database'

export async function POST(
  _request: Request,
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
