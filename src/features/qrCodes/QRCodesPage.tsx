import React, { useState, useEffect, useRef } from 'react';
import { useConvexAuth } from 'convex/react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { QRCodeGenerator, QRCodeList } from './components';

function QRCodesPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const savedQRCodes = useQuery(api.qrCodes.getUserQRCodes);

  const [activeTab, setActiveTab] = useState('generate');
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">Please login to view this page</h2>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  const savedCount = savedQRCodes?.length ?? 0;

  return (
    <div className="space-y-4" data-component="QRCodesPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Codes</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['generate'] = el; }}
            onClick={() => setActiveTab('generate')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'generate'
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Generate
          </button>
          <button
            ref={(el) => { tabRefs.current['saved'] = el; }}
            onClick={() => setActiveTab('saved')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'saved'
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Saved
            {savedCount > 0 && (
              <span
                className={`inline-flex items-center justify-center rounded-full text-xs px-1.5 py-0.5 min-w-[1.25rem] font-medium leading-none ${
                  activeTab === 'saved'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {savedCount}
              </span>
            )}
          </button>
        </nav>
        {/* Animated indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
          style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
        />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'generate' && (
          <QRCodeGenerator onSaved={() => setActiveTab('saved')} />
        )}
        {activeTab === 'saved' && (
          <QRCodeList />
        )}
      </div>
    </div>
  );
}

export default QRCodesPage;
