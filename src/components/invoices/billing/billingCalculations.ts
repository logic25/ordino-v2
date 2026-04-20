export type BillingMode = "amount" | "percent";

interface CalculateBilledAmountInput {
  billingMode: BillingMode;
  inputValue: number;
  remaining: number;
}

function roundCurrency(value: number) {
  return +value.toFixed(2);
}

export function calculateBilledAmount({ billingMode, inputValue, remaining }: CalculateBilledAmountInput) {
  const safeRemaining = Math.max(0, Number(remaining) || 0);
  const safeInputValue = Math.max(0, Number(inputValue) || 0);

  if (billingMode === "percent") {
    const safePercent = Math.min(100, safeInputValue);
    return roundCurrency(safeRemaining * (safePercent / 100));
  }

  return roundCurrency(Math.min(safeRemaining, safeInputValue));
}

interface ResolvePreviouslyBilledAmountInput {
  serviceId: string;
  serviceName: string;
  serviceBilledAmount?: number | null;
  billedById?: Record<string, number>;
  billedByName?: Record<string, number>;
}

export function resolvePreviouslyBilledAmount({
  serviceId,
  serviceName,
  serviceBilledAmount,
  billedById = {},
  billedByName = {},
}: ResolvePreviouslyBilledAmountInput) {
  return roundCurrency(
    Math.max(
      Number(serviceBilledAmount) || 0,
      billedById[serviceId] || 0,
      billedByName[serviceName] || 0,
    ),
  );
}

export function formatRemainingBalanceDescription(percent: number, remaining: number) {
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  const safeRemaining = Math.max(0, Number(remaining) || 0);

  return `${safePercent}% of remaining balance $${safeRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}