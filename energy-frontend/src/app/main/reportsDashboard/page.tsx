import Headings from "@/app/main/template";
import PageHeading from "@/components/pageHeading";
import ReportsTable from "@/components/table/reportsTable";

export type ReportsFetchType = {
    start_date: string;
    end_date: string;
    for: {
      suburb_id: number;
      consumer_id: number | null;
    };
}

interface ReportItem {
    start_date: string;
    end_date: string;
    suburb_id: number;
    consumer_id: number | null;
  }

export default function RegionalDashboard({ params }: {
    params: {id: number};
}) {
    return (
        <>
            <ReportsTable/>
        </>
  );
}