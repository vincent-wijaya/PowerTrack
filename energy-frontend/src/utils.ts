export const fetcher = (url: string) => fetch(url).then((r) => r.json());

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
