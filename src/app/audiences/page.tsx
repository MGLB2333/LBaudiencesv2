import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AudiencesList } from '@/components/audiences/AudiencesList';

export default async function AudiencesPage() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return <AudiencesList />;
}
