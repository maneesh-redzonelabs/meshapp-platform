import { prisma } from '../../lib/prisma';

/**
 * Recomputes doctors.profile_completeness_pct from the presence of each
 * major profile section. Not specified numerically by the spec/prototype
 * (the prototype has no such calculation at all) — this is a reasonable,
 * documented design: 8 equally-weighted sections.
 */
export async function recomputeProfileCompleteness(doctorId: string): Promise<number> {
  const [doctor, educationCount, affiliationCount, locationCount, achievementCount, publicationCount, availabilityCount, docCount] =
    await Promise.all([
      prisma.doctors.findUnique({ where: { doctor_id: doctorId } }),
      prisma.doctor_education.count({ where: { doctor_id: doctorId } }),
      prisma.doctor_affiliations.count({ where: { doctor_id: doctorId } }),
      prisma.doctor_clinic_locations.count({ where: { doctor_id: doctorId, is_active: true } }),
      prisma.doctor_achievements.count({ where: { doctor_id: doctorId } }),
      prisma.doctor_publications.count({ where: { doctor_id: doctorId } }),
      prisma.doctor_availability_slots.count({ where: { doctor_id: doctorId, is_active: true } }),
      prisma.doctor_verification_documents.count({ where: { doctor_id: doctorId, review_status: 'approved' } }),
    ]);

  if (!doctor) return 0;

  const sections = [
    Boolean(doctor.profile_selfie_url),
    Boolean(doctor.bio),
    educationCount > 0,
    affiliationCount > 0,
    locationCount > 0,
    availabilityCount > 0,
    achievementCount > 0 || publicationCount > 0,
    docCount > 0,
  ];

  const pct = Math.round((sections.filter(Boolean).length / sections.length) * 100);
  await prisma.doctors.update({ where: { doctor_id: doctorId }, data: { profile_completeness_pct: pct } });
  return pct;
}
