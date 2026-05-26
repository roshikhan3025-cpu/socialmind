import { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import type { ContentRules as ContentRulesType } from "../../types/agent";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "../../types/platform";

interface Props {
  rules: ContentRulesType;
  onChange: (rules: ContentRulesType) => void;
}

const HASHTAG_OPTIONS = [
  { value: "none", label: "None", description: "No hashtags" },
  { value: "minimal", label: "Minimal", description: "1-2 hashtags per post" },
  { value: "moderate", label: "Moderate", description: "3-5 hashtags per post" },
  { value: "aggressive", label: "Aggressive", description: "5-10 hashtags per post" },
] as const;

export function ContentRules({ rules, onChange }: Props) {
  const [newHashtag, setNewHashtag] = useState("");
  const [newForbidden, setNewForbidden] = useState("");

  const update = <K extends keyof ContentRulesType>(field: K, value: ContentRulesType[K]) => {
    onChange({ ...rules, [field]: value });
  };

  const addHashtag = () => {
    if (newHashtag.trim()) {
      const tag = newHashtag.trim().replace(/^#/, "");
      update("defaultHashtags", [...rules.defaultHashtags, tag]);
      setNewHashtag("");
    }
  };

  const removeHashtag = (index: number) => {
    update("defaultHashtags", rules.defaultHashtags.filter((_, i) => i !== index));
  };

  const addForbiddenWord = () => {
    if (newForbidden.trim()) {
      update("forbiddenWords", [...rules.forbiddenWords, newForbidden.trim()]);
      setNewForbidden("");
    }
  };

  const removeForbiddenWord = (index: number) => {
    update("forbiddenWords", rules.forbiddenWords.filter((_, i) => i !== index));
  };

  return (
    <div className="wizard-form">
      <div className="form-section">
        {/* Hashtag strategy */}
        <div className="form-group">
          <label className="form-label">Hashtag Strategy</label>
          <div className="option-grid">
            {HASHTAG_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`option-card ${rules.hashtagStrategy === option.value ? "selected" : ""}`}
                onClick={() => update("hashtagStrategy", option.value)}
                type="button"
              >
                <span className="option-label">{option.label}</span>
                <span className="option-desc">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default hashtags */}
        <div className="form-group">
          <label className="form-label">Default Hashtags (always included)</label>
          <div className="tag-input-row">
            <input
              type="text"
              className="form-input"
              placeholder="Add a hashtag (without #)"
              value={newHashtag}
              onChange={(e) => setNewHashtag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
            />
            <button className="btn btn-secondary btn-sm" onClick={addHashtag} type="button">
              <FiPlus />
            </button>
          </div>
          <div className="tag-list">
            {rules.defaultHashtags.map((tag, i) => (
              <span key={i} className="tag tag-accent">
                #{tag}
                <button onClick={() => removeHashtag(i)} type="button"><FiX /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="form-group">
          <div className="toggle-row">
            <label className="toggle-label">
              <span>Include Emojis</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={rules.includeEmojis}
                  onChange={(e) => update("includeEmojis", e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </label>
          </div>

          <div className="toggle-row">
            <label className="toggle-label">
              <span>Include Links</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={rules.includeLinks}
                  onChange={(e) => update("includeLinks", e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </label>
          </div>
        </div>

        {/* Mention rules */}
        <div className="form-group">
          <label className="form-label">Mention Rules</label>
          <textarea
            className="form-textarea"
            placeholder="e.g., Never mention competitors by name. Tag @brand in promotional posts. Always credit sources..."
            value={rules.mentionRules}
            onChange={(e) => update("mentionRules", e.target.value)}
            rows={3}
          />
        </div>

        {/* Brand guidelines */}
        <div className="form-group">
          <label className="form-label">Brand Guidelines</label>
          <textarea
            className="form-textarea"
            placeholder="e.g., Always include our tagline. Use active voice. Start posts with a hook question. Never use profanity..."
            value={rules.brandGuidelines}
            onChange={(e) => update("brandGuidelines", e.target.value)}
            rows={4}
          />
        </div>

        {/* Forbidden words */}
        <div className="form-group">
          <label className="form-label">Forbidden Words</label>
          <div className="tag-input-row">
            <input
              type="text"
              className="form-input"
              placeholder="Words the agent must never use"
              value={newForbidden}
              onChange={(e) => setNewForbidden(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addForbiddenWord())}
            />
            <button className="btn btn-secondary btn-sm" onClick={addForbiddenWord} type="button">
              <FiPlus />
            </button>
          </div>
          <div className="tag-list">
            {rules.forbiddenWords.map((word, i) => (
              <span key={i} className="tag tag-danger">
                {word}
                <button onClick={() => removeForbiddenWord(i)} type="button"><FiX /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Max post lengths */}
        <div className="form-group">
          <label className="form-label">Max Post Length (characters)</label>
          <div className="length-grid">
            {ALL_PLATFORMS.map((platform) => (
              <div key={platform} className="length-item">
                <label>{PLATFORM_LABELS[platform]}</label>
                <input
                  type="number"
                  className="form-input"
                  value={rules.maxPostLength[platform] || 280}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    update("maxPostLength", {
                      ...rules.maxPostLength,
                      [platform]: isNaN(val) ? 280 : Math.max(1, Math.min(10000, val)),
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
