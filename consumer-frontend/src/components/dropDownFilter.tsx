'use client';
import React from 'react';

interface DropdownProps {
  onChange: (value: string) => void;
}

const Dropdown: React.FC<DropdownProps> = ({ onChange }) => {
  const options = [
    { label: 'Last year', value: 'last_year' },
    { label: 'Last 6 months', value: 'last_six_months' },
    { label: 'Last month', value: 'last_month' },
    { label: 'Last week', value: 'last_week' },
    { label: 'Last 24 hours', value: 'last_24_hours' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="flex w-full py-4 px-2 justify-between">
      <select
        onChange={handleChange}
        className="flex bg-mainbg border-2 border-chartBorder text-white hover:border-gray-500 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Dropdown;
