import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).end();

  const { key } = req.query;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    await R2.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key as string,
    }));
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[r2-delete] Error:', err);
    return res.status(500).json({ error: 'Failed to delete object' });
  }
}
