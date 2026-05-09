import { lazy, Suspense } from "react";
import { FiZap, FiClock, FiUsers, FiShield, FiArrowRight, FiCheck, FiStar } from "react-icons/fi";

const Scene3D = lazy(() => import("./Scene3D").then((m) => ({ default: m.Scene3D })));
import { FaXTwitter, FaFacebook, FaInstagram } from "react-icons/fa6";

interface Props {
  onEnterApp: () => void;
}

const FEATURES = [
  {
    icon: <FiZap />,
    title: "AI-Powered Content",
    desc: "Advanced AI generates engaging, on-brand posts that match your unique voice and personality.",
  },
  {
    icon: <FiClock />,
    title: "Autonomous Scheduling",
    desc: "Set it and forget it. Your agent posts at optimal times across all your connected platforms.",
  },
  {
    icon: <FiUsers />,
    title: "Multi-Platform",
    desc: "Connect Instagram, X (Twitter), and Facebook. One agent, all your social channels.",
  },
  {
    icon: <FiShield />,
    title: "Full Control",
    desc: "Define tone, topics, rules, and boundaries. Your agent stays on-brand, always.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for trying out SocialMind",
    features: [
      "1 AI agent",
      "1 connected platform",
      "3 posts per day",
      "Basic content generation",
      "Manual posting",
      "Community support",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For creators and small businesses",
    features: [
      "3 AI agents",
      "All platforms (X, FB, IG)",
      "15 posts per day",
      "Advanced AI personalities",
      "Auto-posting on schedule",
      "Image library (100 images)",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/month",
    description: "For agencies and teams",
    features: [
      "Unlimited AI agents",
      "All platforms + LinkedIn",
      "Unlimited posts",
      "Custom AI model tuning",
      "Team collaboration",
      "Image library (unlimited)",
      "Advanced analytics & reports",
      "API access",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function LandingPage({ onEnterApp }: Props) {
  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-logo-container">
              <span className="landing-logo">SM</span>
            </div>
            <span className="landing-brand-text">SocialMind</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <button className="landing-cta-btn" onClick={onEnterApp}>
            Get Started <FiArrowRight />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-background-effects">
          <div className="effect-blob blob-1" />
          <div className="effect-blob blob-2" />
        </div>
        
        <Suspense fallback={<div className="scene3d-container" />}>
          <div className="scene3d-wrapper">
            <Scene3D />
          </div>
        </Suspense>

        <div className="landing-hero-content">
          <div className="hero-reveal-container">
            <div className="landing-hero-badge">
              <FiStar /> The Future of Autonomous Social Growth
            </div>
            <h1 className="landing-hero-title">
              Your Digital Presence,
              <br />
              <span className="landing-gradient-text">Evolved</span>
            </h1>
            <p className="landing-hero-desc">
              SocialMind is a sophisticated AI agent that autonomously crafts, 
              optimizes, and publishes your social content 24/7.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-hero-btn primary" onClick={onEnterApp}>
                Launch Agent <FiArrowRight />
              </button>
              <a className="landing-hero-btn secondary" href="#features">
                Explore Features
              </a>
            </div>
            <div className="landing-hero-platforms">
              <div className="platform-tag"><FaInstagram /> Instagram</div>
              <div className="platform-tag"><FaXTwitter /> Twitter</div>
              <div className="platform-tag"><FaFacebook /> Facebook</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Minimalist Grid */}
      <section className="landing-features" id="features">
        <div className="landing-section-inner">
          <div className="section-header">
            <h2 className="landing-section-title">
              Engineered for <span className="landing-gradient-text">Excellence</span>
            </h2>
            <p className="landing-section-desc">
              SocialMind uses state-of-the-art AI to handle everything from 
              content strategy to engagement.
            </p>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="feature-card-glass" />
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Sleek Cards */}
      <section className="landing-pricing" id="pricing">
        <div className="landing-section-inner">
          <div className="section-header">
            <h2 className="landing-section-title">
              Unmatched <span className="landing-gradient-text">Value</span>
            </h2>
            <p className="landing-section-desc">
              Choose the tier that fits your growth strategy.
            </p>
          </div>
          <div className="landing-pricing-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`landing-plan-card ${plan.highlighted ? "highlighted" : ""}`}
              >
                {plan.highlighted && <div className="plan-badge">Most Popular</div>}
                <div className="plan-header">
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    <span className="plan-amount">{plan.price}</span>
                    {plan.period && <span className="plan-period">{plan.period}</span>}
                  </div>
                </div>
                <p className="plan-desc">{plan.description}</p>
                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <FiCheck /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`plan-cta ${plan.highlighted ? "primary" : "secondary"}`}
                  onClick={onEnterApp}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-main">
            <div className="landing-footer-brand">
              <span className="landing-logo small">SM</span>
              <span>SocialMind</span>
            </div>
            <p className="landing-footer-copy">
              Professional AI automation for the modern social landscape.
            </p>
          </div>
          <div className="landing-footer-bottom">
            <span>© 2024 SocialMind AI. All rights reserved.</span>
            <div className="footer-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
