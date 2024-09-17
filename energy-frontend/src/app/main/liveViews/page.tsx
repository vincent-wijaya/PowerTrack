import Headings from '@/app/main/template';
import PageHeading from '@/components/pageHeading';
import RegionalTable from '@/components/tables/regionalTable';
import UserTable from '@/components/tables/userTable';

export default function LiveViewDashboard() {
  return (
    <>
      <PageHeading title="Live View Dashboard" />
      <div className="gap-8">
        <div className="py-8">
          <RegionalTable />
        </div>
        <div className="py-8">
          <UserTable />
        </div>
      </div>
    </>
  );
}
