/**
 * Commission Calculation Engine
 * Handles tiered/accelerator commission calculations
 */

import { PlanTier, TierBreakdown, CommissionCalculation, SalesforceOpportunity } from '../types';

/**
 * Calculate commission with tiered rates (accelerators)
 *
 * Example tiers:
 * - 0-100% attainment: 10% base rate
 * - 100-125% attainment: 15% accelerated rate
 * - 125%+ attainment: 20% super accelerator
 */
export function calculateTieredCommission(
  bookings: number,
  quota: number,
  tiers: PlanTier[]
): CommissionCalculation {
  if (quota <= 0) {
    return {
      grossCommission: 0,
      tierBreakdown: [],
      attainmentPercent: 0,
    };
  }

  const attainment = bookings / quota;
  const sortedTiers = [...tiers].sort((a, b) =>
    (a.Attainment_Floor__c || 0) - (b.Attainment_Floor__c || 0)
  );

  let totalCommission = 0;
  const breakdown: TierBreakdown[] = [];

  for (const tier of sortedTiers) {
    const tierFloor = (tier.Attainment_Floor__c || 0) / 100; // Convert percentage to decimal
    const tierCeiling = tier.Attainment_Ceiling__c
      ? tier.Attainment_Ceiling__c / 100
      : Infinity;
    const tierRate = (tier.Commission_Rate__c || 0) / 100; // Convert percentage to decimal

    const tierFloorAmount = tierFloor * quota;
    const tierCeilingAmount = tierCeiling === Infinity ? Infinity : tierCeiling * quota;

    // Calculate bookings that fall in this tier
    const bookingsAboveFloor = Math.max(bookings - tierFloorAmount, 0);
    const tierRange = tierCeilingAmount - tierFloorAmount;
    const bookingsInTier = Math.min(bookingsAboveFloor, tierRange);

    if (bookingsInTier > 0) {
      const tierCommission = bookingsInTier * tierRate;
      totalCommission += tierCommission;

      breakdown.push({
        tierName: tier.Name || `${tierFloor * 100}% - ${tierCeiling === Infinity ? 'Uncapped' : tierCeiling * 100 + '%'}`,
        bookingsInTier,
        rateApplied: tierRate,
        commissionAmount: tierCommission,
      });
    }
  }

  return {
    grossCommission: totalCommission,
    tierBreakdown: breakdown,
    attainmentPercent: attainment * 100,
  };
}

/**
 * Calculate commission for each deal with running attainment
 * This tracks which tier each deal falls into based on running total
 */
export interface DealCommission {
  opportunityId: string;
  opportunityName: string;
  dealAmount: number;
  commissionRate: number;
  commissionAmount: number;
  tierApplied: string;
  attainmentAtDeal: number;
  runningBookings: number;
}

export function calculateDealByDealCommission(
  deals: SalesforceOpportunity[],
  quota: number,
  tiers: PlanTier[]
): DealCommission[] {
  if (quota <= 0 || deals.length === 0) {
    return [];
  }

  // Sort deals by close date
  const sortedDeals = [...deals].sort(
    (a, b) => new Date(a.CloseDate).getTime() - new Date(b.CloseDate).getTime()
  );

  // Sort tiers by floor
  const sortedTiers = [...tiers].sort((a, b) =>
    (a.Attainment_Floor__c || 0) - (b.Attainment_Floor__c || 0)
  );

  let runningBookings = 0;
  const dealCommissions: DealCommission[] = [];

  for (const deal of sortedDeals) {
    const dealAmount = deal.Amount || 0;
    runningBookings += dealAmount;
    const attainmentAtDeal = (runningBookings / quota) * 100;

    // Find the applicable tier for this deal based on current attainment
    const applicableTier = findTierForAttainment(attainmentAtDeal, sortedTiers);
    const commissionRate = applicableTier
      ? (applicableTier.Commission_Rate__c || 0) / 100
      : 0;
    const commissionAmount = dealAmount * commissionRate;

    dealCommissions.push({
      opportunityId: deal.Id,
      opportunityName: deal.Name,
      dealAmount,
      commissionRate,
      commissionAmount,
      tierApplied: applicableTier?.Name || 'Base',
      attainmentAtDeal,
      runningBookings,
    });
  }

  return dealCommissions;
}

/**
 * Find the tier that applies for a given attainment percentage
 */
function findTierForAttainment(attainmentPercent: number, tiers: PlanTier[]): PlanTier | null {
  // Find the highest tier where attainment >= floor
  let applicableTier: PlanTier | null = null;

  for (const tier of tiers) {
    const floor = tier.Attainment_Floor__c || 0;
    const ceiling = tier.Attainment_Ceiling__c || Infinity;

    if (attainmentPercent >= floor && attainmentPercent < ceiling) {
      applicableTier = tier;
      break;
    }

    // If we're above the ceiling of this tier, this might still be the best match
    // if there's no higher tier
    if (attainmentPercent >= floor) {
      applicableTier = tier;
    }
  }

  return applicableTier;
}

/**
 * Calculate simple percentage-based commission (no tiers)
 */
export function calculateSimpleCommission(
  bookings: number,
  rate: number
): number {
  return bookings * (rate / 100);
}

/**
 * Calculate SDR commission based on opportunity count
 */
export function calculateSDRCommission(
  oppCount: number,
  perOppRate: number
): number {
  return oppCount * perOppRate;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
