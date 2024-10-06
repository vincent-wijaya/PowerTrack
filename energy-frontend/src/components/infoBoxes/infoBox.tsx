interface InfoBoxProps {
  title: string;
  description: string;
  textColour?: string;
}
export default function InfoBox({
  title,
  description,
  textColour,
}: InfoBoxProps) {
  return (
    <div className="flex flex-col justify-center items-center p-2 w-full bg-itembg border border-stroke rounded-lg transition-transform transform hover:scale-105 hover:shadow-lg">
      <div className="flex flex-col justify-center flex-1 items-center">
        <h1
          className={`${
            textColour ? textColour : 'text-white'
          } text-center font-inter font-semibold text-2xl`}
        >
          {title}
        </h1>
        <p
          className={`${textColour ? textColour : 'text-white'} text-center font-inter text-xs`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
