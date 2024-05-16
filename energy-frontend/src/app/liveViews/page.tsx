import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";
import RegionalTable from "@/components/table/regionalTable";


export default function LiveViews() {
  return (
      <>
        <PageHeading title="Live View Dashboard" />
        
        <RegionalTable/>
      </>
  )
}