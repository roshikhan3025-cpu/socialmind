import { useState } from "react";
import { useChat } from "../context/ChatContext";
import { AVAILABLE_MODELS } from "../types/chat";
import { FiX, FiEye, FiEyeOff, FiSave } from "react-icons/fi";
import type { AIProvider } from "../types/chat";

export function SettingsPanel() {
  const { state, dispatch, updateSettings } = useChat();
  const [showKeys, setShowKeys] = useState<Record<AIProvider, boolean>>({
    "4everland": false,
    groq: false,
    gemini: false,
  });
  const [localSettings, setLocalSettings] = useState({ ...state.settings });
  const [saved, setSaved] = useState(false);

  if (!state.settingsOpen) return null;

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    dispatch({ type: "SET_SETTINGS_OPEN", open: false });
  };

  const toggleKeyVisibility = (provider: AIProvider) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  // Group models by provider
  const providers = AVAILABLE_MODELS.reduce(
    (acc, m) => {
      if (!acc[m.provider]) acc[m.provider] = [];
      acc[m.provider].push(m);
      return acc;
    },
    {} as Record<string, typeof AVAILABLE_MODELS>
  );

  const providerOptions: { label: string; value: AIProvider; description: string }[] = [
    { label: "4everland", value: "4everland", description: "Multi-model API gateway" },
    { label: "Groq", value: "groq", description: "Fast LLM inference" },
    { label: "Google Gemini", value: "gemini", description: "Google's latest AI models" },
  ];

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={handleClose}>
            <FiX />
          </button>
        </div>

        <div className="settings-body">
          {/* AI Provider Selection */}
          <div className="settings-section">
            <h3>AI Provider</h3>
            <label className="settings-label">
              Select Provider
              <select
                value={localSettings.aiProvider}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    aiProvider: e.target.value as AIProvider,
                  })
                }
                className="settings-select"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* API Keys Configuration */}
          <div className="settings-section">
            <h3>API Keys Configuration</h3>

            {providerOptions.map((provider) => (
              <label key={provider.value} className="settings-label">
                {provider.label} API Key
                <div className="api-key-input">
                  <input
                    type={showKeys[provider.value] ? "text" : "password"}
                    value={localSettings.apiKeys[provider.value]}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        apiKeys: {
                          ...localSettings.apiKeys,
                          [provider.value]: e.target.value,
                        },
                      })
                    }
                    placeholder={`Enter your ${provider.label} API key`}
                    className="settings-input"
                  />
                  <button
                    className="icon-btn"
                    onClick={() => toggleKeyVisibility(provider.value)}
                    type="button"
                  >
                    {showKeys[provider.value] ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                <span className="settings-hint">
                  {provider.value === "4everland" && (
                    <>
                      Get your API key from{" "}
                      <a
                        href="https://dashboard.4everland.org"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        4everland Dashboard
                      </a>
                    </>
                  )}
                  {provider.value === "groq" && (
                    <>
                      Get your API key from{" "}
                      <a
                        href="https://console.groq.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Groq Console
                      </a>
                    </>
                  )}
                  {provider.value === "gemini" && (
                    <>
                      Get your API key from{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google AI Studio
                      </a>
                    </>
                  )}
                </span>
              </label>
            ))}

            <label className="settings-label">
              Site URL (optional)
              <input
                type="url"
                value={localSettings.siteUrl}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, siteUrl: e.target.value })
                }
                placeholder="https://yoursite.com"
                className="settings-input"
              />
              <span className="settings-hint">Sent as HTTP-Referer header</span>
            </label>

            <label className="settings-label">
              Site Name (optional)
              <input
                type="text"
                value={localSettings.siteName}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, siteName: e.target.value })
                }
                placeholder="My App"
                className="settings-input"
              />
              <span className="settings-hint">Sent as X-Title header</span>
            </label>
          </div>

          {/* Model */}
          <div className="settings-section">
            <h3>Model</h3>

            <label className="settings-label">
              Model
              <select
                value={localSettings.model}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, model: e.target.value })
                }
                className="settings-select"
              >
                {Object.entries(providers).map(([provider, models]) => (
                  <optgroup key={provider} label={provider}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>

          {/* Parameters */}
          <div className="settings-section">
            <h3>Parameters</h3>

            <label className="settings-label">
              Temperature: {localSettings.temperature}
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={localSettings.temperature}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="settings-range"
              />
              <span className="settings-hint">
                0 = deterministic, 2 = very creative
              </span>
            </label>

            <label className="settings-label">
              Top P: {localSettings.topP}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localSettings.topP}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    topP: parseFloat(e.target.value),
                  })
                }
                className="settings-range"
              />
            </label>

            <label className="settings-label">
              Max Tokens
              <input
                type="number"
                min="1"
                max="128000"
                value={localSettings.maxTokens}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    maxTokens: parseInt(e.target.value) || 4096,
                  })
                }
                className="settings-input"
              />
            </label>
          </div>

          {/* System Prompt */}
          <div className="settings-section">
            <h3>System Prompt</h3>
            <label className="settings-label">
              <textarea
                value={localSettings.systemPrompt}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    systemPrompt: e.target.value,
                  })
                }
                className="settings-textarea"
                rows={4}
                placeholder="You are a helpful AI assistant."
              />
            </label>
          </div>

          {/* Theme */}
          <div className="settings-section">
            <h3>Appearance</h3>
            <label className="settings-label">
              Theme
              <div className="theme-toggle">
                <button
                  className={`theme-btn ${
                    localSettings.theme === "dark" ? "active" : ""
                  }`}
                  onClick={() =>
                    setLocalSettings({ ...localSettings, theme: "dark" })
                  }
                >
                  Dark
                </button>
                <button
                  className={`theme-btn ${
                    localSettings.theme === "light" ? "active" : ""
                  }`}
                  onClick={() =>
                    setLocalSettings({ ...localSettings, theme: "light" })
                  }
                >
                  Light
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <FiSave />
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
