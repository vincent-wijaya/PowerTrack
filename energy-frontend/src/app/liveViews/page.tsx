import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";
import RegionalTable from "@/components/table/regionalTable";
import UserTable from "@/components/table/userTable";


export default function LiveViews() {
  return (
      <>
        <PageHeading title="Live View Dashboard" />
        <div className="gap-8">
            <div className="py-8">
                <RegionalTable/>
            </div>
            <div className="py-8">
                <UserTable />
            </div>
        </div>
      </>
  )
}