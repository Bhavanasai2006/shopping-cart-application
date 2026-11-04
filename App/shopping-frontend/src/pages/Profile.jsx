import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "../components/ConfirmModal";
import { sanitizeErrorMessage } from "../utils/security";

function Profile() {
  const { user, updateProfile, changePassword, logout, fetchSavedAddresses, addSavedAddress, deleteSavedAddress, setDefaultSavedAddress } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    age: user?.age || ""
  });
  const [profileErr, setProfileErr] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordErr, setPasswordErr] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Logout confirmation modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Saved Addresses State
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    fullName: user?.username || "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    isDefault: false
  });
  const [addressErr, setAddressErr] = useState("");
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);

  if (!user) return null;

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileErr("");

    const trimmedUser = profileForm.username.trim();
    const numAge = Number(profileForm.age);

    if (trimmedUser.length < 2 || trimmedUser.length > 50) {
      setProfileErr("Username must be between 2 and 50 characters.");
      return;
    }

    if (isNaN(numAge) || numAge < 1 || numAge > 120) {
      setProfileErr("Age must be a valid number between 1 and 120.");
      return;
    }

    setProfileSubmitting(true);

    try {
      await updateProfile({
        username: trimmedUser,
        age: numAge
      });
      showToast({ type: "success", message: "Profile updated successfully!" });
      setIsEditing(false);
    } catch (err) {
      setProfileErr(sanitizeErrorMessage(err, "Failed to update profile"));
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordErr("");

    if (!passwordForm.currentPassword) {
      setPasswordErr("Current password is required.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordErr("New password must be at least 8 characters long.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErr("New passwords do not match.");
      return;
    }

    setPasswordSubmitting(true);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      showToast({ type: "success", message: "Password changed successfully!" });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setShowPasswordChange(false);
    } catch (err) {
      setPasswordErr(sanitizeErrorMessage(err, "Failed to change password"));
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleAddressSubmit(e) {
    e.preventDefault();
    setAddressErr("");

    if (!addressForm.fullName.trim() || addressForm.fullName.trim().length < 2) {
      setAddressErr("Recipient full name must be at least 2 characters.");
      return;
    }
    if (!addressForm.phone.trim() || addressForm.phone.trim().length < 7) {
      setAddressErr("A valid contact phone number is required.");
      return;
    }
    if (!addressForm.addressLine1.trim() || addressForm.addressLine1.trim().length < 3) {
      setAddressErr("Street address is required.");
      return;
    }
    if (!addressForm.city.trim() || addressForm.city.trim().length < 2) {
      setAddressErr("City name is required.");
      return;
    }
    if (!addressForm.state.trim() || addressForm.state.trim().length < 2) {
      setAddressErr("State is required.");
      return;
    }
    if (!addressForm.postalCode.trim() || addressForm.postalCode.trim().length < 3) {
      setAddressErr("Valid postal/ZIP code is required.");
      return;
    }

    setAddressSubmitting(true);
    try {
      await addSavedAddress(addressForm);
      showToast({ type: "success", message: "Address added successfully!" });
      setShowAddAddress(false);
      setAddressForm({
        fullName: user?.username || "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        isDefault: false
      });
    } catch (err) {
      setAddressErr(sanitizeErrorMessage(err, "Failed to save address"));
    } finally {
      setAddressSubmitting(false);
    }
  }

  async function handleDeleteAddressConfirm() {
    if (!addressToDelete) return;
    try {
      await deleteSavedAddress(addressToDelete._id);
      showToast({ type: "success", message: "Address deleted successfully." });
    } catch (err) {
      showToast({ type: "error", message: sanitizeErrorMessage(err, "Failed to delete address") });
    } finally {
      setAddressToDelete(null);
    }
  }

  async function handleSetDefaultAddress(addrId) {
    try {
      await setDefaultSavedAddress(addrId);
      showToast({ type: "success", message: "Default address updated." });
    } catch (err) {
      showToast({ type: "error", message: sanitizeErrorMessage(err, "Failed to update default address") });
    }
  }

  async function handleLogout() {
    setShowLogoutConfirm(false);
    await logout();
    showToast({ type: "info", message: "You have signed out of your account." });
    navigate("/products");
  }

  return (
    <div className="sole-page-container profile-page-wrap">
      {/* Profile Header */}
      <div className="profile-header-card">
        <div className="profile-avatar-circle" aria-hidden="true">
          {user.username ? user.username.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="profile-header-info">
          <h1 className="profile-username">{user.username}</h1>
          <span className="profile-email">{user.emailId}</span>
          <div className="profile-badge-row">
            <span className="profile-role-badge">
              {user.role === "admin" ? "Administrator" : "Customer"}
            </span>
            {user.emailVerified ? (
              <span className="profile-verified-badge">✓ Verified</span>
            ) : (
              <span className="profile-unverified-badge">Unverified</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Profile Grid */}
      <div className="profile-sections-grid">
        {/* Personal Details Card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h2>Personal Information</h2>
            {!isEditing && (
              <button
                className="profile-edit-btn"
                onClick={() => {
                  setProfileForm({
                    username: user.username,
                    age: user.age || ""
                  });
                  setIsEditing(true);
                  setProfileErr("");
                }}
                aria-label="Edit personal information"
              >
                Edit
              </button>
            )}
          </div>

          {profileErr && (
            <div className="auth-error-banner" role="alert">
              <span aria-hidden="true">!</span>
              <span>{profileErr}</span>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleProfileSubmit} className="profile-form" noValidate>
              <div className="form-field-group">
                <label htmlFor="profile-username">Full Name / Username</label>
                <input
                  id="profile-username"
                  type="text"
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, username: e.target.value })
                  }
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="profile-age">Age</label>
                <input
                  id="profile-age"
                  type="number"
                  min="1"
                  max="120"
                  value={profileForm.age}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, age: e.target.value })
                  }
                  required
                />
              </div>

              <div className="profile-btn-row">
                <button
                  type="submit"
                  className="sole-primary-btn"
                  disabled={profileSubmitting}
                >
                  {profileSubmitting ? (
                    <span className="btn-spinner-wrap">
                      <span className="btn-spinner" aria-hidden="true" />
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>
                <button
                  type="button"
                  className="profile-cancel-btn"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-details-list">
              <div className="profile-detail-item">
                <span className="detail-label">Username</span>
                <span className="detail-value">{user.username}</span>
              </div>
              <div className="profile-detail-item">
                <span className="detail-label">Email Address</span>
                <span className="detail-value">{user.emailId}</span>
              </div>
              <div className="profile-detail-item">
                <span className="detail-label">Age</span>
                <span className="detail-value">
                  {user.age ? `${user.age} years` : "Not specified"}
                </span>
              </div>
              <div className="profile-detail-item">
                <span className="detail-label">Account Role</span>
                <span className="detail-value capitalize">{user.role}</span>
              </div>
            </div>
          )}
        </div>

        {/* Security / Password Card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h2>Security & Password</h2>
            {!showPasswordChange && (
              <button
                className="profile-edit-btn"
                onClick={() => {
                  setShowPasswordChange(true);
                  setPasswordErr("");
                }}
                aria-label="Change account password"
              >
                Change Password
              </button>
            )}
          </div>

          {passwordErr && (
            <div className="auth-error-banner" role="alert">
              <span aria-hidden="true">!</span>
              <span>{passwordErr}</span>
            </div>
          )}

          {showPasswordChange ? (
            <form onSubmit={handlePasswordSubmit} className="profile-form" noValidate>
              <div className="form-field-group">
                <label htmlFor="curr-pass">Current Password</label>
                <input
                  id="curr-pass"
                  type="password"
                  placeholder="Enter current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value
                    })
                  }
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="new-pass">New Password (min 8 characters)</label>
                <input
                  id="new-pass"
                  type="password"
                  placeholder="Min 8 characters"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value
                    })
                  }
                  required
                  minLength={8}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="repeat-pass">Confirm New Password</label>
                <input
                  id="repeat-pass"
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value
                    })
                  }
                  required
                />
                {passwordForm.confirmPassword && (
                  <span
                    className={`field-hint ${
                      passwordForm.newPassword === passwordForm.confirmPassword
                        ? "hint-valid"
                        : "hint-warning"
                    }`}
                  >
                    {passwordForm.newPassword === passwordForm.confirmPassword
                      ? "✓ Passwords match"
                      : "✕ Passwords do not match"}
                  </span>
                )}
              </div>

              <div className="profile-btn-row">
                <button
                  type="submit"
                  className="sole-primary-btn"
                  disabled={passwordSubmitting}
                >
                  {passwordSubmitting ? (
                    <span className="btn-spinner-wrap">
                      <span className="btn-spinner" aria-hidden="true" />
                      Updating...
                    </span>
                  ) : (
                    "Update Password"
                  )}
                </button>
                <button
                  type="button"
                  className="profile-cancel-btn"
                  onClick={() => setShowPasswordChange(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="security-note">
              Your password is encrypted using high-security bcrypt hashing with
              automatic dual-token session verification.
            </p>
          )}
        </div>

        {/* Saved Addresses Card */}
        <div className="profile-card profile-addresses-card">
          <div className="profile-card-header">
            <div>
              <h2>Saved Delivery Addresses</h2>
              <p className="profile-card-subtitle">Manage your preferred shipping destinations</p>
            </div>
            {!showAddAddress && (
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => {
                  setAddressForm({
                    fullName: user?.username || "",
                    phone: "",
                    addressLine1: "",
                    addressLine2: "",
                    city: "",
                    state: "",
                    postalCode: "",
                    country: "",
                    isDefault: false
                  });
                  setAddressErr("");
                  setShowAddAddress(true);
                }}
              >
                ＋ Add Address
              </button>
            )}
          </div>

          {addressErr && (
            <div className="auth-error-banner" role="alert">
              <span aria-hidden="true">!</span>
              <span>{addressErr}</span>
            </div>
          )}

          {showAddAddress ? (
            <form onSubmit={handleAddressSubmit} className="profile-form" noValidate>
              <div className="form-row-halves">
                <div className="form-field-group">
                  <label htmlFor="addr-fullName">Recipient Name <span className="field-required">*</span></label>
                  <input
                    id="addr-fullName"
                    type="text"
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field-group">
                  <label htmlFor="addr-phone">Phone Number <span className="field-required">*</span></label>
                  <input
                    id="addr-phone"
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="addr-line1">Street Address <span className="field-required">*</span></label>
                <input
                  id="addr-line1"
                  type="text"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                  placeholder="Street name, house/flat number"
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="addr-line2">Apt, Suite, Building <small className="label-optional">(Optional)</small></label>
                <input
                  id="addr-line2"
                  type="text"
                  value={addressForm.addressLine2}
                  onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                />
              </div>

              <div className="form-row-thirds">
                <div className="form-field-group">
                  <label htmlFor="addr-city">City <span className="field-required">*</span></label>
                  <input
                    id="addr-city"
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field-group">
                  <label htmlFor="addr-state">State <span className="field-required">*</span></label>
                  <input
                    id="addr-state"
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field-group">
                  <label htmlFor="addr-zip">ZIP / Postal Code <span className="field-required">*</span></label>
                  <input
                    id="addr-zip"
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="addr-country">Country</label>
                <input
                  id="addr-country"
                  type="text"
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                  placeholder="e.g. United States, India, Canada, etc."
                />
              </div>

              <div className="profile-btn-row">
                <button type="submit" className="sole-primary-btn" disabled={addressSubmitting}>
                  {addressSubmitting ? "Saving Address..." : "Save Address"}
                </button>
                <button
                  type="button"
                  className="profile-cancel-btn"
                  onClick={() => setShowAddAddress(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-addresses-list">
              {Array.isArray(user.savedAddresses) && user.savedAddresses.length > 0 ? (
                user.savedAddresses.map((addr) => (
                  <div key={addr._id} className="profile-address-item-card">
                    <div className="profile-address-item-details">
                      <div className="profile-address-item-header">
                        <span className="profile-address-item-name">{addr.fullName}</span>
                        {addr.isDefault && <span className="address-default-badge">Default</span>}
                        <span className="profile-address-item-phone">{addr.phone}</span>
                      </div>
                      <p className="profile-address-item-lines">
                        {addr.addressLine1}
                        {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                        <br />
                        {addr.city}, {addr.state} - {addr.postalCode}{addr.country ? `, ${addr.country}` : ""}
                      </p>
                    </div>

                    <div className="profile-address-item-actions">
                      {!addr.isDefault && (
                        <button
                          type="button"
                          className="address-action-text-btn"
                          onClick={() => handleSetDefaultAddress(addr._id)}
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        type="button"
                        className="address-action-delete-btn"
                        onClick={() => setAddressToDelete(addr)}
                        aria-label={`Delete address for ${addr.fullName}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="profile-empty-address-box">
                  <p>No saved addresses yet.</p>
                  <small>Add an address here or during checkout to enable 1-click delivery selection.</small>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Links Card */}
        <div className="profile-card quick-links-card">
          <h2>Account Actions</h2>
          <div className="profile-quick-actions">
            <Link to="/orders" className="profile-action-link">
              
              <div>
                <strong>My Orders</strong>
                <p>Track purchases & order history</p>
              </div>
            </Link>

            {user.role === "admin" && (
              <Link to="/admin" className="profile-action-link admin-action">
                
                <div>
                  <strong>Admin Dashboard</strong>
                  <p>Manage skincare catalog & inventory</p>
                </div>
              </Link>
            )}

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="profile-logout-btn"
              aria-label="Log out of SOLE"
            >
              Log Out of SOLE
            </button>
          </div>
        </div>
      </div>

      {/* Delete Address Modal */}
      <ConfirmModal
        isOpen={Boolean(addressToDelete)}
        title="Delete Address"
        message={`Are you sure you want to remove the address for "${addressToDelete?.fullName || 'this location'}"?`}
        confirmText="Delete Address"
        cancelText="Keep"
        destructive={true}
        onConfirm={handleDeleteAddressConfirm}
        onCancel={() => setAddressToDelete(null)}
      />

      {/* Confirmation Modal for Sign Out */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of your SOLE account?"
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        destructive={true}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}

export default Profile;
