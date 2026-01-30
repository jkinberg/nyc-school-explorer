'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || undefined;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatInterface initialQuery={initialQuery} />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="flex-1 min-h-0 flex items-center justify-center">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
