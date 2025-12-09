import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const category = searchParams.get('category')
  const bank = searchParams.get('bank')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const search = searchParams.get('search')

  const where: any = {}

  if (category) where.category = category
  if (bank) where.bank = bank
  if (search) {
    where.OR = [
      { sender: { contains: search } },
      { description: { contains: search } },
      { recipient: { contains: search } },
    ]
  }
  if (startDate || endDate) {
    where.date = {}
    if (startDate) where.date.gte = new Date(startDate)
    if (endDate) where.date.lte = new Date(endDate)
  }

  const [incomes, total] = await Promise.all([
    prisma.income.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { name: true },
        },
      },
    }),
    prisma.income.count({ where }),
  ])

  return NextResponse.json({
    incomes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const income = await prisma.income.create({
      data: {
        amount: parseFloat(body.amount),
        currency: body.currency || 'TRY',
        sender: body.sender,
        senderBank: body.senderBank,
        senderIban: body.senderIban,
        recipient: body.recipient,
        recipientBank: body.recipientBank,
        recipientIban: body.recipientIban,
        bank: body.bank,
        branchCode: body.branchCode,
        branchName: body.branchName,
        transactionType: body.transactionType,
        transactionId: body.transactionId,
        description: body.description,
        category: body.category || 'Diğer',
        date: new Date(body.date),
        time: body.time,
        receiptPath: body.receiptPath,
        receiptType: body.receiptType,
        aiRawResponse: body.aiRawResponse,
        isManual: body.isManual ?? true,
        userId: session.user.id,
      },
    })

    return NextResponse.json(income)
  } catch (error) {
    console.error('Error creating income:', error)
    return NextResponse.json({ error: 'Failed to create income' }, { status: 500 })
  }
}
