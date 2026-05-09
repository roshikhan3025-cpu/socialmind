import { useAuth } from "../../context/AuthContext";
import { isMetaMaskInstalled } from "../../lib/metamask";
import { FiAlertCircle, FiLoader } from "react-icons/fi";
import { useEffect, useState } from "react";

function MetaMaskLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 35 33" fill="none">
      <path d="M32.96 1l-13.14 9.72 2.45-5.73L32.96 1z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.66 1l13.02 9.81L13.35 4.99 2.66 1z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28.23 23.53l-3.5 5.36 7.49 2.06 2.14-7.28-6.13-.14z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.27 23.67l2.13 7.28 7.47-2.06-3.48-5.36-6.12.14z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.47 14.51l-2.08 3.14 7.4.34-.26-7.96-5.06 4.48z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M25.15 14.51l-5.13-4.58-.17 8.06 7.4-.34-2.1-3.14z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.87 28.89l4.49-2.16-3.88-3.02-.61 5.18z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.29 26.73l4.46 2.16-.6-5.18-3.86 3.02z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function LoginPage() {
  const { loginWithSSO, error, clearError, isLoading } = useAuth() as any;
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
