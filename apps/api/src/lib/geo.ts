import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Prisma cannot write/read the Unsupported("geography") column directly, so
 * every write to a geography-bearing table goes through $executeRaw with
 * ST_SetSRID(ST_MakePoint(lng,lat),4326) exactly as the DB's own
 * fn_sync_clinic_geolocation / fn_sync_patient_geolocation triggers do
 * (those triggers also fire as a safety net on direct SQL writes, but we
 * still set it explicitly here since Prisma's generated INSERT/UPDATE would
 * otherwise omit the column name whose trigger depends on latitude/longitude
 * being present in the same statement — which Prisma *does* write fine).
 */

export async function setClinicGeolocation(locationId: string, lat: number, lng: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE meshapp.doctor_clinic_locations
    SET geolocation = ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography
    WHERE location_id = ${locationId}::uuid
  `;
}

export async function setPatientAddressGeolocation(addressId: string, lat: number, lng: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE meshapp.patient_addresses
    SET geolocation = ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography
    WHERE address_id = ${addressId}::uuid
  `;
}

/**
 * doctor_clinic_locations.geolocation is a required (NOT NULL) Unsupported
 * column, which means Prisma Client does not generate a `.create()` method
 * at all for this model (there is no way to express the column in
 * CreateInput). Inserts therefore go through raw SQL; the BEFORE INSERT
 * trigger fn_sync_clinic_geolocation populates geolocation from the
 * latitude/longitude values in the same statement, so this is a complete,
 * non-partial insert — not a workaround that leaves data in a half state.
 */
export interface ClinicLocationRow {
  location_id: string;
  doctor_id: string;
  clinic_hospital_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  country: string;
  latitude: string;
  longitude: string;
  consultation_fee_inperson: string | null;
  consultation_fee_video: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: Date;
}

type PrismaOrTx = Pick<typeof prisma, '$queryRaw'>;

export async function insertClinicLocation(
  params: {
    doctorId: string;
    clinicHospitalName: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    latitude: number;
    longitude: number;
    consultationFeeInPerson?: number;
    consultationFeeVideo?: number;
    isPrimary: boolean;
  },
  client: PrismaOrTx = prisma,
): Promise<ClinicLocationRow> {
  const rows = await client.$queryRaw<ClinicLocationRow[]>`
    INSERT INTO meshapp.doctor_clinic_locations
      (doctor_id, clinic_hospital_name, address_line1, address_line2, city, state, pin_code,
       latitude, longitude, consultation_fee_inperson, consultation_fee_video, is_primary)
    VALUES
      (${params.doctorId}::uuid, ${params.clinicHospitalName}, ${params.addressLine1 ?? null}, ${params.addressLine2 ?? null},
       ${params.city ?? null}, ${params.state ?? null}, ${params.pinCode ?? null},
       ${params.latitude}::decimal(10,8), ${params.longitude}::decimal(11,8),
       ${params.consultationFeeInPerson ?? null}::decimal(10,2), ${params.consultationFeeVideo ?? null}::decimal(10,2),
       ${params.isPrimary})
    RETURNING location_id, doctor_id, clinic_hospital_name, address_line1, address_line2, city, state, pin_code,
      country, latitude, longitude, consultation_fee_inperson, consultation_fee_video, is_primary, is_active, created_at
  `;
  return rows[0];
}

export interface NearbyDoctorRow {
  doctor_id: string;
  full_name: string;
  profile_selfie_url: string | null;
  speciality_name: string;
  subspeciality_name: string;
  years_of_experience: number | null;
  rating_avg: string | null;
  rating_count: number;
  subscription_tier: string;
  verification_status: string;
  location_id: string;
  clinic_hospital_name: string;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  consultation_fee_inperson: string | null;
  consultation_fee_video: string | null;
  distance_meters: number;
}

export async function searchNearbyDoctors(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  specialityId?: number;
  subspecialityId?: number;
  limit: number;
  offset: number;
}): Promise<NearbyDoctorRow[]> {
  const { lat, lng, radiusMeters, specialityId, subspecialityId, limit, offset } = params;

  // vw_searchable_doctors (see meshapp-create-db.sql §34) does not expose
  // speciality_id/subspeciality_id, only their names — so to filter by id we
  // re-join the base tables here rather than the view, replicating its
  // exact WHERE clause (is_searchable, premium tier, verified, active, not deleted).
  const filters = [Prisma.sql`d.is_searchable = TRUE`,
    Prisma.sql`d.subscription_tier = 'premium'`,
    Prisma.sql`d.verification_status = 'verified'`,
    Prisma.sql`u.is_active = TRUE`,
    Prisma.sql`u.deleted_at IS NULL`,
    Prisma.sql`d.deleted_at IS NULL`,
    Prisma.sql`l.is_primary = TRUE`,
    Prisma.sql`l.is_active = TRUE`,
    Prisma.sql`ST_DWithin(l.geolocation, ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography, ${radiusMeters}::double precision)`,
  ];
  if (specialityId) filters.push(Prisma.sql`d.speciality_id = ${specialityId}`);
  if (subspecialityId) filters.push(Prisma.sql`d.subspeciality_id = ${subspecialityId}`);

  const whereClause = Prisma.join(filters, ' AND ');

  return prisma.$queryRaw<NearbyDoctorRow[]>(Prisma.sql`
    SELECT
      d.doctor_id, d.full_name, d.profile_selfie_url, ms.speciality_name, mss.subspeciality_name,
      d.years_of_experience, d.rating_avg::text as rating_avg, d.rating_count, d.subscription_tier,
      d.verification_status, l.location_id, l.clinic_hospital_name, l.city, l.state, l.pin_code,
      l.consultation_fee_inperson::text as consultation_fee_inperson,
      l.consultation_fee_video::text as consultation_fee_video,
      ST_Distance(l.geolocation, ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography) AS distance_meters
    FROM meshapp.doctors d
    JOIN meshapp.users u ON d.doctor_id = u.user_id
    JOIN meshapp.medical_specialities ms ON d.speciality_id = ms.speciality_id
    JOIN meshapp.medical_subspecialities mss ON d.subspeciality_id = mss.subspeciality_id
    JOIN meshapp.doctor_clinic_locations l ON d.doctor_id = l.doctor_id
    WHERE ${whereClause}
    ORDER BY distance_meters ASC
    LIMIT ${limit} OFFSET ${offset}
  `);
}
