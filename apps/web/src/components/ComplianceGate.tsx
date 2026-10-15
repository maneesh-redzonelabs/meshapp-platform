import React, { useState } from 'react';
import type { ComplianceEntityType, ComplianceScanResult } from '@meshapp/shared';
import { apiClient, ApiError } from '@/lib/apiClient';
import { Modal } from './ui/Modal';
import { Button, Spinner } from './ui/Primitives';

/**
 * Hook implementing the mandatory NMC content-compliance flow:
 * before any doctor_achievement / doctor_publication / post / equipment_listing
 * is created, the text MUST be scanned via POST /compliance/scan and the
 * resulting scan_id (only valid when verdict === 'passed') passed as
 * compliance_scan_id on the real create call. There is no "publish anyway"
 * override — a blocked scan requires editing the text and rescanning.
 */
export function useComplianceScan(contentType: ComplianceEntityType) {
  const [scanning, setScanning] = useState(false);
  const [blockedResult, setBlockedResult] = useState<ComplianceScanResult | null>(null);

  async function scan(text: string): Promise<string | null> {
    setScanning(true);
    setBlockedResult(null);
    try {
      const result = await apiClient.post<ComplianceScanResult>('/compliance/scan', {
        content_type: contentType,
        text,
      });
      if (result.verdict === 'passed') {
        return result.scan_id;
      }
      setBlockedResult(result);
      return null;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COMPLIANCE_BLOCKED' && err.violations) {
        setBlockedResult({ scan_id: '', verdict: 'blocked', violations: err.violations });
        return null;
      }
      throw err;
    } finally {
      setScanning(false);
    }
  }

  function dismiss() {
    setBlockedResult(null);
  }

  return { scan, scanning, blockedResult, dismiss };
}

export function ComplianceScanningOverlay() {
  return (
    <div className="fixed inset-0 z-[180] bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl px-8 py-10 flex flex-col items-center gap-4 shadow-2xl max-w-xs text-center">
        <Spinner className="text-3xl" />
        <p className="font-bold text-purple-950 text-sm">Scanning content for NMC compliance…</p>
        <p className="text-xs text-slate-500">Checking against medical advertising &amp; ethics guidelines before publishing.</p>
      </div>
    </div>
  );
}

export function ComplianceBlockedDialog({
  result,
  onClose,
}: {
  result: ComplianceScanResult;
  onClose: () => void;
}) {
  return (
    <Modal title="Content Blocked — Compliance Review Failed" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 text-sm text-rose-900">
          <i className="fa-solid fa-ban text-rose-600 mt-0.5" />
          <span>
            This content violates NMC advertising/ethics guidelines and cannot be published. Edit the flagged
            text below and resubmit — there is no override.
          </span>
        </div>
        <div className="space-y-3">
          {result.violations.length === 0 && (
            <p className="text-sm text-slate-500">The scan was blocked but returned no specific violation detail.</p>
          )}
          {result.violations.map((v, idx) => (
            <div key={idx} className="border border-rose-200 bg-rose-50/60 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wide text-rose-800">{v.category}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    v.severity === 'block' ? 'bg-rose-600 text-white border-rose-700' : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {v.severity.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-slate-800 italic mb-1">&ldquo;{v.excerpt}&rdquo;</p>
              <p className="text-xs text-slate-600">{v.guidance}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Edit &amp; Resubmit
        </Button>
      </div>
    </Modal>
  );
}
