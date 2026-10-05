const PDFDocument = require('pdfkit');

/**
 * Generates a luxury, publication-grade WanderStay Booking Invoice PDF
 * matching WanderStay brand aesthetics and design guidelines.
 *
 * @param {Object} booking - Fully populated Booking document (listing with owner, guest)
 * @param {Stream} outputStream - Writable stream (e.g. Express res)
 */
function generateBookingInvoice(booking, outputStream) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `WanderStay Invoice - #${booking._id.toString().slice(-8).toUpperCase()}`,
          Author: 'WanderStay Inc.',
          Subject: 'Official Booking Receipt & Invoice',
          Keywords: 'WanderStay, Invoice, Booking, Travel, Receipt'
        }
      });

      if (outputStream) {
        doc.pipe(outputStream);
      }

      const buffers = [];
      if (!outputStream) {
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
      } else {
        doc.on('end', () => resolve());
      }
      doc.on('error', err => reject(err));

      // Brand Palette
      const primaryColor = '#FF385C'; // WanderStay signature coral
      const primaryDark = '#D90B38';
      const textDark = '#111827';    // Deep Slate
      const textMuted = '#6B7280';   // Muted Gray
      const borderLine = '#E5E7EB';  // Light Gray
      const tableBg = '#F9FAFB';     // Subtle slate
      const successColor = '#059669';// Green

      // 1. Top Decorative Brand Banner (Slim 5pt coral ribbon across top)
      doc.rect(0, 0, 595.28, 6).fill(primaryColor);

      // 2. Header: Logo & Invoice Title
      let y = 35;

      // Draw Vector WanderStay Emblem (Crisp, Resolution-independent)
      doc.save();
      // Outer rounded emblem badge
      doc.roundedRect(40, y, 38, 38, 8).fill(primaryColor);

      // Emblem Interior: Stylized Peak + Pin
      doc.fillColor('#FFFFFF');
      // Mountain Peak
      doc.polygon([59, y + 10], [50, y + 26], [68, y + 26]).fill();
      // Compass Star / Hearth
      doc.polygon([59, y + 20], [55, y + 28], [63, y + 28]).fillColor('#111827').fill();
      doc.circle(59, y + 13, 2).fillColor('#FFFFFF').fill();
      doc.restore();

      // Brand Wordmark
      doc.font('Helvetica-Bold').fontSize(22).fillColor(textDark)
        .text('Wander', 86, y + 2, { continued: true });
      doc.fillColor(primaryColor)
        .text('Stay', { continued: false });

      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted)
        .text('WANDER FAR • STAY SOMEWHERE EXTRAORDINARY', 86, y + 26, { characterSpacing: 0.5 });

      // Invoice Title & Meta (Right Column)
      doc.font('Helvetica-Bold').fontSize(20).fillColor(textDark)
        .text('BOOKING INVOICE', 320, y + 2, { align: 'right', width: 235 });

      const invoiceNum = `INV-WS-${booking._id.toString().slice(-8).toUpperCase()}`;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
        .text(invoiceNum, 320, y + 26, { align: 'right', width: 235 });

      y += 55;

      // 3. Status Badge & Metadata Bar
      doc.rect(40, y, 515.28, 30).fill(tableBg);
      doc.rect(40, y, 515.28, 30).strokeColor(borderLine).lineWidth(0.75).stroke();

      const bookingDate = booking.createdAt
        ? new Date(booking.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted)
        .text('ISSUED DATE:', 52, y + 10);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark)
        .text(bookingDate, 120, y + 10);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted)
        .text('BOOKING REF:', 220, y + 10);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark)
        .text(`#${booking._id.toString().slice(-10).toUpperCase()}`, 292, y + 10);

      const isPaid = (booking.paymentStatus === 'paid' || booking.status === 'confirmed');
      const statusLabel = isPaid ? 'PAID & CONFIRMED' : (booking.status || 'PENDING').toUpperCase();
      const statusBg = isPaid ? '#DCFCE7' : '#FEF3C7';
      const statusTextColor = isPaid ? '#166534' : '#92400E';

      // Status pill badge on right
      doc.roundedRect(435, y + 6, 110, 18, 9).fill(statusBg);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statusTextColor)
        .text(statusLabel, 435, y + 11, { align: 'center', width: 110 });

      y += 45;

      // 4. Two-Column Information Box (Guest Details & Property / Stay Details)
      const colWidth = 245;

      // Left Column: Guest / Billed To
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryColor)
        .text('BILLED TO (GUEST)', 40, y);
      doc.rect(40, y + 13, colWidth, 1).fill(borderLine);

      const guestName = booking.guest
        ? (booking.guest.fullName || booking.guest.username || 'Traveler')
        : 'Traveler';
      const guestEmail = booking.guest ? booking.guest.email : 'N/A';
      const guestPhone = booking.guest && booking.guest.phone ? booking.guest.phone : 'Not provided';

      doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark)
        .text(guestName, 40, y + 20);
      doc.font('Helvetica').fontSize(9).fillColor(textMuted)
        .text(guestEmail, 40, y + 35)
        .text(`Phone: ${guestPhone}`, 40, y + 49)
        .text(`Account ID: @${booking.guest ? booking.guest.username : 'traveler'}`, 40, y + 63);

      // Right Column: Property & Host
      const rightX = 310;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryColor)
        .text('PROPERTY & HOST DETAILS', rightX, y);
      doc.rect(rightX, y + 13, colWidth, 1).fill(borderLine);

      const propTitle = booking.listing ? booking.listing.title : 'WanderStay Property';
      const propLocation = booking.listing
        ? `${booking.listing.location}, ${booking.listing.country}`
        : 'Destination Worldwide';
      const hostName = (booking.listing && booking.listing.owner)
        ? (booking.listing.owner.fullName || booking.listing.owner.username || 'WanderStay Verified Host')
        : 'WanderStay Verified Host';

      doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark)
        .text(propTitle, rightX, y + 20, { width: colWidth, ellipsis: true });
      doc.font('Helvetica').fontSize(9).fillColor(textMuted)
        .text(propLocation, rightX, y + 35)
        .text(`Host: ${hostName}`, rightX, y + 49)
        .text(`Category: ${booking.listing ? booking.listing.category : 'Luxury Stay'}`, rightX, y + 63);

      y += 88;

      // 5. Itinerary Details Ribbon (Check-in, Check-out, Nights, Guests)
      doc.rect(40, y, 515.28, 48).fill('#F3F4F6');
      doc.rect(40, y, 515.28, 48).strokeColor(borderLine).lineWidth(0.75).stroke();

      const formatCheckDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      };

      const segWidth = 515.28 / 4;

      // Check-in
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('CHECK-IN', 40 + (segWidth * 0), y + 10, { align: 'center', width: segWidth });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark).text(formatCheckDate(booking.checkIn), 40 + (segWidth * 0), y + 22, { align: 'center', width: segWidth });
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('(From 3:00 PM)', 40 + (segWidth * 0), y + 34, { align: 'center', width: segWidth });

      // Check-out
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('CHECK-OUT', 40 + (segWidth * 1), y + 10, { align: 'center', width: segWidth });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark).text(formatCheckDate(booking.checkOut), 40 + (segWidth * 1), y + 22, { align: 'center', width: segWidth });
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('(By 11:00 AM)', 40 + (segWidth * 1), y + 34, { align: 'center', width: segWidth });

      // Nights
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('DURATION', 40 + (segWidth * 2), y + 10, { align: 'center', width: segWidth });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text(`${booking.nights} ${booking.nights === 1 ? 'Night' : 'Nights'}`, 40 + (segWidth * 2), y + 22, { align: 'center', width: segWidth });

      // Guests
      doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text('TRAVELERS', 40 + (segWidth * 3), y + 10, { align: 'center', width: segWidth });
      const guestCount = booking.guests || 1;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text(`${guestCount} ${guestCount === 1 ? 'Guest' : 'Guests'}`, 40 + (segWidth * 3), y + 22, { align: 'center', width: segWidth });

      // Vertical dividers between segments
      for (let i = 1; i <= 3; i++) {
        doc.moveTo(40 + (segWidth * i), y + 8).lineTo(40 + (segWidth * i), y + 40).strokeColor(borderLine).lineWidth(0.5).stroke();
      }

      y += 65;

      // 6. Itemized Price Breakdown Table
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
        .text('ITEMIZED PRICING BREAKDOWN', 40, y);
      y += 15;

      // Table Header Row
      doc.rect(40, y, 515.28, 22).fill(textDark);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('DESCRIPTION', 52, y + 7, { width: 220 });
      doc.text('RATE', 280, y + 7, { width: 75, align: 'right' });
      doc.text('QTY / UNITS', 365, y + 7, { width: 70, align: 'center' });
      doc.text('AMOUNT (INR)', 445, y + 7, { width: 100, align: 'right' });
      y += 22;

      // Pricing Calculations
      const pricePerNight = (booking.listing && booking.listing.price)
        ? booking.listing.price
        : Math.round((booking.totalPrice - 1250) / (booking.nights || 1));
      const subtotal = pricePerNight * (booking.nights || 1);
      const cleaningFee = 500;
      const serviceFee = 750;
      const discount = 0;
      const totalAmount = booking.totalPrice || (subtotal + cleaningFee + serviceFee);

      const tableRows = [
        {
          desc: `Property Stay Accommodation (${booking.listing ? booking.listing.title : 'WanderStay'})`,
          subDesc: `${booking.nights} night stay in ${booking.listing ? booking.listing.location : 'destination'}`,
          rate: `₹${Number(pricePerNight).toLocaleString('en-IN')}`,
          qty: `${booking.nights} ${booking.nights === 1 ? 'night' : 'nights'}`,
          amount: `₹${Number(subtotal).toLocaleString('en-IN')}`
        },
        {
          desc: 'Standard Cleaning & Sanitization Fee',
          subDesc: 'Professional turnover and hygiene preparation',
          rate: `₹${Number(cleaningFee).toLocaleString('en-IN')}`,
          qty: '1 Stay',
          amount: `₹${Number(cleaningFee).toLocaleString('en-IN')}`
        },
        {
          desc: 'WanderStay Service & Platform Fee',
          subDesc: '24/7 guest support, secure transaction processing & guarantee',
          rate: `₹${Number(serviceFee).toLocaleString('en-IN')}`,
          qty: '1 Stay',
          amount: `₹${Number(serviceFee).toLocaleString('en-IN')}`
        }
      ];

      tableRows.forEach((row, idx) => {
        const rowHeight = 32;
        if (idx % 2 === 1) {
          doc.rect(40, y, 515.28, rowHeight).fill(tableBg);
        }
        doc.rect(40, y, 515.28, rowHeight).strokeColor(borderLine).lineWidth(0.5).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark)
          .text(row.desc, 52, y + 6, { width: 220, ellipsis: true });
        doc.font('Helvetica').fontSize(7.5).fillColor(textMuted)
          .text(row.subDesc, 52, y + 17, { width: 220, ellipsis: true });

        doc.font('Helvetica').fontSize(8.5).fillColor(textDark)
          .text(row.rate, 280, y + 10, { width: 75, align: 'right' });

        doc.font('Helvetica').fontSize(8.5).fillColor(textDark)
          .text(row.qty, 365, y + 10, { width: 70, align: 'center' });

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark)
          .text(row.amount, 445, y + 10, { width: 100, align: 'right' });

        y += rowHeight;
      });

      y += 10;

      // 7. Totals & Payment Verification Box
      // Left Sub-box: Payment & Transaction Details (Safe, No secrets)
      const payBoxY = y;
      doc.roundedRect(40, payBoxY, 260, 95, 6).fill(tableBg);
      doc.roundedRect(40, payBoxY, 260, 95, 6).strokeColor(borderLine).lineWidth(0.75).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor)
        .text('PAYMENT VERIFICATION (SECURITY SAFE)', 52, payBoxY + 10);

      const payMethod = 'Razorpay Instant Verified';
      const orderRef = booking.razorpayOrderId || `ORD-WS-${booking._id.toString().slice(-8).toUpperCase()}`;
      const paymentRef = booking.razorpayPaymentId || (isPaid ? 'PAY-VERIFIED' : 'Pending Verification');

      doc.font('Helvetica').fontSize(8).fillColor(textMuted).text('Payment Gateway:', 52, payBoxY + 25);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark).text(payMethod, 140, payBoxY + 25);

      doc.font('Helvetica').fontSize(8).fillColor(textMuted).text('Payment ID:', 52, payBoxY + 38);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark).text(paymentRef, 140, payBoxY + 38);

      doc.font('Helvetica').fontSize(8).fillColor(textMuted).text('Order ID:', 52, payBoxY + 51);
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text(orderRef, 140, payBoxY + 51);

      doc.font('Helvetica').fontSize(8).fillColor(textMuted).text('Payment Status:', 52, payBoxY + 64);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(isPaid ? successColor : '#D97706')
        .text(isPaid ? 'PAID & VERIFIED (INR)' : 'PENDING PAYMENT', 140, payBoxY + 64);

      if (booking.paidAt) {
        const paidAtStr = new Date(booking.paidAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        doc.font('Helvetica').fontSize(7.5).fillColor(textMuted).text(`Paid on: ${paidAtStr}`, 52, payBoxY + 79);
      }

      // Right Sub-box: Financial Totals
      const sumBoxX = 320;
      const sumBoxWidth = 235.28;

      const summaryLines = [
        { label: 'Stay Subtotal:', val: `₹${Number(subtotal).toLocaleString('en-IN')}` },
        { label: 'Cleaning Fee:', val: `₹${Number(cleaningFee).toLocaleString('en-IN')}` },
        { label: 'Service & Platform Fee:', val: `₹${Number(serviceFee).toLocaleString('en-IN')}` },
        { label: 'Promotional Discount:', val: discount > 0 ? `-₹${Number(discount).toLocaleString('en-IN')}` : '₹0.00' }
      ];

      let sumY = payBoxY;
      summaryLines.forEach(item => {
        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted)
          .text(item.label, sumBoxX, sumY + 4, { width: 130, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(textDark)
          .text(item.val, sumBoxX + 130, sumY + 4, { width: sumBoxWidth - 130, align: 'right' });
        sumY += 16;
      });

      // Grand Total Highlight Banner
      doc.rect(sumBoxX, sumY + 4, sumBoxWidth, 26).fill(textDark);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF')
        .text('TOTAL PAID (INR):', sumBoxX + 10, sumY + 12);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#10B981')
        .text(`₹${Number(totalAmount).toLocaleString('en-IN')}`, sumBoxX + 110, sumY + 11, { width: sumBoxWidth - 120, align: 'right' });

      y = payBoxY + 110;

      // 8. Important Travel Terms & Support Information
      doc.rect(40, y, 515.28, 48).fill('#FFF5F5');
      doc.rect(40, y, 515.28, 48).strokeColor('#FECDD3').lineWidth(0.5).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryDark)
        .text('IMPORTANT POLICIES & ASSISTANCE', 52, y + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor(textDark)
        .text('• Cancellation Policy: Free cancellation within standard window. Refund will be credited to original payment source.', 52, y + 19)
        .text('• Check-in Assistance: Please present government ID upon arrival. Contact your host via the WanderStay messaging portal.', 52, y + 28)
        .text('• Dedicated Support: Need assistance? Reach our 24/7 team at support@wanderstay.com or visit www.wanderstay.com/help', 52, y + 37);

      // 9. Official Brand Footer (Anchored to bottom of page)
      const footerY = 790;
      doc.moveTo(40, footerY).lineTo(555.28, footerY).strokeColor(borderLine).lineWidth(0.5).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark)
        .text('Thank you for wandering with us. Have an extraordinary journey!', 40, footerY + 8, { align: 'center', width: 515.28 });

      doc.font('Helvetica').fontSize(7).fillColor(textMuted)
        .text('WanderStay Inc. • Handpicked Luxury Accommodations Worldwide • www.wanderstay.com • support@wanderstay.com', 40, footerY + 19, { align: 'center', width: 515.28 });

      // Finalize document
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateBookingInvoice
};
