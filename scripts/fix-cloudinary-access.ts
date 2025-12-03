import { v2 as cloudinary } from 'cloudinary'
import { PrismaClient } from '@prisma/client'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const prisma = new PrismaClient()

async function fixCloudinaryAccess() {
  console.log('🔧 Cloudinary erişim düzeltme başlıyor...\n')

  try {
    // Cloudinary URL'li giderleri al
    const expenses = await prisma.expense.findMany({
      where: {
        receiptPath: { startsWith: 'https://res.cloudinary.com' },
      },
      select: {
        id: true,
        recipient: true,
        receiptPath: true,
      },
    })

    console.log(`📎 ${expenses.length} Cloudinary dosyası bulundu\n`)

    let fixed = 0
    let failed = 0

    for (const expense of expenses) {
      try {
        // URL'den public_id çıkar
        // URL format: https://res.cloudinary.com/CLOUD/image/upload/vXXX/FOLDER/FILE.ext
        const url = expense.receiptPath!
        const match = url.match(/\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/)

        if (!match) {
          console.log(`⚠️  ${expense.recipient}: URL parse edilemedi`)
          continue
        }

        const publicId = match[1]
        console.log(`[${fixed + failed + 1}/${expenses.length}] ${expense.recipient}`)
        console.log(`   Public ID: ${publicId}`)

        // Dosyayı public yap
        await cloudinary.uploader.explicit(publicId, {
          type: 'upload',
          access_mode: 'public',
          resource_type: 'auto',
        })

        console.log(`   ✅ Public yapıldı`)
        fixed++

        // Rate limit için bekle
        await new Promise((r) => setTimeout(r, 300))
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Bilinmeyen hata'
        console.log(`   ❌ Hata: ${msg}`)
        failed++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 ÖZET')
    console.log('='.repeat(50))
    console.log(`   Düzeltilen: ${fixed} ✅`)
    console.log(`   Başarısız:  ${failed} ❌`)
    console.log('\n✅ Tamamlandı!')

  } catch (error) {
    console.error('❌ Hata:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixCloudinaryAccess()
