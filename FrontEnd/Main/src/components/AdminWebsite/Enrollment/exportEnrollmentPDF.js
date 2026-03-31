import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToPDF(enrollments, stats, window_) {
  const doc = new jsPDF("landscape");

  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text("Enrollment Report", 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);

  const currentDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.text(`Generated: ${currentDate}`, 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text("Summary Statistics", 14, 35);

  const statsData = [
    ["Total Enrollments", String(stats.total)],
    ["Active/Enrolled", String(stats.active)],
    ["Pending", String(stats.pending)],
    ["Declined/Dropped", String(stats.dropped)],
    // ["Expired", String(stats.expired)],
    [
      "Enrollment Status",
      window_.isOpen ? `Open (${window_.daysLeft} days left)` : "Closed",
    ],
    ["Academic Year", window_.academicYear || "—"],
  ];

  autoTable(doc, {
    startY: 40,
    head: [["Metric", "Value"]],
    body: statsData,
    theme: "grid",
    headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text("Enrollment Details", 14, finalY);

  const tableData = enrollments.map((enrollment) => [
    enrollment.studentName,
    enrollment.gradeLevel,
    enrollment.sectionName,
    enrollment.enrollmentDate
      ? new Date(enrollment.enrollmentDate).toLocaleDateString()
      : "—",
    enrollment.statusText,
    enrollment.fee === "cash" || enrollment.fee === "Paid"
      ? "Cash"
      : "Installment",
    enrollment.parentName,
    enrollment.phone,
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [[
      "Student Name",
      "Grade",
      "Section",
      "Enrollment Date",
      "Status",
      "Payment",
      "Parent/Guardian",
      "Contact",
    ]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 7, cellPadding: 3 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 25 },
      6: { cellWidth: 35 },
      7: { cellWidth: 35 },
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 20,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`enrollment_report_${new Date().toISOString().split("T")[0]}.pdf`);
}