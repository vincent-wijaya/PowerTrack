interface InfoBoxProps {
  title: string;
  description: string;
  textColour?: string;
}
export default function InfoBox({ title, description }: InfoBoxProps) {
    return <div className="flex flex-col justify-center items-center p-24 gap-7 flex-shrink-0 w-full bg-itembg border border-stroke rounded-lg">
            <div className="flex flex-col justify-center flex-1 items-center">
            <h1 className="text-white text-center font-inter font-semibold text-3xl leading-12">
                {title}
            </h1>
            <p className="text-white text-center font-inter text-xl leading-9">
                {description}
            </p>
            </div>
        </div>;   
}
