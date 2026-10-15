import { AppointmentType } from '../types/shared';

export type RootStackParamList = {
  RoleSelect: undefined;
  DoctorAuth: undefined;
  DoctorOnboarding: { doctorRegistrationToken?: string } | undefined;
  DoctorApp: undefined;
  PatientAuth: undefined;
  PatientApp: undefined;
};

export type DoctorTabParamList = {
  DoctorHome: undefined;
  DoctorNetwork: undefined;
  DoctorPosts: undefined;
  DoctorCommunity: undefined;
  DoctorMarket: undefined;
  DoctorLegal: undefined;
  DoctorHelp: undefined;
};

export type DoctorHomeStackParamList = {
  DoctorHomeMain: undefined;
  DoctorAchievements: undefined;
  DoctorPublications: undefined;
};

export type PatientTabParamList = {
  PatientHome: undefined;
  PatientAppointments: undefined;
  PatientAlerts: undefined;
  PatientProfile: undefined;
};

export type BookingDraft = {
  doctorId: string;
  doctorName: string;
  specialityName?: string;
  subspecialityName?: string;
  doctorPhoto?: string | null;
  locationId?: string;
  consultationFeeInPerson?: number;
  consultationFeeVideo?: number;
  familyMemberId?: string;
  familyMemberName?: string;
  appointmentType?: AppointmentType;
  appointmentDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  isReschedule?: boolean;
  rescheduleAppointmentId?: string;
};

export type PatientHomeStackParamList = {
  PatientHomeMain: undefined;
  BookingFamily: { draft: BookingDraft };
  BookingMode: { draft: BookingDraft };
  BookingDate: { draft: BookingDraft };
  BookingTime: { draft: BookingDraft };
  BookingPayment: { draft: BookingDraft };
  BookingSuccess: { appointmentId: string };
};

export type PatientProfileStackParamList = {
  PatientProfileMain: undefined;
  FamilyMembers: undefined;
};

export type PatientAppointmentsStackParamList = {
  PatientAppointmentsMain: undefined;
  VideoCall: { appointmentId: string };
  Prescription: { appointmentId: string };
  BookingDate: { draft: BookingDraft };
  BookingTime: { draft: BookingDraft };
  BookingPayment: { draft: BookingDraft };
};
