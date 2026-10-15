import type { compliance_entity_type_enum, compliance_severity_enum } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/apiError';

export interface ComplianceViolation {
  category: string;
  excerpt: string;
  severity: 'block' | 'warn';
  guidance: string;
}

/**
 * Evaluates `text` against every active content_compliance_rules.pattern as
 * a JS regex (the rules table stores PCRE-ish patterns authored against the
 * NMC Ethical Advertising & Public Communication Guidelines; they translate
 * directly to JS RegExp with the 'i' flag). Per the prototype's own gating
 * logic (ContentComplianceGuard) AND the spec, ANY match — block or warn
 * severity — stops publishing; there is no soft-allow path. Writes an
 * immutable scan row regardless of verdict.
 */
export async function runComplianceScan(params: {
  userId: string;
  entityType: compliance_entity_type_enum;
  text: string;
}): Promise<{ scan_id: string; verdict: 'passed' | 'blocked'; violations: ComplianceViolation[] }> {
  const rules = await prisma.content_compliance_rules.findMany({ where: { is_active: true } });

  const violations: ComplianceViolation[] = [];
  for (const rule of rules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, 'i');
    } catch {
      continue; // skip a malformed rule rather than fail the whole scan
    }
    const match = regex.exec(params.text);
    if (match) {
      violations.push({
        category: rule.category,
        excerpt: match[0],
        severity: rule.severity as 'block' | 'warn',
        guidance: rule.guidance,
      });
    }
  }

  // Mirrors the prototype + spec: any violation (block OR warn) blocks publish.
  const verdict: 'passed' | 'blocked' = violations.length === 0 ? 'passed' : 'blocked';

  const scan = await prisma.content_compliance_scans.create({
    data: {
      entity_type: params.entityType,
      user_id: params.userId,
      scanned_text: params.text,
      verdict,
      matched_rules: violations as any,
    },
  });

  return { scan_id: scan.scan_id, verdict, violations };
}

/**
 * Re-validates a previously issued scan_id before it's referenced by a
 * creation endpoint: must belong to the same user, same entity_type, be a
 * 'passed' verdict, and — since a passed scan is only valid for the exact
 * text it scanned — the text the client is about to persist must still
 * match what was scanned (defense-in-depth against a client submitting a
 * passed scan_id for different/edited text than what was actually scanned).
 */
export async function assertPassedScan(params: {
  scanId: string;
  userId: string;
  entityType: compliance_entity_type_enum;
  text: string;
}): Promise<void> {
  const scan = await prisma.content_compliance_scans.findUnique({ where: { scan_id: params.scanId } });
  if (!scan) throw ApiError.badRequest('compliance_scan_id does not reference a known scan');
  if (scan.user_id !== params.userId) throw ApiError.forbidden('This compliance scan does not belong to you');
  if (scan.entity_type !== params.entityType) {
    throw ApiError.badRequest(`compliance_scan_id was scanned for entity_type=${scan.entity_type}, not ${params.entityType}`);
  }
  if (scan.scanned_text !== params.text) {
    throw ApiError.badRequest('Content has changed since it was scanned — re-run /compliance/scan on the final text');
  }
  if (scan.verdict !== 'passed') {
    throw ApiError.complianceBlocked(
      "This content violates MeshApp's NMC guideline rules and cannot be saved/published.",
      (scan.matched_rules as unknown as ComplianceViolation[]) ?? [],
    );
  }
  // 15-minute validity window on a passed scan, per spec recommendation.
  const ageMs = Date.now() - scan.scanned_at.getTime();
  if (ageMs > 15 * 60 * 1000) {
    throw ApiError.badRequest('This compliance scan has expired (valid 15 minutes) — re-run /compliance/scan');
  }
}

export type { compliance_severity_enum };
