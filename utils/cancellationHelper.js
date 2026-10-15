/**
 * WanderStay Cancellation Policy Helper
 * Defines structured cancellation policies (Flexible, Moderate, Strict)
 * and calculates exact refund amounts securely based on booking timeline and payments.
 */

const CANCELLATION_POLICIES = {
  Flexible: {
    name: 'Flexible',
    badgeClass: 'bg-success-subtle text-success border border-success-subtle',
    color: '#059669',
    icon: 'fa-solid fa-feather-pointed',
    headline: 'Full refund 1 day prior to arrival',
    summary: 'Cancel up to 24 hours before check-in for a full 100% refund. Cancel within 24 hours for a 50% refund.',
    rules: [
      {
        cutoff: '24+ hours before check-in',
        refundText: '100% Refund',
        percentage: 100,
        description: 'Full refund if cancelled at least 24 hours prior to standard 3:00 PM check-in.'
      },
      {
        cutoff: 'Within 24 hours of check-in',
        refundText: '50% Refund',
        percentage: 50,
        description: '50% refund of the total booking price.'
      },
      {
        cutoff: 'After check-in time',
        refundText: 'No Refund (0%)',
        percentage: 0,
        description: 'No refund once the scheduled check-in time has passed.'
      }
    ]
  },
  Moderate: {
    name: 'Moderate',
    badgeClass: 'bg-warning-subtle text-warning border border-warning-subtle',
    color: '#D97706',
    icon: 'fa-solid fa-scale-balanced',
    headline: 'Full refund 5 days prior to arrival',
    summary: 'Cancel up to 5 days before check-in for a 100% refund. Cancel within 5 days for a 50% refund.',
    rules: [
      {
        cutoff: '5+ days (120 hrs) before check-in',
        refundText: '100% Refund',
        percentage: 100,
        description: 'Full refund if cancelled at least 5 full days before check-in.'
      },
      {
        cutoff: '1 to 5 days before check-in',
        refundText: '50% Refund',
        percentage: 50,
        description: '50% refund of the total booking price.'
      },
      {
        cutoff: 'Less than 24 hours before check-in',
        refundText: 'No Refund (0%)',
        percentage: 0,
        description: 'No refund if cancelled less than 24 hours prior to arrival.'
      }
    ]
  },
  Strict: {
    name: 'Strict',
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
    color: '#DC2626',
    icon: 'fa-solid fa-shield-halved',
    headline: 'Full refund within 48h of booking (14+ days before arrival)',
    summary: 'Full refund within 48 hours of booking and 14+ days before arrival. 50% refund up to 7 days before check-in.',
    rules: [
      {
        cutoff: 'Within 48h of booking & 14+ days before check-in',
        refundText: '100% Refund',
        percentage: 100,
        description: 'Full refund if booked at least 14 days in advance and cancelled within 48 hours of reservation.'
      },
      {
        cutoff: '7+ days before check-in',
        refundText: '50% Refund',
        percentage: 50,
        description: '50% refund of the total booking price if cancelled at least 7 days before arrival.'
      },
      {
        cutoff: 'Less than 7 days before check-in',
        refundText: 'No Refund (0%)',
        percentage: 0,
        description: 'No refund within 7 days of scheduled arrival.'
      }
    ]
  }
};

/**
 * Retrieves policy details or defaults to Flexible.
 * @param {string} policyName
 * @returns {Object}
 */
function getCancellationPolicy(policyName) {
  if (policyName && CANCELLATION_POLICIES[policyName]) {
    return CANCELLATION_POLICIES[policyName];
  }
  return CANCELLATION_POLICIES.Flexible;
}

/**
 * Calculates refund eligibility and exact amounts securely on the server.
 * Never trust refund values or percentages from the frontend.
 *
 * @param {Object} params - { booking, listing, cancellationTime }
 * @returns {Object}
 */
function calculateRefund({ booking, listing, cancellationTime = new Date() }) {
  const policyName = 
    (booking && booking.cancellationPolicy) ||
    (listing && listing.cancellationPolicy) ||
    (booking && booking.cancellation && booking.cancellation.policyApplied) ||
    'Flexible';

  const policy = getCancellationPolicy(policyName);

  // Normalize check-in to 3:00 PM local time on checkIn date
  const checkInDate = new Date(booking.checkIn);
  checkInDate.setHours(15, 0, 0, 0);

  const now = new Date(cancellationTime);
  const diffMs = checkInDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  const createdAt = booking.createdAt ? new Date(booking.createdAt) : now;
  const hoursSinceBooking = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  let refundPercentage = 0;
  let explanation = '';

  if (diffHours <= 0) {
    refundPercentage = 0;
    explanation = 'Check-in time has already passed. In accordance with policy terms, no refund is available.';
  } else if (policyName === 'Flexible') {
    if (diffHours >= 24) {
      refundPercentage = 100;
      explanation = `Cancelled ${Math.floor(diffHours)} hours before check-in (requires 24+ hours). Eligible for a full 100% refund.`;
    } else {
      refundPercentage = 50;
      explanation = `Cancelled within 24 hours of check-in (${Math.floor(diffHours)} hours remaining). Eligible for a 50% partial refund.`;
    }
  } else if (policyName === 'Moderate') {
    if (diffDays >= 5) {
      refundPercentage = 100;
      explanation = `Cancelled ${Math.floor(diffDays)} days before check-in (requires 5+ days). Eligible for a full 100% refund.`;
    } else if (diffHours >= 24) {
      refundPercentage = 50;
      explanation = `Cancelled between 1 and 5 days before check-in (${Math.floor(diffHours)} hours remaining). Eligible for a 50% partial refund.`;
    } else {
      refundPercentage = 0;
      explanation = `Cancelled less than 24 hours before check-in (${Math.floor(diffHours)} hours remaining). No refund is eligible under Moderate policy.`;
    }
  } else if (policyName === 'Strict') {
    if (hoursSinceBooking <= 48 && diffDays >= 14) {
      refundPercentage = 100;
      explanation = `Cancelled within 48 hours of booking and ${Math.floor(diffDays)} days before check-in. Eligible for a full 100% refund.`;
    } else if (diffDays >= 7) {
      refundPercentage = 50;
      explanation = `Cancelled ${Math.floor(diffDays)} days before check-in (requires 7+ days). Eligible for a 50% partial refund.`;
    } else {
      refundPercentage = 0;
      explanation = `Cancelled less than 7 days before check-in (${Math.floor(diffDays)} days remaining). No refund is eligible under Strict policy.`;
    }
  }

  const isPaid = booking.paymentStatus === 'paid';
  const totalPaid = Number(booking.totalPrice) || 0;
  const refundAmount = isPaid ? Math.round((totalPaid * refundPercentage) / 100) : 0;
  const nonRefundableAmount = isPaid ? Math.max(0, totalPaid - refundAmount) : 0;

  return {
    policy,
    policyName,
    hoursUntilCheckIn: Math.max(0, Math.floor(diffHours)),
    daysUntilCheckIn: Math.max(0, Math.floor(diffDays)),
    isPastCheckIn: diffHours <= 0,
    refundPercentage,
    refundAmount,
    totalPaid,
    nonRefundableAmount,
    explanation,
    isPaid
  };
}

module.exports = {
  CANCELLATION_POLICIES,
  getCancellationPolicy,
  calculateRefund
};
