import { useLocation, Link, Navigate } from "react-router-dom";
import SkincareImage from "../components/SkincareImage";
import { formatINR } from "../utils/formatCurrency";

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
