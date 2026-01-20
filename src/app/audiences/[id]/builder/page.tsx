import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';

// Dynamically import to prevent SSR hydration issues
const AudienceBuilder = dynamic(
  () => import('@/components/audience-builder/AudienceBuilder').then(mod => ({ default: mod.AudienceBuilder })),
  { ssr: false }
);

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { step?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const step = parseInt(searchParams.step || '1', 10);
  // 4 steps: Brief, Audience Selection, Build & Explore, Export
  const validStep = step >= 1 && step <= 4 ? step : 1;

  return <AudienceBuilder audienceId={params.id} initialStep={validStep} />;
}
