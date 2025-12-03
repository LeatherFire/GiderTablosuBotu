'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

interface SummaryData {
  month: string
  monthOffset: number
  summary: {
    total: number
    count: number
    average: number
    max: number
    min: number
  }
  comparison: {
    prevTotal: number
    changePercent: number
    increased: boolean
  }
  categoryStats: { category: string; total: number; count: number }[]
  bankStats: { bank: string; total: number; count: number }[]
  dailyData: { date: string; total: number; label: string }[]
  weeklyData: { day: string; total: number }[]
  topExpenses: any[]
  aiSummary: string
}

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#6B7280'
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ReportsPage() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)

  useEffect(() => {
    fetchSummary()
  }, [monthOffset])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/summary?month=${monthOffset}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* Başlık ve Ay Seçimi */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Raporlar</h1>
            <p className="text-gray-600">Detaylı gider analizi</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthOffset((prev) => prev + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-2 bg-white rounded-lg shadow-sm font-medium">
              {data?.month || 'Yükleniyor...'}
            </span>
            <button
              onClick={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
              disabled={monthOffset === 0}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : data ? (
          <>
            {/* Özet Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-gray-500">Toplam Harcama</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(data.summary.total)}</p>
                {data.comparison.prevTotal > 0 && (
                  <p className={`text-sm mt-1 ${data.comparison.increased ? 'text-red-500' : 'text-green-500'}`}>
                    {data.comparison.increased ? '↑' : '↓'} %{Math.abs(data.comparison.changePercent).toFixed(1)} geçen aya göre
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-gray-500">İşlem Sayısı</p>
                <p className="text-2xl font-bold text-gray-800">{data.summary.count}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-gray-500">Ortalama</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(data.summary.average)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <p className="text-sm text-gray-500">En Yüksek</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(data.summary.max)}</p>
              </div>
            </div>

            {/* AI Özeti */}
            {data.aiSummary && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-sm p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1">AI Analizi</h3>
                    <p className="text-gray-600">{data.aiSummary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Günlük Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Günlük Harcama Trendi</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Toplam']} />
                    <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Kategori Dağılımı */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Kategori Dağılımı</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.categoryStats}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {data.categoryStats.map((entry, index) => (
                        <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Haftalık Dağılım */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Haftalık Dağılım</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Toplam']} />
                    <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Banka Dağılımı */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Banka Dağılımı</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.bankStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <YAxis dataKey="bank" type="category" width={80} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Toplam']} />
                    <Bar dataKey="total" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detay Tabloları */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kategori Detayları */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Kategori Detayları</h3>
                <div className="space-y-3">
                  {data.categoryStats.map((cat, index) => {
                    const percentage = (cat.total / data.summary.total) * 100
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                          <span className="text-sm text-gray-500">{formatCurrency(cat.total)} ({cat.count} işlem)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* En Büyük Harcamalar */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">En Büyük Harcamalar</h3>
                <div className="space-y-3">
                  {data.topExpenses.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Henüz harcama yok</p>
                  ) : (
                    data.topExpenses.map((expense, index) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800">{expense.recipient}</p>
                            <p className="text-sm text-gray-500">
                              {expense.category} • {format(new Date(expense.date), 'd MMM', { locale: tr })}
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold text-gray-800">{formatCurrency(expense.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">Veri yüklenemedi</div>
        )}
      </div>
    </AuthGuard>
  )
}
