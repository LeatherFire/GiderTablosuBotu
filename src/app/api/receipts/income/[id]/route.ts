import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const income = await prisma.income.findUnique({
      where: { id },
      select: { receiptPath: true, receiptType: true },
    })

    if (!income || !income.receiptPath) {
      return NextResponse.json({ error: 'Dekont bulunamadı' }, { status: 404 })
    }

    // Cloudinary URL kontrolü - https:// ile başlıyorsa redirect yap
    if (income.receiptPath.startsWith('http://') || income.receiptPath.startsWith('https://')) {
      return NextResponse.redirect(income.receiptPath)
    }

    // Local dosya - eski sistem için geriye uyumluluk
    if (!existsSync(income.receiptPath)) {
      return NextResponse.json({ error: 'Dekont dosyası bulunamadı' }, { status: 404 })
    }

    const fileBuffer = await readFile(income.receiptPath)

    // MIME type belirleme
    let contentType = 'application/octet-stream'
    const ext = income.receiptType || income.receiptPath.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'pdf':
        contentType = 'application/pdf'
        break
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'webp':
        contentType = 'image/webp'
        break
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="dekont.${ext}"`,
      },
    })
  } catch (error) {
    console.error('Receipt fetch error:', error)
    return NextResponse.json({ error: 'Dekont yüklenirken hata oluştu' }, { status: 500 })
  }
}
