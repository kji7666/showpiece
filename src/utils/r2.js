import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_KEY,
  },
});

const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET;

export const uploadToR2 = async (file, folder = 'zips') => {
  const fileName = `${folder}/${Date.now()}-${file.name}`;
  
  // ▼▼▼ 修改開始：先將檔案轉換為 ArrayBuffer ▼▼▼
  const arrayBuffer = await file.arrayBuffer();
  const fileBody = new Uint8Array(arrayBuffer);
  // ▲▲▲ 修改結束 ▲▲▲

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileBody, // <--- 這裡改成傳入轉換後的 fileBody，而不是原本的 file
    ContentType: file.type,
    // 加入這個可以確保瀏覽器下載時知道檔案大小
    ContentLength: file.size 
  });

  try {
    await R2.send(command);
    console.log('R2 上傳成功:', fileName);
    return fileName;
  } catch (error) {
    console.error('R2 上傳失敗:', error);
    throw error;
  }
};

export const getR2DownloadLink = async (fileName) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
  });

  try {
    const url = await getSignedUrl(R2, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('R2 簽署失敗:', error);
    throw error;
  }
};