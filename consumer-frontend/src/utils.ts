export const fetcher = (url: string) => fetch(url).then((r) => r.json());

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { differenceInMonths, differenceInWeeks } from 'date-fns';

export const exportToPDF = async (elementId: string) => {
  const element = document.getElementById(elementId);

  if (element) {
    // Apply padding to the element's style temporarily for the screenshot
    const copyElement = element;
    copyElement.style.padding = '20px'; // Adjust padding
    copyElement.style.backgroundColor = '#011625'; // Set a background color

    // Capture the content as a canvas with background color
    const canvas = await html2canvas(copyElement, {
      scale: 2, // Adjust scale for better quality
      useCORS: true, // To allow cross-origin images to be drawn
    });

    const imgData = canvas.toDataURL('image/png');

    // Create a PDF document
    const pdf = new jsPDF('p', 'mm', [210, 210]);

    const backgroundColor = '#011625';
    pdf.setFillColor(backgroundColor);
    pdf.rect(0, 0, 210, 210, 'F'); // Draw a filled rectangle to cover the entire page

    // Add image to PDF
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Add the tag below the image
    const tagText = 'Brought to you by PowerTrack';
    const tagFontSize = 12;
    const tagYPosition = imgHeight + 10; // Position below the image with some padding
    pdf.setFontSize(tagFontSize);
    pdf.setTextColor(255, 255, 255); // Set text color to white for contrast
    pdf.text(tagText, 210 / 2, tagYPosition, { align: 'center' });

    // Save the PDF
    pdf.save('report.pdf');
  }
};

export const formatCurrency = (value: number): string => {
  // Format the value to 2 decimal places
  const formattedValue = value.toFixed(2);

  // Check if the value is negative
  if (value < 0) {
    // Add dollar sign after the negative sign
    return `-$${Math.abs(Number(formattedValue))}`;
  }

  // Add dollar sign for positive values
  return `$${formattedValue}`;
};

export const generateDateRange = (
  timeRange: string
): { start: string; end: string; granularity: string } => {
  const now = new Date();
  let startDate;
  switch (timeRange) {
    case 'last_year':
      startDate = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate()
      );
      break;
    case 'last_six_months':
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - 6,
        now.getDate()
      );
      break;
    case 'last_month':
      startDate = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate()
      );
      break;
    case 'last_week':
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7
      );
      break;
    case 'last_24_hours':
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      );
      break;
    default:
      startDate = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate()
      );
  }
  return {
    start: startDate.toISOString(),
    end: now.toISOString(),
    granularity: getTemporalGranularity(
      startDate.toISOString(),
      now.toISOString()
    ),
  };
};

/**
 * Determines the temporal granularity based on the period between start and end dates.
 * As written on the API specification document:
 * - weekly: greater than or equal to 1 month
 * - daily: between 1 week and 1 month
 * - hourly: less than 1 week
 *
 * @param startDate start date of period
 * @param endDate end date of period
 * @returns the name of the temporal granularity as in the API specification document, and the adverb
 *  version of the word that is used for the sequelize date-truncating function 'date_trunc'.
 */
export function getTemporalGranularity(
  startDate: string,
  endDate: string
): string {
  const months = differenceInMonths(endDate, startDate);
  const weeks = differenceInWeeks(endDate, startDate);

  if (months >= 1) {
    return 'week';
  } else if (weeks >= 1) {
    return 'day';
  } else {
    return 'hour';
  }
}
