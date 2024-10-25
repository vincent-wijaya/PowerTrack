interface PageHeadingProps {
  title: string;
}

export default function PageHeading(props: PageHeadingProps) {
  return (
    <span className="text-white text-2xl font-bold text-pretty uppercase">
      {props.title}
    </span>
  );
}
