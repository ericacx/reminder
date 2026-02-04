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
