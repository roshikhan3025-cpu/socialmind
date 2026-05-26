import { useState } from "react";
import { FiZap, FiEdit3, FiRefreshCw, FiDownload, FiLoader } from "react-icons/fi";
import { FaXTwitter, FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube, FaBluesky, FaDiscord } from "react-icons/fa6";
import { FiMessageCircle } from "react-icons/fi";
import type { AgentConfig } from "../../types/agent";
import { postNow } from "../../utils/api";

interface Props {
  agent: AgentConfig | null;
  onEditAgent: () => void;
}

const PLATFORM_BUTTONS = [
  { key: "instagram", label: "Post to Instagram", icon: <FaInstagram /> },
  { key: "twitter", label: "Post to X", icon: <FaXTwitter /> },
  { key: "facebook", label: "Post to Facebook", icon: <FaFacebook /> },
  { key: "linkedin", label: "Post to LinkedIn", icon: <FaLinkedin /> },
  { key: "tiktok", label: "Post to TikTok", icon: <FaTiktok /> },
  { key: "youtube", label: "Post to YouTube", icon: <FaYoutube /> },
  { key: "bluesky", label: "Post to Bluesky", icon: <FaBluesky /> },
  { key: "discord", label: "Post to Discord", icon: <FaDiscord /> },
  { key: "threads", label: "Post to Threads", icon: <FiMessageCircle /> },
];

export function QuickActions({ agent, onEditAgent }: Props) {
  const [posting, setPosting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handlePostNow = async (platform?: string) => {
    setPosting(platform || "all");
    setLastResult(null);
    try {
      const result = await postNow(platform);
      const outcomes = result.results || [];
      const summary = outcomes
        .map((r: { platform: string; success: boolean; error?: string; postUrl?: string }) =>
          r.success
            ? `${r.platform}: Posted${r.postUrl ? ` (${r.postUrl})` : ""}`
            : `${r.platform}: Failed — ${r.error || "unknown error"}`
        )
        .join("\n");
      setLastResult(summary);
    } catch (err) {
      setLastResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPosting(null);
    }
  };

  return (
    <div className="quick-actions">
      <h3 className="quick-actions-title">Quick Actions</h3>

      <div className="quick-actions-list">
        <button
          className="quick-action-btn"
          onClick={() => handlePostNow()}
          disabled={!!posting}
        >
          {posting === "all" ? <FiLoader className="spin" /> : <FiZap />}
          <div className="quick-action-info">
            <span className="quick-action-label">Post to All</span>
            <span className="quick-action-desc">AI-generate and post to all connected</span>
          </div>
        </button>

        {PLATFORM_BUTTONS.map(({ key, label, icon }) => (
          <button
            key={key}
            className="quick-action-btn"
            onClick={() => handlePostNow(key)}
            disabled={!!posting}
          >
            {posting === key ? <FiLoader className="spin" /> : icon}
            <div className="quick-action-info">
              <span className="quick-action-label">{label}</span>
              <span className="quick-action-desc">Generate and post now</span>
            </div>
          </button>
        ))}

        <button className="quick-action-btn" onClick={onEditAgent}>
          <FiEdit3 />
          <div className="quick-action-info">
            <span className="quick-action-label">Edit Agent</span>
            <span className="quick-action-desc">Update personality and settings</span>
          </div>
        </button>

        <button className="quick-action-btn" onClick={() => window.location.reload()}>
          <FiRefreshCw />
          <div className="quick-action-info">
            <span className="quick-action-label">Refresh Data</span>
            <span className="quick-action-desc">Reload posts and status</span>
          </div>
        </button>

        <button
          className="quick-action-btn"
          onClick={() => {
            const data = JSON.stringify({ agent }, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `socialmind-agent-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <FiDownload />
          <div className="quick-action-info">
            <span className="quick-action-label">Export Config</span>
            <span className="quick-action-desc">Download agent configuration</span>
          </div>
        </button>
      </div>

      {lastResult && (
        <div className="quick-action-result">
          <pre>{lastResult}</pre>
        </div>
      )}
    </div>
  );
}
