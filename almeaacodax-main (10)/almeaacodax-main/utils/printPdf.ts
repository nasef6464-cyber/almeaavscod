const getCurrentPageStyles = () =>
  Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

const buildPrintableDocument = (title: string, html: string, styles: string) => `
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${styles}
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        direction: rtl;
        font-family: "Tahoma", "Arial", sans-serif;
        background: #f8fafc;
        color: #111827;
      }
      .print-shell {
        max-width: 1100px;
        margin: 0 auto;
        background: #fff;
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 12px 35px rgba(15, 23, 42, 0.08);
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      button,
      .print-hide,
      [data-print-hidden="true"] {
        display: none !important;
      }
      img,
      svg {
        max-width: 100%;
      }
      @media print {
        body {
          padding: 0;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-shell {
          max-width: none;
          border-radius: 0;
          box-shadow: none;
          padding: 12mm;
        }
      }
    </style>
  </head>
  <body>
    <main class="print-shell">${html}</main>
  </body>
</html>
`;

export const printElementAsPdf = (elementId: string, title: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintableDocument(title, element.innerHTML, getCurrentPageStyles()));
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 400);
};
