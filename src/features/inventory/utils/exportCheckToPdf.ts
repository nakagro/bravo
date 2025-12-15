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

function getStatusText(item: RunItemDoc): string {
  if (item.expectedQuantity !== undefined) {
    if (item.actualQuantity === undefined) return "-";
    if (item.actualQuantity === item.expectedQuantity) return "Yes";
    // Show actual quantity found (not the difference)
    return String(item.actualQuantity);
  }
  if (item.value === "yes") return "Yes";
  if (item.value === "no") return "No";
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

export function exportCheckToPdf({ run, items, groupedSections }: ExportOptions): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightCol = pageWidth / 2 + 10;
  
  // Header: "Weekly Inventory" + Template Name
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Weekly Inventory", 14, 15);
  
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(run.templateName, 14, 22);
  
  // Status badge (top right)
  const statusText = run.status === "completed" ? "COMPLETED" : run.status === "cancelled" ? "CANCELLED" : "IN PROGRESS";
  const statusColor: [number, number, number] = run.status === "completed" ? [34, 139, 34] : run.status === "cancelled" ? [128, 128, 128] : [255, 165, 0];
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...statusColor);
  doc.text(statusText, pageWidth - 14, 15, { align: "right" });
  doc.setTextColor(0, 0, 0);
  
  // Two-column metadata layout
  let yPos = 30;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  
  // Left column: Started info
  doc.text(`Started: ${formatDate(run.startedAt)}`, 14, yPos);
  if (run.startedByName) {
    doc.text(`By: ${run.startedByName}`, 14, yPos + 4);
  }
  
  // Right column: Completed info
  if (run.status === "completed" && run.completedAt) {
    doc.text(`Completed: ${formatDate(run.completedAt)}`, rightCol, yPos);
    if (run.completedByName) {
      doc.text(`By: ${run.completedByName}`, rightCol, yPos + 4);
    }
  }
  
  yPos += 12;
  
  // Calculate deviations
  const deviationItems = items.filter(i => 
    i.value === "no" || 
    (i.expectedQuantity !== undefined && i.actualQuantity !== undefined && i.actualQuantity !== i.expectedQuantity) ||
    (i.notes && i.notes.trim().length > 0)
  );
  
  // Summary stats line
  const totalItems = items.length;
  const okCount = items.filter(i => 
    (i.value === "yes" && (!i.notes || i.notes.trim().length === 0)) || 
    (i.expectedQuantity !== undefined && i.actualQuantity === i.expectedQuantity && (!i.notes || i.notes.trim().length === 0))
  ).length;
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`Total: ${totalItems}  |  OK: ${okCount}  |  Deviations: ${deviationItems.length}`, 14, yPos);
  yPos += 6;
  
  // Deviations section (if any)
  if (deviationItems.length > 0) {
    // Draw a light background for deviations section
    doc.setFillColor(255, 250, 240);
    doc.rect(14, yPos - 2, pageWidth - 28, Math.min(deviationItems.length * 4 + 8, 40), "F");
    doc.setDrawColor(220, 150, 100);
    doc.rect(14, yPos - 2, pageWidth - 28, Math.min(deviationItems.length * 4 + 8, 40), "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 100, 50);
    doc.text("DEVIATIONS", 16, yPos + 2);
    yPos += 6;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    
    // Show up to 8 deviations in the header
    const maxDeviations = 8;
    const displayDeviations = deviationItems.slice(0, maxDeviations);
    
    for (const item of displayDeviations) {
      let deviationText = `- ${item.itemName}`;
      if (item.value === "no") {
        deviationText += " - Marked as No";
      } else if (item.expectedQuantity !== undefined && item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity) {
        const diff = item.actualQuantity - item.expectedQuantity;
        if (diff < 0) {
          deviationText += ` - Missing ${Math.abs(diff)}, expected ${item.expectedQuantity}`;
        } else {
          deviationText += ` - Extra ${diff}, expected ${item.expectedQuantity}`;
        }
      } else if (item.notes) {
        deviationText += " - Has notes";
      }
      doc.text(deviationText, 16, yPos);
      yPos += 3.5;
    }
    
    if (deviationItems.length > maxDeviations) {
      doc.setTextColor(120, 120, 120);
      doc.text(`... and ${deviationItems.length - maxDeviations} more`, 16, yPos);
      yPos += 3.5;
    }
    
    yPos += 4;
  } else {
    // All OK message
    doc.setFillColor(240, 255, 240);
    doc.rect(14, yPos - 2, pageWidth - 28, 10, "F");
    doc.setDrawColor(100, 180, 100);
    doc.rect(14, yPos - 2, pageWidth - 28, 10, "S");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(50, 150, 50);
    doc.text("ALL ITEMS OK - No deviations found", 16, yPos + 4);
    yPos += 12;
  }
  
  doc.setTextColor(0, 0, 0);
  
  // Sections with items
  for (const section of groupedSections) {
    // Check if we need a new page (with less margin since tables handle page breaks)
    if (yPos > 270) {
      doc.addPage();
      yPos = 15;
    }
    
    // Items table with section name as first header row
    const tableData = section.items.map(item => {
      const itemName = item.expectedQuantity 
        ? `${item.itemName} (${item.expectedQuantity})`
        : item.itemName;
      
      return [
        itemName,
        getStatusText(item),
        item.notes || "",
      ];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [
        [{ content: section.sectionName, colSpan: 3, styles: { fillColor: [80, 80, 80], fontSize: 8, fontStyle: "bold" } }],
        ["Item", "Status", "Notes"],
      ],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [120, 120, 120],
        fontSize: 7,
        fontStyle: "bold",
        halign: "left",
        cellPadding: 1.5,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { cellWidth: 75, halign: "left" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: "auto", halign: "left" },
      },
      didParseCell: (data) => {
        // Color the status column header
        if (data.section === "head" && data.column.index === 1 && data.row.index === 1) {
          data.cell.styles.halign = "center";
        }
        // Color the status column body cells
        if (data.section === "body" && data.column.index === 1) {
          const item = section.items[data.row.index];
          if (item) {
            const color = getStatusColor(item);
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 4;
  }
  
  // Footer with generation date
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-AU")} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }
  
  // Download
  const filename = `${run.templateName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_check_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
