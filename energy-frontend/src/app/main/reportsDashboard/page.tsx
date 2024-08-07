import Headings from "@/app/main/template";
import PageHeading from "@/components/pageHeading";
import ReportsTable from "@/components/table/reportsTable";

export default function RegionalDashboard({ params }: {
    params: {id: number};
}) {
    return (
        <>
        <ReportsTable/>
        </>
  );
}