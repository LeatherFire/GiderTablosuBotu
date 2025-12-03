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
      { recipient: { contains: search } },
      { description: { contains: search } },
      { sender: { contains: search } },
    ]
  }
  if (startDate || endDate) {
    where.date = {}
    if (startDate) where.date.gte = new Date(startDate)
    if (endDate) where.date.lte = new Date(endDate)
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
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
    prisma.expense.count({ where }),
  ])

  return NextResponse.json({
    expenses,
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

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(body.amount),
        currency: body.currency || 'TRY',
        recipient: body.recipient,
        sender: body.sender,
        bank: body.bank,
        accountType: body.accountType,
        accountNumber: body.accountNumber,
        description: body.description,
        category: body.category || 'Diğer',
        date: new Date(body.date),
        receiptPath: body.receiptPath,
        aiRawResponse: body.aiRawResponse,
        isManual: body.isManual ?? true,
        userId: session.user.id,
      },
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
