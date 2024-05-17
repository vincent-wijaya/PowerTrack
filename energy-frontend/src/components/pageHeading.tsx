interface PageHeadingProps {
    title: string
}

export default function PageHeading(props: PageHeadingProps) {
    return <span className="text-white text-4xl px-10">{props.title}</span>
}