
export const fetcher = (url: string) => fetch(url).then((r) => r.json());


import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element) {
    // Capture the content as a canvas
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    // Create a PDF document
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Add image to PDF
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Save the PDF
    pdf.save('report.pdf');
  }
};
