import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ok, created } from '../../lib/response';
import { ApiError } from '../../lib/apiError';
import { prisma } from '../../lib/prisma';
import { assertPassedScan } from '../compliance/compliance.service';
import { consumeUpload } from '../uploads/uploads.store';
import { listingCreateSchema, listingUpdateSchema, inquiryCreateSchema } from './marketplace.schemas';

const router = Router();

function scanTextFor(title: string, description?: string) {
  return description ? `${title}\n${description}` : title;
}

router.get(
  '/listings',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const { category_id, q, listing_status } = req.query as Record<string, string | undefined>;
    const status = listing_status ?? 'active';
    const rows = q
      ? await prisma.$queryRaw`
          SELECT * FROM meshapp.equipment_listings
          WHERE listing_status = ${status}::meshapp.listing_status_enum
            AND to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${q})
          ORDER BY created_at DESC`
      : await prisma.equipment_listings.findMany({
          where: { listing_status: status as any, category_id: category_id ? Number(category_id) : undefined },
          orderBy: { created_at: 'desc' },
        });
    ok(res, rows);
  }),
);

router.post(
  '/listings',
  authenticate(),
  requireRole(['doctor']),
  validateBody(listingCreateSchema),
  asyncHandler(async (req, res) => {
    const { compliance_scan_id, media, ...rest } = req.body;
    await assertPassedScan({
      scanId: compliance_scan_id,
      userId: req.authUser!.userId,
      entityType: 'equipment_listing',
      text: scanTextFor(rest.title, rest.description),
    });

    const listing = await prisma.$transaction(async (tx) => {
      const l = await tx.equipment_listings.create({ data: { seller_id: req.authUser!.userId, compliance_scan_id, ...rest } });
      if (media?.length) {
        for (const [i, uploadId] of media.entries()) {
          const localPath = consumeUpload(uploadId, req.authUser!.userId);
          if (!localPath) continue;
          await tx.equipment_listing_media.create({ data: { listing_id: l.listing_id, file_path: localPath, is_primary: i === 0, sort_order: i } });
        }
      }
      return l;
    });

    await prisma.content_compliance_scans.update({ where: { scan_id: compliance_scan_id }, data: { entity_id: listing.listing_id } });
    created(res, listing);
  }),
);

router.get(
  '/listings/:listing_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const listing = await prisma.equipment_listings.findUnique({ where: { listing_id: req.params.listing_id } });
    if (!listing || listing.deleted_at) throw ApiError.notFound();
    if (listing.seller_id !== req.authUser!.userId) {
      await prisma.equipment_listings.update({ where: { listing_id: listing.listing_id }, data: { views_count: { increment: 1 } } }).catch(() => undefined);
    }
    ok(res, listing);
  }),
);

router.patch(
  '/listings/:listing_id',
  authenticate(),
  requireRole(['doctor']),
  validateBody(listingUpdateSchema),
  asyncHandler(async (req, res) => {
    const listing = await prisma.equipment_listings.findUnique({ where: { listing_id: req.params.listing_id } });
    if (!listing || listing.seller_id !== req.authUser!.userId) throw ApiError.notFound();

    const { compliance_scan_id, ...rest } = req.body;
    if (rest.title || rest.description) {
      if (!compliance_scan_id) throw ApiError.badRequest('compliance_scan_id is required when editing title/description');
      await assertPassedScan({
        scanId: compliance_scan_id,
        userId: req.authUser!.userId,
        entityType: 'equipment_listing',
        text: scanTextFor(rest.title ?? listing.title, rest.description ?? listing.description ?? undefined),
      });
    }
    const updated = await prisma.equipment_listings.update({
      where: { listing_id: listing.listing_id },
      data: { ...rest, compliance_scan_id: compliance_scan_id ?? undefined, updated_at: new Date() },
    });
    ok(res, updated);
  }),
);

router.delete(
  '/listings/:listing_id',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const listing = await prisma.equipment_listings.findUnique({ where: { listing_id: req.params.listing_id } });
    if (!listing || listing.seller_id !== req.authUser!.userId) throw ApiError.notFound();
    await prisma.equipment_listings.update({ where: { listing_id: listing.listing_id }, data: { deleted_at: new Date(), listing_status: 'cancelled' } });
    ok(res, { deleted: true });
  }),
);

router.post(
  '/listings/:listing_id/inquiries',
  authenticate(),
  requireRole(['doctor']),
  validateBody(inquiryCreateSchema),
  asyncHandler(async (req, res) => {
    const listing = await prisma.equipment_listings.findUnique({ where: { listing_id: req.params.listing_id } });
    if (!listing || listing.deleted_at) throw ApiError.notFound();
    const inquiry = await prisma.equipment_inquiries.create({
      data: { listing_id: listing.listing_id, buyer_id: req.authUser!.userId, message: req.body.message },
    });
    await prisma.notifications.create({
      data: {
        recipient_id: listing.seller_id,
        notification_type: 'market',
        title: 'New inquiry on your listing',
        message: `Someone is interested in "${listing.title}"`,
        entity_type: 'equipment_inquiries',
        entity_id: inquiry.inquiry_id,
      },
    });
    created(res, inquiry);
  }),
);

router.patch(
  '/inquiries/:inquiry_id/reply',
  authenticate(),
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const inquiry = await prisma.equipment_inquiries.findUnique({ where: { inquiry_id: req.params.inquiry_id } });
    if (!inquiry) throw ApiError.notFound();
    const listing = await prisma.equipment_listings.findUnique({ where: { listing_id: inquiry.listing_id } });
    if (!listing || listing.seller_id !== req.authUser!.userId) throw ApiError.notFound();
    const row = await prisma.equipment_inquiries.update({ where: { inquiry_id: inquiry.inquiry_id }, data: { status: 'replied', replied_at: new Date() } });
    ok(res, row);
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.equipment_categories.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }));
  }),
);

export default router;
