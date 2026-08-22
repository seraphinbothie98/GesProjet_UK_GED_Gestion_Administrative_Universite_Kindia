import { createClient } from '@supabase/supabase-js';

// Configuration Supabase UK-GED (Projet: neauokcwcpoblzslvraf)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://neauokcwcpoblzslvraf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper pour écouter les transmissions de documents en temps réel
export function subscribeToIncomingTransfers(serviceId, onNewTransfer) {
  if (!serviceId) return null;

  return supabase
    .channel(`service_transfers_${serviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'document_transfers',
        filter: `to_service_id=eq.${serviceId}`
      },
      (payload) => {
        if (onNewTransfer) onNewTransfer(payload.new);
      }
    )
    .subscribe();
}

// Helper pour uploader un fichier vers un bucket Supabase Storage
export async function uploadFileToSupabaseStorage(bucketName, filePath, file) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return { path: data.path, publicUrl: urlData.publicUrl };
}
