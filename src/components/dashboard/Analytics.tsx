import { FiTrendingUp, FiActivity, FiCheckCircle, FiXCircle } from "react-icons/fi";
import type { PostLog, AgentConfig } from "../../types/agent";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";

interface Props {
  posts: PostLog[];
  agent: AgentConfig | null;
}

export function Analytics({ posts, agent }: Props) {
  const totalPosts = posts.length;
  const successfulPosts = posts.filter((p) => p.status === "posted").length;
  const failedPosts = posts.filter((p) => p.status === "failed").length;
  const successRate = totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0;

  const byPlatform = posts.reduce(
    (acc, p) => {
      acc[p.platform] = (acc[p.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = posts.filter((p) => p.createdAt >= today.getTime()).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const postsThisWeek = posts.filter((p) => p.createdAt >= weekAgo.getTime()).length;

  const connectedCount = agent?.platforms
    ? ALL_PLATFORMS.filter((p) => agent.platforms?.[p]?.connected).length
    : 0;

  return (
    <div className="analytics-section">
      <h3 className="analytics-title">Overview</h3>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FiActivity />
          </div>
          <div className="stat-info">
            <span className="stat-value">{postsToday}</span>
            <span className="stat-label">Posts Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp />
          </div>
          <div className="stat-info">
            <span className="stat-value">{postsThisWeek}</span>
            <span className="stat-label">This Week</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <FiCheckCircle />
          </div>
          <div className="stat-info">
            <span className="stat-value">{successRate}%</span>
            <span className="stat-label">Success Rate</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon error">
            <FiXCircle />
          </div>
          <div className="stat-info">
            <span className="stat-value">{failedPosts}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>
      </div>

      <div className="analytics-breakdown">
        <h4>Platform Breakdown</h4>
        <div className="breakdown-bars">
          {Object.entries(byPlatform).map(([platform, count]) => (
            <div key={platform} className="breakdown-bar">
              <div className="breakdown-label">
                <span>{PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform}</span>
                <span>{count} posts</span>
              </div>
              <div className="breakdown-track">
                <div
                  className={`breakdown-fill platform-${platform}`}
                  style={{ width: `${totalPosts > 0 ? (count / totalPosts) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
          {Object.keys(byPlatform).length === 0 && (
            <p className="no-data">No platform data yet</p>
          )}
        </div>
      </div>

      <div className="analytics-info">
        <div className="info-item">
          <span className="info-label">Total Posts</span>
          <span className="info-value">{totalPosts}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Platforms Connected</span>
          <span className="info-value">{connectedCount}/{ALL_PLATFORMS.length}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Agent Status</span>
          <span className={`info-value status-${agent?.status || "setup"}`}>
            {agent?.status || "Not configured"}
          </span>
        </div>
      </div>
    </div>
  );
}
