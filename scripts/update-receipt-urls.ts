import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { readdirSync } from 'fs'

const prisma = new PrismaClient()

interface MigrationResult {
  expenseId: string
  oldPath: string
  newUrl: string | null
  publicId: string | null
  success: boolean
  error?: string
}

async function updateReceiptUrls() {
  console.log('🔄 Dekont URL güncelleme başlıyor...\n')

  const backupDir = join(process.cwd(), 'backup')

  // En son migration_results dosyasını bul
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith('migration_results_'))
    .sort()
    .reverse()

  if (files.length === 0) {
    console.error('❌ Migration sonuç dosyası bulunamadı!')
    console.log('   Önce: npx tsx scripts/migrate-receipts.ts')
    process.exit(1)
  }

  const latestFile = join(backupDir, files[0])
  console.log(`📄 Sonuç dosyası: ${latestFile}\n`)

  try {
    const content = await readFile(latestFile, 'utf-8')
    const results: MigrationResult[] = JSON.parse(content)

    const successfulMigrations = results.filter((r) => r.success && r.newUrl)

    console.log(`📎 ${successfulMigrations.length} başarılı migration bulundu\n`)

    let updated = 0
    let failed = 0

    for (const migration of successfulMigrations) {
      try {
        await prisma.expense.update({
          where: { id: migration.expenseId },
          data: { receiptPath: migration.newUrl },
        })

        console.log(`✅ ${migration.expenseId} → ${migration.newUrl?.slice(0, 60)}...`)
        updated++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
        console.log(`❌ ${migration.expenseId} → Hata: ${errorMessage}`)
        failed++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 GÜNCELLEME ÖZETİ')
    console.log('='.repeat(50))
    console.log(`   Güncellenen: ${updated} ✅`)
    console.log(`   Başarısız:   ${failed} ❌`)
    console.log('\n✅ URL güncelleme tamamlandı!')

  } catch (error) {
    console.error('❌ Güncelleme hatası:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateReceiptUrls()
