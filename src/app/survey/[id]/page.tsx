'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SurveyPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/survey/${params.id}/edit`);
  }, [router, params.id]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
    </div>
  );
}
