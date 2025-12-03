import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface UploadResult {
  url: string
  publicId: string
}

/**
 * Dekont dosyasını Cloudinary'ye yükler
 * @param buffer - Dosya içeriği
 * @param filename - Dosya adı (uzantısız)
 * @returns Upload sonucu (URL ve public_id)
 */
export async function uploadReceipt(buffer: Buffer, filename: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'gider-tablosu/receipts',
        public_id: filename,
        resource_type: 'auto', // PDF ve görsel destekler
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

/**
 * Cloudinary'den dekont siler
 * @param publicId - Silinecek dosyanın public_id'si
 */
export async function deleteReceipt(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * PDF için özel URL oluşturur (inline görüntüleme için)
 * @param publicId - Dosyanın public_id'si
 * @returns PDF görüntüleme URL'i
 */
export function getPdfViewUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    flags: 'attachment:false',
  })
}

/**
 * Görsel için optimize edilmiş URL oluşturur
 * @param publicId - Dosyanın public_id'si
 * @param width - İstenen genişlik (opsiyonel)
 * @returns Optimize edilmiş görsel URL'i
 */
export function getImageUrl(publicId: string, width?: number): string {
  const options: Record<string, unknown> = {
    quality: 'auto',
    fetch_format: 'auto',
  }

  if (width) {
    options.width = width
    options.crop = 'scale'
  }

  return cloudinary.url(publicId, options)
}

export { cloudinary }
