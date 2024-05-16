import React from "react";

interface TableProps {
  columns: string[];
  data: any[]; // Data should be an array of objects
}

export default function Table({ columns, data }: TableProps) {
  return (
    <table className="flex flex-col flex-start flex-shrink-0 border-stroke border-2 rounded-sm">
      <thead className="flex items-start flex-shrink-0 self-stretch">
        {columns.map((column, columnIndex) => (
          <th
            className="flex p-16 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2"
            key={columnIndex}
          >
            <div className="font-inter text-white text-nowrap">{column}</div>
          </th>
        ))}
      </thead>
      <tbody className="items-start flex-shrink-0 self-stretch">
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
