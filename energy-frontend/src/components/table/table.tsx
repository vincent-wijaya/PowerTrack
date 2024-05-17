import React from "react";
import Router from 'next/router'
import Link from "next/link";
import { use } from 'next/navigation';


interface TableProps {
  columns: string[];
  data: any[]; // Data should be an array of objects
  link: string | null;
}

export default function Table({ columns, data, link }: TableProps) {
  
  // Check if link is true, if so, add 'Action' header
  const updatedColumns = link ? [...columns, "Action"] : columns;

  return (
    <table className="flex flex-col flex-start flex-shrink-0 border-stroke border-2 rounded-sm">
      <thead className="items-start flex-shrink-0 self-stretch">
        <tr className="flex items-start flex-shrink-0 self-stretch">
        {updatedColumns.map((column, columnIndex) => (
          <th
            className="flex p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2"
            key={columnIndex}
          >
            <div className="font-inter text-white text-nowrap">{column}</div>
          </th>
        ))}
        </tr>
      </thead>
      <tbody className="items-start flex-shrink-0 self-stretch bg-itembg">
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} className="flex items-start flex-shrink-0 self-stretch">
            {columns.map((column, columnIndex) => (
              <td
                className="p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2"
                key={columnIndex}
              >
                <div className="font-inter text-white text-nowrap">
                  {row[column.toLowerCase()]} {/* Assuming data keys match columns */}
                </div>
              </td>
            ))}
            {link && (
              <td
                className="p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2 bg-purple"
                key={`action-${rowIndex}`}
              >
                <div className="font-inter text-white text-nowrap">
                    <Link href={`${link}/${row[columns[0].toLowerCase()]}` }>
                    View
                    </Link>
                   {/*{row[columns[0].toLowerCase()]} {/* Displaying the same text as the first column  */}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
