import type { ReactElement } from 'react';

import { serverGet, type PlanRow } from '../../lib/server-api';

import PricingClient from './pricing-client';

export default async function PricingPage(): Promise<ReactElement> {
  const plans = await serverGet<PlanRow[]>('payments/plans');
  return <PricingClient plans={plans} />;
}
