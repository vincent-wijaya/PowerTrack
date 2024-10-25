// Props interface defining the structure for InfoBox component
interface InfoBoxProps {
  title: string;          // The title text
  description: string;    // The description text
  textColour?: string;    // Optional custom text color
}

// InfoBox component: Displays a title and description with optional text color
export default function InfoBox({
  title,
  description,
  textColour,
}: InfoBoxProps) {
  return (
    <div className="flex flex-col justify-center items-center p-2 w-full bg-itembg border border-stroke rounded-lg transition-transform transform hover:scale-105 hover:shadow-lg">
      <div className="flex flex-col justify-center flex-1 items-center">
        {/* Title with optional text color, defaulting to white */}
        <h1
          className={`${
            textColour ? textColour : 'text-white'
          } text-center font-inter font-semibold text-2xl`}
        >
          {title}
        </h1>
        {/* Description with optional text color, defaulting to white */}
        <p
          className={`${textColour ? textColour : 'text-white'} text-center font-inter text-xs`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}