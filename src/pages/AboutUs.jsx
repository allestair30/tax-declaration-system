import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white min-h-screen w-full flex flex-col justify-between px-6 lg:px-16 py-12 overflow-x-hidden">
      
      {/* Background Radial Overlay */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      {/* Header Navigation */}
      <div className="relative z-10 max-w-6xl w-full mx-auto flex justify-between items-center pb-8 border-b border-blue-700/50">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600/30 p-2 rounded-xl border border-blue-400/30 text-blue-300 font-bold text-lg">
            LGU
          </span>
          <div>
            <span className="font-semibold text-slate-200 text-sm sm:text-base block">
              San Fernando, Romblon
            </span>
            <span className="text-xs text-blue-300/80">Municipal Assessor’s Office</span>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/')}
          className="bg-blue-700/60 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl border border-blue-500/40 transition shadow flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-6xl mx-auto my-auto py-12 space-y-16">
        
        {/* Hero Title Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="inline-block bg-blue-700/40 text-blue-200 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-500/30">
            About the System
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Digital Archiving & Retrieval System
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Modernizing land tax administration, streamlining real property tax records, and securing historical municipal documentation for the Local Government Unit of San Fernando, Romblon.
          </p>
        </div>

        {/* Feature Cards / Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-950/50 border border-blue-800/40 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-3 hover:border-blue-500/40 transition">
            <div className="p-3 bg-blue-600/20 text-blue-400 w-fit rounded-xl border border-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Our Mission</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              To transition legacy paper tax declarations into high-speed digital archives that accelerate retrieval times, reduce processing backlogs, and improve accuracy for public services.
            </p>
          </div>

          <div className="bg-blue-950/50 border border-blue-800/40 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-3 hover:border-blue-500/40 transition">
            <div className="p-3 bg-blue-600/20 text-blue-400 w-fit rounded-xl border border-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Security & Integrity</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Engineered with strict access controls and encrypted cloud storage, protecting real property records against physical degradation, loss, and unauthorized tampering.
            </p>
          </div>

          <div className="bg-blue-950/50 border border-blue-800/40 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-3 hover:border-blue-500/40 transition">
            <div className="p-3 bg-blue-600/20 text-blue-400 w-fit rounded-xl border border-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Public Accessibility</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Enabling property owners to submit requests for tax declaration copies online, track assessment updates, and review notice statuses without unnecessary physical office visits.
            </p>
          </div>
        </div>

        {/* System Capabilities Section */}
        <div className="bg-slate-900/60 border border-blue-800/50 rounded-3xl p-8 sm:p-10 backdrop-blur-md space-y-8">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">System Core Capabilities</h2>
            <p className="text-sm text-slate-400">Key modules driving municipal efficiency and transparency.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="text-blue-400 font-semibold text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Digital Archiving
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Centralized cloud repository for indexed Tax Declarations, enabling instant query searches by TD Number, PIN, or Owner Name.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-blue-400 font-semibold text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Online Requests
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Simplified digital workflows allowing citizens to apply for certified true copies of Tax Declarations with automated tracking.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-blue-400 font-semibold text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Assessor Verification
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Structured verification dashboards for Municipal Assessors to evaluate, approve, or request revisions on pending property records.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-blue-400 font-semibold text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Analytics & Insights
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Comprehensive reporting modules generating real-time metrics on total property assessments, approvals, and submission trends.
              </p>
            </div>
          </div>
        </div>

        {/* Stakeholders Section */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Who Benefits?</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Designed to serve both local government personnel and the citizens of San Fernando.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-2xl p-6 space-y-3">
              <h4 className="text-lg font-bold text-blue-200">Property Owners & Citizens</h4>
              <ul className="text-xs sm:text-sm text-slate-300 space-y-2 list-disc list-inside">
                <li>Submit tax declaration requests online 24/7.</li>
                <li>Monitor application statuses directly from your personalized dashboard.</li>
                <li>Avoid long queues and reduce unnecessary travel to the municipal hall.</li>
              </ul>
            </div>

            <div className="bg-blue-950/30 border border-blue-800/30 rounded-2xl p-6 space-y-3">
              <h4 className="text-lg font-bold text-blue-200">Municipal Assessor Staff</h4>
              <ul className="text-xs sm:text-sm text-slate-300 space-y-2 list-disc list-inside">
                <li>Eliminate physical file loss with digitized record management.</li>
                <li>Review and process property declarations with built-in audit trails.</li>
                <li>Generate statistical summaries for municipal tax planning and reporting.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Callout */}
        <div className="bg-gradient-to-r from-blue-700/40 to-indigo-800/40 border border-blue-500/30 rounded-2xl p-8 text-center space-y-4">
          <h3 className="text-2xl font-bold text-white">Need to access real property services?</h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Log in to your account to view your property portal or register to submit a new tax declaration request.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button 
              onClick={() => navigate('/user-login')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition shadow-lg"
            >
              Property Owner Portal
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm px-6 py-2.5 rounded-xl border border-slate-600 transition"
            >
              LGU Staff Login
            </button>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pt-8 border-t border-blue-800/50 text-xs text-slate-400 space-y-1">
        <p>© {new Date().getFullYear()} Municipal Government of San Fernando, Romblon. All Rights Reserved.</p>
        <p className="text-slate-500 text-[11px]">Municipal Assessor’s Office • Digital Archiving & Retrieval System</p>
      </div>

    </div>
  );
}