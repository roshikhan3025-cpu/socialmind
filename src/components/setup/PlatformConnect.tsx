import { useState, useEffect, useCallback } from "react";
import { FiCheck, FiLink, FiLoader, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { FaXTwitter, FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube, FaBluesky, FaDiscord } from "react-icons/fa6";
import { FiMessageCircle } from "react-icons/fi";
import type { PlatformConnections } from "../../types/agent";
import type { Platform } from "../../types/platform";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";
import {
  connectPlatform,
  disconnectPlatform,
  getSocialStatus,
  pollConnectionStatus,
} from "../../utils/api";

interface Props {
  platforms: PlatformConnections;
  onChange: (platforms: PlatformConnections) => void;
}

const PLATFORM_INFO: Record<Platform, { icon: React.ReactNode; color: string; description: string }> = {
  twitter: {
    icon: <FaXTwitter />,
    color: "#ffffff",
    description: "Post tweets and threads automatically to your X account.",
  },
  facebook: {
    icon: <FaFacebook />,
    color: "#1877F2",
    description: "Auto-post to your Facebook Page. Requires admin access.",
  },
  instagram: {
    icon: <FaInstagram />,
    color: "#E4405F",
    description: "Post to your Instagram Business or Creator account.",
  },
  linkedin: {
    icon: <FaLinkedin />,
    color: "#0A66C2",
    description: "Share content to your LinkedIn profile feed.",
  },
  tiktok: {
    icon: <FaTiktok />,
    color: "#ffffff",
    description: "Upload videos to your TikTok account.",
  },
  youtube: {
    icon: <FaYoutube />,
    color: "#FF0000",
    description: "Publish videos to your YouTube channel.",
  },
  bluesky: {
    icon: <FaBluesky />,
    color: "#0285FF",
    description: "Post to your Bluesky social feed.",
  },
  discord: {
    icon: <FaDiscord />,
    color: "#5865F2",
    description: "Post messages to your Discord server.",
  },
  threads: {
    icon: <FiMessageCircle />,
    color: "#ffffff",
    description: "Post threads to your Threads profile.",
  },
};

export function PlatformConnect({ platforms, onChange }: Props) {
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [polling, setPolling] = useState<Platform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const status = await getSocialStatus(true);
      const updated = { ...platforms };
      for (const p of ALL_PLATFORMS) {
        if (status[p]) {
          updated[p] = { ...updated[p], ...status[p] };
        }
      }
      onChange(updated);
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, [platforms, onChange]);

  const handleConnect = async (platform: Platform) => {
    setConnecting(platform);
    setError(null);

    try {
      const result = await connectPlatform(platform);

      if (result.authUrl) {
        const popup = window.open(
          result.authUrl,
          `oauth-${platform}-auth`,
          "width=620,height=720,scrollbars=yes"
        );

        onChange({
          ...platforms,
          [platform]: {
            ...platforms[platform],
            connected: false,
          },
        });

        setConnecting(null);
        setPolling(platform);

        const connected = await pollConnectionStatus(platform, 3000, 60);

        if (connected) {
          const status = await getSocialStatus(true);
          if (status[platform]) {
            onChange({
              ...platforms,
              [platform]: {
                ...platforms[platform],
                ...status[platform],
                connected: true,
                connectedAt: Date.now(),
              },
            });
          }
        } else {
          if (popup && popup.closed) {
            setError(
              `${PLATFORM_LABELS[platform]} authorization was cancelled or timed out. Please try again.`
            );
          } else {
            setError(
              `Timed out waiting for ${PLATFORM_LABELS[platform]} connection. If you completed authorization, click "Refresh Status".`
            );
          }
        }

        setPolling(null);
      } else {
        throw new Error("No authorization URL returned from server");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect platform"
      );
      setConnecting(null);
      setPolling(null);
    }
  };

  const handleDisconnect = async (platform: Platform) => {
    setError(null);
    try {
      await disconnectPlatform(platform);
      onChange({
        ...platforms,
        [platform]: { connected: false },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to disconnect platform"
      );
    }
  };

  return (
    <div className="wizard-form">
      <div className="form-section">
        <p className="form-section-desc">
          Connect your social media accounts using official OAuth authorization.
          You will be redirected to each platform to grant permissions.
          Tokens are stored securely and used only for posting on your behalf.
        </p>

        {error && (
          <div className="form-error">
            <FiXCircle style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={refreshStatus}
            disabled={refreshing}
            type="button"
          >
            <FiRefreshCw className={refreshing ? "spin" : ""} />
            <span>Refresh Status</span>
          </button>
        </div>

        <div className="platform-connect-list">
          {(ALL_PLATFORMS as Platform[]).map((platform) => {
            const info = PLATFORM_INFO[platform];
            const connection = platforms[platform];
            const isConnecting = connecting === platform;
            const isPolling = polling === platform;

            return (
              <div
                key={platform}
                className={`platform-connect-card ${
                  connection.connected ? "connected" : ""
                }`}
              >
                <div className="platform-connect-header">
                  <div
                    className="platform-connect-icon"
                    style={{ color: info.color }}
                  >
                    {info.icon}
                  </div>
                  <div className="platform-connect-info">
                    <h3>{PLATFORM_LABELS[platform]}</h3>
                    <p>{info.description}</p>
                  </div>
                </div>

                <div className="platform-connect-status">
                  {connection.connected ? (
                    <div className="connected-status">
                      <span className="status-badge status-connected">
                        <FiCheck /> Connected
                      </span>
                      {connection.handle && (
                        <span className="connected-handle">
                          @{connection.handle}
                        </span>
                      )}
                      {connection.displayName && !connection.handle && (
                        <span className="connected-handle">
                          {connection.displayName}
                        </span>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDisconnect(platform)}
                        type="button"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="connect-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting || isPolling}
                        type="button"
                      >
                        {isConnecting ? (
                          <>
                            <FiLoader className="spin" /> Opening authorization...
                          </>
                        ) : isPolling ? (
                          <>
                            <FiLoader className="spin" /> Waiting for authorization...
                          </>
                        ) : (
                          <>
                            <FiLink /> Connect
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="platform-connect-note" style={{ marginTop: 16 }}>
          <p>
            <strong>How it works:</strong> Click "Connect" to open the
            platform's official authorization page. Sign in and grant permissions.
            Once complete, SocialMind will detect the connection automatically.
            Your access tokens are stored securely and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
