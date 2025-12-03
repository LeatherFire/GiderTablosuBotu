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

// Dekont kaydetme fonksiyonu
async function saveExpense(
  result: ParsedReceipt,
  filepath: string,
  receiptType: string,
  userId: number
) {
  let user = await prisma.user.findFirst({
    where: { telegramId: userId.toString() },
  })

  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: 'admin' },
    })
  }

  if (!user) {
    throw new Error('Sistem kullanıcısı bulunamadı')
  }

  const expense = await prisma.expense.create({
    data: {
      // Tutar
      amount: result.amount || 0,
      currency: result.currency || 'TRY',

      // Alıcı Bilgileri
      recipient: result.recipient || 'Bilinmiyor',
      recipientBank: result.recipientBank,
      recipientIban: result.recipientIban,

      // Gönderen Bilgileri
      sender: result.sender,
      senderIban: result.senderIban,

      // Banka/Şube Bilgileri
      bank: result.bank || 'Bilinmiyor',
      branchCode: result.branchCode,
      branchName: result.branchName,

      // Hesap Bilgileri
      accountType: result.accountType,
      accountNumber: result.accountNumber,

      // İşlem Detayları
      transactionType: result.transactionType,
      transactionId: result.transactionId,
      description: result.description,

      // Masraflar
      commission: result.commission,
      tax: result.tax,
      totalFee: result.totalFee,

      // Tarih/Saat
      date: result.date ? new Date(result.date) : new Date(),
      time: result.time,

      // Kategori ve Dosya
      category: result.suggestedCategory || 'Diğer',
      receiptPath: filepath,
      receiptType: receiptType,

      // Meta
      aiRawResponse: JSON.stringify(result),
      isManual: false,
      userId: user.id,
    },
  })

  return expense
}

// Detaylı onay mesajı oluştur
function createConfirmMessage(result: ParsedReceipt): string {
  let msg = `✅ Gider kaydedildi!\n\n`

  // Ana bilgiler
  msg += `💰 Tutar: ${formatCurrency(result.amount || 0)}\n`

  if (result.totalFee) {
    msg += `   └ Masraf: ${formatCurrency(result.totalFee)}\n`
  }

  msg += `\n👤 Alıcı: ${result.recipient || 'Bilinmiyor'}\n`
  if (result.recipientBank) {
    msg += `   └ Banka: ${result.recipientBank}\n`
  }
  if (result.recipientIban) {
    msg += `   └ IBAN: ${result.recipientIban}\n`
  }

  msg += `\n🏦 Gönderen Banka: ${result.bank || 'Bilinmiyor'}\n`
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

  msg += `\n📁 Kategori: ${result.suggestedCategory || 'Diğer'}\n`

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
    `👋 Merhaba! Gider Tablosu botuna hoş geldiniz.\n\n` +
    `📸 Bana bir dekont/makbuz görseli veya PDF gönderin, otomatik olarak analiz edip sisteme ekleyeyim.\n\n` +
    `📋 Komutlar:\n` +
    `/start - Başlangıç\n` +
    `/help - Yardım\n` +
    `/stats - Bu ayki özet\n` +
    `/son - Son 5 işlem\n` +
    `/id - Telegram ID'nizi öğrenin`
  )
})

// Help komutu
bot.help(async (ctx) => {
  await ctx.reply(
    `📖 Kullanım Kılavuzu\n\n` +
    `1️⃣ WhatsApp'tan aldığınız dekont görselini veya PDF'i bu bota gönderin\n` +
    `2️⃣ Bot görseli AI ile analiz eder\n` +
    `3️⃣ Tüm bilgiler (tutar, alıcı, banka, şube, komisyon vb.) çıkarılır\n` +
    `4️⃣ Size detaylı onay mesajı gönderilir\n\n` +
    `💡 İpucu: Görsel net ve okunaklı olmalı.`
  )
})

// ID komutu
bot.command('id', async (ctx) => {
  const userId = ctx.from?.id
  await ctx.reply(`🆔 Telegram ID'niz: ${userId}`)
})

// Son işlemler komutu
bot.command('son', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId || !isAllowedUser(userId)) {
    await ctx.reply('⛔ Bu botu kullanma yetkiniz yok.')
    return
  }

  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    if (expenses.length === 0) {
      await ctx.reply('📭 Henüz kayıtlı gider yok.')
      return
    }

    let msg = '📋 Son 5 İşlem:\n\n'
    expenses.forEach((e, i) => {
      const dateStr = e.date.toLocaleDateString('tr-TR')
      msg += `${i + 1}. ${formatCurrency(e.amount)} - ${e.recipient}\n`
      msg += `   ${e.bank} | ${e.category} | ${dateStr}\n\n`
    })

    await ctx.reply(msg)
  } catch (error) {
    console.error('Son işlemler hatası:', error)
    await ctx.reply('❌ İşlemler alınırken bir hata oluştu.')
  }
})

// Stats komutu
bot.command('stats', async (ctx) => {
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
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true, totalFee: true },
      _count: true,
    })

    const categoryStats = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: 5,
    })

    const monthName = now.toLocaleString('tr-TR', { month: 'long' })

    let message = `📊 ${monthName} Özeti\n\n`
    message += `💰 Toplam: ${formatCurrency(stats._sum.amount || 0)}\n`
    if (stats._sum.totalFee) {
      message += `💸 Toplam Masraf: ${formatCurrency(stats._sum.totalFee)}\n`
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

    if (!result.amount && !result.recipient) {
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
      // Cloudinary'ye yükle
      const uploadResult = await uploadReceipt(Buffer.from(buffer), filename)
      receiptPath = uploadResult.url
    } else {
      // Local'e kaydet (fallback)
      if (!existsSync(RECEIPTS_FOLDER)) {
        await mkdir(RECEIPTS_FOLDER, { recursive: true })
      }
      const localPath = join(RECEIPTS_FOLDER, `${filename}.jpg`)
      await writeFile(localPath, Buffer.from(buffer))
      receiptPath = localPath
    }

    await saveExpense(result, receiptPath, 'jpg', userId)
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

    if (!result.amount && !result.recipient) {
      await ctx.reply('⚠️ Dekont okunamadı. Lütfen daha net bir görsel gönderin.')
      return
    }

    const timestamp = Date.now()
    const ext = isPdf ? 'pdf' : (mimeType.split('/')[1] || 'jpg')
    const filename = `receipt_${timestamp}`
    let receiptPath: string

    if (USE_CLOUDINARY) {
      // Cloudinary'ye yükle
      const uploadResult = await uploadReceipt(Buffer.from(buffer), filename)
      receiptPath = uploadResult.url
    } else {
      // Local'e kaydet (fallback)
      if (!existsSync(RECEIPTS_FOLDER)) {
        await mkdir(RECEIPTS_FOLDER, { recursive: true })
      }
      const localPath = join(RECEIPTS_FOLDER, `${filename}.${ext}`)
      await writeFile(localPath, Buffer.from(buffer))
      receiptPath = localPath
    }

    await saveExpense(result, receiptPath, ext, userId)
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
