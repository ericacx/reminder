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
