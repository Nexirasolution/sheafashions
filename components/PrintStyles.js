// components/PrintStyles.jsx
// Drop <PrintStyles /> into any page that has a `.print-area` wrapper.
// When printing: hides navbar/footer/floating buttons, sets the sheet to A5,
// and prints only the `.print-area` content.

const css = `
@page {
  size: A5 portrait;   /* 148mm x 210mm */
  margin: 8mm;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Hide everything that is not the print area, or an ancestor/descendant of it */
  body *:not(.print-area):not(.print-area *):not(:has(.print-area)) {
    display: none !important;
  }

  /* Strip spacing/limits from the layout wrappers around the print area */
  body :has(.print-area):not(.print-area) {
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    width: auto !important;
    border: none !important;
    box-shadow: none !important;
  }

  .print-area {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  .print-area tr,
  .print-area .avoid-break {
    break-inside: avoid;
  }

  .no-print {
    display: none !important;
  }
}
`;

export default function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}