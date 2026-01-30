'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || undefined;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface initialQuery={initialQuery} />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)] flex items-center justify-center">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
