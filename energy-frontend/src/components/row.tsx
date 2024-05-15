import Row from "./row"

interface RowProps {
    columns: string[];
}

export default function Table({ columns }: RowProps) {
    return (
                <tr className="flex items-start flex-1 flex-shrink-0 self-stretch bg-itembg">
                    {columns.map((column, columnIndex) => (
                        <td className="flex p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2" key={columnIndex}>
                            <div className="font-inter text-white text-nowrap">
                                {column}
                            </div>
                        </td>
                    ))}
                </tr>
    )
}