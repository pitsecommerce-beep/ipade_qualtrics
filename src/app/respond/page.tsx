import { Suspense } from 'react';
import RespondClient from './respond-client';

export default function RespondPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    }>
      <RespondClient />
    </Suspense>
  );
}
