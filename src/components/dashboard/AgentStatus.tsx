import { FiPlay, FiPause, FiEdit3 } from "react-icons/fi";
import { FaXTwitter, FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube, FaBluesky, FaDiscord } from "react-icons/fa6";
import { FiMessageCircle } from "react-icons/fi";
import type { AgentConfig } from "../../types/agent";
import type { Platform } from "../../types/platform";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";

interface Props {
  agent: AgentConfig;
  onToggleStatus: () => void;
  onEdit: () => void;
}

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

export function AgentStatus({ agent, onToggleStatus, onEdit }: Props) {
  const isActive = agent.status === "active";

  return (
    <div className="agent-status-card">
      <div className="agent-status-header">
        {agent.identity.avatar ? (
          <img src={agent.identity.avatar} alt="" className="agent-avatar" />
        ) : (
          <div className="agent-avatar-placeholder">
            {agent.identity.name?.charAt(0) || "?"}
          </div>
        )}
        <div className="agent-identity">
          <h3>{agent.identity.name || "Unnamed Agent"}</h3>
          <p className="agent-tagline">{agent.identity.tagline}</p>
        </div>
      </div>

      <div className="agent-status-indicator">
        <span className={`status-dot ${isActive ? "active" : "paused"}`} />
        <span className="status-text">
          {isActive ? "Active — Auto-posting" : "Paused"}
        </span>
      </div>

      <div className="agent-platforms-status">
        {ALL_PLATFORMS.map((p) => {
          const connected = agent.platforms?.[p]?.connected;
          const scheduled = agent.schedule?.[p]?.enabled;
          const postsPerDay = agent.schedule?.[p]?.postsPerDay || 0;
          return (
            <div key={p} className={`platform-status-item ${connected ? "connected" : ""}`}>
              <span className="platform-icon">{PLATFORM_ICONS[p]}</span>
              <span className={`platform-badge ${connected && scheduled ? "active" : connected ? "idle" : "off"}`}>
                {connected && scheduled ? `${postsPerDay}/day` : connected ? "Idle" : "Off"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="agent-status-actions">
        <button
          className={`btn ${isActive ? "btn-secondary" : "btn-primary"} btn-sm`}
          onClick={onToggleStatus}
        >
          {isActive ? <><FiPause /> Pause</> : <><FiPlay /> Activate</>}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>
          <FiEdit3 /> Edit
        </button>
      </div>
    </div>
  );
}
