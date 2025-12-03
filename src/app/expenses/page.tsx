'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

interface Expense {
  id: string
  amount: number
  currency: string
  recipient: string
  recipientBank: string | null
  recipientIban: string | null
  sender: string | null
  senderIban: string | null
  bank: string
  branchCode: string | null
  branchName: string | null
  transactionType: string | null
  transactionId: string | null
  category: string
  description: string | null
  date: string
  time: string | null
  commission: number | null
  tax: number | null
  totalFee: number | null
  receiptPath: string | null
  receiptType: string | null
  isManual: boolean
  user: { name: string }
}

interface Category {
  id: string
  name: string
  color: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ExpensesPage() {
  const { data: session } = useSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
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
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [pagination.page, search, categoryFilter, bankFilter, startDate, endDate])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchExpenses = async () => {
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

      const res = await fetch(`/api/expenses?${params}`)
      const data = await res.json()
      setExpenses(data.expenses)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu gideri silmek istediğinizden emin misiniz?')) return

    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchExpenses()
        setSelectedExpense(null)
      } else {
        alert('Silme işlemi başarısız')
      }
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Bir hata oluştu')
    }
  }

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName)
    return category?.color || '#6B7280'
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('')
    setBankFilter('')
    setStartDate('')
    setEndDate('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const openDetail = (expense: Expense) => {
    setSelectedExpense(expense)
  }

  const openReceipt = (expense: Expense) => {
    setSelectedExpense(expense)
    setShowReceiptModal(true)
  }

  const hasActiveFilters = search || categoryFilter || bankFilter || startDate || endDate

  return (
    <AuthGuard>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Giderler</h1>
            <p className="text-sm sm:text-base text-gray-600">Tüm gider kayıtları</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors sm:hidden ${
                hasActiveFilters ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtre
              {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
            </button>
            <Link
              href="/add"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Yeni Gider</span>
              <span className="sm:hidden">Ekle</span>
            </Link>
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
                placeholder="Alıcı, açıklama..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Tümü</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : expenses.length === 0 ? (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="mt-4 text-gray-500">Henüz gider kaydı yok</p>
              <Link
                href="/add"
                className="mt-4 inline-block text-blue-600 hover:text-blue-700"
              >
                İlk gideri ekle →
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Tablo */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarih
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Alıcı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kategori
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Banka / Şube
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        İşlem
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tutar
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dekont
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">

                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => openDetail(expense)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {format(new Date(expense.date), 'd MMM yyyy', { locale: tr })}
                            {expense.time && (
                              <span className="text-gray-500 text-xs block">{expense.time}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{expense.recipient}</p>
                            {expense.recipientBank && (
                              <p className="text-xs text-gray-500">{expense.recipientBank}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${getCategoryColor(expense.category)}20`,
                              color: getCategoryColor(expense.category),
                            }}
                          >
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm text-gray-900">{expense.bank}</p>
                            {expense.branchName && (
                              <p className="text-xs text-gray-500">{expense.branchName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            {expense.transactionType && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                {expense.transactionType}
                              </span>
                            )}
                            {expense.transactionId && (
                              <p className="text-xs text-gray-400 mt-1 font-mono">{expense.transactionId}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(expense.amount)}
                          </p>
                          {expense.totalFee && expense.totalFee > 0 && (
                            <p className="text-xs text-gray-500">
                              +{formatCurrency(expense.totalFee)} masraf
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {expense.receiptPath ? (
                            <button
                              onClick={() => openReceipt(expense)}
                              className="text-blue-600 hover:text-blue-800"
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
                              onClick={() => handleDelete(expense.id)}
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
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => openDetail(expense)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{expense.recipient}</p>
                        <p className="text-sm text-gray-500">
                          {expense.bank}
                          {expense.recipientBank && ` → ${expense.recipientBank}`}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</p>
                        {expense.totalFee && expense.totalFee > 0 && (
                          <p className="text-xs text-gray-500">+{formatCurrency(expense.totalFee)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${getCategoryColor(expense.category)}20`,
                            color: getCategoryColor(expense.category),
                          }}
                        >
                          {expense.category}
                        </span>
                        {expense.transactionType && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                            {expense.transactionType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs">
                          {format(new Date(expense.date), 'd MMM', { locale: tr })}
                        </span>
                        {expense.receiptPath && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openReceipt(expense)
                            }}
                            className="text-blue-600"
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
                              handleDelete(expense.id)
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
      {selectedExpense && !showReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">Gider Detayı</h2>
                <button
                  onClick={() => setSelectedExpense(null)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* Ana Bilgiler */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div>
                      <p className="text-sm text-blue-600">Tutar</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-700">{formatCurrency(selectedExpense.amount)}</p>
                      {selectedExpense.totalFee && selectedExpense.totalFee > 0 && (
                        <p className="text-sm text-blue-600">+ {formatCurrency(selectedExpense.totalFee)} masraf</p>
                      )}
                    </div>
                    <span
                      className="inline-flex px-3 py-1 text-sm font-medium rounded-full self-start"
                      style={{
                        backgroundColor: `${getCategoryColor(selectedExpense.category)}20`,
                        color: getCategoryColor(selectedExpense.category),
                      }}
                    >
                      {selectedExpense.category}
                    </span>
                  </div>
                </div>

                {/* Alıcı Bilgileri */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Alıcı Bilgileri</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm">Ad:</span>
                      <span className="font-medium">{selectedExpense.recipient}</span>
                    </div>
                    {selectedExpense.recipientBank && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Banka:</span>
                        <span className="font-medium">{selectedExpense.recipientBank}</span>
                      </div>
                    )}
                    {selectedExpense.recipientIban && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">IBAN:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedExpense.recipientIban}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gönderen Bilgileri */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Gönderen Bilgileri</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {selectedExpense.sender && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Ad:</span>
                        <span className="font-medium">{selectedExpense.sender}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm">Banka:</span>
                      <span className="font-medium">{selectedExpense.bank}</span>
                    </div>
                    {selectedExpense.branchName && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Şube:</span>
                        <span className="font-medium">{selectedExpense.branchName}</span>
                      </div>
                    )}
                    {selectedExpense.branchCode && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Şube Kodu:</span>
                        <span className="font-mono">{selectedExpense.branchCode}</span>
                      </div>
                    )}
                    {selectedExpense.senderIban && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">IBAN:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedExpense.senderIban}</span>
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
                        {format(new Date(selectedExpense.date), 'd MMMM yyyy', { locale: tr })}
                        {selectedExpense.time && ` - ${selectedExpense.time}`}
                      </span>
                    </div>
                    {selectedExpense.transactionType && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">İşlem Türü:</span>
                        <span className="font-medium">{selectedExpense.transactionType}</span>
                      </div>
                    )}
                    {selectedExpense.transactionId && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Referans No:</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{selectedExpense.transactionId}</span>
                      </div>
                    )}
                    {selectedExpense.description && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm">Açıklama:</span>
                        <span className="font-medium">{selectedExpense.description}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Masraflar */}
                {(selectedExpense.commission || selectedExpense.tax || selectedExpense.totalFee) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Masraflar</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {selectedExpense.commission && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 text-sm">Komisyon:</span>
                          <span className="font-medium">{formatCurrency(selectedExpense.commission)}</span>
                        </div>
                      )}
                      {selectedExpense.tax && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 text-sm">BSMV:</span>
                          <span className="font-medium">{formatCurrency(selectedExpense.tax)}</span>
                        </div>
                      )}
                      {selectedExpense.totalFee && (
                        <div className="flex justify-between border-t pt-2 mt-2">
                          <span className="text-gray-600 font-medium text-sm">Toplam Masraf:</span>
                          <span className="font-bold">{formatCurrency(selectedExpense.totalFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dekont Butonu */}
                {selectedExpense.receiptPath && (
                  <button
                    onClick={() => setShowReceiptModal(true)}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
      {showReceiptModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 border-b flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Dekont</h2>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/receipts/${selectedExpense.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 p-2"
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
              {selectedExpense.receiptType === 'pdf' ? (
                <iframe
                  src={`/api/receipts/${selectedExpense.id}`}
                  className="w-full h-full min-h-[400px] sm:min-h-[600px] rounded-lg"
                  title="Dekont PDF"
                />
              ) : (
                <img
                  src={`/api/receipts/${selectedExpense.id}`}
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
