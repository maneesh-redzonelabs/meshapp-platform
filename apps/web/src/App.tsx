import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import DoctorAuth from './pages/doctor/DoctorAuth';
import PatientAuth from './pages/patient/PatientAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout, NavItem } from './components/layout/DashboardLayout';
import ProfileTab from './pages/doctor/ProfileTab';
import NetworkTab from './pages/doctor/NetworkTab';
import FeedTab from './pages/doctor/FeedTab';
import CommunityTab from './pages/doctor/CommunityTab';
import MarketplaceTab from './pages/doctor/MarketplaceTab';
import MedicoLegalTab from './pages/doctor/MedicoLegalTab';
import HelpDeskTab from './pages/doctor/HelpDeskTab';
import PatientHomeTab from './pages/patient/HomeTab';
import BookingFlow from './pages/patient/BookingFlow';
import PatientAppointmentsTab from './pages/patient/AppointmentsTab';
import PatientProfileTab from './pages/patient/PatientProfileTab';

const doctorNav: NavItem[] = [
  { to: '/doctor', label: 'Home', icon: 'fa-house-medical', end: true },
  { to: '/doctor/network', label: 'Network', icon: 'fa-users' },
  { to: '/doctor/feed', label: 'Feed', icon: 'fa-newspaper' },
  { to: '/doctor/community', label: 'Community', icon: 'fa-users-rectangle' },
  { to: '/doctor/marketplace', label: 'Market', icon: 'fa-store' },
  { to: '/doctor/medico-legal', label: 'Legal', icon: 'fa-scale-balanced' },
  { to: '/doctor/helpdesk', label: 'Help', icon: 'fa-headset' },
];

const patientNav: NavItem[] = [
  { to: '/patient', label: 'Home', icon: 'fa-house', end: true },
  { to: '/patient/appointments', label: 'Appointments', icon: 'fa-calendar-check' },
  { to: '/patient/profile', label: 'Profile', icon: 'fa-user' },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/doctor" element={<DoctorAuth />} />
      <Route path="/auth/patient" element={<PatientAuth />} />

      <Route
        path="/doctor"
        element={
          <ProtectedRoute allow={['doctor']}>
            <DashboardLayout navItems={doctorNav} brandSubtitle="Doctor Module (DPP)" />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProfileTab />} />
        <Route path="network" element={<NetworkTab />} />
        <Route path="feed" element={<FeedTab />} />
        <Route path="community" element={<CommunityTab />} />
        <Route path="marketplace" element={<MarketplaceTab />} />
        <Route path="medico-legal" element={<MedicoLegalTab />} />
        <Route path="helpdesk" element={<HelpDeskTab />} />
      </Route>

      <Route
        path="/patient"
        element={
          <ProtectedRoute allow={['patient']}>
            <DashboardLayout navItems={patientNav} brandSubtitle="Patient Care Portal" />
          </ProtectedRoute>
        }
      >
        <Route index element={<PatientHomeTab />} />
        <Route path="book/:doctorId" element={<BookingFlow />} />
        <Route path="appointments" element={<PatientAppointmentsTab />} />
        <Route path="profile" element={<PatientProfileTab />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
