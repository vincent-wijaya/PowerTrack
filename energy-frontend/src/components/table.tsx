import Row from "./row"

interface TableProps {
    columns: string[];
}

export default function Table({ columns }: TableProps) {
    return (
            <table className="flex flex-col  flex-start flex-shrink-0 border-stroke border-2 rounded-sm">
                <thead className="flex items-start flex-shrink-0 self-stretch">
                    {columns.map((column, columnIndex) => (
                        <th className="flex p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2" key={columnIndex}>
                            <div className="font-inter text-white text-nowrap">
                                {column}
                            </div>
                        </th>
                    ))}
                </thead>
                <Row columns={["1", "Power Outage", "High"]} />
                <Row columns={["2", "High Fossil Fuel Usage", "Medium"]} />
                <Row columns={["3", "Profit Margin is High", "Low"]} />
            </table>
    )
}

