
import Headings from "@/app/template";
import PageHeading from "@/components/pageHeading";
import InfoBox from "@/components/infoBox";
import Map from "@/components/map"
import UserTable from "@/components/table/userTable"

export default function MainDashboard() {
  return (
      <>
        <PageHeading title="Home" />
      
        <div className="h-screen px-10 grid grid-cols-2">
          <div className="gap-8 py-10">
            <div className="h-1/6 gap-2 grid grid-cols-3">
              <InfoBox title="None" description="none"/>
              <InfoBox title="None" description="none"/>
              <InfoBox title="None" description="none"/>
            </div>
            <div className="h-1/3 mt-8 p-4 bg-itembg border border-stroke rounded-lg">
              <Map />
            </div> 
            <div className="h-1/3 gap-2 py-10">
              <UserTable/>
            </div> 
          </div>
        </div>
      </>
  )
}

