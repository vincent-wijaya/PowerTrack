export default function Legend() {
  return (
    <div className="relative bg-white bg-opacity-90 p-4 rounded-b-lg shadow-md">
      <h4 className="font-bold  text-center">
        Energy Consumption Levels in kW
      </h4>
      <div className="flex items-center justify-between">
        {/* Label for no consumption */}
        <span className="text-sm font-bold">0</span>

        {/* Gradient bar */}
        <div className="mx-4 w-full h-4 bg-gradient-to-r from-[rgb(144,238,144)] via-[rgb(72,105,201)] to-[rgb(0,0,139)] rounded"></div>

        {/* Label for high consumption */}
        <span className="text-sm font-bold">2000+</span>
      </div>
    </div>
  );
}
