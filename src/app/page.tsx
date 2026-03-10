"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Briefcase, Zap, Globe, Phone, ExternalLink, Bot, CheckCircle, XCircle } from "lucide-react";

type Business = {
  id: string;
  name: string;
  rating: number;
  website: string | null;
  phone: string;
  address: string;
  analysis?: AnalysisResult;
  isAnalyzing?: boolean;
};

type AnalysisResult = {
  score: number;
  reason: string;
  isPrimeLead: boolean;
  detectedTools: string[];
};

export default function Home() {
  const [location, setLocation] = useState("");
  const [niche, setNiche] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`/api/places?location=${encodeURIComponent(location)}&niche=${encodeURIComponent(niche)}`);
      const data = await res.json();
      setBusinesses(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeBusiness = async (index: number, website: string | null) => {
    // Optimistically update UI to show analyzing state
    setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, isAnalyzing: true } : b));

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: website })
      });
      const result: AnalysisResult = await res.json();

      setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, analysis: result, isAnalyzing: false } : b));
    } catch (e) {
      console.error(e);
      setBusinesses(prev => prev.map((b, i) => i === index ? { ...b, isAnalyzing: false } : b));
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6 md:p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Hero Section (smaller when results exist) */}
      <motion.div
        animate={{
          marginTop: businesses.length > 0 ? 0 : "8rem",
          scale: businesses.length > 0 ? 0.9 : 1
        }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl flex flex-col items-center text-center space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-primary-500 mb-2 border-primary-500/20">
          <Zap size={16} />
          <span>The Ultimate Lead Gen for AI Agencies</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
          Find clients stuck in the <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-secondary-500">
            Digital Stone Age
          </span>
        </h1>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-3xl flex flex-col md:flex-row gap-4 mt-8"
        >
          <div className="flex-1 relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Location (e.g. Austin, TX)"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <div className="flex-1 relative">
            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Niche (e.g. Dentists)"
              required
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-14 px-8 bg-gradient-to-r from-primary-600 to-primary-500 hover:opacity-90 text-white font-semibold rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[160px]"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <Search size={20} />
                <span>Search</span>
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Results Grid */}
      <AnimatePresence>
        {businesses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {businesses.map((business, i) => (
              <motion.div
                key={business.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass rounded-2xl p-6 flex flex-col relative overflow-hidden group"
              >
                {/* Decorative glow on prime lead */}
                {business.analysis?.isPrimeLead && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 blur-3xl rounded-full -z-10" />
                )}

                <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{business.name}</h3>
                <div className="flex items-center text-yellow-400 text-sm mb-4">
                  ★ {business.rating} Rating
                </div>

                <div className="space-y-3 mb-6 text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-gray-500 mt-0.5 shrink-0" />
                    <span>{business.address}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-gray-500 shrink-0" />
                    <span>{business.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe size={16} className="text-gray-500 shrink-0" />
                    {business.website ? (
                      <a href={business.website} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline flex items-center gap-1">
                        {new URL(business.website).hostname.replace('www.', '')}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-red-400 font-medium">No Website</span>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/10">
                  {!business.analysis ? (
                    <button
                      onClick={() => analyzeBusiness(i, business.website)}
                      disabled={business.isAnalyzing}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {business.isAnalyzing ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <Bot size={16} className="text-primary-400" />
                          </motion.div>
                          <span>Analyzing Tech...</span>
                        </>
                      ) : (
                        <>
                          <Bot size={16} />
                          <span>Check AI Maturity</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-400">Score</span>
                        <div className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold font-mono",
                          business.analysis.isPrimeLead ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {business.analysis.score}/10
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed border-l-2 border-white/20 pl-3">
                        {business.analysis.reason}
                      </p>

                      {business.analysis.isPrimeLead ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm font-semibold pt-2">
                          <CheckCircle size={16} /> Prime Agency Lead
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 text-sm font-semibold pt-2">
                          <XCircle size={16} /> Tech Saturated
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// Simple CN utility for this file to avoid import issues if utils.ts isn't ready
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
