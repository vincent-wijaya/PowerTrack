import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';
import ReportsTable from '@/components/table/reportsTable';


export default function ReportsDashboard({ params }: { params: { id: number } }) {
  console.log("ID:", params.id)
  return (
    <>
      <PageHeading title="Reports" />
      <ReportsTable consumer_id={params.id}/>
    </>
  );
}
