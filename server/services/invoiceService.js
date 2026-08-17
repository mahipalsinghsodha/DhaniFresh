const PDFDocument = require('pdfkit');

function buildInvoiceDocument(doc, invoice) {
  const textColor = '#333333';
  const lightGray = '#A0A0A0';
  const hrColor = '#000000';

  // Format dates
  const orderDate = new Date(invoice.createdAt || invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const invoiceDate = new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

  // Address string builder
  const formatAddress = (addr) => {
    if (!addr) return '';
    let res = [];
    if (addr.street) res.push(addr.street);
    if (addr.city || addr.state || addr.zipCode) {
      let loc = [];
      if (addr.city) loc.push(addr.city);
      if (addr.state) loc.push(addr.state);
      if (addr.zipCode) loc.push(addr.zipCode);
      res.push(loc.join(', '));
    }
    return res;
  };

  const addressLines = formatAddress(invoice.customer.address);
  const phone = invoice.customer.address?.phone || '';

  // 1. Header Section
  doc
    .fillColor('#000000')
    .fontSize(22)
    .font('Helvetica-BoldOblique')
    .text('Daatasa', 30, 30, { align: 'left' });

  const companyDetails = invoice.companyDetails || {
    name: 'Daatasa',
    email: 'support@daatasa.com',
    address: 'B-302, Phase 1, Industrial Area, Maharashtra - 410209',
    gstin: '29AAAAA0000A1Z5'
  };

  // Contact Info
  doc
    .fontSize(10)
    .fillColor(textColor)
    .font('Helvetica')
    .text(`Contact us: ${companyDetails.email}`, 140, 35)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(companyDetails.name, 140, 50, { width: 250 })
    .font('Helvetica')
    .fontSize(8)
    .text(`Warehouse Address: ${companyDetails.address}`, 140, 65, { width: 250 });

  // Tax Invoice Box
  doc
    .rect(400, 32, 160, 16)
    .dash(2, { space: 2 })
    .stroke(textColor)
    .undash();

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(textColor)
    .text(`Tax Invoice # ${invoice.invoiceNumber}`, 405, 36);

  // Horizontal line
  doc.moveTo(30, 75).lineTo(565, 75).lineWidth(1).stroke(lightGray);

  // 2. Details & Addresses Section
  let y = 85;

  // Left Column
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Order ID: ', 30, y, { continued: true })
    .font('Helvetica-Bold')
    .text(invoice.orderIdString || invoice.orderId.toString().slice(-8).toUpperCase())
    .font('Helvetica-Bold')
    .text('Order Date: ', 30, y + 20, { continued: true })
    .font('Helvetica')
    .text(orderDate)
    .font('Helvetica-Bold')
    .text('Invoice Date: ', 30, y + 40, { continued: true })
    .font('Helvetica')
    .text(invoiceDate)
    .font('Helvetica-Bold')
    .text('GSTIN: ', 30, y + 60, { continued: true })
    .font('Helvetica')
    .text(companyDetails.gstin);

  let leftY = y + 80;
  if (invoice.paymentMethod) {
    doc.font('Helvetica-Bold').text('Payment Mode: ', 30, leftY, { continued: true }).font('Helvetica').text(invoice.paymentMethod);
    leftY += 15;
  }
  if (invoice.transactionId) {
    doc.font('Helvetica-Bold').text('Txn ID: ', 30, leftY, { continued: true }).font('Helvetica').text(invoice.transactionId);
    leftY += 15;
  }
  if (invoice.paymentInfo && invoice.paymentInfo.method) {
    if (invoice.paymentInfo.vpa) {
      doc.font('Helvetica-Bold').text('UPI ID: ', 30, leftY, { continued: true }).font('Helvetica').text(invoice.paymentInfo.vpa);
      leftY += 15;
    } else if (invoice.paymentInfo.cardNetwork || invoice.paymentInfo.bank) {
      const cardStr = [invoice.paymentInfo.cardNetwork, invoice.paymentInfo.bank].filter(Boolean).join(' - ');
      doc.font('Helvetica-Bold').text('Card/Bank: ', 30, leftY, { continued: true }).font('Helvetica').text(cardStr);
      leftY += 15;
    } else {
      doc.font('Helvetica-Bold').text('Payment Type: ', 30, leftY, { continued: true }).font('Helvetica').text(invoice.paymentInfo.method.toUpperCase());
      leftY += 15;
    }
  }

  // Billing Address
  doc
    .font('Helvetica-Bold')
    .text('Billing Address', 180, y)
    .font('Helvetica')
    .text(invoice.customer.name, 180, y + 15);
  
  let currentY = y + 30;
  addressLines.forEach(line => {
    doc.text(line, 180, currentY);
    currentY += 15;
  });
  if (phone) {
    doc.text(`Phone: ${phone}`, 180, currentY);
  }

  // Shipping Address
  doc
    .font('Helvetica-Bold')
    .text('Shipping Address', 380, y)
    .font('Helvetica-BoldOblique')
    .text(invoice.customer.name, 380, y + 15);
  
  let shipY = y + 30;
  addressLines.forEach(line => {
    doc.font('Helvetica').text(line, 380, shipY);
    shipY += 15;
  });
  if (phone) {
    doc.text(`Phone: ${phone}`, 380, shipY);
    shipY += 15;
  }

  // Warranty note
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor('#666666')
    .text('*Keep this invoice and manufacturer box for warranty purposes.', 450, shipY + 5, { width: 110, align: 'right' });

  // 3. Items Table Header
  const tableY = Math.max(currentY, shipY, (typeof leftY !== 'undefined' ? leftY : 0)) + 30;
  
  doc.moveTo(30, tableY).lineTo(565, tableY).lineWidth(2).stroke(hrColor);

  const colProd = 30;
  const colTitle = 130;
  const colQty = 370;
  const colPrice = 410;
  const colTax = 465;
  const colTotal = 515;

  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Product', colProd, tableY + 5)
    .text('Title', colTitle, tableY + 5)
    .text('Qty', colQty, tableY + 5, { width: 30, align: 'right' })
    .text('Price (Rs)', colPrice, tableY + 5, { width: 50, align: 'right' })
    .text('Tax (Rs)', colTax, tableY + 5, { width: 45, align: 'right' })
    .text('Total (Rs)', colTotal, tableY + 5, { width: 50, align: 'right' });

  doc.moveTo(30, tableY + 20).lineTo(565, tableY + 20).lineWidth(1).stroke(lightGray);

  // 4. Items List
  let pos = tableY + 30;
  let totalQty = 0;
  let totalTax = Number(invoice.tax) || 0;

  invoice.items.forEach(item => {
    totalQty += item.quantity;
    
    // Calculate approximate tax per item if total tax > 0
    let itemTotal = Number(item.total);
    let taxRatio = invoice.subtotal > 0 ? (totalTax / invoice.subtotal) : 0;
    let taxAmt = (itemTotal * taxRatio).toFixed(2);
    let priceExTax = (itemTotal - taxAmt).toFixed(2);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666666')
      .text(item.category || 'Daatasa Premium Ghee', colProd, pos, { width: 90 })
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text(item.name, colTitle, pos, { width: 230 })
      .font('Helvetica')
      .text(item.quantity.toString(), colQty, pos, { width: 30, align: 'right' })
      .text(priceExTax, colPrice, pos, { width: 50, align: 'right' })
      .text(taxAmt, colTax, pos, { width: 45, align: 'right' })
      .text(itemTotal.toFixed(2), colTotal, pos, { width: 50, align: 'right' });

    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .fillColor('#666666')
      .text(`Price is inclusive of taxes`, colTitle, pos + 15, { width: 230 });
    
    pos += 35;
  });

  doc.moveTo(30, pos).lineTo(565, pos).lineWidth(2).stroke(hrColor);

  // 5. Totals
  pos += 10;
  
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#000000')
    .text('Total', colTitle, pos, { align: 'right', width: 230 })
    .font('Helvetica-Bold')
    .text(totalQty.toString(), colQty, pos, { width: 30, align: 'right' })
    .text((Number(invoice.subtotal) - totalTax).toFixed(2), colPrice, pos, { width: 50, align: 'right' })
    .text(totalTax.toFixed(2), colTax, pos, { width: 45, align: 'right' })
    .text(Number(invoice.subtotal).toFixed(2), colTotal, pos, { width: 50, align: 'right' });

  pos += 25;
  doc.moveTo(30, pos).lineTo(565, pos).lineWidth(1).stroke(lightGray);

  // 6. Grand Total
  pos += 15;
  
  doc
    .fontSize(18)
    .font('Helvetica')
    .text('Grand Total', colTitle, pos, { align: 'right', width: 230 })
    .font('Helvetica-Bold')
    .text(`Rs ${Number(invoice.total).toFixed(2)}`, colPrice, pos, { width: 155, align: 'right' });

  pos += 30;
  doc.moveTo(30, pos).lineTo(565, pos).lineWidth(2).stroke(hrColor);

  // 7. Footer
  doc
    .fontSize(9)
    .font('Helvetica-Oblique')
    .fillColor('#666666')
    .text('This is a computer generated invoice. No signature required.', 30, pos + 15, { align: 'center' });

}

function generateInvoicePDF(invoice, res) {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
  buildInvoiceDocument(doc, invoice);
  doc.end();
}

function generateInvoiceBuffer(invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      buildInvoiceDocument(doc, invoice);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateInvoicePDF, generateInvoiceBuffer, buildInvoiceDocument };
