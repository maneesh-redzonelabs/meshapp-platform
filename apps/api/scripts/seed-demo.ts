/**
 * Creates a handful of demo users/content so the web/mobile apps have real
 * data to show immediately: 3 doctors (fully onboarded + verified +
 * searchable), 2 patients, some posts, and a completed appointment with a
 * prescription. Safe to re-run — it upserts by phone number and skips work
 * that's already done.
 *
 * Run with: npm run seed:demo
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/lib/crypto';
import { insertClinicLocation, setPatientAddressGeolocation } from '../src/lib/geo';
import { runComplianceScan } from '../src/modules/compliance/compliance.service';

const prisma = new PrismaClient();

async function upsertUser(phone: string, email: string | null, userType: 'doctor' | 'patient') {
  const existing = await prisma.users.findUnique({ where: { phone_number: phone } });
  if (existing) return existing;
  return prisma.users.create({
    data: {
      phone_number: phone,
      email: email ?? undefined,
      user_type: userType,
      phone_verified_at: new Date(),
      email_verified_at: email ? new Date() : undefined,
      password_hash: await hashSecret('DemoPass123!'),
    },
  });
}

async function seedDoctor(params: {
  phone: string;
  email: string;
  fullName: string;
  specialityName: string;
  subspecialityName: string;
  city: string;
  lat: number;
  lng: number;
  years: number;
}) {
  const user = await upsertUser(params.phone, params.email, 'doctor');
  const existingDoctor = await prisma.doctors.findUnique({ where: { doctor_id: user.user_id } });
  if (existingDoctor) {
    console.log(`  doctor ${params.fullName} already exists, skipping`);
    return existingDoctor;
  }

  const speciality = await prisma.medical_specialities.findFirstOrThrow({ where: { speciality_name: params.specialityName } });
  const subspeciality = await prisma.medical_subspecialities.findFirstOrThrow({
    where: { speciality_id: speciality.speciality_id, subspeciality_name: params.subspecialityName },
  });

  const doctor = await prisma.doctors.create({
    data: {
      doctor_id: user.user_id,
      full_name: params.fullName,
      speciality_id: speciality.speciality_id,
      subspeciality_id: subspeciality.subspeciality_id,
      bio: `Experienced ${params.specialityName} specialist in ${params.city}.`,
      years_of_experience: params.years,
      subscription_tier: 'premium',
      verification_status: 'verified',
      is_searchable: true,
      rating_avg: 4.6,
      rating_count: 23,
      profile_completeness_pct: 90,
    },
  });

  await insertClinicLocation({
    doctorId: doctor.doctor_id,
    clinicHospitalName: `${params.fullName.replace('Dr. ', '')} Clinic`,
    city: params.city,
    country: 'India',
    latitude: params.lat,
    longitude: params.lng,
    consultationFeeInPerson: 700,
    consultationFeeVideo: 500,
    isPrimary: true,
  } as any);

  await prisma.doctor_education.create({
    data: { doctor_id: doctor.doctor_id, education_level: 'graduation', degree_name: 'MBBS', passing_year: 2010 - params.years + 10 },
  });

  // Weekday 9am-5pm availability, both in-person and video, 30-min slots.
  for (let day = 1; day <= 5; day++) {
    await prisma.doctor_availability_slots.create({
      data: {
        doctor_id: doctor.doctor_id,
        day_of_week: day,
        start_time: new Date('1970-01-01T09:00:00Z'),
        end_time: new Date('1970-01-01T17:00:00Z'),
        slot_duration_minutes: 30,
        max_patients: 1,
        slot_type: 'both',
      },
    });
  }

  // An achievement that passes compliance (demonstrates the gate end-to-end).
  const scan = await runComplianceScan({ userId: doctor.doctor_id, entityType: 'doctor_achievement', text: `Completed fellowship training relevant to ${params.specialityName}` });
  if (scan.verdict === 'passed') {
    await prisma.doctor_achievements.create({
      data: {
        doctor_id: doctor.doctor_id,
        achievement_text: `Completed fellowship training relevant to ${params.specialityName}`,
        achievement_year: 2020,
        compliance_scan_id: scan.scan_id,
      },
    });
  }

  console.log(`  created doctor ${params.fullName} (${doctor.doctor_id})`);
  return doctor;
}

async function seedPatient(params: { phone: string; firstName: string; lastName: string; pin: string; lat: number; lng: number }) {
  const user = await upsertUser(params.phone, null, 'patient');
  const existing = await prisma.patients.findUnique({ where: { patient_id: user.user_id } });
  if (existing) {
    console.log(`  patient ${params.firstName} already exists, skipping`);
    return existing;
  }
  const patient = await prisma.patients.create({
    data: { patient_id: user.user_id, first_name: params.firstName, last_name: params.lastName, gender: 'other' },
  });
  const address = await prisma.patient_addresses.create({
    data: { patient_id: patient.patient_id, pin_code: params.pin, latitude: params.lat, longitude: params.lng, is_primary: true },
  });
  await setPatientAddressGeolocation(address.address_id, params.lat, params.lng);
  await prisma.patient_family_members.create({
    data: { patient_id: patient.patient_id, full_name: `${params.firstName} ${params.lastName}`, relationship: 'self' },
  });
  console.log(`  created patient ${params.firstName} (${patient.patient_id})`);
  return patient;
}

async function main() {
  console.log('Seeding demo data...');

  console.log('Doctors:');
  const doc1 = await seedDoctor({
    phone: '9000000001', email: 'dr.sharma@meshapp.demo', fullName: 'Dr. Anita Sharma',
    specialityName: 'Cardiology', subspecialityName: 'Interventional Cardiology', city: 'New Delhi', lat: 28.6139, lng: 77.209, years: 14,
  });
  const doc2 = await seedDoctor({
    phone: '9000000002', email: 'dr.khan@meshapp.demo', fullName: 'Dr. Imran Khan',
    specialityName: 'Orthopedics', subspecialityName: 'Sports Medicine', city: 'Mumbai', lat: 19.076, lng: 72.8777, years: 9,
  });
  await seedDoctor({
    phone: '9000000003', email: 'dr.rao@meshapp.demo', fullName: 'Dr. Lakshmi Rao',
    specialityName: 'Pediatrics', subspecialityName: 'Neonatology', city: 'Bengaluru', lat: 12.9716, lng: 77.5946, years: 11,
  });

  console.log('Patients:');
  const patient1 = await seedPatient({ phone: '9000000011', firstName: 'Rahul', lastName: 'Verma', pin: '110001', lat: 28.6304, lng: 77.2177 });
  await seedPatient({ phone: '9000000012', firstName: 'Priya', lastName: 'Nair', pin: '400001', lat: 18.9388, lng: 72.8354 });

  console.log('Posts:');
  const postScan = await runComplianceScan({ userId: doc1.doctor_id, entityType: 'post', text: 'Interesting case review: managing hypertension in young adults with lifestyle-first approaches.' });
  if (postScan.verdict === 'passed') {
    await prisma.posts.create({
      data: {
        author_id: doc1.doctor_id,
        content: 'Interesting case review: managing hypertension in young adults with lifestyle-first approaches.',
        visibility_scope: 'public',
        post_type: 'clinical_case',
        compliance_scan_id: postScan.scan_id,
      },
    });
    console.log('  created 1 post');
  }

  console.log('Appointment:');
  const location = await prisma.doctor_clinic_locations.findFirst({ where: { doctor_id: doc1.doctor_id, is_primary: true } });
  const existingAppt = await prisma.appointments.findFirst({ where: { patient_id: patient1.patient_id, doctor_id: doc1.doctor_id } });
  if (!existingAppt && location) {
    const payment = await prisma.payments.create({
      data: { payer_id: patient1.patient_id, payment_for: 'appointment', amount: 749, status: 'success', completed_at: new Date() },
    });
    const appt = await prisma.appointments.create({
      data: {
        patient_id: patient1.patient_id,
        doctor_id: doc1.doctor_id,
        location_id: location.location_id,
        appointment_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        start_time: new Date('1970-01-01T10:00:00Z'),
        appointment_type: 'in_person',
        status: 'completed',
        consultation_fee: 700,
        platform_service_fee: 49,
        total_amount: 749,
        payment_status: 'paid',
        payment_id: payment.payment_id,
      },
    });
    await prisma.prescriptions.create({
      data: {
        appointment_id: appt.appointment_id,
        doctor_id: doc1.doctor_id,
        patient_id: patient1.patient_id,
        diagnosis: 'Stage 1 hypertension',
        medications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '30 days' }],
        advice: 'Reduce salt intake, daily 30-minute walk, follow up in 4 weeks.',
        digital_signature: 'demo-signature-hash',
      },
    });
    console.log('  created 1 completed appointment + prescription');
  } else {
    console.log('  appointment already exists, skipping');
  }

  console.log('\nDemo credentials (password login, for any seeded doctor/patient):');
  console.log('  identifier: <phone_number above>, password: DemoPass123!');
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
