'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SurveyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('surveyId') || '';

  useEffect(() => {
    if (surveyId) {
      router.replace(`/survey/_/edit?surveyId=${surveyId}`);
    } else {
      router.replace('/dashboard');
    }
  }, [router, surveyId]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
    </div>
  );
}
