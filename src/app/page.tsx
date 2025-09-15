import FMStationsFetcher from '@/components/FMStationsFetcher';

// Force dynamic rendering and no caching to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
  return <FMStationsFetcher />;
}