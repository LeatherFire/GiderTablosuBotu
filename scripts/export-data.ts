import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function exportData() {
  console.log('📦 Veri export işlemi başlıyor...\n')

  const backupDir = join(process.cwd(), 'backup')

  // Backup klasörünü oluştur
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  try {
    // 1. Users export
    console.log('👤 Kullanıcılar export ediliyor...')
    const users = await prisma.user.findMany({
      include: { expenses: false }
    })
    const usersFile = join(backupDir, `users_${timestamp}.json`)
    await writeFile(usersFile, JSON.stringify(users, null, 2), 'utf-8')
    console.log(`   ✅ ${users.length} kullanıcı → ${usersFile}`)

    // 2. Categories export
    console.log('\n📁 Kategoriler export ediliyor...')
    const categories = await prisma.category.findMany()
    const categoriesFile = join(backupDir, `categories_${timestamp}.json`)
    await writeFile(categoriesFile, JSON.stringify(categories, null, 2), 'utf-8')
    console.log(`   ✅ ${categories.length} kategori → ${categoriesFile}`)

    // 3. Expenses export
    console.log('\n💰 Giderler export ediliyor...')
    const expenses = await prisma.expense.findMany({
      include: { user: { select: { username: true, name: true } } }
    })
    const expensesFile = join(backupDir, `expenses_${timestamp}.json`)
    await writeFile(expensesFile, JSON.stringify(expenses, null, 2), 'utf-8')
    console.log(`   ✅ ${expenses.length} gider → ${expensesFile}`)

    // 4. Dekont dosya listesi
    console.log('\n📎 Dekont dosyaları listeleniyor...')
    const receiptsWithPaths = expenses
      .filter(e => e.receiptPath)
      .map(e => ({
        expenseId: e.id,
        recipient: e.recipient,
        amount: e.amount,
        receiptPath: e.receiptPath,
        receiptType: e.receiptType
      }))
    const receiptsListFile = join(backupDir, `receipts_list_${timestamp}.json`)
    await writeFile(receiptsListFile, JSON.stringify(receiptsWithPaths, null, 2), 'utf-8')
    console.log(`   ✅ ${receiptsWithPaths.length} dekont kaydı → ${receiptsListFile}`)

    // Özet
    console.log('\n' + '='.repeat(50))
    console.log('📊 EXPORT ÖZETİ')
    console.log('='.repeat(50))
    console.log(`   Kullanıcılar: ${users.length}`)
    console.log(`   Kategoriler:  ${categories.length}`)
    console.log(`   Giderler:     ${expenses.length}`)
    console.log(`   Dekontlar:    ${receiptsWithPaths.length}`)
    console.log(`\n   📂 Backup klasörü: ${backupDir}`)
    console.log('\n✅ Export tamamlandı!')

  } catch (error) {
    console.error('❌ Export hatası:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

exportData()
