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
