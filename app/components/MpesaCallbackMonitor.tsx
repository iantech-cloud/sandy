'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { getMpesaCallbackInfo } from '@/app/hooks/useMpesaCallbackRegistration';

/**
 * Component to display M-Pesa callback registration status and recent responses
 * Useful for debugging callback issues
 */
export function MpesaCallbackMonitor() {
  const [callbackInfo, setCallbackInfo] = useState<any>(null);
  const [callbackStatus, setCallbackStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load callback registration info
    const info = getMpesaCallbackInfo();
    setCallbackInfo(info);

    // Fetch callback status from API
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/mpesa/register-callback');
        const data = await response.json();

        if (response.ok) {
          setCallbackStatus('success');
          setCallbackInfo(prev => ({
            ...prev,
            ...data,
          }));
        } else {
          setCallbackStatus('error');
        }
      } catch (error) {
        console.error('[v0] Failed to fetch callback status:', error);
        setCallbackStatus('error');
      }
    };

    fetchStatus();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showDetails) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {callbackStatus === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="font-semibold text-green-600 dark:text-green-400">M-Pesa Callback Active</span>
            </>
          ) : callbackStatus === 'loading' ? (
            <>
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">Loading...</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-600 dark:text-red-400">Callback Error</span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowDetails(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {callbackInfo && (
        <div className="space-y-3 text-sm">
          {/* Primary Callback URL */}
          {callbackInfo.callbackUrls?.primary && (
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-semibold mb-1">
                Primary Callback
              </label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 break-all font-mono">
                  {callbackInfo.callbackUrls.primary}
                </code>
                <button
                  onClick={() => copyToClipboard(callbackInfo.callbackUrls.primary)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Copy URL"
                >
                  {copied ? (
                    <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Secondary Callback URL */}
          {callbackInfo.callbackUrls?.secondary && (
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-semibold mb-1">
                Secondary Callback
              </label>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                <code className="flex-1 text-xs text-gray-700 dark:text-gray-300 break-all font-mono">
                  {callbackInfo.callbackUrls.secondary}
                </code>
                <button
                  onClick={() => copyToClipboard(callbackInfo.callbackUrls.secondary)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          )}

          {/* Registered At */}
          {callbackInfo.registeredAt && (
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-semibold mb-1">
                Registered At
              </label>
              <div className="text-gray-700 dark:text-gray-300">
                {new Date(callbackInfo.registeredAt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Base URL */}
          {callbackInfo.baseUrl && (
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-semibold mb-1">
                Base URL
              </label>
              <div className="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                {callbackInfo.baseUrl}
              </div>
            </div>
          )}

          {/* Instructions */}
          {callbackInfo.instructions && (
            <div>
              <label className="block text-gray-600 dark:text-gray-400 font-semibold mb-2">
                Setup Instructions
              </label>
              <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300 text-xs">
                {callbackInfo.instructions.step1 && <li>{callbackInfo.instructions.step1}</li>}
                {callbackInfo.instructions.step2 && <li>{callbackInfo.instructions.step2}</li>}
                {callbackInfo.instructions.step3 && <li>{callbackInfo.instructions.step3}</li>}
              </ol>
            </div>
          )}

          {/* Daraja Portal Link */}
          <a
            href="https://developer.safaricom.co.ke"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <span>Open Safaricom Daraja Portal</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Button to toggle the callback monitor display
 */
export function MpesaCallbackMonitorToggle() {
  const [showMonitor, setShowMonitor] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowMonitor(!showMonitor)}
        className="fixed bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Toggle M-Pesa Callback Monitor"
      >
        {showMonitor ? (
          <span className="text-lg">✕</span>
        ) : (
          <span className="text-lg">📡</span>
        )}
      </button>

      {showMonitor && (
        <div className="fixed bottom-20 right-4 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg p-4">
          <MpesaCallbackMonitor />
        </div>
      )}
    </>
  );
}
