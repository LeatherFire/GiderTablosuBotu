import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { readdirSync } from 'fs'

const prisma = new PrismaClient()

interface UserData {
  id: string
  username: string
  password: string
  name: string
  role: string
  telegramId: string | null
  createdAt: string
  updatedAt: string
}

interface CategoryData {
  id: string
  name: string
  color: string
  createdAt: string
}

interface ExpenseData {
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
  accountType: string | null
  accountNumber: string | null
  transactionType: string | null
  transactionId: string | null
  description: string | null
  commission: number | null
  tax: number | null
  totalFee: number | null
  date: string
  time: string | null
  category: string
  receiptPath: string | null
  receiptType: string | null
  aiRawResponse: string | null
  isManual: boolean
  createdAt: string
  updatedAt: string
  userId: string
}

async function findLatestBackupFile(prefix: string): Promise<string | null> {
  const backupDir = join(process.cwd(), 'backup')
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith(prefix))
    .sort()
    .reverse()

  return files.length > 0 ? join(backupDir, files[0]) : null
}

async function importData() {
  console.log('📥 Veri import işlemi başlıyor...\n')

  try {
    // 1. Users import
    console.log('👤 Kullanıcılar import ediliyor...')
    const usersFile = await findLatestBackupFile('users_')
    if (!usersFile) {
      throw new Error('Users backup dosyası bulunamadı')
    }

    const usersContent = await readFile(usersFile, 'utf-8')
    const users: UserData[] = JSON.parse(usersContent)

    for (const user of users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          username: user.username,
          password: user.password,
          name: user.name,
          role: user.role,
          telegramId: user.telegramId,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
      })
    }
    console.log(`   ✅ ${users.length} kullanıcı import edildi`)

    // 2. Categories import
    console.log('\n📁 Kategoriler import ediliyor...')
    const categoriesFile = await findLatestBackupFile('categories_')
    if (!categoriesFile) {
      throw new Error('Categories backup dosyası bulunamadı')
    }

    const categoriesContent = await readFile(categoriesFile, 'utf-8')
    const categories: CategoryData[] = JSON.parse(categoriesContent)

    for (const category of categories) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: {},
        create: {
          id: category.id,
          name: category.name,
          color: category.color,
          createdAt: new Date(category.createdAt),
        },
      })
    }
    console.log(`   ✅ ${categories.length} kategori import edildi`)

    // 3. Expenses import
    console.log('\n💰 Giderler import ediliyor...')
    const expensesFile = await findLatestBackupFile('expenses_')
    if (!expensesFile) {
      throw new Error('Expenses backup dosyası bulunamadı')
    }

    const expensesContent = await readFile(expensesFile, 'utf-8')
    const expenses: ExpenseData[] = JSON.parse(expensesContent)

    // Migration sonuçlarını kontrol et (Cloudinary URL'leri için)
    const migrationFile = await findLatestBackupFile('migration_results_')
    let urlMap: Map<string, string> = new Map()

    if (migrationFile) {
      const migrationContent = await readFile(migrationFile, 'utf-8')
      const migrationResults = JSON.parse(migrationContent)

      for (const result of migrationResults) {
        if (result.success && result.newUrl) {
          urlMap.set(result.expenseId, result.newUrl)
        }
      }
      console.log(`   📎 ${urlMap.size} Cloudinary URL bulundu`)
    }

    for (const expense of expenses) {
      // Cloudinary URL varsa kullan, yoksa eski path
      const receiptPath = urlMap.get(expense.id) || expense.receiptPath

      await prisma.expense.upsert({
        where: { id: expense.id },
        update: {},
        create: {
          id: expense.id,
          amount: expense.amount,
          currency: expense.currency,
          recipient: expense.recipient,
          recipientBank: expense.recipientBank,
          recipientIban: expense.recipientIban,
          sender: expense.sender,
          senderIban: expense.senderIban,
          bank: expense.bank,
          branchCode: expense.branchCode,
          branchName: expense.branchName,
          accountType: expense.accountType,
          accountNumber: expense.accountNumber,
          transactionType: expense.transactionType,
          transactionId: expense.transactionId,
          description: expense.description,
          commission: expense.commission,
          tax: expense.tax,
          totalFee: expense.totalFee,
          date: new Date(expense.date),
          time: expense.time,
          category: expense.category,
          receiptPath: receiptPath,
          receiptType: expense.receiptType,
          aiRawResponse: expense.aiRawResponse,
          isManual: expense.isManual,
          createdAt: new Date(expense.createdAt),
          updatedAt: new Date(expense.updatedAt),
          userId: expense.userId,
        },
      })
    }
    console.log(`   ✅ ${expenses.length} gider import edildi`)

    // Özet
    console.log('\n' + '='.repeat(50))
    console.log('📊 IMPORT ÖZETİ')
    console.log('='.repeat(50))
    console.log(`   Kullanıcılar: ${users.length}`)
    console.log(`   Kategoriler:  ${categories.length}`)
    console.log(`   Giderler:     ${expenses.length}`)
    console.log('\n✅ Import tamamlandı!')

  } catch (error) {
    console.error('❌ Import hatası:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

importData()
