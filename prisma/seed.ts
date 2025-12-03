import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const categories = [
  { name: 'İşçi', color: '#EF4444' },
  { name: 'Kasap', color: '#F97316' },
  { name: 'Toptancı', color: '#F59E0B' },
  { name: 'Nakliye', color: '#EAB308' },
  { name: 'Yemekhane Kurulum', color: '#84CC16' },
  { name: 'Fırın', color: '#22C55E' },
  { name: 'Market', color: '#10B981' },
  { name: 'Sebze-Meyve', color: '#14B8A6' },
  { name: 'Kira', color: '#06B6D4' },
  { name: 'Fatura', color: '#0EA5E9' },
  { name: 'Diğer', color: '#6B7280' },
]

async function main() {
  console.log('Seeding database...')

  // Kategorileri ekle
  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { color: category.color },
      create: category,
    })
  }
  console.log('✓ Kategoriler eklendi')

  // Admin kullanıcı oluştur
  const adminPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Admin',
      role: 'admin',
    },
  })
  console.log('✓ Admin kullanıcı oluşturuldu (admin / admin123)')

  // Normal kullanıcı oluştur
  const userPassword = await bcrypt.hash('user123', 10)
  await prisma.user.upsert({
    where: { username: 'baba' },
    update: {},
    create: {
      username: 'baba',
      password: userPassword,
      name: 'Baba',
      role: 'user',
    },
  })
  console.log('✓ User kullanıcı oluşturuldu (baba / user123)')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
