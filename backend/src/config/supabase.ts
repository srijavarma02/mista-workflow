import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.SUPABASE_URL  || '';
const supabaseKey  = process.env.SUPABASE_SERVICE_KEY || '';
export const BUCKET = process.env.SUPABASE_BUCKET || 'stores-documents';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder = ''
): Promise<string> {
  const path = folder ? `${folder}/${fileName}` : fileName;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
