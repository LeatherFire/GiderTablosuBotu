'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useSession } from 'next-auth/react'

interface Income {
  id: string
  amount: number
  currency: string
  sender: string
  senderBank: string | null
  senderIban: string | null
  recipient: string
  recipientBank: string | null
  recipientIban: string | null
  bank: string
  branchCode: string | null
  branchName: string | null
  transactionType: string | null
  transactionId: string | null
  category: string
  description: string | null
  date: string
  time: string | null
  receiptPath: string | null
  receiptType: string | null
  isManual: boolean
  user: { name: string }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const INCOME_CATEGORIES = [
  { name: 'Satış Geliri', color: '#10B981' },
  { name: 'Hizmet Geliri', color: '#059669' },
  { name: 'Kira Geliri', color: '#047857' },
  { name: 'Faiz Geliri', color: '#065F46' },
  { name: 'İade', color: '#6366F1' },
  { name: 'Diğer Gelir', color: '#6B7280' },
]

export default function IncomesPage() {
  const { data: session } = useSession()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchIncomes()
  }, [pagination.page, search, categoryFilter, bankFilter, startDate, endDate])

  const fetchIncomes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (bankFilter) params.set('bank', bankFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/incomes?${params}`)
      const data = await res.json()
      setIncomes(data.incomes)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching incomes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu geliri silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/incomes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchIncomes()
        setSelectedIncome(null)
      } else {
        alert('Silme işlemi başarısız')
      }
    } catch (error) {
      console.error('Error deleting income:', error)
      alert('Bir hata oluştu')
    }
  }

  const getCategoryColor = (categoryName: string) => {
    const category = INCOME_CATEGORIES.find((c) => c.name === categoryName)
    return category?.color || '#10B981'
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setBankFilter('')
    setStartDate('')
    setEndDate('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const openDetail = (income: Income) => {
    setSelectedIncome(income)
  }

  const openReceipt = (income: Income) => {
    setSelectedIncome(income)
    setShowReceiptModal(true)
  }

  const hasActiveFilters = search || categoryFilter || bankFilter || startDate || endDate

  return (
    <AuthGuard>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Gelirler</h1>
            <p className="text-sm sm:text-base text-gray-600">Tüm gelir kayıtları</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors sm:hidden ${
                hasActiveFilters ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-gray-300 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtre
              {hasActiveFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
            </button>
          </div>
        </div>

        {/* Filtreler - Desktop her zaman görünür, mobilde toggle */}
        <div className={`bg-white rounded-xl shadow-sm p-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ara</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gönderen, açıklama..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              >
                <option value="">Tümü</option>
                {INCOME_CATEGORIES.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Temizle
              </button>
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : incomes.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="mt-4 text-gray-500">Henüz gelir kaydı yok</p>
              <p className="mt-2 text-sm text-gray-400">
                Telegram botuna dekont göndererek gelir ekleyebilirsiniz
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Tablo */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-emerald-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Tarih
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Gönderen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Banka
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        İşlem
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Tutar
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        Dekont
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider">

                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {incomes.map((income) => (
                      <tr
                        key={income.id}
                        className="hover:bg-emerald-50/50 cursor-pointer"
                        onClick={() => openDetail(income)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {format(new Date(income.date), 'd MMM yyyy', { locale: tr })}
                            {income.time && (
                              <span className="text-gray-500 text-xs block">{income.time}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{income.sender}</p>
                            {income.senderBank && (
                              <p className="text-xs text-gray-500">{income.senderBank}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${getCategoryColor(income.category)}20`,
                              color: getCategoryColor(income.category),
                            }}
                          >
                            {income.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{income.bank}</p>
                            {income.branchName && (
                              <p className="text-xs text-gray-500">{income.branchName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            {income.transactionType && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                                {income.transactionType}
                              </span>
                            )}
                            {income.transactionId && (
                              <p className="text-xs text-gray-400 mt-1 font-mono">{income.transactionId}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-sm font-semibold text-emerald-600">
                            +{formatCurrency(income.amount)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {income.receiptPath ? (
                            <button
                              onClick={() => openReceipt(income)}
                              className="text-emerald-600 hover:text-emerald-800"
                              title="Dekontu Görüntüle"
                            >
                              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={(e) => e.stopPropagation()}>
                          {session?.user.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(income.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Kartlar */}
              <div className="lg:hidden divide-y divide-gray-200">
                {incomes.map((income) => (
                  <div
                    key={income.id}
                    className="p-4 hover:bg-emerald-50/50 cursor-pointer"
                    onClick={() => openDetail(income)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{income.sender}</p>
                        <p className="text-sm text-gray-500">
                          {income.senderBank || income.bank}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-emerald-600">+{formatCurrency(income.amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${getCategoryColor(income.category)}20`,
                            color: getCategoryColor(income.category),
                          }}
                        >
                          {income.category}
                        </span>
                        {income.transactionType && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                            {income.transactionType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs">
                          {format(new Date(income.date), 'd MMM', { locale: tr })}
                        </span>
                        {income.receiptPath && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openReceipt(income)
                            }}
                            className="text-emerald-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}
                        {session?.user.role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(income.id)
                            }}
                            className="text-red-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-gray-500">
                    Toplam {pagination.total} kayıt
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Önceki
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detay Modal */}
      {selectedIncome && !showReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">Gelir Detayı</h2>
                <button
                  onClick={() => setSelectedIncome(null)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* Ana Bilgiler */}
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <p className="text-sm text-emerald-600">Tutar</p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-700">+{formatCurrency(selectedIncome.amount)}</p>
                    </div>
                    <span
                      className="inline-flex px-3 py-1 text-sm font-medium rounded-full self-start"
                      style={{
                        backgroundColor: `${getCategoryColor(selectedIncome.category)}20`,
                        color: getCategoryColor(selectedIncome.category),
                      }}
                    >
                      {selectedIncome.category}
                    </span>
                  </div>
                </div>

                {/* Gönderen Bilgileri */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Gönderen Bilgileri</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm">Ad:</span>
                      <span className="font-medium">{selectedIncome.sender}</span>
                    </div>
                    {selectedIncome.senderBank && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Banka:</span>
                        <span className="font-medium">{selectedIncome.senderBank}</span>
                      </div>
                    )}
                    {selectedIncome.senderIban && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">IBAN:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedIncome.senderIban}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alıcı Bilgileri */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Alıcı Bilgileri</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {selectedIncome.recipient && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Ad:</span>
                        <span className="font-medium">{selectedIncome.recipient}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm">Banka:</span>
                      <span className="font-medium">{selectedIncome.bank}</span>
                    </div>
                    {selectedIncome.branchName && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Şube:</span>
                        <span className="font-medium">{selectedIncome.branchName}</span>
                      </div>
                    )}
                    {selectedIncome.branchCode && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Şube Kodu:</span>
                        <span className="font-mono">{selectedIncome.branchCode}</span>
                      </div>
                    )}
                    {selectedIncome.recipientIban && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">IBAN:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedIncome.recipientIban}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* İşlem Detayları */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">İşlem Detayları</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm">Tarih:</span>
                      <span className="font-medium">
                        {format(new Date(selectedIncome.date), 'd MMMM yyyy', { locale: tr })}
                        {selectedIncome.time && ` - ${selectedIncome.time}`}
                      </span>
                    </div>
                    {selectedIncome.transactionType && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">İşlem Türü:</span>
                        <span className="font-medium">{selectedIncome.transactionType}</span>
                      </div>
                    )}
                    {selectedIncome.transactionId && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Referans No:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedIncome.transactionId}</span>
                      </div>
                    )}
                    {selectedIncome.description && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Açıklama:</span>
                        <span className="font-medium">{selectedIncome.description}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dekont Butonu */}
                {selectedIncome.receiptPath && (
                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Dekontu Görüntüle
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dekont Modal */}
      {showReceiptModal && selectedIncome && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 border-b flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Dekont</h2>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/receipts/income/${selectedIncome.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-800 p-2"
                  title="Yeni sekmede aç"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={() => {
                    setShowReceiptModal(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-100">
              {selectedIncome.receiptType === 'pdf' ? (
                <iframe
                  src={`/api/receipts/income/${selectedIncome.id}`}
                  className="w-full h-full min-h-[400px] sm:min-h-[600px] rounded-lg"
                  title="Dekont PDF"
                />
              ) : (
                <img
                  src={`/api/receipts/income/${selectedIncome.id}`}
                  alt="Dekont"
                  className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  )
}
