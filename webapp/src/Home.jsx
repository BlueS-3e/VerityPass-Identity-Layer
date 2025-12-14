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
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 backdrop-blur-sm hover:scale-105 transition-transform duration-300`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-200 leading-relaxed">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-teal-400/10 to-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-indigo-500/10 to-pink-500/10 rounded-full blur-3xl animate-bounce" />

      <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24">
        <NetworkBanner expectedChainHex={undefined} expectedName={undefined} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Main Content */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
                <span className="text-lg">✨</span>
                <span className="text-sm text-white font-medium">Trustless & Permissionless</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-teal-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  RealMint
                </span>
                <br />
                <span className="text-white">Build Trust,</span>
                <br />
                <span className="text-gray-300">Not Friction</span>
              </h1>

              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
                Create verifiable attestations, launch curated projects, and build reputation — 
                all with built-in fee mechanics and referral systems. No signup required.
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
                className="group inline-flex items-center gap-4 px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-400 to-blue-500 text-gray-900 font-bold text-lg shadow-2xl hover:shadow-teal-500/25 hover:scale-105 transition-all duration-300"
              >
                <div className="text-2xl">📝</div>
                <div className="text-left">
                  <div>Get Started</div>
                  <div className="text-sm font-normal opacity-90">Connect wallet & verify income</div>
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
                    <div>Launch Project</div>
                    <div className="text-sm font-normal opacity-90">Curated & verified</div>
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
                title="Instant Attestations"
                description="Sign and pin verifiable claims in seconds with zero setup required."
                gradient="from-teal-500/10 to-blue-500/10"
              />
              <FeatureCard
                icon="🛡️"
                title="Secure & Trustless"
                description="Built on blockchain verification with no central authority required."
                gradient="from-purple-500/10 to-pink-500/10"
              />
              <FeatureCard
                icon="🌐"
                title="IPFS Powered"
                description="All attestations are permanently stored on decentralized IPFS."
                gradient="from-blue-500/10 to-cyan-500/10"
              />
              <FeatureCard
                icon="💫"
                title="No Account Needed"
                description="Connect your wallet and start building — no registration required."
                gradient="from-orange-500/10 to-red-500/10"
              />
            </div>
          </div>

          {/* Hero Graphic Side */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              <div className="absolute -inset-4 bg-gradient-to-r from-teal-400/20 to-blue-500/20 rounded-3xl blur-xl opacity-50" />
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/10 border border-white/20 backdrop-blur-2xl shadow-2xl">
                <HeroGraphic />
                <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">🔐</div>
                    <div className="text-white font-semibold">Wallet Connected</div>
                  </div>
                  <p className="text-sm text-gray-300">
                    Simply connect your wallet to start creating attestations or launching projects instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-2xl font-bold text-white">Instant</div>
            <div className="text-sm text-gray-300">Setup</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-2xl mb-2">🛡️</div>
            <div className="text-2xl font-bold text-white">Secure</div>
            <div className="text-sm text-gray-300">Verification</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-2xl mb-2">🌐</div>
            <div className="text-2xl font-bold text-white">Decentralized</div>
            <div className="text-sm text-gray-300">Storage</div>
          </div>
          <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="text-2xl mb-2">💫</div>
            <div className="text-2xl font-bold text-white">Free</div>
            <div className="text-sm text-gray-300">To Start</div>
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