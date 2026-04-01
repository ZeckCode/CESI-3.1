import React, { useState, useRef } from 'react';
import { X, Download, FileText, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './PreviewModal.css';

const PreviewModal = ({ 
  isOpen, 
  onClose, 
  title, 
  data, 
  columns,
  filename = 'report',
  onDownloadExcel,
  onDownloadPDF,
  onPrint,
  customPreview = null
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const tableRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true);
      if (onDownloadExcel) {
        await onDownloadExcel();
      } else {
        // Default Excel export
        const ws = XLSX.utils.json_to_sheet(data);
        if (columns) {
          ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        const timestamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
      }
      alert('✓ Excel file downloaded successfully!');
    } catch (err) {
      console.error('Error downloading Excel:', err);
      alert('Failed to download Excel file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      if (onDownloadPDF) {
        await onDownloadPDF();
      } else {
        // Default PDF export using jsPDF and autoTable
        const doc = new jsPDF();
        const timestamp = new Date().toISOString().slice(0, 10);
        
        // Add title
        doc.setFontSize(16);
        doc.text(title || 'Report', 14, 15);
        
        // Add timestamp
        doc.setFontSize(10);
        doc.text(`Generated: ${timestamp}`, 14, 25);
        
        // Get formatted data for PDF
        let pdfData = data;
        
        if (Array.isArray(pdfData) && pdfData.length > 0) {
          // Extract column headers from first object if not provided
          const headers = columns ? columns.map(c => c.label || c.key) : Object.keys(pdfData[0]);
          
          // Format rows
          const rows = pdfData.map(row => 
            headers.map(header => {
              const key = columns ? columns.find(c => c.label === header)?.key : header;
              return row[key] !== undefined ? String(row[key]) : '—';
            })
          );
          
          // Add table
          autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 35,
            margin: { top: 30 },
            styles: {
              fontSize: 9,
              cellPadding: 3,
              overflow: 'linebreak',
            },
            columnStyles: {
              0: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
              // Footer
              const pageCount = doc.internal.getPages().length;
              doc.setFontSize(8);
              doc.text(
                `Page ${data.pageNumber} of ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
              );
            }
          });
        }
        
        doc.save(`${filename}_${timestamp}.pdf`);
      }
      alert('✓ PDF file downloaded successfully!');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    try {
      if (onPrint) {
        onPrint();
      } else {
        // Default print
        const printWindow = window.open('', '', 'height=600,width=800');
        
        let htmlContent = `
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                .timestamp { color: #666; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #007bff; color: white; padding: 10px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #ddd; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                @media print { 
                  body { margin: 10px; }
                  th { background-color: #007bff !important; color: white !important; }
                }
              </style>
            </head>
            <body>
              <h1>${title}</h1>
              <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
              ${customPreview || tableRef.current?.innerHTML || '<p>No data to print</p>'}
            </body>
          </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    } catch (err) {
      console.error('Error printing:', err);
      alert('Failed to print. Please try again.');
    }
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-modal-header">
          <h2>{title}</h2>
          <button
            className="preview-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Preview Content */}
        <div className="preview-modal-content" ref={tableRef}>
          {customPreview ? (
            customPreview
          ) : (
            <div className="preview-table-wrapper">
              {Array.isArray(data) && data.length > 0 ? (
                <table className="preview-table">
                  <thead>
                    <tr>
                      {columns && columns.length > 0 ? (
                        columns.map((col) => (
                          <th key={col.key}>{col.label || col.key}</th>
                        ))
                      ) : (
                        Object.keys(data[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx}>
                        {columns && columns.length > 0 ? (
                          columns.map((col) => (
                            <td key={col.key}>
                              {row[col.key] !== undefined
                                ? String(row[col.key])
                                : '—'}
                            </td>
                          ))
                        ) : (
                          Object.keys(row).map((key) => (
                            <td key={key}>{String(row[key]) || '—'}</td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="preview-no-data">No data available</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="preview-modal-footer">
          <button
            className="preview-btn preview-btn-excel"
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            title="Download as Excel"
          >
            <FileText size={18} />
            Download Excel
          </button>
          <button
            className="preview-btn preview-btn-pdf"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            title="Download as PDF"
          >
            <Download size={18} />
            Download PDF
          </button>
          <button
            className="preview-btn preview-btn-print"
            onClick={handlePrint}
            disabled={isDownloading}
            title="Print"
          >
            <Printer size={18} />
            Print
          </button>
          <button
            className="preview-btn preview-btn-cancel"
            onClick={onClose}
            disabled={isDownloading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
