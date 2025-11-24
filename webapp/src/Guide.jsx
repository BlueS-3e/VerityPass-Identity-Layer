import React from 'react';
import { Link } from 'react-router-dom';
import HeroGraphic from './components/HeroGraphic';
import Footer from './components/Footer';

function GuideCard({ icon, title, children, gradient = "from-blue-500/10 to-purple-500/10" }) {
  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 backdrop-blur-sm hover:scale-105 transition-transform duration-300`}>
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
    { icon: "🚀", title: "Launchpad", description: "Start your project journey", href: "/launch" },
    { icon: "📝", title: "Create Attestation", description: "Sign and verify claims", href: "/attestation" },
    { icon: "🔗", title: "Connect Bank", description: "Link accounts securely", href: "/connect" },
    { icon: "📚", title: "Project Docs", description: "External documentation", href: "https://github.com/" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-blue-500/10 to-purple-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-r from-teal-400/10 to-cyan-500/10 rounded-full blur-3xl" />
      
      <HeroGraphic />
      
      <main className="relative max-w-6xl mx-auto py-16 px-4 z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm mb-6">
            <span className="text-2xl">📚</span>
            <span className="text-white font-semibold">Getting Started Guide</span>
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4">
            RealMint
            <span className="bg-gradient-to-r from-teal-300 to-blue-400 bg-clip-text text-transparent"> Guides</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Everything you need to know to launch projects and create verifiable attestations on RealMint.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Start Guide */}
            <GuideCard 
              icon="⚡" 
              title="Quick Start Guide"
              gradient="from-green-500/10 to-emerald-500/10"
            >
              <div className="space-y-3">
                <StepItem
                  number="1"
                  title="Connect Your Wallet"
                  description="Click the connect button and choose your preferred wallet provider"
                  icon="🔗"
                />
                <StepItem
                  number="2"
                  title="Pay Listing Fee"
                  description="Small fee covers processing and verification costs"
                  icon="💳"
                />
                <StepItem
                  number="3"
                  title="Submit Project Details"
                  description="Fill in your project information and upload optional documents"
                  icon="📄"
                />
                <StepItem
                  number="4"
                  title="Admin Review & Verification"
                  description="Our team reviews submissions and publishes verified attestations"
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
          <div className="space-y-6">
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
                  <span>Check our documentation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🐛</span>
                  <span>Report issues on GitHub</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Join our community</span>
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
                  <span>Instant setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Trustless verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🌐</span>
                  <span>Decentralized storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💫</span>
                  <span>No registration needed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center p-8 rounded-3xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-white/10 backdrop-blur-sm">
          <div className="text-4xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Started?</h3>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            Join thousands of builders creating verifiable attestations and launching trusted projects.
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
              Launch Project
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}