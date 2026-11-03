import test from "node:test";
import assert from "node:assert/strict";

function buildDemoCheckoutPayload({
  userId,
  items,
  shippingAddress,
  idempotencyKey,
  paymentMethod,
  simulateFailure,
  demoAccount
}) {
  const PROHIBITED_KEYS = [
    "cvv", "cvc", "cardnumber", "card_number", "pan", "pin", "upipin", "upi_pin", "otp"
  ];

  // Validate that no prohibited financial keys are included in demo checkout payload
  const payloadKeys = Object.keys(arguments[0] || {}).map((k) => k.toLowerCase());
  const hasProhibited = PROHIBITED_KEYS.some((pk) => payloadKeys.includes(pk));
  if (hasProhibited) {
    throw new Error("Security violation: Real financial credentials (CVV, Card Number, PIN, OTP) must never be sent.");
  }

  return {
    userId,
    items,
    shippingAddress,
    idempotencyKey,
    paymentMethod: paymentMethod || "DEMO_SIMULATION",
    simulateFailure: Boolean(simulateFailure),
    demoAccount: demoAccount || "Instant Sandbox Simulation"
  };
}

function formatPaymentDisplay(order) {
  const isDemo = order?.isDemoPayment !== false;
  const disclaimer = isDemo ? "DEMO PAYMENT — No real money is transferred." : "";
  const label =
    order?.paymentMethod === "DEMO_UPI"
      ? "Simulated UPI Demo"
      : order?.paymentMethod === "DEMO_COD"
      ? "Cash on Delivery (Demo COD)"
      : "Instant Demo Simulation";

  return {
    isDemo,
    disclaimer,
    label,
    isGenuinePayment: false
  };
}

test("DEMO Payment Frontend Architecture & Safety Tests", async (t) => {
  await t.test("1. Payload Builder: Generates valid simulated checkout payload without collecting CVV or PIN", () => {
    const payload = buildDemoCheckoutPayload({
      userId: "60c72b2f9b1d8b001c8e4d1a",
      items: [{ productId: "60c72b2f9b1d8b001c8e4d1b", quantity: 1 }],
      shippingAddress: { fullName: "Test User", phone: "1234567890", addressLine1: "123 St", city: "NYC", state: "NY", postalCode: "10001" },
      idempotencyKey: "client_uuid_12345",
      paymentMethod: "DEMO_CARD",
      simulateFailure: false,
      demoAccount: "Demo Visa ending in 4242"
    });

    assert.equal(payload.paymentMethod, "DEMO_CARD");
    assert.equal(payload.simulateFailure, false);
    assert.equal(payload.demoAccount, "Demo Visa ending in 4242");
    assert.equal("cvv" in payload, false);
    assert.equal("pin" in payload, false);
  });

  await t.test("2. Security Guard: Strictly throws error if real financial credentials are passed", () => {
    assert.throws(
      () =>
        buildDemoCheckoutPayload({
          userId: "60c72b2f9b1d8b001c8e4d1a",
          items: [],
          cvv: "999", // Attempt to pass real CVV
          paymentMethod: "DEMO_CARD"
        }),
      /Real financial credentials/
    );
  });

  await t.test("3. Display Formatter: Never marks demo payments as genuine payments", () => {
    const display = formatPaymentDisplay({
      isDemoPayment: true,
      paymentMethod: "DEMO_UPI",
      paymentStatus: "demo_completed"
    });

    assert.equal(display.isDemo, true);
    assert.equal(display.isGenuinePayment, false);
    assert.equal(display.disclaimer, "DEMO PAYMENT — No real money is transferred.");
    assert.equal(display.label, "Simulated UPI Demo");
  });
});

