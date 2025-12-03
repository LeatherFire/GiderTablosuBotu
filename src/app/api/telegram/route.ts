import { NextRequest, NextResponse } from 'next/server'
import { bot } from '@/lib/telegram'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

// Telegram webhook endpoint
export async function POST(request: NextRequest) {
  try {
    // Secret token doğrulaması (opsiyonel güvenlik katmanı)
    if (WEBHOOK_SECRET) {
      const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
      if (secretHeader !== WEBHOOK_SECRET) {
        console.warn('Invalid webhook secret token')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()

    // Telegraf'a gelen update'i işle
    await bot.handleUpdate(body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// Webhook durumu kontrolü
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Telegram webhook endpoint aktif',
    timestamp: new Date().toISOString(),
  })
}
