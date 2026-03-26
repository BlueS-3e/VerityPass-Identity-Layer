import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setSelectedFlow, clearSelectedFlow } from './flowGate';
import PrimaryCTA from './components/PrimaryCTA';
import NetworkBanner from './components/NetworkBanner';
import HeroGraphic from './components/HeroGraphic';

export default function Home() {
  const ENABLE_LAUNCHPAD = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LAUNCHPAD) !== 'false';
  const navigate = useNavigate();

  React.useEffect(() => {
    try { clearSelectedFlow(); } catch (e) {}
  }, []);

  const FeatureCard = ({ icon, title, description, gradient }) => (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 backdrop-blur-sm card-hover-lift`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-200 leading-relaxed">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-orange-400/10 to-yellow-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-full blur-3xl animate-bounce" />

      <div className="relative max-w-7xl mx-auto page-shell sm:py-12 lg:py-20">
        <NetworkBanner expectedChainHex={undefined} expectedName={undefined} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center reveal">
          {/* Main Content */}
          <div className="lg:col-span-7 space-y-8 reveal reveal-delay-1">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
                <img src="/bnb-chain-logo.svg" alt="BNB Chain" className="w-5 h-5" />
                <span className="text-sm text-white font-medium">Verified Identity for Global DeFi</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  VerityPass
                </span>
                <br />
                <span className="text-white">Get Verified,</span>
                <br />
                <span className="text-gray-300">Access DeFi</span>
              </h1>

              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                VerityPass combines identity attestations, bank-linked signals, and transparent
                risk controls to power practical onchain lending on BNB Chain.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <PrimaryCTA
                to="/connect"
                hideWhenSelectedFlow={['launchpad']}
                onClick={(e) => { 
                  e.preventDefault(); 
                  clearSelectedFlow(); 
                  setSelectedFlow('attestation'); 
                  navigate('/connect'); 
                }}
                className="group inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 font-bold text-lg shadow-2xl hover:shadow-yellow-500/25 hover:scale-105 transition-all duration-300"
              >
                <div className="text-2xl">📝</div>
                <div className="text-left">
                  <div>Start Credit Profile</div>
                  <div className="text-sm font-normal opacity-90">Connect wallet and link bank data</div>
                </div>
                <div className="ml-4 text-2xl group-hover:translate-x-1 transition-transform">→</div>
              </PrimaryCTA>

              {ENABLE_LAUNCHPAD ? (
                <PrimaryCTA
                  to="/launch"
                  hideWhenSelectedFlow={['attestation']}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    clearSelectedFlow(); 
                    setSelectedFlow('launchpad'); 
                    navigate('/launch'); 
                  }}
                  className="group inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold text-lg backdrop-blur-sm hover:bg-white/20 hover:scale-105 transition-all duration-300"
                >
                  <div className="text-2xl">🚀</div>
                  <div className="text-left">
                    <div>Open Lending Pool</div>
                    <div className="text-sm font-normal opacity-90">BNB-native capital campaigns</div>
                  </div>
                  <div className="ml-4 text-2xl group-hover:translate-x-1 transition-transform">→</div>
                </PrimaryCTA>
              ) : (
                <div className="inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-gray-800/50 border border-gray-700 text-gray-400">
                  <div className="text-2xl">⏸️</div>
                  <div className="text-left">
                    <div>Launchpad</div>
                    <div className="text-sm">Temporarily disabled</div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <FeatureCard
                icon="⚡"
                title="Fast Credit Signals"
                description="Generate verifiable attestations and bank-backed risk signals in minutes."
                gradient="from-teal-500/10 to-blue-500/10"
              />
              <FeatureCard
                icon="🛡️"
                title="Auditable Risk Controls"
                description="Every approval and scoring step is trackable across your operations stack."
                gradient="from-purple-500/10 to-pink-500/10"
              />
              <FeatureCard
                icon="🌐"
                title="Onchain Settlement"
                description="Issue and settle lending interactions with BNB Chain finality and low fees."
                gradient="from-blue-500/10 to-cyan-500/10"
              />
              <FeatureCard
                icon="🏦"
                title="Bank + Web3 Bridge"
                description="Connect Plaid flows to create realistic credit rails for crypto-native lending."
                gradient="from-orange-500/10 to-red-500/10"
              />
            </div>
          </div>

          {/* Hero Graphic Side */}
          <div className="lg:col-span-5 flex items-center justify-center reveal reveal-delay-2">
            <div className="relative w-full max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-r from-teal-400/20 to-blue-500/20 rounded-3xl blur-xl opacity-50" />
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/10 border border-white/20 backdrop-blur-2xl shadow-2xl">
                <HeroGraphic />
                <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">📈</div>
                    <div className="text-white font-semibold">Lending Health Snapshot</div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>Score readiness</span>
                      <span className="text-emerald-300">Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Risk engine</span>
                      <span className="text-yellow-300">Monitoring</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Chain</span>
                      <span className="text-amber-300">BNB Mainnet</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 reveal reveal-delay-3">
          <div className="text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm card-hover-lift">
            <div className="text-2xl mb-2">💹</div>
            <div className="text-2xl font-bold text-white">24/7</div>
            <div className="text-sm text-gray-300">Scoring</div>
          </div>
          <div className="text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm card-hover-lift">
            <div className="text-2xl mb-2">🏛️</div>
            <div className="text-2xl font-bold text-white">Policy</div>
            <div className="text-sm text-gray-300">Governed</div>
          </div>
          <div className="text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm card-hover-lift">
            <div className="text-2xl mb-2">⛓️</div>
            <div className="text-2xl font-bold text-white">Low Fee</div>
            <div className="text-sm text-gray-300">Settlement</div>
          </div>
          <div className="text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm card-hover-lift">
            <div className="text-2xl mb-2">🏦</div>
            <div className="text-2xl font-bold text-white">Bank</div>
            <div className="text-sm text-gray-300">Connected</div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <span className="text-sm text-gray-400">⚙️ Configured via environment variables</span>
          </div>
        </div>
      </div>
    </div>
  );
}