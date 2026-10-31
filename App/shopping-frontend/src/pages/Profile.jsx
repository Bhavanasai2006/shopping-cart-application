import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "../components/ConfirmModal";
import { sanitizeErrorMessage } from "../utils/security";

function Profile() {
  const { user, updateProfile, changePassword, logout } = useAuth();
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
              {user.role === "admin" ? "★ Administrator" : "Customer"}
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
                ✎ Edit
              </button>
            )}
          </div>

          {profileErr && (
            <div className="auth-error-banner" role="alert">
              <span aria-hidden="true">⚠</span>
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
              <span aria-hidden="true">⚠</span>
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

        {/* Quick Links Card */}
        <div className="profile-card quick-links-card">
          <h2>Account Actions</h2>
          <div className="profile-quick-actions">
            <Link to="/orders" className="profile-action-link">
              <span aria-hidden="true">🛍️</span>
              <div>
                <strong>My Orders</strong>
                <p>Track purchases & order history</p>
              </div>
            </Link>

            {user.role === "admin" && (
              <Link to="/admin" className="profile-action-link admin-action">
                <span aria-hidden="true">⚙️</span>
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
              🚪 Log Out of SOLE
            </button>
          </div>
        </div>
      </div>

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
