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
} from 'recharts'

interface Stats {
  monthlyTotal: number
  allTimeTotal: number
  monthlyCount: number
  categoryStats: { category: string; total: number }[]
  dailyData: { date: string; total: number; label: string }[]
  recentExpenses: any[]
  bankStats: { bank: string; total: number; count: number }[]
  // Gelir istatistikleri
  monthlyIncome: number
  allTimeIncome: number
  monthlyIncomeCount: number
  incomeCategoryStats: { category: string; total: number }[]
  recentIncomes: any[]
  netBalance: number
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Gelir-Gider takip özeti</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : stats ? (
          <>
            {/* Ana Özet Kartları - Gelir, Gider, Net Bakiye */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              {/* Bu Ay Gelir */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border-l-4 border-emerald-500">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Bu Ay Gelir</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">+{formatCurrency(stats.monthlyIncome || 0)}</p>
                    <p className="text-xs text-gray-400">{stats.monthlyIncomeCount || 0} işlem</p>
                  </div>
                </div>
              </div>

              {/* Bu Ay Gider */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border-l-4 border-red-500">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Bu Ay Gider</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">-{formatCurrency(stats.monthlyTotal)}</p>
                    <p className="text-xs text-gray-400">{stats.monthlyCount} işlem</p>
                  </div>
                </div>
              </div>

              {/* Net Bakiye */}
              <div className={`bg-white rounded-xl shadow-sm p-4 sm:p-6 border-l-4 ${(stats.netBalance || 0) >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center ${(stats.netBalance || 0) >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${(stats.netBalance || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500">Net Bakiye</p>
                    <p className={`text-lg sm:text-2xl font-bold ${(stats.netBalance || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {(stats.netBalance || 0) >= 0 ? '+' : ''}{formatCurrency(stats.netBalance || 0)}
                    </p>
                    <p className="text-xs text-gray-400">Gelir - Gider</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Genel Toplam Kartları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs text-emerald-600 font-medium">Toplam Gelir</p>
                <p className="text-sm sm:text-lg font-bold text-emerald-700">{formatCurrency(stats.allTimeIncome || 0)}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs text-red-600 font-medium">Toplam Gider</p>
                <p className="text-sm sm:text-lg font-bold text-red-700">{formatCurrency(stats.allTimeTotal)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs text-blue-600 font-medium">Gelir İşlem</p>
                <p className="text-sm sm:text-lg font-bold text-blue-700">{stats.monthlyIncomeCount || 0} adet</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 sm:p-4">
                <p className="text-xs text-purple-600 font-medium">Gider İşlem</p>
                <p className="text-sm sm:text-lg font-bold text-purple-700">{stats.monthlyCount} adet</p>
              </div>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Son 7 Gün */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Son 7 Gün</h3>
                {stats.dailyData && stats.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} width={40} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Toplam']}
                        labelFormatter={(label) => `Tarih: ${label}`}
                      />
                      <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    Henüz veri yok
                  </div>
                )}
              </div>

              {/* Kategori Dağılımı */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Kategori Dağılımı</h3>
                {stats.categoryStats && stats.categoryStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.categoryStats}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percent }) => `${(name || '').substring(0, 6)} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {stats.categoryStats.map((entry, index) => (
                          <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    Henüz veri yok
                  </div>
                )}
              </div>
            </div>

            {/* Son İşlemler - Gelir ve Gider */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Son Giderler */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Son Giderler
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {!stats.recentExpenses || stats.recentExpenses.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Henüz gider yok</p>
                  ) : (
                    stats.recentExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-2 sm:p-3 bg-red-50 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 text-sm sm:text-base truncate">{expense.recipient}</p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {expense.category} • {format(new Date(expense.date), 'd MMM yyyy', { locale: tr })}
                          </p>
                        </div>
                        <p className="font-semibold text-red-600 text-sm sm:text-base shrink-0 ml-2">-{formatCurrency(expense.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Son Gelirler */}
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Son Gelirler
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {!stats.recentIncomes || stats.recentIncomes.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Henüz gelir yok</p>
                  ) : (
                    stats.recentIncomes.map((income: any) => (
                      <div
                        key={income.id}
                        className="flex items-center justify-between p-2 sm:p-3 bg-emerald-50 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 text-sm sm:text-base truncate">{income.sender}</p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {income.category} • {format(new Date(income.date), 'd MMM yyyy', { locale: tr })}
                          </p>
                        </div>
                        <p className="font-semibold text-emerald-600 text-sm sm:text-base shrink-0 ml-2">+{formatCurrency(income.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Banka Dağılımı */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Banka Dağılımı (Giderler)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {!stats.bankStats || stats.bankStats.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 col-span-full">Henüz işlem yok</p>
                ) : (
                  stats.bankStats.map((bank, index) => (
                    <div
                      key={bank.bank}
                      className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 text-sm sm:text-base">{bank.bank}</p>
                          <p className="text-xs sm:text-sm text-gray-500">{bank.count} işlem</p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm sm:text-base shrink-0 ml-2">{formatCurrency(bank.total)}</p>
                    </div>
                  ))
                )}
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
