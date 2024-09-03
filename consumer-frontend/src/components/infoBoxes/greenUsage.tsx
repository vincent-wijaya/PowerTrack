import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from 'swr';
import InfoBox from './infoBox';

export default function GreenUsage() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  const { data, error } = useSWR(`${url}/consumer/greenEnergy`, fetcher, {
    refreshInterval: POLLING_RATE,
  });

  if (error || !data) {
    return (
      <InfoBox
        title={`N/A`}
        description="Green Energy Usage"
      />
    );
  }

  return (
    <InfoBox
      title={`${(data.greenUsagePercent * 100).toFixed(0)}%`}
      description="Green Energy Usage"
    />
  );
}
