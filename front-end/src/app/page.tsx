'use client';

import { Suspense, useEffect, useState } from 'react';
import TaskList from '@/components/TaskList';

function HomeContent() {
  const [hostAddress, setHostAddress] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Only access URL params on client side
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setHostAddress(urlParams.get('host'));
    }
  }, []);

  // Show loading during hydration
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

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
