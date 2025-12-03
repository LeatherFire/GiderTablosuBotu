import { v2 as cloudinary } from 'cloudinary'
import { PrismaClient } from '@prisma/client'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'

// Cloudinary konfigürasyonu
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const prisma = new PrismaClient()

interface MigrationResult {
  expenseId: string
  oldPath: string
  newUrl: string | null
  publicId: string | null
  success: boolean
  error?: string
}

async function uploadToCloudinary(
  filePath: string,
  filename: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const buffer = require('fs').readFileSync(filePath)

    cloudinary.uploader.upload_stream(
      {
        folder: 'gider-tablosu/receipts',
        public_id: filename,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error)
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          })
        } else {
          reject(new Error('Upload sonucu alınamadı'))
        }
      }
    ).end(buffer)
  })
}

async function migrateReceipts() {
  console.log('🚀 Dekont migration başlıyor...\n')

  // Cloudinary credentials kontrolü
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary credentials bulunamadı!')
    console.log('\n.env.local dosyasına aşağıdaki değerleri ekleyin:')
    console.log('CLOUDINARY_CLOUD_NAME=your-cloud-name')
    console.log('CLOUDINARY_API_KEY=your-api-key')
    console.log('CLOUDINARY_API_SECRET=your-api-secret')
    process.exit(1)
  }

  const results: MigrationResult[] = []

  try {
    // Dekontlu giderleri al
    const expenses = await prisma.expense.findMany({
      where: {
        receiptPath: { not: null },
      },
      select: {
        id: true,
        receiptPath: true,
        receiptType: true,
        recipient: true,
        date: true,
      },
    })

    console.log(`📎 ${expenses.length} dekont bulundu\n`)

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i]
      const oldPath = expense.receiptPath!

      console.log(`[${i + 1}/${expenses.length}] ${expense.recipient} - ${oldPath}`)

      // Dosya var mı kontrol et
      if (!existsSync(oldPath)) {
        console.log('   ⚠️  Dosya bulunamadı, atlanıyor...')
        results.push({
          expenseId: expense.id,
          oldPath,
          newUrl: null,
          publicId: null,
          success: false,
          error: 'Dosya bulunamadı',
        })
        continue
      }

      try {
        // Benzersiz filename oluştur
        const timestamp = expense.date.getTime()
        const ext = expense.receiptType || oldPath.split('.').pop() || 'jpg'
        const filename = `receipt_${timestamp}_${expense.id.slice(-6)}`

        // Cloudinary'ye yükle
        const result = await uploadToCloudinary(oldPath, filename)

        console.log(`   ✅ Yüklendi: ${result.url}`)

        results.push({
          expenseId: expense.id,
          oldPath,
          newUrl: result.url,
          publicId: result.publicId,
          success: true,
        })

        // Küçük bir bekleme (rate limit için)
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
        console.log(`   ❌ Hata: ${errorMessage}`)
        results.push({
          expenseId: expense.id,
          oldPath,
          newUrl: null,
          publicId: null,
          success: false,
          error: errorMessage,
        })
      }
    }

    // Sonuçları kaydet
    const backupDir = join(process.cwd(), 'backup')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultsFile = join(backupDir, `migration_results_${timestamp}.json`)
    await writeFile(resultsFile, JSON.stringify(results, null, 2), 'utf-8')

    // Özet
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    console.log('\n' + '='.repeat(50))
    console.log('📊 MIGRATION ÖZETİ')
    console.log('='.repeat(50))
    console.log(`   Toplam:     ${results.length}`)
    console.log(`   Başarılı:   ${successful} ✅`)
    console.log(`   Başarısız:  ${failed} ❌`)
    console.log(`\n   📄 Sonuçlar: ${resultsFile}`)

    if (successful > 0) {
      console.log('\n⚠️  ÖNEMLİ: Şimdi veritabanındaki receiptPath alanlarını')
      console.log('   Cloudinary URL\'leri ile güncellemeniz gerekiyor.')
      console.log('   Bunun için: npx tsx scripts/update-receipt-urls.ts')
    }

    console.log('\n✅ Migration tamamlandı!')

  } catch (error) {
    console.error('❌ Migration hatası:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateReceipts()
