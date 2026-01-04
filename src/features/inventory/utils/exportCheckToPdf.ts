import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RunItemDoc, GroupedSection } from "../types/inventory.types";

interface CheckRunData {
  templateName: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt?: number;
  completedAt?: number;
  notes?: string;
  startedByName?: string;
  completedByName?: string;
}

interface ExportOptions {
  run: CheckRunData;
  items: RunItemDoc[];
  groupedSections: GroupedSection[];
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateCompact(timestamp?: number): string {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCompactStatus(item: RunItemDoc): string {
  if (item.expectedQuantity !== undefined) {
    if (item.actualQuantity === undefined) return "-";
    if (item.actualQuantity === item.expectedQuantity) return "✓";
    // Show found/expected for mismatches
    return `${item.actualQuantity}/${item.expectedQuantity}`;
  }
  if (item.value === "yes") return "✓";
  if (item.value === "no") return "✗";
  return "-";
}

function getStatusColor(item: RunItemDoc): [number, number, number] {
  if (item.expectedQuantity !== undefined) {
    if (item.actualQuantity === undefined) return [128, 128, 128];
    if (item.actualQuantity === item.expectedQuantity) return [34, 139, 34];
    return item.actualQuantity < item.expectedQuantity ? [220, 53, 69] : [255, 165, 0];
  }
  if (item.value === "yes") return [34, 139, 34];
  if (item.value === "no") return [220, 53, 69];
  return [128, 128, 128];
}

function isDeviation(item: RunItemDoc): boolean {
  return item.value === "no" ||
    (item.expectedQuantity !== undefined && item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity);
}

export function exportCheckToPdf({ run, items, groupedSections }: ExportOptions): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Compact header: Template name + status on one line
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(run.templateName, 10, 12);

  // Status badge (top right)
  const statusText = run.status === "completed" ? "COMPLETED" : run.status === "cancelled" ? "CANCELLED" : "IN PROGRESS";
  const statusColor: [number, number, number] = run.status === "completed" ? [34, 139, 34] : run.status === "cancelled" ? [128, 128, 128] : [255, 165, 0];
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...statusColor);
  doc.text(statusText, pageWidth - 10, 12, { align: "right" });

  // Compact metadata: single line
  let yPos = 18;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);

  let metaLine = `Started: ${formatDateCompact(run.startedAt)}`;
  if (run.startedByName) metaLine += ` by ${run.startedByName}`;
  if (run.status === "completed" && run.completedAt) {
    metaLine += `  |  Completed: ${formatDateCompact(run.completedAt)}`;
    if (run.completedByName) metaLine += ` by ${run.completedByName}`;
  }
  doc.text(metaLine, 10, yPos);

  yPos += 5;

  // Calculate deviations
  const deviationItems = items.filter(i =>
    i.value === "no" ||
    (i.expectedQuantity !== undefined && i.actualQuantity !== undefined && i.actualQuantity !== i.expectedQuantity) ||
    (i.notes && i.notes.trim().length > 0)
  );

  // Summary stats - compact
  const totalItems = items.length;
  const okCount = items.filter(i =>
    (i.value === "yes" && (!i.notes || i.notes.trim().length === 0)) ||
    (i.expectedQuantity !== undefined && i.actualQuantity === i.expectedQuantity && (!i.notes || i.notes.trim().length === 0))
  ).length;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`Total: ${totalItems}  |  OK: ${okCount}  |  Deviations: ${deviationItems.length}`, 10, yPos);
  yPos += 4;

  // Compact deviations section (if any) - two columns
  if (deviationItems.length > 0) {
    const colWidth = (pageWidth - 24) / 2;
    const deviationRowHeight = 2.8;
    const rowsPerCol = Math.ceil(deviationItems.length / 2);
    const deviationBoxHeight = Math.min(rowsPerCol * deviationRowHeight + 6, 50);

    // Check if we need to start on a new page
    if (yPos + deviationBoxHeight > 280) {
      doc.addPage();
      yPos = 10;
    }

    // Draw background
    doc.setFillColor(255, 250, 240);
    doc.rect(10, yPos - 1, pageWidth - 20, deviationBoxHeight, "F");
    doc.setDrawColor(220, 150, 100);
    doc.rect(10, yPos - 1, pageWidth - 20, deviationBoxHeight, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(180, 100, 50);
    doc.text("DEVIATIONS", 12, yPos + 2);
    yPos += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(60, 60, 60);

    // Two-column deviation list
    const maxDeviationsToShow = Math.min(deviationItems.length, 30); // Cap for very long lists
    for (let i = 0; i < maxDeviationsToShow; i++) {
      const item = deviationItems[i];
      const col = i < rowsPerCol ? 0 : 1;
      const row = i < rowsPerCol ? i : i - rowsPerCol;
      const xPos = col === 0 ? 12 : 12 + colWidth;
      const itemYPos = yPos + row * deviationRowHeight;

      let text = `• ${item.itemName}`;
      if (item.value === "no") {
        text += " [No]";
      } else if (item.expectedQuantity !== undefined && item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity) {
        const diff = item.actualQuantity - item.expectedQuantity;
        const diffText = diff > 0 ? `+${diff}` : `${diff}`;
        text += ` [${item.actualQuantity}/${item.expectedQuantity} ${diffText}]`;
      } else if (item.notes) {
        text += " [note]";
      }

      // Truncate if too long
      if (text.length > 55) text = text.substring(0, 52) + "...";
      doc.text(text, xPos, itemYPos);
    }

    if (deviationItems.length > maxDeviationsToShow) {
      doc.setTextColor(120, 120, 120);
      doc.text(`... and ${deviationItems.length - maxDeviationsToShow} more (see details below)`, 12, yPos + rowsPerCol * deviationRowHeight);
    }

    yPos += Math.min(rowsPerCol, 15) * deviationRowHeight + 3;
  } else {
    // Compact "All OK" message
    doc.setFillColor(240, 255, 240);
    doc.rect(10, yPos - 1, pageWidth - 20, 6, "F");
    doc.setDrawColor(100, 180, 100);
    doc.rect(10, yPos - 1, pageWidth - 20, 6, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(50, 150, 50);
    doc.text("ALL ITEMS OK - No deviations found", 12, yPos + 2.5);
    yPos += 7;
  }

  doc.setTextColor(0, 0, 0);
  yPos += 2;

  // Sections with items - COMPACT TWO-COLUMN LAYOUT
  for (const section of groupedSections) {
    if (yPos > 275) {
      doc.addPage();
      yPos = 10;
    }

    // Build two-column table data
    // Each row contains: [Item1, Status1, Item2, Status2]
    const tableData: (string | { content: string; styles?: object })[][] = [];
    const sectionItems = section.items;

    for (let i = 0; i < sectionItems.length; i += 2) {
      const item1 = sectionItems[i];
      const item2 = sectionItems[i + 1];

      // Format item1
      let item1Name = item1.expectedQuantity ? `${item1.itemName} (${item1.expectedQuantity})` : item1.itemName;
      if (item1.notes) item1Name += " *";

      const row: (string | { content: string; styles?: object })[] = [
        item1Name,
        getCompactStatus(item1),
      ];

      // Format item2 (if exists)
      if (item2) {
        let item2Name = item2.expectedQuantity ? `${item2.itemName} (${item2.expectedQuantity})` : item2.itemName;
        if (item2.notes) item2Name += " *";
        row.push(item2Name, getCompactStatus(item2));
      } else {
        row.push("", "");
      }

      tableData.push(row);
    }

    autoTable(doc, {
      startY: yPos,
      head: [
        [{ content: section.sectionName, colSpan: 4, styles: { fillColor: [70, 70, 70], fontSize: 6, fontStyle: "bold", cellPadding: 0.8 } }],
      ],
      body: tableData,
      theme: "grid",
      styles: {
        fontSize: 5.5,
        cellPadding: 0.6,
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: [70, 70, 70],
        textColor: [255, 255, 255],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: (pageWidth - 20) / 2 - 8, halign: "left" },
        1: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        2: { cellWidth: (pageWidth - 20) / 2 - 8, halign: "left" },
        3: { cellWidth: 8, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // Color the status columns (1 and 3)
        if (data.section === "body" && (data.column.index === 1 || data.column.index === 3)) {
          const itemIndex = data.column.index === 1
            ? data.row.index * 2
            : data.row.index * 2 + 1;
          const item = sectionItems[itemIndex];
          if (item) {
            const color = getStatusColor(item);
            data.cell.styles.textColor = color;
          }
        }
        // Highlight rows with deviations
        if (data.section === "body") {
          const item1 = sectionItems[data.row.index * 2];
          const item2 = sectionItems[data.row.index * 2 + 1];
          if ((item1 && isDeviation(item1)) || (item2 && isDeviation(item2))) {
            if (data.column.index === 0 || data.column.index === 1) {
              if (item1 && isDeviation(item1)) {
                data.cell.styles.fillColor = [255, 248, 240];
              }
            }
            if (data.column.index === 2 || data.column.index === 3) {
              if (item2 && isDeviation(item2)) {
                data.cell.styles.fillColor = [255, 248, 240];
              }
            }
          }
        }
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 2;
  }

  // Notes section - compact list of items with notes
  const itemsWithNotes = items.filter(i => i.notes && i.notes.trim().length > 0);
  if (itemsWithNotes.length > 0) {
    if (yPos > 260) {
      doc.addPage();
      yPos = 10;
    }

    yPos += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text("NOTES", 10, yPos);
    yPos += 3;

    const notesData = itemsWithNotes.map(item => [
      item.itemName,
      item.notes || ""
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Item", "Note"]],
      body: notesData,
      theme: "striped",
      styles: {
        fontSize: 5.5,
        cellPadding: 0.8,
      },
      headStyles: {
        fillColor: [100, 100, 100],
        fontSize: 5.5,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 45, halign: "left" },
        1: { cellWidth: "auto", halign: "left" },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 2;
  }

  // Footer with generation date
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-AU")} | Page ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  // Download
  const filename = `${run.templateName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_check_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
