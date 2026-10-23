const MAX_IMAGE_BYTES = 100 * 1024;
const MAX_IMAGE_DIMENSION = 300;

export interface CompressImageOptions {
  maxDimension?: number;
  maxBytes?: number;
  initialQuality?: number;
  minQuality?: number;
}

export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const maxDimension = options.maxDimension ?? MAX_IMAGE_DIMENSION;
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('请选择图片文件。'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('无法读取所选图片。'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('所选文件不是有效图片。'));
      image.onload = () => {
        let scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('当前浏览器无法处理图片。'));
          return;
        }

        const render = () => {
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const minQuality = options.minQuality ?? 0.35;
          let quality = options.initialQuality ?? 0.7;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrlBytes(dataUrl) > maxBytes && quality > minQuality) {
            quality = Math.max(minQuality, quality - 0.1);
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          if (dataUrlBytes(dataUrl) <= maxBytes) {
            resolve(dataUrl);
            return;
          }

          if (Math.max(canvas.width, canvas.height) <= 64) {
            reject(new Error(`图片压缩后仍超过 ${Math.round(maxBytes / 1024)}KB，请选择更简单或更小的图片。`));
            return;
          }

          scale *= 0.8;
          render();
        };

        try {
          render();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('图片压缩失败。'));
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const dataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4) -
    (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
};

export const compressImageFile = compressImage;

export const compressWallpaper = (file: File): Promise<string> =>
  compressImage(file, { maxDimension: 1920, maxBytes: 1200 * 1024, initialQuality: 0.92, minQuality: 0.6 });

export const compressChatPhoto = (file: File): Promise<string> =>
  compressImage(file, { maxDimension: 1280, maxBytes: 400 * 1024 });
