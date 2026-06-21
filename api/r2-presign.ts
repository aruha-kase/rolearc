import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { key, contentType } = req.query;
  if (!key || !contentType) {
    return res.status(400).json({ error: 'key and contentType are required' });
  }

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key as string,
      ContentType: contentType as string,
    });

    const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.VITE_R2_PUBLIC_URL}/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error('[r2-presign] Error:', err);
    return res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
}
