const PAGE_WIDTH = 595.28;
const CONTENT_X = 52;
const CONTENT_WIDTH = 491.28;
const COLORS = {
  navy: '#1b2430',
  muted: '#64748b',
  line: '#d9dee5',
  card: '#f6f8fb',
  gold: '#d9a900',
  green: '#eaf6ef',
  greenText: '#17603d',
  white: '#ffffff',
};

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function formatAmount(value) {
  return `INR ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function drawMainHeader(doc) {
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(COLORS.gold);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.navy)
    .text('PSG INSTITUTIONS', 0, 31, { width: PAGE_WIDTH, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
    .text('TRANSPORT DEPARTMENT', 0, 52, { width: PAGE_WIDTH, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.navy)
    .text('Long Trip Advance Receipt', 0, 76, { width: PAGE_WIDTH, align: 'center' });
  doc.strokeColor(COLORS.gold).lineWidth(1.5)
    .moveTo(CONTENT_X, 111).lineTo(CONTENT_X + CONTENT_WIDTH, 111).stroke();
}

function drawContinuationHeader(doc, advance) {
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(COLORS.gold);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy)
    .text('PSG INSTITUTIONS  |  TRANSPORT DEPARTMENT', CONTENT_X, 32);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.navy)
    .text('LONG TRIP ADVANCE RECEIPT', CONTENT_X, 51);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
    .text(`Receipt No: ${advance.receiptNo}`, CONTENT_X, 70);
  doc.strokeColor(COLORS.line).moveTo(CONTENT_X, 89).lineTo(CONTENT_X + CONTENT_WIDTH, 89).stroke();
}

function drawReceiptCard(doc, advance, y) {
  const height = 58;
  const middle = CONTENT_X + CONTENT_WIDTH / 2;
  doc.roundedRect(CONTENT_X, y, CONTENT_WIDTH, height, 8)
    .fillAndStroke(COLORS.card, COLORS.line);
  doc.strokeColor(COLORS.line).moveTo(middle, y + 10).lineTo(middle, y + height - 10).stroke();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
    .text('RECEIPT NO.', CONTENT_X + 16, y + 11);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.navy)
    .text(advance.receiptNo, CONTENT_X + 16, y + 27);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
    .text('RECEIPT DATE', middle + 16, y + 11);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy)
    .text(formatDate(advance.approvedDate || advance.createdAt), middle + 16, y + 27);
  return y + height;
}

function drawSectionHeading(doc, title, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy)
    .text(title.toUpperCase(), CONTENT_X, y);
  doc.strokeColor(COLORS.line).lineWidth(0.7)
    .moveTo(CONTENT_X, y + 15).lineTo(CONTENT_X + CONTENT_WIDTH, y + 15).stroke();
  return y + 25;
}

function drawInfoCard(doc, rows, y) {
  const padding = 13;
  const columnGap = 18;
  const innerWidth = CONTENT_WIDTH - (padding * 2);
  const rowHeights = rows.map((fields) => {
    const columnWidth = (innerWidth - (columnGap * (fields.length - 1))) / fields.length;
    const valueHeights = fields.map((field) => {
      doc.font(field.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(field.valueSize || 10);
      return Math.max(12, doc.heightOfString(String(field.value), { width: columnWidth, lineGap: 1 }));
    });
    return 12 + Math.max(...valueHeights) + 10;
  });
  const height = (padding * 2) + rowHeights.reduce((total, rowHeight) => total + rowHeight, 0);

  doc.roundedRect(CONTENT_X, y, CONTENT_WIDTH, height, 8)
    .fillAndStroke(COLORS.white, COLORS.line);
  let rowY = y + padding;
  rows.forEach((fields, rowIndex) => {
    const columnWidth = (innerWidth - (columnGap * (fields.length - 1))) / fields.length;
    fields.forEach((field, fieldIndex) => {
      const fieldX = CONTENT_X + padding + (fieldIndex * (columnWidth + columnGap));
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
        .text(field.label.toUpperCase(), fieldX, rowY, { width: columnWidth });
      doc.font(field.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(field.valueSize || 10)
        .fillColor(field.color || COLORS.navy)
        .text(String(field.value), fieldX, rowY + 12, { width: columnWidth, lineGap: 1 });
    });
    if (rowIndex < rows.length - 1) {
      const dividerY = rowY + rowHeights[rowIndex] - 4;
      doc.strokeColor(COLORS.line).lineWidth(0.5)
        .moveTo(CONTENT_X + padding, dividerY)
        .lineTo(CONTENT_X + CONTENT_WIDTH - padding, dividerY)
        .stroke();
    }
    rowY += rowHeights[rowIndex];
  });
  return y + height;
}

function drawAmountCards(doc, advance, y) {
  const gap = 14;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const height = 72;
  const cards = [
    { x: CONTENT_X, label: 'REQUESTED AMOUNT', value: advance.requestedAmount, fill: COLORS.card, color: COLORS.navy },
    { x: CONTENT_X + cardWidth + gap, label: 'APPROVED ADVANCE', value: advance.approvedAmount, fill: COLORS.green, color: COLORS.greenText },
  ];

  cards.forEach((card) => {
    doc.roundedRect(card.x, y, cardWidth, height, 8).fillAndStroke(card.fill, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
      .text(card.label, card.x + 14, y + 12);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(card.color)
      .text(formatAmount(card.value), card.x + 14, y + 32, { width: cardWidth - 28 });
  });
  return y + height;
}

function getRemarksHeight(doc, remarks) {
  doc.font('Helvetica').fontSize(10);
  return Math.max(14, doc.heightOfString(remarks, { width: CONTENT_WIDTH - 28, lineGap: 2 }));
}

function drawRemarksCard(doc, remarks, y, textHeight) {
  const height = textHeight + 28;
  doc.roundedRect(CONTENT_X, y, CONTENT_WIDTH, height, 8)
    .fillAndStroke(COLORS.card, COLORS.line);
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.navy)
    .text(remarks, CONTENT_X + 14, y + 14, { width: CONTENT_WIDTH - 28, lineGap: 2 });
  return y + height;
}

function drawSignatureFooter(doc, advance) {
  const footerY = doc.page.height - doc.page.margins.bottom - 104;
  const gap = 32;
  const columnWidth = (CONTENT_WIDTH - gap) / 2;
  const lineY = footerY + 40;
  const columns = [
    { x: CONTENT_X, title: 'DRIVER SIGNATURE', name: advance.driver?.name || 'Driver' },
    { x: CONTENT_X + columnWidth + gap, title: 'TRANSPORT OFFICER SIGNATURE', name: advance.reviewedBy?.name || 'Transport Officer' },
  ];

  doc.strokeColor(COLORS.line).lineWidth(0.8)
    .moveTo(CONTENT_X, footerY).lineTo(CONTENT_X + CONTENT_WIDTH, footerY).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy)
    .text('SIGNATURES', CONTENT_X, footerY + 11);
  columns.forEach((column) => {
    doc.strokeColor(COLORS.muted).lineWidth(0.7)
      .moveTo(column.x, lineY).lineTo(column.x + columnWidth, lineY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
      .text(column.title, column.x, lineY + 7, { width: columnWidth });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.navy)
      .text(column.name, column.x, lineY + 20, { width: columnWidth });
  });
}

export default function writeTripAdvanceReceipt(doc, advance) {
  drawMainHeader(doc);
  let y = drawReceiptCard(doc, advance, 128) + 17;

  y = drawSectionHeading(doc, 'Driver & trip details', y);
  y = drawInfoCard(doc, [
    [
      { label: 'Driver name', value: advance.driver?.name || 'Driver' },
      { label: 'Driver phone', value: advance.driver?.phone || 'Not provided' },
    ],
    [
      { label: 'Vehicle number', value: advance.vehicle?.regNo || 'Vehicle' },
      { label: 'Trip destination', value: advance.destination },
    ],
    [{ label: 'Trip purpose', value: advance.purpose }],
    [
      { label: 'Departure date', value: formatDate(advance.departureDate) },
      { label: 'Return date', value: formatDate(advance.returnDate) },
    ],
  ], y) + 17;

  y = drawSectionHeading(doc, 'Advance payment details', y);
  y = drawAmountCards(doc, advance, y) + 17;

  const remarks = advance.officerRemarks?.trim() || 'No officer remarks provided.';
  const remarksHeight = getRemarksHeight(doc, remarks);
  const footerY = doc.page.height - doc.page.margins.bottom - 104;
  if (y + 25 + remarksHeight + 28 > footerY - 10) {
    doc.addPage();
    drawContinuationHeader(doc, advance);
    y = 105;
  }
  y = drawSectionHeading(doc, 'Officer remarks', y);
  drawRemarksCard(doc, remarks, y, remarksHeight);
  drawSignatureFooter(doc, advance);
  doc.end();
}
