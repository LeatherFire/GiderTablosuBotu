import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMonthlySummary } from '@/lib/gemini'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { tr } from 'date-fns/locale'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const monthOffset = parseInt(searchParams.get('month') || '0') // 0 = bu ay, 1 = geçen ay, vs.

  const targetDate = subMonths(new Date(), monthOffset)
  const monthStart = startOfMonth(targetDate)
  const monthEnd = endOfMonth(targetDate)
  const monthName = format(targetDate, 'MMMM yyyy', { locale: tr })

  try {
    // Aylık özet
    const monthlyStats = await prisma.expense.aggregate({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
      _count: true,
      _avg: { amount: true },
      _max: { amount: true },
      _min: { amount: true },
    })

    // Kategori bazlı dağılım
    const categoryStats = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: {
        _sum: { amount: 'desc' },
      },
    })

    // Banka bazlı dağılım
    const bankStats = await prisma.expense.groupBy({
      by: ['bank'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: {
        _sum: { amount: 'desc' },
      },
    })

    // Günlük dağılım
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    })

    // Günlük toplamları hesapla
    const dailyTotals: Record<string, number> = {}
    expenses.forEach((expense) => {
      const dateStr = format(expense.date, 'yyyy-MM-dd')
      dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + expense.amount
    })

    const dailyData = Object.entries(dailyTotals)
      .map(([date, total]) => ({
        date,
        total,
        label: format(new Date(date), 'd MMM', { locale: tr }),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Haftalık dağılım
    const weeklyTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    expenses.forEach((expense) => {
      const dayOfWeek = expense.date.getDay()
      weeklyTotals[dayOfWeek] += expense.amount
    })

    const weekDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const weeklyData = Object.entries(weeklyTotals).map(([day, total]) => ({
      day: weekDays[parseInt(day)],
      total,
    }))

    // En büyük harcamalar
    const topExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { amount: 'desc' },
      take: 5,
    })

    // AI Özeti oluştur
    let aiSummary = ''
    try {
      aiSummary = await generateMonthlySummary(expenses)
    } catch (error) {
      console.error('AI Summary error:', error)
      aiSummary = 'Özet oluşturulamadı.'
    }

    // Geçen ayla karşılaştırma
    const prevMonthStart = startOfMonth(subMonths(targetDate, 1))
    const prevMonthEnd = endOfMonth(subMonths(targetDate, 1))

    const prevMonthStats = await prisma.expense.aggregate({
      where: {
        date: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
      },
      _sum: { amount: true },
    })

    const currentTotal = monthlyStats._sum.amount || 0
    const prevTotal = prevMonthStats._sum.amount || 0
    const changePercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0

    return NextResponse.json({
      month: monthName,
      monthOffset,
      summary: {
        total: monthlyStats._sum.amount || 0,
        count: monthlyStats._count,
        average: monthlyStats._avg.amount || 0,
        max: monthlyStats._max.amount || 0,
        min: monthlyStats._min.amount || 0,
      },
      comparison: {
        prevTotal,
        changePercent,
        increased: currentTotal > prevTotal,
      },
      categoryStats: categoryStats.map((c) => ({
        category: c.category,
        total: c._sum.amount || 0,
        count: c._count,
      })),
      bankStats: bankStats.map((b) => ({
        bank: b.bank,
        total: b._sum.amount || 0,
        count: b._count,
      })),
      dailyData,
      weeklyData,
      topExpenses,
      aiSummary,
    })
  } catch (error) {
    console.error('Summary error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
