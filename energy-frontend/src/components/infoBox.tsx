interface InfoBoxProps {
  title: string;
  description: string;
  textColour?: string;
}
export default function InfoBox({ title, description, textColour }: InfoBoxProps) {
  return (
    <div className="flex flex-col justify-center items-center gap-7 flex-shrink-0 w-[280px] h-[140px] bg-itembg border border-stroke rounded-lg">
      <div className="flex flex-col justify-center flex-1 items-center">
        <h1
          className={`${
            textColour ? textColour : "text-white"
          } text-center font-inter font-semibold text-3xl leading-12`}
        >
          {title}
        </h1>
        <p className={`${textColour ? textColour : "text-white"} text-center font-inter text-base leading-9`}>
          {description}
        </p>
      </div>
    </div>
  );
}
