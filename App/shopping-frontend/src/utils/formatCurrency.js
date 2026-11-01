/**
 * Currency Formatting Utility
 * Standardizes INR (₹) representation across the SOLE skincare application.
 */

export function formatINR(amount) {
  if (amount == null || amount === "") return "₹0";
  const num = Number(amount);
  if (isNaN(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}

export default formatINR;
