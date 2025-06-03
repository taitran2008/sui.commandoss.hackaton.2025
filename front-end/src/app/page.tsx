'use client';

import { Suspense } from 'react';
import TaskList from '@/components/TaskList';
import { useSearchParams } from 'next/navigation';

function HomeContent() {
  const searchParams = useSearchParams();
  const hostAddress = searchParams.get('host');

  return <TaskList hostAddress={hostAddress} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    </div>}>
      <HomeContent />
    </Suspense>
  );
}
