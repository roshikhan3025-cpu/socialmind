import { useAuth } from "../../context/AuthContext";
import { FiAlertCircle, FiLoader } from "react-icons/fi";
import { useState } from "react";

export function LoginPage() {
  const { loginWithSSO, error, isLoading } = useAuth() as any;
  const [ssoLoading, setSsoLoading] = useState(false);

  const handleSSOClick = async () => {
    setSsoLoading(true);
    try {
      // This will trigger your SSO flow (e.g. redirect to Vercel Auth or Google)
      await loginWithSSO();
    } catch (err) {
      console.error("SSO login error:", err);
    } finally {
      setSsoLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <span className="auth-logo-icon">SM</span>
          </div>
          <h1 className="auth-title">SocialMind</h1>
          <p className="auth-subtitle">Autonomous AI Social Media Agent</p>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 16 }}>
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="auth-actions">
          <button
            className="auth-sso-btn"
            onClick={handleSSOClick}
            disabled={ssoLoading}
          >
            {ssoLoading ? <FiLoader className="spin" /> : <div className="sso-icon" />}
            <span>Sign in with SSO</span>
          </button>
        </div>

        <div className="auth-wallet-info">
          <p>Secure login powered by your organization's SSO.</p>
        </div>

        <div className="auth-wallet-info">
          <p>Connect your MetaMask wallet on Base chain.</p>
          <p>No email, no password — just your wallet.</p>
        </div>

        <div className="auth-features">
          <div className="auth-feature">
            <span className="feature-dot" />
            <span>Setup once, auto-post forever</span>
          </div>
          <div className="auth-feature">
            <span className="feature-dot" />
            <span>X, Facebook & Instagram</span>
          </div>
          <div className="auth-feature">
            <span className="feature-dot" />
            <span>AI-powered personality engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
