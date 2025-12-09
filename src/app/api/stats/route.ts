import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const last7Days = subDays(now, 7)

  // Bu ayki gider toplamı
  const monthlyExpenseTotal = await prisma.expense.aggregate({
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
  })

  // Bu ayki gelir toplamı
  const monthlyIncomeTotal = await prisma.income.aggregate({
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
  })

  // Genel gider toplamı
  const allTimeExpenseTotal = await prisma.expense.aggregate({
    _sum: {
      amount: true,
    },
  })

  // Genel gelir toplamı
  const allTimeIncomeTotal = await prisma.income.aggregate({
    _sum: {
      amount: true,
    },
  })

  // Bu ayki gider sayısı
  const monthlyExpenseCount = await prisma.expense.count({
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  })

  // Bu ayki gelir sayısı
  const monthlyIncomeCount = await prisma.income.count({
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  })

  // Kategori dağılımı (bu ay)
  const categoryStats = await prisma.expense.groupBy({
    by: ['category'],
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
    orderBy: {
      _sum: {
        amount: 'desc',
      },
    },
  })

  // Son 7 gün günlük toplamlar
  const last7DaysExpenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: last7Days,
      },
    },
    select: {
      date: true,
      amount: true,
    },
  })

  // Günlük toplamları hesapla
  const dailyTotals: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const date = subDays(now, i)
    const dateStr = format(date, 'yyyy-MM-dd')
    dailyTotals[dateStr] = 0
  }

  last7DaysExpenses.forEach((expense) => {
    const dateStr = format(expense.date, 'yyyy-MM-dd')
    if (dailyTotals[dateStr] !== undefined) {
      dailyTotals[dateStr] += expense.amount
    }
  })

  const dailyData = Object.entries(dailyTotals).map(([date, total]) => ({
    date,
    total,
    label: format(new Date(date), 'dd MMM'),
  }))

  // Son 5 işlem
  const recentExpenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      user: {
        select: { name: true },
      },
    },
  })

  // Banka dağılımı
  const bankStats = await prisma.expense.groupBy({
    by: ['bank'],
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        amount: 'desc',
      },
    },
  })

  // Son 5 gelir
  const recentIncomes = await prisma.income.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      user: {
        select: { name: true },
      },
    },
  })

  // Gelir kategori dağılımı (bu ay)
  const incomeCategoryStats = await prisma.income.groupBy({
    by: ['category'],
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
    orderBy: {
      _sum: {
        amount: 'desc',
      },
    },
  })

  // Net bakiye hesapla
  const monthlyIncome = monthlyIncomeTotal._sum.amount || 0
  const monthlyExpense = monthlyExpenseTotal._sum.amount || 0
  const netBalance = monthlyIncome - monthlyExpense

  return NextResponse.json({
    // Gider istatistikleri
    monthlyTotal: monthlyExpense,
    allTimeTotal: allTimeExpenseTotal._sum.amount || 0,
    monthlyCount: monthlyExpenseCount,
    categoryStats: categoryStats.map((c) => ({
      category: c.category,
      total: c._sum.amount || 0,
    })),
    dailyData,
    recentExpenses,
    bankStats: bankStats.map((b) => ({
      bank: b.bank,
      total: b._sum.amount || 0,
      count: b._count,
    })),
    // Gelir istatistikleri
    monthlyIncome,
    allTimeIncome: allTimeIncomeTotal._sum.amount || 0,
    monthlyIncomeCount,
    incomeCategoryStats: incomeCategoryStats.map((c) => ({
      category: c.category,
      total: c._sum.amount || 0,
    })),
    recentIncomes,
    // Net bakiye
    netBalance,
  })
}
