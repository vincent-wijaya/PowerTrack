import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import FirstPageIcon from '../icons/firstPageIcon';
import PreviousPageIcon from '../icons/previousPageIcon';
import NextPageIcon from '../icons/nextpageIcon';
import LastPageIcon from '../icons/lastPageIcon';

interface TableProps {
  columns: { name: string; title: string }[];
  data: any[]; // Data should be an array of objects
  link: string | null;
  showPageControls: boolean | false; // title pagination system
}

export default function Table({
  columns,
  data,
  link,
  showPageControls,
}: TableProps) {
  // Check if link is true, if so, add 'Action' header
  const updatedColumns: { name: string; title: string }[] = link
    ? [...columns, { name: 'Action', title: 'Action' }]
    : columns;

  const [page, setPage] = useState<number>(1);
  const [pageInputValue, setPageInputValue] = useState<number>(page);
  const [pages, setPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const ITEMS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];
  const [pageItems, setPageItems] = useState(data);

  useEffect(() => {
    setPage(1);
    filterData(data);
  }, [data, itemsPerPage]);

  useEffect(() => {
    filterData(data);
  }, [page, itemsPerPage]); // Added page to dependencies

  useEffect(() => {
    setPageInputValue(page);
  }, [page]);

  const filterData = (data: any) => {
    setPageItems(data.slice((page - 1) * itemsPerPage, page * itemsPerPage));
    setPages(Math.ceil(data.length / itemsPerPage) || 1);
  };

  const previousPage = () => {
    setPage((prevPage) => Math.max(1, prevPage - 1));
  };

  const nextPage = () => {
    setPage((prevPage) => Math.min(prevPage + 1, pages));
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setPage(1); // Return to first page
    setItemsPerPage(newItemsPerPage);
  };

  const handlePageChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let newPage = pageInputValue;

    if (e.key === 'Enter') {
      if (pageInputValue < 1) {
        newPage = 1; // If page is set to less than 0, set to 0
      } else if (pageInputValue > pages) {
        newPage = pages; // If page is set to more than max pages, set to max page
      }
      setPage(newPage); // Update the page
    }
  };

  return (
    <>
      <table className="w-full border-stroke border-2 rounded-sm">
        <thead className="items-start flex-shrink-0 self-stretch">
          <tr className="flex items-start flex-shrink-0 self-stretch">
            {updatedColumns.map((column, columnIndex) => (
              <th
                className="flex p-4 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2"
                key={columnIndex}
              >
                <div className="font-inter text-white text-nowrap">
                  {column.title}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="items-start flex-shrink-0 self-stretch bg-itembg">
          {pageItems.length === 0 ? (
            <tr className="flex items-start flex-shrink-0 self-stretch">
              <td
                className="px-3 py-8 items-center text-center flex-1 self-stretch border-stroke border-r-2 border-b-2"
                colSpan={updatedColumns.length}
              >
                <div className="font-inter text-white">No data found</div>
              </td>
            </tr>
          ) : (
            pageItems.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="flex items-start flex-shrink-0 self-stretch"
              >
                {columns.map((column, columnIndex) => (
                  <td
                    className="px-3 py-8 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2"
                    key={columnIndex}
                  >
                    <div className="font-inter text-white">
                      {row[
                        column.name.toLowerCase().replace(' ', '_')
                      ].toString()}
                    </div>
                  </td>
                ))}
                {link && (
                  <td
                    className="px-3 py-8 items-start gap-8 flex-1 self-stretch border-stroke border-r-2 border-b-2 bg-purple"
                    key={`action-${rowIndex}`}
                  >
                    <div className="font-inter text-white">
                      <Link
                        href={`${link}/${row[columns[0].name.toLowerCase()]}`}
                      >
                        View
                      </Link>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {showPageControls && (
        <div className="flex flex-row justify-between">
          <div className="text-white">
            <button
              className="hover:opacity-75 transition-all duration-100"
              onClick={() => setPage(1)}
              aria-label="First Page Button"
            >
              <FirstPageIcon />
            </button>
            <button
              className="hover:opacity-75 transition-all duration-100"
              onClick={previousPage}
              aria-label="Previous Page Button"
            >
              <PreviousPageIcon />
            </button>
            <button
              className="hover:opacity-75 transition-all duration-100"
              onClick={nextPage}
              aria-label="Next Page Button"
            >
              <NextPageIcon />
            </button>
            <button
              className="hover:opacity-75 transition-all duration-100"
              onClick={() => setPage(pages)}
              aria-label="Last Page Button"
            >
              <LastPageIcon />
            </button>
            <div>
              <span className="mr-3 font-bold">Page</span>
              <input
                type="number"
                value={pageInputValue}
                onChange={(e) => setPageInputValue(Number(e.target.value))}
                onKeyDown={(e) => handlePageChange(e)}
                className="max-w-14 text-center bg-gray-50 border border-gray-300 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 pr-0 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-black dark:focus:ring-blue-500 dark:focus:border-blue-500"
                aria-label="Go to Page Input Field"
              ></input>
              <span className="mr-3 font-bold">/ {pages}</span>
            </div>
          </div>
          <div className="text-white font-bold text-lg">
            {data.length} items found
          </div>
          <div>
            <select
              value={itemsPerPage}
              onChange={(option) =>
                handleItemsPerPageChange(Number(option.target.value))
              }
              className="mt-1 flex bg-mainbg border-2 border-chartBorder text-white font-bold hover:border-gray-500 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
              aria-label="Items Per Page Dropdown"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                  aria-label={`${option} items per page option`}
                >
                  {option} items
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
