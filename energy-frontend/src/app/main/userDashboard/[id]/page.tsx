import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';
import ReportFormButton from '@/components/reportFormButton';

export default function UserDashboard({ params }: { params: { id: number } }) {
  const stringID = params.id.toString();
  return (
    <>
      <div className="flex flex-col-2">
        <PageHeading title={`User ID - ${params.id}`} />

        <div>
          {/* <InfoBox title="X Urgent Warnings" description="of all warnings" />*/}
        </div>
      </div>

      <ReportFormButton
        id={stringID}
        type="consumer"
      />
    </>
  );
}
