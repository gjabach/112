'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RedirectWorldbuildingPage() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/editor/${params.projectId}`);
  }, [params.projectId, router]);
  return null;
}
