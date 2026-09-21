import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function HeroSection({ 
  onGetStarted, 
  onGoToLogin, 
  onViewDashboard, 
  onRequestForm 
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  
  // State to manage Terms and Policy Modal visibility
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    // Check for incoming submission message or state flag
    const hasSubmitted = location.state?.redirectToNotice || location.state?.message;

    if (hasSubmitted) {
      setNotification(
        'Tax Declaration submitted successfully! Please wait for audit and review. You can check the status on the Notice Dashboard.'
      );

      // Clear navigation state so message won't show again on manual page refresh
      navigate(location.pathname, {
        replace: true,
        state: {}
      });

      // Auto-hide banner after 8 seconds to give time to click the dashboard button
      const timer = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [location, navigate]);

  const handleAcceptTerms = () => {
    setShowTermsModal(false);
    if (onGetStarted) {
      onGetStarted();
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white min-h-screen w-full flex flex-col justify-center items-center px-6 lg:px-16 overflow-hidden">
      
      {/* Dynamic Success Notification Banner */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-400 flex flex-col sm:flex-row items-center gap-3 animate-bounce max-w-xl w-11/12">
          <div className="flex items-center gap-2 text-left flex-grow">
            <svg className="w-6 h-6 text-emerald-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs sm:text-sm font-medium leading-snug">{notification}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
           
            <button 
              onClick={() => setNotification(null)} 
              className="text-emerald-200 hover:text-white font-bold text-xs p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      {/* Top Header Controls */}
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        <button 
          onClick={() => navigate('/about')}
          className="bg-blue-900/40 hover:bg-blue-800/60 text-slate-200 hover:text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-blue-500/30 transition shadow"
        >
          About Us
        </button>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 my-auto">
        <span className="inline-block bg-blue-700/50 text-blue-200 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-500/30 shadow-sm">
          Local Government Unit of San Fernando, Romblon
        </span>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
          Digital Archiving & Retrieval System for <span className="text-blue-400">Real Property Tax Declarations</span>
        </h1>

        <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
          Securely manage, digitize, and instantly retrieve real property tax records, streamline assessment workflows, and optimize municipal archiving for LGU San Fernando.
        </p>

        {/* Action Buttons Group */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2">
          <button 
            onClick={() => setShowTermsModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2 text-base w-full sm:w-auto"
          >
            <span>Lot Owners Portal</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <button 
            onClick={onGoToLogin}
            className="bg-blue-700/80 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl border border-blue-500/40 shadow-lg transition duration-200 flex items-center justify-center gap-2 text-base w-full sm:w-auto"
          >
            <span>Admin Portal Login</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-blue-800/60 text-center max-w-3xl mx-auto">
          <div className="p-4 bg-blue-950/40 rounded-xl border border-blue-800/30 shadow-inner">
            <h3 className="text-2xl font-bold text-blue-300">Fast</h3>
            <p className="text-xs text-slate-400 mt-1">Instant Record Retrieval</p>
          </div>
          <div className="p-4 bg-blue-950/40 rounded-xl border border-blue-800/30 shadow-inner">
            <h3 className="text-2xl font-bold text-blue-300">Secure</h3>
            <p className="text-xs text-slate-400 mt-1">Reliable LGU Database</p>
          </div>
          <div className="p-4 bg-blue-950/40 rounded-xl border border-blue-800/30 shadow-inner">
            <h3 className="text-2xl font-bold text-blue-300">Paperless</h3>
            <p className="text-xs text-slate-400 mt-1">Digital Tax Mapping & Archiving</p>
          </div>
        </div>
      </div>

      {/* 7 Terms and Policy Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-left flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
                Terms and Policy
              </h2>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Terms Content */}
            <div className="overflow-y-auto space-y-4 my-4 pr-2 text-slate-300 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-blue-600">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                Please read and accept the following terms before proceeding. A Property Owner account is required to submit a Tax Declaration.
              </p>

              <ol className="list-decimal list-inside space-y-3 font-normal">
                <li className="pl-1">
                  <strong className="text-white">Truthfulness of Information:</strong> All information provided in the Real Property Tax Declaration Form must be accurate, complete, and legally truthful.
                </li>
                <li className="pl-1">
                  <strong className="text-white">Data Privacy Compliance:</strong> Submitted data will be processed in strict compliance with the Data Privacy Act of 2012 for official municipal tax archiving.
                </li>
                <li className="pl-1">
                  <strong className="text-white">Official Verification & Audit:</strong> Submission of this form does not constitute immediate approval. All records undergo verification by the Municipal Assessor’s Office.
                </li>
                <li className="pl-1">
                  <strong className="text-white">Authorized Use Only:</strong> Users are prohibited from submitting fraudulent claims or using another person’s real property credentials without proper legal authorization.
                </li>
                <li className="pl-1">
                  <strong className="text-white">Digital Record Archiving:</strong> Digitize documents will be stored securely in the LGU San Fernando digital repository for official tracking and retrieval.
                </li>
                <li className="pl-1">
                  <strong className="text-white">Notice Dashboard Monitoring:</strong> Applicants are responsible for regularly checking the Notice Dashboard to view updates regarding audit status or required revisions.
                </li>
                <li className="pl-1">
                  <strong className="text-white">System Modifications:</strong> LGU San Fernando reserves the right to adjust assessment guidelines, terms, and digital workflow policies in accordance with updated local tax ordinances.
                </li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3 justify-end items-center">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium text-sm transition"
              >
                Decline & Cancel
              </button>
              <button
                onClick={handleAcceptTerms}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg transition"
              >
                I Agree & Continue
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}