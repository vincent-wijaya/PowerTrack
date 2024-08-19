import React from "react";
import Link from "next/link"

interface TableProps {
  columns: string[];
  data: any[]; // Data should be an array of objects
  link: string | null;
}

export default function Table({ columns, data, link }: TableProps) {
  
  // Check if link is true, if so, add 'Action' header
  const updatedColumns = link ? [...columns, "Action"] : columns;

  return (
    <table className="table-auto border-stroke border-r-2">
      <thead className="">
        <tr className="">
        {updatedColumns.map((column, columnIndex) => (
          <th
            className="p-4 items-start gap-8  border-stroke border-2"
            key={columnIndex}
          >
            <div className="font-inter text-white text-nowrap">{column}</div>
          </th>
        ))}
        </tr>
      </thead>
      <tbody className="items-start bg-itembg">
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className="">
            {columns.map((column, columnIndex) => (
              <td
                className="px-3 py-8 items-start gap-8 border-stroke border-r-2 border-l-2 border-b-2"
                key={columnIndex}
              >
                <div className="font-inter text-white">
                  {(row[column.toLowerCase().replace(' ','_')])}
                </div>
              </td>
            ))}
            {link && (
              <td
                className="px-3 py-8 items-start gap-8  border-stroke border-r-2 border-b-2"
                key={`action-${rowIndex}`}
              >
                <div className="font-inter text-center text-white bg-purple p-2 rounded-lg">
                    <Link href={`${link}/${row[columns[0].toLowerCase()]}` }>
                    View
                    </Link>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
