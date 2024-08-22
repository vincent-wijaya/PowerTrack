import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';

export default function RegionalDashboard({
  params,
}: {
  params: { id: number };
}) {
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title={`Area - ${params.id}`} />

        <div>
          {/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}
        </div>
      </div>
    </>
  );
}
