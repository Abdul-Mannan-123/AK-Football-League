export function publicAssetUrl(value: string | null | undefined, bucket?: string) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const storagePath = bucket && !value.startsWith(`${bucket}/`) ? `${bucket}/${value}` : value;
  return base ? `${base}/storage/v1/object/public/${storagePath}` : value;
}
