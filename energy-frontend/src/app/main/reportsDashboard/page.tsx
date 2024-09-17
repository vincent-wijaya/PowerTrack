import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';
import ReportsTable from '@/components/tables/reportsTable';
import { POLLING_RATE } from '@/config';
import { fetcher } from '@/utils';
import useSWR from 'swr';

export default function ReportsDashboard() {
  return (
    <>
      <PageHeading title="Reports" />
      <ReportsTable />
    </>
  );
}
