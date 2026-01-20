import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/pagination';

export interface Client {
  id: string;
  name: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List all clients
 */
export async function listClients(): Promise<Client[]> {
  const supabase = createClient();
  const query = supabase
    .from('admin_clients')
    .select('*')
    .order('name', { ascending: true });

  return await fetchAll<Client>(query);
}

/**
 * Create a new client
 */
export async function createClientRecord(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('admin_clients')
    .insert({
      name: client.name,
      url: client.url || null,
      updated_at: new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a client
 */
export async function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>): Promise<Client> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('admin_clients') as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a client
 */
export async function deleteClient(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('admin_clients')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
