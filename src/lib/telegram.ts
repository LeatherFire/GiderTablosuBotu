import { Telegraf } from 'telegraf'
import { analyzeReceipt, ParsedReceipt } from './gemini'
import { prisma } from './prisma'
import { uploadReceipt } from './cloudinary'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '')

const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

const RECEIPTS_FOLDER = process.env.RECEIPTS_FOLDER || './receipts'

// Cloudinary aktif mi kontrol et
const USE_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

// Yetkili kullanıcı kontrolü
function isAllowedUser(userId: number): boolean {
  if (ALLOWED_USERS.length === 0) return true
  return ALLOWED_USERS.includes(userId.toString())
}

// Para formatı
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Kullanıcı bul veya oluştur
async function findUser(telegramUserId: number) {
  let user = await prisma.user.findFirst({
    where: { telegramId: telegramUserId.toString() },
  })

  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: 'admin' },
    })
  }

  if (!user) {
    throw new Error('Sistem kullanıcısı bulunamadı')
  }

  return user
}

// GİDER kaydetme fonksiyonu
async function saveExpense(
  result: ParsedReceipt,
  filepath: string,
  receiptType: string,
  userId: number
) {
  const user = await findUser(userId)

  const expense = await prisma.expense.create({
    data: {
      amount: result.amount || 0,
      currency: result.currency || 'TRY',
      recipient: result.recipient || 'Bilinmiyor',
      recipientBank: result.recipientBank,
      recipientIban: result.recipientIban,
      sender: result.sender,
      senderIban: result.senderIban,
      bank: result.bank || 'Bilinmiyor',
      branchCode: result.branchCode,
      branchName: result.branchName,
      accountType: result.accountType,
      accountNumber: result.accountNumber,
      transactionType: result.transactionType,
      transactionId: result.transactionId,
      description: result.description,
      commission: result.commission,
      tax: result.tax,
      totalFee: result.totalFee,
      date: result.date ? new Date(result.date) : new Date(),
      time: result.time,
      category: result.suggestedCategory || 'Diğer',
      receiptPath: filepath,
      receiptType: receiptType,
      aiRawResponse: JSON.stringify(result),
      isManual: false,
      userId: user.id,
    },
  })

  return expense
}

// GELİR kaydetme fonksiyonu
async function saveIncome(
  result: ParsedReceipt,
  filepath: string,
  receiptType: string,
  userId: number
) {
  const user = await findUser(userId)

  const income = await prisma.income.create({
    data: {
      amount: result.amount || 0,
      currency: result.currency || 'TRY',
      sender: result.sender || 'Bilinmiyor',
      senderBank: result.senderBank,
      senderIban: result.senderIban,
      recipient: result.recipient || 'Bilinmiyor',
      recipientBank: result.recipientBank,
      recipientIban: result.recipientIban,
      bank: result.bank || 'Bilinmiyor',
      branchCode: result.branchCode,
      branchName: result.branchName,
      transactionType: result.transactionType,
      transactionId: result.transactionId,
      description: result.description,
      date: result.date ? new Date(result.date) : new Date(),
      time: result.time,
      category: result.suggestedCategory || 'Diğer Gelir',
      receiptPath: filepath,
      receiptType: receiptType,
      aiRawResponse: JSON.stringify(result),
      isManual: false,
      userId: user.id,
    },
  })

  return income
}

// İşlem kaydet (gelir veya gider)
async function saveTransaction(
  result: ParsedReceipt,
  filepath: string,
  receiptType: string,
  userId: number
) {
  if (result.transactionDirection === 'income') {
    return { type: 'income', data: await saveIncome(result, filepath, receiptType, userId) }
  } else {
    return { type: 'expense', data: await saveExpense(result, filepath, receiptType, userId) }
  }
}

// Detaylı onay mesajı oluştur
function createConfirmMessage(result: ParsedReceipt): string {
  const isIncome = result.transactionDirection === 'income'

  let msg = isIncome
    ? `💰 GELİR KAYDEDİLDİ!\n\n`
    : `💸 GİDER KAYDEDİLDİ!\n\n`

  // Ana bilgiler
  const amountIcon = isIncome ? '📥' : '📤'
  msg += `${amountIcon} Tutar: ${formatCurrency(result.amount || 0)}\n`

  if (result.totalFee) {
    msg += `   └ Masraf: ${formatCurrency(result.totalFee)}\n`
  }

  if (isIncome) {
    // Gelir için: Gönderen önemli
    msg += `\n👤 Gönderen: ${result.sender || 'Bilinmiyor'}\n`
    if (result.senderBank) {
      msg += `   └ Banka: ${result.senderBank}\n`
    }
    if (result.senderIban) {
      msg += `   └ IBAN: ${result.senderIban}\n`
    }

    msg += `\n🏦 Alıcı Banka: ${result.bank || 'Bilinmiyor'}\n`
  } else {
    // Gider için: Alıcı önemli
    msg += `\n👤 Alıcı: ${result.recipient || 'Bilinmiyor'}\n`
    if (result.recipientBank) {
      msg += `   └ Banka: ${result.recipientBank}\n`
    }
    if (result.recipientIban) {
      msg += `   └ IBAN: ${result.recipientIban}\n`
    }

    msg += `\n🏦 Gönderen Banka: ${result.bank || 'Bilinmiyor'}\n`
  }

  if (result.branchName) {
    msg += `   └ Şube: ${result.branchName}\n`
  }
  if (result.branchCode) {
    msg += `   └ Şube Kodu: ${result.branchCode}\n`
  }

  if (result.transactionType) {
    msg += `\n📋 İşlem Türü: ${result.transactionType}\n`
  }
  if (result.transactionId) {
    msg += `   └ Referans No: ${result.transactionId}\n`
  }

  const defaultCategory = isIncome ? 'Diğer Gelir' : 'Diğer'
  msg += `\n📁 Kategori: ${result.suggestedCategory || defaultCategory}\n`

  if (result.date) {
    const dateStr = new Date(result.date).toLocaleDateString('tr-TR')
    msg += `📅 Tarih: ${dateStr}`
    if (result.time) {
      msg += ` ${result.time}`
    }
    msg += '\n'
  }

  if (result.description) {
    msg += `📝 Açıklama: ${result.description}\n`
  }

  return msg
}

// Start komutu
bot.start(async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  await ctx.reply(
    `👋 Merhaba! Gelir-Gider Tablosu botuna hoş geldiniz.\n\n` +
    `📸 Bana bir dekont/makbuz görseli veya PDF gönderin, otomatik olarak analiz edip sisteme ekleyeyim.\n\n` +
    `🤖 AI otomatik olarak gelir mi gider mi tespit eder!\n\n` +
    `📋 Komutlar:\n` +
    `/start - Başlangıç\n` +
    `/help - Yardım\n` +
    `/ozet - Aylık gelir-gider özeti\n` +
    `/gelir - Bu ayki gelirler\n` +
    `/gider - Bu ayki giderler\n` +
    `/bakiye - Net bakiye\n` +
    `/son - Son 5 işlem\n` +
    `/id - Telegram ID'nizi öğrenin`
  )
})

// Help komutu
bot.help(async (ctx) => {
  await ctx.reply(
    `📖 Kullanım Kılavuzu\n\n` +
    `1️⃣ Dekont görselini veya PDF'i bu bota gönderin\n` +
    `2️⃣ AI görseli analiz eder ve gelir/gider otomatik tespit eder:\n` +
    `   • "Gelen EFT/Havale" → 💰 GELİR\n` +
    `   • "Giden EFT/Havale" → 💸 GİDER\n` +
    `3️⃣ Tüm bilgiler (tutar, alıcı, banka vb.) çıkarılır\n` +
    `4️⃣ Size detaylı onay mesajı gönderilir\n\n` +
    `💡 İpucu: Görsel net ve okunaklı olmalı.`
  )
})

// ID komutu
bot.command('id', async (ctx) => {
  const userId = ctx.from?.id
  await ctx.reply(`🆔 Telegram ID'niz: ${userId}`)
})

// Son işlemler komutu (hem gelir hem gider)
bot.command('son', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.income.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ])

    if (expenses.length === 0 && incomes.length === 0) {
      await ctx.reply('📭 Henüz kayıtlı işlem yok.')
      return
    }

    let msg = '📋 Son İşlemler:\n\n'

    if (incomes.length > 0) {
      msg += '💰 Son Gelirler:\n'
      incomes.forEach((i, idx) => {
        const dateStr = i.date.toLocaleDateString('tr-TR')
        msg += `${idx + 1}. +${formatCurrency(i.amount)} - ${i.sender}\n`
        msg += `   ${i.category} | ${dateStr}\n\n`
      })
    }

    if (expenses.length > 0) {
      msg += '💸 Son Giderler:\n'
      expenses.forEach((e, idx) => {
        const dateStr = e.date.toLocaleDateString('tr-TR')
        msg += `${idx + 1}. -${formatCurrency(e.amount)} - ${e.recipient}\n`
        msg += `   ${e.category} | ${dateStr}\n\n`
      })
    }

    await ctx.reply(msg)
  } catch (error) {
    console.error('Son işlemler hatası:', error)
    await ctx.reply('❌ İşlemler alınırken bir hata oluştu.')
  }
})

// Özet komutu (gelir + gider)
bot.command('ozet', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [expenseStats, incomeStats] = await Promise.all([
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.income.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const totalExpense = expenseStats._sum.amount || 0
    const totalIncome = incomeStats._sum.amount || 0
    const netBalance = totalIncome - totalExpense

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })

    let message = `📊 ${monthName} Özeti\n\n`
    message += `💰 Toplam Gelir: ${formatCurrency(totalIncome)}\n`
    message += `   └ ${incomeStats._count} işlem\n\n`
    message += `💸 Toplam Gider: ${formatCurrency(totalExpense)}\n`
    message += `   └ ${expenseStats._count} işlem\n\n`

    const balanceIcon = netBalance >= 0 ? '📈' : '📉'
    const balanceText = netBalance >= 0 ? 'Kâr' : 'Zarar'
    message += `${balanceIcon} Net ${balanceText}: ${formatCurrency(Math.abs(netBalance))}\n`

    await ctx.reply(message)
  } catch (error) {
    console.error('Özet error:', error)
    await ctx.reply('❌ Özet alınırken bir hata oluştu.')
  }
})

// Bakiye komutu
bot.command('bakiye', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [expenseStats, incomeStats] = await Promise.all([
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
    ])

    const totalExpense = expenseStats._sum.amount || 0
    const totalIncome = incomeStats._sum.amount || 0
    const netBalance = totalIncome - totalExpense

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })
    const balanceIcon = netBalance >= 0 ? '✅' : '⚠️'

    await ctx.reply(
      `${balanceIcon} ${monthName} Bakiyesi\n\n` +
      `💰 Gelir: +${formatCurrency(totalIncome)}\n` +
      `💸 Gider: -${formatCurrency(totalExpense)}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📊 Net: ${formatCurrency(netBalance)}`
    )
  } catch (error) {
    console.error('Bakiye error:', error)
    await ctx.reply('❌ Bakiye alınırken bir hata oluştu.')
  }
})

// Gelir komutu
bot.command('gelir', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const stats = await prisma.income.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      _count: true,
    })

    const categoryStats = await prisma.income.groupBy({
      by: ['category'],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })

    let message = `💰 ${monthName} Gelirleri\n\n`
    message += `📥 Toplam: ${formatCurrency(stats._sum.amount || 0)}\n`
    message += `📝 İşlem Sayısı: ${stats._count}\n\n`

    if (categoryStats.length > 0) {
      message += `📈 Kategori Dağılımı:\n`
      categoryStats.forEach((cat, index) => {
        message += `${index + 1}. ${cat.category}: ${formatCurrency(cat._sum.amount || 0)}\n`
      })
    }

    await ctx.reply(message)
  } catch (error) {
    console.error('Gelir error:', error)
    await ctx.reply('❌ Gelir bilgileri alınırken bir hata oluştu.')
  }
})

// Gider komutu (eski stats'ın yerini aldı)
bot.command('gider', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const stats = await prisma.expense.aggregate({
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true, totalFee: true },
      _count: true,
    })

    const categoryStats = await prisma.expense.groupBy({
      by: ['category'],
      where: { date: { gte: monthStart, lte: monthEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })

    let message = `💸 ${monthName} Giderleri\n\n`
    message += `📤 Toplam: ${formatCurrency(stats._sum.amount || 0)}\n`
    if (stats._sum.totalFee) {
      message += `💳 Toplam Masraf: ${formatCurrency(stats._sum.totalFee)}\n`
    }
    message += `📝 İşlem Sayısı: ${stats._count}\n\n`

    if (categoryStats.length > 0) {
      message += `📈 En Çok Harcanan Kategoriler:\n`
      categoryStats.forEach((cat, index) => {
        message += `${index + 1}. ${cat.category}: ${formatCurrency(cat._sum.amount || 0)}\n`
      })
    }

    await ctx.reply(message)
  } catch (error) {
    console.error('Gider error:', error)
    await ctx.reply('❌ Gider bilgileri alınırken bir hata oluştu.')
  }
})

// Stats komutu (ozet'e yönlendir)
bot.command('stats', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  // ozet komutuyla aynı işlevi görsün
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [expenseStats, incomeStats] = await Promise.all([
      prisma.expense.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.income.aggregate({
        where: { date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const totalExpense = expenseStats._sum.amount || 0
    const totalIncome = incomeStats._sum.amount || 0
    const netBalance = totalIncome - totalExpense

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })

    let message = `📊 ${monthName} Özeti\n\n`
    message += `💰 Toplam Gelir: ${formatCurrency(totalIncome)}\n`
    message += `   └ ${incomeStats._count} işlem\n\n`
    message += `💸 Toplam Gider: ${formatCurrency(totalExpense)}\n`
    message += `   └ ${expenseStats._count} işlem\n\n`

    const balanceIcon = netBalance >= 0 ? '📈' : '📉'
    const balanceText = netBalance >= 0 ? 'Kâr' : 'Zarar'
    message += `${balanceIcon} Net ${balanceText}: ${formatCurrency(Math.abs(netBalance))}\n`

    await ctx.reply(message)
  } catch (error) {
    console.error('Stats error:', error)
    await ctx.reply('❌ İstatistikler alınırken bir hata oluştu.')
  }
})

// Fotoğraf işleme
bot.on('photo', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  await ctx.reply('🔍 Dekont analiz ediliyor...')

  try {
    const photos = ctx.message.photo
    const photo = photos[photos.length - 1]

    const file = await ctx.telegram.getFile(photo.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    const response = await fetch(fileUrl)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const result = await analyzeReceipt(base64, 'image/jpeg')

    if (!result.amount && !result.recipient && !result.sender) {
      await ctx.reply(
        '⚠️ Dekont okunamadı veya geçersiz görüntü.\n\n' +
        'Lütfen daha net bir görsel gönderin.'
      )
      return
    }

    const timestamp = Date.now()
    const filename = `receipt_${timestamp}`
    let receiptPath: string

    if (USE_CLOUDINARY) {
      const uploadResult = await uploadReceipt(Buffer.from(buffer), filename)
      receiptPath = uploadResult.url
    } else {
      if (!existsSync(RECEIPTS_FOLDER)) {
        await mkdir(RECEIPTS_FOLDER, { recursive: true })
      }
      const localPath = join(RECEIPTS_FOLDER, `${filename}.jpg`)
      await writeFile(localPath, Buffer.from(buffer))
      receiptPath = localPath
    }

    // Gelir veya gider olarak kaydet
    await saveTransaction(result, receiptPath, 'jpg', userId)
    await ctx.reply(createConfirmMessage(result))

  } catch (error) {
    console.error('Photo processing error:', error)
    await ctx.reply('❌ Dekont işlenirken bir hata oluştu. Lütfen tekrar deneyin.')
  }
})

// Dokuman işleme (PDF ve görseller)
bot.on('document', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  const document = ctx.message.document
  const mimeType = document.mime_type || ''

  const isImage = mimeType.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'

  if (!isImage && !isPdf) {
    await ctx.reply('⚠️ Sadece görsel (JPEG, PNG) ve PDF dosyaları kabul edilmektedir.')
    return
  }

  await ctx.reply('🔍 Dekont analiz ediliyor...')

  try {
    const file = await ctx.telegram.getFile(document.file_id)
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

    const response = await fetch(fileUrl)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const result = await analyzeReceipt(base64, mimeType)

    if (!result.amount && !result.recipient && !result.sender) {
      await ctx.reply('⚠️ Dekont okunamadı. Lütfen daha net bir görsel gönderin.')
      return
    }

    const timestamp = Date.now()
    const ext = isPdf ? 'pdf' : (mimeType.split('/')[1] || 'jpg')
    const filename = `receipt_${timestamp}`
    let receiptPath: string

    if (USE_CLOUDINARY) {
      const uploadResult = await uploadReceipt(Buffer.from(buffer), filename)
      receiptPath = uploadResult.url
    } else {
      if (!existsSync(RECEIPTS_FOLDER)) {
        await mkdir(RECEIPTS_FOLDER, { recursive: true })
      }
      const localPath = join(RECEIPTS_FOLDER, `${filename}.${ext}`)
      await writeFile(localPath, Buffer.from(buffer))
      receiptPath = localPath
    }

    // Gelir veya gider olarak kaydet
    await saveTransaction(result, receiptPath, ext, userId)
    await ctx.reply(createConfirmMessage(result))

  } catch (error) {
    console.error('Document processing error:', error)
    await ctx.reply('❌ Dekont işlenirken bir hata oluştu.')
  }
})

// Diğer mesajlar
bot.on('text', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  await ctx.reply(
    '📸 Lütfen bir dekont/makbuz görseli veya PDF gönderin.\n\n' +
    'Yardım için /help yazın.'
  )
})

export { bot }

let botRunning = false

export async function startBot() {
  try {
    botRunning = true
    await bot.launch()
    console.log('Telegram bot başlatıldı')
  } catch (error) {
    console.error('Bot başlatma hatası:', error)
    botRunning = false
  }
}

process.once('SIGINT', () => {
  if (botRunning) bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
  if (botRunning) bot.stop('SIGTERM')
})
