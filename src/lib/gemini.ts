import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ParsedReceipt {
  // İşlem Yönü - Gelir mi Gider mi?
  transactionDirection: 'income' | 'expense'

  // Tutar
  amount: number | null
  currency: string

  // Alıcı Bilgileri
  recipient: string | null
  recipientBank: string | null
  recipientIban: string | null

  // Gönderen Bilgileri
  sender: string | null
  senderBank: string | null
  senderIban: string | null

  // Banka/Şube Bilgileri
  bank: string | null
  branchCode: string | null
  branchName: string | null

  // Hesap Bilgileri
  accountType: string | null
  accountNumber: string | null

  // İşlem Detayları
  transactionType: string | null
  transactionId: string | null
  description: string | null

  // Masraflar
  commission: number | null
  tax: number | null
  totalFee: number | null

  // Tarih/Saat
  date: string | null
  time: string | null

  // Kategori
  suggestedCategory: string | null
}

const EXPENSE_CATEGORIES = [
  'İşçi',
  'Kasap',
  'Toptancı',
  'Nakliye',
  'Yemekhane Kurulum',
  'Fırın',
  'Market',
  'Sebze-Meyve',
  'Kira',
  'Fatura',
  'Diğer',
]

const INCOME_CATEGORIES = [
  'Satış Geliri',
  'Hizmet Geliri',
  'Kira Geliri',
  'Faiz Geliri',
  'İade',
  'Diğer Gelir',
]

export async function analyzeReceipt(imageBase64: string, mimeType: string): Promise<ParsedReceipt> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Bu bir banka dekontu/havale makbuzu dosyasıdır (görsel veya PDF). Türk bankalarından (Ziraat, DenizBank, Enpara, Yapıkredi, Garanti, İş Bankası, Akbank vb.) olabilir.

Lütfen aşağıdaki TÜM bilgileri JSON formatında çıkar. Sadece JSON döndür, başka bir şey yazma. Her alanı dikkatlice oku ve doldur.

{
  "transactionDirection": "<işlem yönü: income veya expense>",
  "amount": <işlem tutarı, sayı olarak, virgül yerine nokta kullan, masraflar HARİÇ ana tutar>,
  "currency": "TRY",

  "recipient": "<alıcı/alan kişi adı>",
  "recipientBank": "<alıcı banka adı, örn: Akbank, Garanti>",
  "recipientIban": "<alıcı IBAN numarası, TR ile başlayan>",

  "sender": "<gönderen kişi adı>",
  "senderBank": "<gönderen banka adı>",
  "senderIban": "<gönderen IBAN numarası>",

  "bank": "<işlemi yapan banka adı, örn: Ziraat Bankası>",
  "branchCode": "<şube kodu, örn: 2720>",
  "branchName": "<şube adı, örn: GÜLKENT/ISPARTA ŞUBESİ>",

  "accountType": "<IBAN veya Hesap No veya Kart>",
  "accountNumber": "<hesap numarası, IBAN değilse>",

  "transactionType": "<işlem türü: Gelen EFT, Gelen Havale, Gelen FAST, EFT, Havale, FAST, Virman>",
  "transactionId": "<işlem referans no, FAST sorgu no, dekont no>",
  "description": "<açıklama/mesaj varsa>",

  "commission": <komisyon tutarı, sayı olarak>,
  "tax": <BSMV tutarı, sayı olarak>,
  "totalFee": <toplam masraf tutarı, sayı olarak>,

  "date": "<YYYY-MM-DD formatında tarih>",
  "time": "<HH:mm:ss formatında saat>",

  "suggestedCategory": "<aşağıdaki kategorilerden en uygun olanı>"
}

İŞLEM YÖNÜ TESPİTİ (ÇOK ÖNEMLİ):
- İşlem türü "Gelen EFT", "Gelen Havale", "Gelen FAST", "Gelen Transfer" içeriyorsa → "income" (GELİR)
- İşlem türü "Giden EFT", "EFT", "Havale", "FAST", "Virman", "Ödeme" içeriyorsa → "expense" (GİDER)
- Dekontta "Gelen" kelimesi varsa → "income"
- Dekontta "Gönderilen", "Gönderdiğiniz", "Ödeme" kelimesi varsa → "expense"
- Hesaba para girdiyse (alıcı biziz) → "income"
- Hesaptan para çıktıysa (gönderen biziz) → "expense"

GİDER Kategori seçenekleri (transactionDirection: "expense" ise):
${EXPENSE_CATEGORIES.join(', ')}

GELİR Kategori seçenekleri (transactionDirection: "income" ise):
${INCOME_CATEGORIES.join(', ')}

Gider kategorisi seçerken:
- Eğer alıcı bir kişi adı ise ve tutar düşükse "İşçi" olabilir
- Et, tavuk, balık ile ilgili ise "Kasap"
- Toptan gıda, tedarikçi ise "Toptancı"
- Taşımacılık, kargo ise "Nakliye"
- Ekipman, tadilat, mobilya ise "Yemekhane Kurulum"
- Ekmek, unlu mamul ise "Fırın"
- Günlük alışveriş ise "Market"
- Meyve, sebze ise "Sebze-Meyve"
- Kira ödemesi ise "Kira"
- Elektrik, su, doğalgaz, telefon ise "Fatura"
- Emin değilsen "Diğer"

Gelir kategorisi seçerken:
- Yemek satışı, catering hizmeti ise "Satış Geliri"
- Danışmanlık, hizmet bedeli ise "Hizmet Geliri"
- Kira ödemesi alıyorsanız "Kira Geliri"
- Banka faizi ise "Faiz Geliri"
- İade, geri ödeme ise "İade"
- Emin değilsen "Diğer Gelir"

ÖNEMLİ:
- Eğer bir bilgi görünmüyorsa veya okunamıyorsa null yaz
- Tutarlar mutlaka sayı olmalı (string değil)
- IBAN'ları boşluksuz yaz
- Tarih ve saati dekontta yazan şekilde çıkar ve formata çevir`

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
      prompt,
    ])

    const response = await result.response
    const text = response.text()

    // JSON'u parse et
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('JSON bulunamadı')
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedReceipt

    // Validasyon - transactionDirection
    if (!parsed.transactionDirection || !['income', 'expense'].includes(parsed.transactionDirection)) {
      // Varsayılan olarak expense kabul et (geriye uyumluluk)
      parsed.transactionDirection = 'expense'
    }

    // Validasyon - string tutarları sayıya çevir
    if (parsed.amount !== null && typeof parsed.amount === 'string') {
      parsed.amount = parseFloat((parsed.amount as string).replace(/[.,]/g, (m) => m === ',' ? '.' : ''))
    }
    if (parsed.commission !== null && typeof parsed.commission === 'string') {
      parsed.commission = parseFloat((parsed.commission as string).replace(',', '.'))
    }
    if (parsed.tax !== null && typeof parsed.tax === 'string') {
      parsed.tax = parseFloat((parsed.tax as string).replace(',', '.'))
    }
    if (parsed.totalFee !== null && typeof parsed.totalFee === 'string') {
      parsed.totalFee = parseFloat((parsed.totalFee as string).replace(',', '.'))
    }

    // Kategori validasyonu - işlem yönüne göre
    if (parsed.transactionDirection === 'income') {
      if (parsed.suggestedCategory && !INCOME_CATEGORIES.includes(parsed.suggestedCategory)) {
        parsed.suggestedCategory = 'Diğer Gelir'
      }
    } else {
      if (parsed.suggestedCategory && !EXPENSE_CATEGORIES.includes(parsed.suggestedCategory)) {
        parsed.suggestedCategory = 'Diğer'
      }
    }

    return parsed
  } catch (error) {
    console.error('Gemini API error:', error)
    throw error
  }
}

export async function generateMonthlySummary(expenses: any[]): Promise<string> {
  if (expenses.length === 0) {
    return 'Bu dönemde henüz gider kaydı bulunmuyor.'
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
  const categoryTotals: Record<string, number> = {}
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount
  })

  const prompt = `Aşağıdaki yemekhane gider verilerini analiz et ve kısa bir Türkçe özet yaz (2-3 cümle):

Toplam Gider: ${totalAmount.toLocaleString('tr-TR')} TL
İşlem Sayısı: ${expenses.length}
Kategori Dağılımı:
${Object.entries(categoryTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, total]) => `- ${cat}: ${total.toLocaleString('tr-TR')} TL`)
  .join('\n')}

Özet yazarken:
- En çok harcama yapılan kategoriyi belirt
- Dikkat çekici bir bilgi varsa ekle
- Öneriler verebilirsin
- Kısa ve öz ol`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  } catch (error) {
    console.error('Summary generation error:', error)
    return 'Özet oluşturulamadı.'
  }
}
