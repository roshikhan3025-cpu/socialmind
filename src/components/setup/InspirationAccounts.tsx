import { useState } from "react";
import { FiPlus, FiTrash2, FiLink } from "react-icons/fi";
import { FaXTwitter, FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube, FaBluesky, FaDiscord } from "react-icons/fa6";
import { FiMessageCircle } from "react-icons/fi";
import type { InspirationAccount } from "../../types/agent";
import type { Platform } from "../../types/platform";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";

interface Props {
  accounts: InspirationAccount[];
  onChange: (accounts: InspirationAccount[]) => void;
}

export function InspirationAccounts({ accounts, onChange }: Props) {
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const addAccount = () => {
    if (!handle.trim()) return;

    const account: InspirationAccount = {
      platform,
      handle: handle.trim().replace(/^@/, ""),
      url: url.trim() || (() => {
        const domains: Record<string, string> = { twitter: 'x.com', threads: 'threads.net', bluesky: 'bsky.app', discord: 'discord.com/users' };
        const domain = domains[platform] || `${platform}.com`;
        return `https://${domain}/${handle.trim().replace(/^@/, "")}`;
      })(),
      notes: notes.trim(),
    };

    onChange([...accounts, account]);
    setHandle("");
    setUrl("");
    setNotes("");
  };

  const removeAccount = (index: number) => {
    onChange(accounts.filter((_, i) => i !== index));
  };

  const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
    twitter: <FaXTwitter />,
    facebook: <FaFacebook />,
    instagram: <FaInstagram />,
    linkedin: <FaLinkedin />,
    tiktok: <FaTiktok />,
    youtube: <FaYoutube />,
    bluesky: <FaBluesky />,
    discord: <FaDiscord />,
    threads: <FiMessageCircle />,
  };

  return (
    <div className="wizard-form">
      <div className="form-section">
        <p className="form-section-desc">
          Add social media accounts that inspire your agent's style. The AI will analyze 
          their communication patterns to better match the voice you want.
        </p>

        {/* Add new account */}
        <div className="inspiration-add-form">
          <div className="form-row-inline">
            <div className="form-group flex-1">
              <label className="form-label">Platform</label>
              <div className="platform-selector">
                {ALL_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    className={`platform-btn ${platform === p ? "selected" : ""}`}
                    onClick={() => setPlatform(p)}
                    type="button"
                  >
                    {PLATFORM_ICONS[p]}
                    <span>{PLATFORM_LABELS[p]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-group flex-1">
              <label className="form-label">Handle / Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="@username"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Profile URL (optional)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://x.com/username"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">What to draw from this account</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Their thread style, use of humor, technical depth..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAccount())}
            />
          </div>

          <button className="btn btn-secondary" onClick={addAccount} type="button">
            <FiPlus />
            <span>Add Inspiration Account</span>
          </button>
        </div>

        {/* Account list */}
        {accounts.length > 0 && (
          <div className="inspiration-list">
            <h3 className="form-subtitle">Added Accounts ({accounts.length})</h3>
            {accounts.map((account, index) => (
              <div key={index} className="inspiration-card">
                <div className="inspiration-card-left">
                  <span className="inspiration-platform">
                    {PLATFORM_ICONS[account.platform]}
                  </span>
                  <div className="inspiration-info">
                    <span className="inspiration-handle">@{account.handle}</span>
                    {account.url && (
                      <a href={account.url} target="_blank" rel="noopener noreferrer" className="inspiration-url">
                        <FiLink /> {account.url}
                      </a>
                    )}
                    {account.notes && (
                      <span className="inspiration-notes">{account.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  className="btn-icon-danger"
                  onClick={() => removeAccount(index)}
                  type="button"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        )}

        {accounts.length === 0 && (
          <div className="empty-state-small">
            <p>No inspiration accounts added yet</p>
            <p className="muted">This step is optional but helps the AI match your desired style</p>
          </div>
        )}
      </div>
    </div>
  );
}
