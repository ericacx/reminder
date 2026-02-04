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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.reminder.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
