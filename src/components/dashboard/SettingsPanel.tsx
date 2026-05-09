import { useState } from "react";
import { FiSave, FiCpu, FiKey, FiGlobe, FiChevronRight } from "react-icons/fi";
import type { AgentConfig, AIProvider, AISettings } from "../../types/agent";
import { updateAgentConfig } from "../../utils/api";

interface Props {
  agent: AgentConfig;
  onUpdate: (updatedAgent: AgentConfig) => void;
  onClose: () => void;
}

const PROVIDERS: { id: AIProvider; name: string; description: string }[] = [
  { id: "groq", name: "Groq", description: "Ultra-fast inference for Llama & Mixtral" },
  { id: "openrouter", name: "OpenRouter", description: "Access any AI model via a single API" },
  { id: "openai", name: "OpenAI", description: "Industry standard GPT models" },
  { id: "azure", name: "Azure AI", description: "Enterprise-grade AI Foundry" },
  { id: "nvidia", name: "NVIDIA NIM", description: "Accelerated AI inference" },
  { id: "custom", name: "Custom", description: "Any OpenAI-compatible API" },
];

export function SettingsPanel({ agent, onUpdate, onClose }: Props) {
  const [settings, setSettings] = useState<AISettings>(agent.aiSettings || {
    provider: "openrouter",
    apiKey: "",
    model: "anthropic/claude-3-sonnet",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const updatedAgent = { ...agent, aiSettings: settings };
      await updateAgentConfig({ aiSettings: settings });
      onUpdate(updatedAgent);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="settings-title-group">
          <FiCpu className="title-icon" />
          <h2>AI Infrastructure</h2>
        </div>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h3>AI Provider</h3>
          <p className="section-hint">Select the engine that powers your agent's intelligence.</p>
          
          <div className="provider-grid">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={`provider-card ${settings.provider === p.id ? "active" : ""}`}
                onClick={() => setSettings({ ...settings, provider: p.id })}
              >
                <div className="provider-info">
                  <span className="provider-name">{p.name}</span>
                  <span className="provider-desc">{p.description}</span>
                </div>
                {settings.provider === p.id && <FiChevronRight className="active-icon" />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>API Configuration</h3>
          <div className="settings-form">
            <div className="form-field">
              <label><FiKey /> API Key</label>
              <input
                type="password"
                placeholder="Enter your API key"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              />
              <p className="field-hint">Your keys are encrypted and never shared.</p>
            </div>

            <div className="form-field">
              <label><FiCpu /> Model ID</label>
              <input
                type="text"
                placeholder="e.g. llama-3-70b-instruct"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              />
            </div>

            {(settings.provider === "custom" || settings.provider === "azure") && (
              <div className="form-field">
                <label><FiGlobe /> Base URL / Endpoint</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="settings-footer">
        {success && <span className="save-success">Settings saved!</span>}
        <button 
          className="save-btn" 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? "Saving..." : <><FiSave /> Save Configuration</>}
        </button>
      </div>
    </div>
  );
}
