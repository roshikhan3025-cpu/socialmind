import { FaXTwitter, FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube, FaBluesky, FaDiscord } from "react-icons/fa6";
import { FiMessageCircle } from "react-icons/fi";
import { FiPlus, FiX } from "react-icons/fi";
import type {
  PostingSchedule as PostingScheduleType,
  PlatformSchedule,
  TimeSlot,
} from "../../types/agent";
import type { Platform } from "../../types/platform";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";

interface Props {
  schedule: PostingScheduleType;
  onChange: (schedule: PostingScheduleType) => void;
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

function formatTime(hour: number, minute: number): string {
  const h = isNaN(hour) ? 0 : Math.max(0, Math.min(23, hour));
  const m = isNaN(minute) ? 0 : Math.max(0, Math.min(59, minute));
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function safeInt(value: string, fallback: number, min: number, max: number): number {
  const parsed = parseInt(value);
  if (isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function PlatformScheduleEditor({
  platform,
  schedule,
  onChange,
}: {
  platform: Platform;
  schedule: PlatformSchedule;
  onChange: (schedule: PlatformSchedule) => void;
}) {

  const addTimeSlot = () => {
    const newSlot: TimeSlot = { hour: 12, minute: 0, enabled: true };
    onChange({ ...schedule, timeSlots: [...(schedule.timeSlots || []), newSlot] });
  };

  const removeTimeSlot = (index: number) => {
    onChange({
      ...schedule,
      timeSlots: (schedule.timeSlots || []).filter((_, i) => i !== index),
    });
  };

  const updateTimeSlot = (index: number, updates: Partial<TimeSlot>) => {
    const slots = [...(schedule.timeSlots || [])];
    slots[index] = { ...slots[index], ...updates };
    onChange({ ...schedule, timeSlots: slots });
  };

  const updateMix = (type: string, value: string) => {
    const num = safeInt(value, 0, 0, 100);
    onChange({
      ...schedule,
      contentMix: { ...(schedule.contentMix || {}), [type]: num },
    });
  };

  const postsPerDay = Math.max(1, schedule.postsPerDay || 1);
  const timeSlots = schedule.timeSlots || [];
  const contentMix = schedule.contentMix || { original: 100, reply: 0, quote: 0, thread: 0 };

  return (
    <div className={`schedule-platform-card ${schedule.enabled ? "enabled" : ""}`}>
      <div className="schedule-platform-header">
        <div className="schedule-platform-label">
          <span className="schedule-platform-icon">{PLATFORM_ICONS[platform]}</span>
          <span>{PLATFORM_LABELS[platform]}</span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={!!schedule.enabled}
            onChange={(e) => onChange({ ...schedule, enabled: e.target.checked })}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {schedule.enabled && (
        <div className="schedule-platform-body">
          <div className="form-group">
            <label className="form-label">Posts per day: {postsPerDay}</label>
            <div className="range-input">
              <input
                type="range"
                min={1}
                max={12}
                value={postsPerDay}
                onChange={(e) =>
                  onChange({ ...schedule, postsPerDay: safeInt(e.target.value, 1, 1, 12) })
                }
              />
              <span className="range-value">{postsPerDay}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Time Slots
              <button className="btn-icon-sm" onClick={addTimeSlot} type="button">
                <FiPlus />
              </button>
            </label>
            <div className="time-slots">
              {timeSlots.map((slot, i) => (
                <div key={i} className="time-slot">
                  <input
                    type="time"
                    value={formatTime(slot.hour, slot.minute)}
                    onChange={(e) => {
                      const parts = (e.target.value || "12:00").split(":");
                      const h = safeInt(parts[0], 12, 0, 23);
                      const m = safeInt(parts[1], 0, 0, 59);
                      updateTimeSlot(i, { hour: h, minute: m });
                    }}
                    className="form-input time-input"
                  />
                  <label className="toggle-switch small">
                    <input
                      type="checkbox"
                      checked={!!slot.enabled}
                      onChange={(e) => updateTimeSlot(i, { enabled: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <button
                    className="btn-icon-sm danger"
                    onClick={() => removeTimeSlot(i)}
                    type="button"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
              {timeSlots.length === 0 && (
                <p className="form-hint">No time slots — agent will post at any time</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Content Mix (%)</label>
            <div className="content-mix-grid">
              {(["original", "reply", "quote", "thread"] as const).map((type) => (
                <div key={type} className="mix-item">
                  <label>{type.charAt(0).toUpperCase() + type.slice(1)}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={contentMix[type] ?? 0}
                    onChange={(e) => updateMix(type, e.target.value)}
                    className="form-input mix-input"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for browsers that don't support supportedValuesOf
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Kolkata",
      "Asia/Dubai",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
  }
}

const TIMEZONES = getTimezones();

export function PostingSchedule({ schedule, onChange }: Props) {
  const defaultSchedule = { enabled: false, postsPerDay: 1, timeSlots: [], contentMix: { original: 100, reply: 0, quote: 0, thread: 0 } };
  const safeSchedule: PostingScheduleType = {
    timezone: schedule?.timezone || "UTC",
  } as PostingScheduleType;
  for (const p of ALL_PLATFORMS) {
    (safeSchedule as Record<string, unknown>)[p] = (schedule as Record<string, unknown>)?.[p] || { ...defaultSchedule };
  }

  return (
    <div className="wizard-form">
      <div className="form-section">
        <p className="form-section-desc">
          Configure when and how often your agent posts on each platform.
          Set time slots in your local timezone.
        </p>

        <div className="form-group">
          <label className="form-label">Timezone</label>
          <select
            className="form-select"
            value={safeSchedule.timezone}
            onChange={(e) => onChange({ ...safeSchedule, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="schedule-platforms">
          {ALL_PLATFORMS.map((platform) => (
            <PlatformScheduleEditor
              key={platform}
              platform={platform}
              schedule={safeSchedule[platform]}
              onChange={(updated) => {
                const next = { ...safeSchedule, [platform]: updated } as PostingScheduleType;
                onChange(next);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
