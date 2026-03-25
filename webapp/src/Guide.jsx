import React from 'react';
import { Link } from 'react-router-dom';
import HeroGraphic from './components/HeroGraphic';
import Footer from './components/Footer';

function GuideCard({ icon, title, children, gradient = "from-blue-500/10 to-purple-500/10" }) {
  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 backdrop-blur-sm card-hover-lift`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">{icon}</div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StepItem({ number, title, description, icon }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-teal-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
        {icon || number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function Guide() {
  const quickLinks = [
    { icon: "🏦", title: "Lending Desk", description: "Configure product listings", href: "/launch" },
    { icon: "📝", title: "Create Attestation", description: "Sign borrower risk claims", href: "/attestation" },
    { icon: "🔗", title: "Connect Bank", description: "Link account-based income signals", href: "/connect" },
    { icon: "📚", title: "Project Docs", description: "External documentation", href: "https://github.com/" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-yellow-500/10 to-amber-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-r from-cyan-400/10 to-emerald-500/10 rounded-full blur-3xl" />
      
      <HeroGraphic />
      
      <main className="relative max-w-6xl mx-auto page-shell sm:py-12 lg:py-16 z-10">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12 reveal">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm mb-6">
            <img src="/bnb-chain-logo.svg" alt="BNB Chain" className="w-6 h-6" />
            <span className="text-white font-semibold">BNB Lending Playbook</span>
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4">
            RealMint
            <span className="bg-gradient-to-r from-yellow-300 to-amber-400 bg-clip-text text-transparent"> Ops Guide</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Everything you need to launch realistic lending products and credit attestations on BNB Chain.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 reveal reveal-delay-1">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8 reveal reveal-delay-2">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Underwriting Pipeline</h3>
                <span className="text-xs text-amber-300">BNB Chain Flow</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-gray-400">Identity + Bank Signals</div>
                  <div className="h-2 mt-3 rounded bg-white/10 overflow-hidden"><div className="h-full w-4/5 bg-gradient-to-r from-cyan-400 to-emerald-400" /></div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-gray-400">Risk Model Evaluation</div>
                  <div className="h-2 mt-3 rounded bg-white/10 overflow-hidden"><div className="h-full w-2/3 bg-gradient-to-r from-amber-400 to-yellow-300" /></div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-gray-400">Onchain Offer Publishing</div>
                  <div className="h-2 mt-3 rounded bg-white/10 overflow-hidden"><div className="h-full w-3/4 bg-gradient-to-r from-sky-400 to-indigo-400" /></div>
                </div>
              </div>
            </div>

            {/* Quick Start Guide */}
            <GuideCard 
              icon="⚡" 
              title="Quick Start Guide"
              gradient="from-green-500/10 to-emerald-500/10"
            >
              <div className="space-y-3">
                <StepItem
                  number="1"
                  title="Connect Treasury Wallet"
                  description="Connect an operator wallet for product creation and publishing"
                  icon="🔗"
                />
                <StepItem
                  number="2"
                  title="Pay Listing Fee"
                  description="Submit the BNB listing fee to activate underwriting workflows"
                  icon="💳"
                />
                <StepItem
                  number="3"
                  title="Submit Lending Details"
                  description="Define terms, risk summary, and supporting borrower evidence"
                  icon="📄"
                />
                <StepItem
                  number="4"
                  title="Risk Review & Verification"
                  description="Operations team reviews and publishes verified onchain attestations"
                  icon="✅"
                />
              </div>
            </GuideCard>

            {/* Attestations & IPFS */}
            <GuideCard 
              icon="📝" 
              title="Attestations & IPFS"
              gradient="from-blue-500/10 to-cyan-500/10"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">🔐</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Secure Signing</h4>
                    <p className="text-gray-300 text-sm">
                      Your wallet signs typed messages for cryptographic verification without gas fees.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">🌐</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">IPFS Storage</h4>
                    <p className="text-gray-300 text-sm">
                      All attestations are permanently pinned to IPFS for decentralized, tamper-proof storage.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">🔍</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Verifiable Proof</h4>
                    <p className="text-gray-300 text-sm">
                      Anyone can verify the authenticity of your attestations using the stored signatures.
                    </p>
                  </div>
                </div>
              </div>
            </GuideCard>

            {/* Safety & Privacy */}
            <GuideCard 
              icon="🛡️" 
              title="Safety & Privacy"
              gradient="from-orange-500/10 to-red-500/10"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">🔒</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Minimal Data Storage</h4>
                    <p className="text-gray-300 text-sm">
                      We store only essential data and rely on IPFS for decentralized storage.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">⚠️</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Prototype Notice</h4>
                    <p className="text-gray-300 text-sm">
                      This is a prototype environment. Do not use real funds or sensitive personal data.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-1">🔑</div>
                  <div>
                    <h4 className="font-semibold text-white mb-1">Wallet Security</h4>
                    <p className="text-gray-300 text-sm">
                      You maintain full control of your keys and assets at all times.
                    </p>
                  </div>
                </div>
              </div>
            </GuideCard>
          </div>

          {/* Quick Links Sidebar */}
          <div className="space-y-6 reveal reveal-delay-3">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>🚀</span>
                Quick Actions
              </h3>
              <div className="space-y-3">
                {quickLinks.map((link, index) => (
                  <Link
                    key={index}
                    to={link.href}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group"
                  >
                    <div className="text-xl">{link.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-white group-hover:text-teal-300 transition-colors">
                        {link.title}
                      </div>
                      <div className="text-xs text-gray-400">{link.description}</div>
                    </div>
                    <div className="text-gray-400 group-hover:text-white transition-colors">→</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Support Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-blue-500/10 border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span>💬</span>
                Need Help?
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span>📖</span>
                  <span>Read underwriting docs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🐛</span>
                  <span>Report integration issues</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Join operator channels</span>
                </div>
              </div>
            </div>

            {/* Feature Highlight */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span>⭐</span>
                Why RealMint?
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Fast BNB settlement</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Auditable risk controls</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🌐</span>
                  <span>Onchain + IPFS evidence</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💫</span>
                  <span>Bank + wallet onboarding</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-white/10 backdrop-blur-sm reveal reveal-delay-4">
          <div className="text-4xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Started?</h3>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            Start shipping lending-grade attestations and credit products with a production-minded workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/attestation"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-blue-500 text-gray-900 font-bold hover:scale-105 transition-transform"
            >
              <span>📝</span>
              Create First Attestation
            </Link>
            <Link
              to="/launch"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/10 text-white font-bold border border-white/20 hover:bg-white/20 transition-colors"
            >
              <span>🎯</span>
              Open Lending Desk
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}