import { useLocation, Link } from "react-router-dom";
import SkincareImage from "../components/SkincareImage";
import { formatINR } from "../utils/formatCurrency";

function formatPaymentMethodLabel(method, simAccount) {
  switch (method) {
    case "DEMO_UPI":
      return `Simulated UPI (${simAccount || "Demo VPA"})`;
    case "DEMO_COD":
      return "Cash on Delivery (Demo COD)";
    case "DEMO_SIMULATION":
    case "DEMO_CARD":
    default:
      return "Instant Demo Simulation";
  }
}

function OrderSuccess() {
  const location = useLocation();
  const order = location.state?.order;
  const orderId = location.state?.orderId || order?._id;

  if (!orderId && !order) {
    return (
      <div className="sole-page-container">
        <div className="order-success-card">
          <div className="order-success-icon" aria-hidden="true">📦</div>
          <h1 className="order-success-title">Order Confirmation</h1>
          <p className="order-success-sub">
            Your orders are tracked under your account profile.
          </p>
          <div className="order-success-actions">
            <Link to="/orders" className="sole-primary-btn">
              View My Orders
            </Link>
            <Link to="/products" className="sole-secondary-btn">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = order?.createdAt
    ? new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });

  const address = order?.shippingAddress;
  const paymentSimulation = order?.paymentSimulation;
  const paymentMethod = order?.paymentMethod || "DEMO_CARD";
  const paymentStatus = order?.paymentStatus || "demo_completed";

  return (
    <div className="sole-page-container">
      <div className="order-success-card">
        {/* Success Header Icon */}
        <div className="order-success-badge-icon" aria-hidden="true">
          ✓
        </div>

        <span className="order-success-eyebrow">ORDER CONFIRMED</span>
        <h1 className="order-success-title">Thank you for your order!</h1>
        <p className="order-success-sub">
          Your order has been placed and is being prepared with care by the SOLE team.
        </p>

        {/* DEMO PAYMENT DISCLAIMER BANNER */}
        <div className="order-success-demo-disclaimer" role="alert">
          <span className="demo-disclaimer-shield" aria-hidden="true">🛡️</span>
          <div>
            <strong>DEMO PAYMENT — No real money is transferred.</strong>
            <p>
              This order was placed using a simulated payment channel. Product prices, live inventory deductions, and order records are verified by the backend.
            </p>
          </div>
        </div>

        {/* Order Meta Bar */}
        <div className="order-success-meta-bar">
          <div className="success-meta-item">
            <span className="meta-label">Order Number</span>
            <strong className="meta-value">
              #{String(orderId).slice(-8).toUpperCase()}
            </strong>
          </div>

          <div className="success-meta-item">
            <span className="meta-label">Date Placed</span>
            <span className="meta-value">{formattedDate}</span>
          </div>

          <div className="success-meta-item">
            <span className="meta-label">Status</span>
            <span className="order-status-badge status-placed">
              ● Order Placed
            </span>
          </div>

          <div className="success-meta-item">
            <span className="meta-label">Total Amount</span>
            <strong className="meta-value grand-price">
              {formatINR(order?.totalAmount)}
            </strong>
          </div>
        </div>

        {/* Simulated Demo Payment Details */}
        <div className="order-success-section">
          <h2 className="success-section-heading">Demo Payment Details</h2>
          <div className="demo-payment-receipt-card">
            <div className="receipt-line">
              <span className="receipt-label">Payment Method:</span>
              <strong className="receipt-val">
                {formatPaymentMethodLabel(paymentMethod, paymentSimulation?.simulatedAccount)}
              </strong>
            </div>
            <div className="receipt-line">
              <span className="receipt-label">Transaction ID:</span>
              <code className="receipt-code">
                {paymentSimulation?.transactionId || `DEMO_TXN_${String(orderId).slice(-8).toUpperCase()}`}
              </code>
            </div>
            <div className="receipt-line">
              <span className="receipt-label">Payment Status:</span>
              <span className={`demo-status-tag status-${paymentStatus}`}>
                {paymentStatus === "demo_completed"
                  ? "✓ Simulated Payment Complete"
                  : paymentStatus === "demo_pending"
                  ? "⏳ Demo Payment Pending (COD)"
                  : paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Shipping Address Block */}
        {address && (
          <div className="order-success-section">
            <h2 className="success-section-heading">Delivery Address</h2>
            <div className="success-address-card">
              <strong className="address-recipient">{address.fullName}</strong>
              <span className="address-phone">{address.phone}</span>
              <span className="address-street">{address.addressLine1}</span>
              {address.addressLine2 && (
                <span className="address-street">{address.addressLine2}</span>
              )}
              <span className="address-locality">
                {address.city}, {address.state} {address.postalCode}
              </span>
              <span className="address-country">{address.country || "United States"}</span>
            </div>
          </div>
        )}

        {/* Itemized Order Items Snapshot */}
        {Array.isArray(order?.items) && order.items.length > 0 && (
          <div className="order-success-section">
            <h2 className="success-section-heading">Ordered Items</h2>
            <div className="success-items-list" role="list">
              {order.items.map((item, idx) => (
                <div key={idx} className="success-item-row" role="listitem">
                  <div className="success-item-thumb">
                    <SkincareImage
                      src={item.image}
                      alt={item.productName || "Product"}
                      className="success-item-img"
                    />
                  </div>
                  <div className="success-item-details">
                    <span className="success-item-name">{item.productName || "Skincare Item"}</span>
                    <span className="success-item-qty">
                      Quantity: {item.quantity} × {formatINR(item.price)}
                    </span>
                  </div>
                  <div className="success-item-subtotal">
                    {formatINR(item.lineTotal || (item.price * item.quantity))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="order-success-actions">
          <Link to="/orders" className="sole-primary-btn">
            View All Orders
          </Link>
          <Link to="/products" className="sole-secondary-btn">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default OrderSuccess;
