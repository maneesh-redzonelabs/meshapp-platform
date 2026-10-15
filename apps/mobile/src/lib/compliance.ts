import { api, ApiError } from './apiClient';
import { ComplianceEntityType, ComplianceScanResult } from '../types/shared';

/**
 * Runs the mandatory NMC-ethics compliance pre-check before any doctor
 * achievement, publication, post, or marketplace listing is created.
 *
 * Contract (POST /compliance/scan):
 *   request:  { content_type, text, has_image? }
 *   response: { scan_id, verdict: 'passed' | 'blocked', violations: [...] }
 *
 * The API spec document only shows the *blocked* example verbatim (as an
 * HTTP error from the downstream create endpoint); a passing scan's exact
 * success shape is not shown, so we defensively handle both:
 *  - a normal 200 response with { scan_id, verdict, violations }
 *  - a thrown ApiError with code COMPLIANCE_BLOCKED carrying violations/scan_id
 * Either way we normalize to a single ComplianceScanResult so callers never
 * special-case it.
 */
export async function runComplianceScan(
  contentType: ComplianceEntityType,
  text: string,
  hasImage = false,
): Promise<ComplianceScanResult> {
  try {
    const data = await api.post<ComplianceScanResult>('/compliance/scan', {
      content_type: contentType,
      text,
      has_image: hasImage,
    });
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'COMPLIANCE_BLOCKED') {
      return {
        scan_id: err.scanId ?? '',
        verdict: 'blocked',
        violations: err.violations ?? [],
      };
    }
    throw err;
  }
}
