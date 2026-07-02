/**
 * Cloudflare R2へのアップロードヘルパー
 * Vercel APIルート経由でPresigned URLを取得し、R2に直接アップロードする
 */

export async function uploadToR2(file: File, path: string): Promise<string> {
  // Vercel APIからPresigned URLを取得
  const res = await fetch(
    `/api/r2-presign?key=${encodeURIComponent(path)}&contentType=${encodeURIComponent(file.type)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Presigned URL取得失敗: ${err.error ?? res.status}`);
  }

  const { uploadUrl, publicUrl } = await res.json();

  // R2に直接アップロード
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadRes.ok) {
    throw new Error(`R2アップロード失敗: ${uploadRes.status}`);
  }

  return publicUrl;
}

/**
 * R2からファイルを削除する
 * R2のPublic URLからキーを抽出してAPIを呼ぶ
 */
export async function deleteFromR2(url: string): Promise<void> {
  const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
  if (!r2PublicUrl || !url.startsWith(r2PublicUrl)) return; // R2のURLでなければスキップ

  const key = url.replace(`${r2PublicUrl}/`, '');
  await fetch(`/api/r2-delete?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
}
