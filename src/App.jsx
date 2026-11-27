import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { LodgeMartProvider, useLodgeMart } from './context/LodgeMartContext';
import Navbar from './components/Navbar';
import SmoothScroll from './components/SmoothScroll';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StorefrontPage from './pages/StorefrontPage';
import StudentOrdersPage from './pages/StudentOrdersPage';
import VendorPortalPage from './pages/VendorPortalPage';
import RiderPortalPage from './pages/RiderPortalPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function RequireRole({ allowedRoles, children }) {
  const { currentUser } = useLodgeMart();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={currentUser.homeRoute || '/'} replace />;
  }
  return children;
}

function ShopRoute({ children }) {
  const { currentUser } = useLodgeMart();
  if (currentUser && currentUser.role !== 'student') {
    return <Navigate to={currentUser.homeRoute || '/'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <LodgeMartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-canvas text-ink">
          <SmoothScroll />
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/shop"
              element={
                <ShopRoute>
                  <StorefrontPage />
                </ShopRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <RequireRole allowedRoles={['student']}>
                  <StudentOrdersPage />
                </RequireRole>
              }
            />
            <Route
              path="/vendor"
              element={
                <RequireRole allowedRoles={['vendor']}>
                  <VendorPortalPage />
                </RequireRole>
              }
            />
            <Route
              path="/rider"
              element={
                <RequireRole allowedRoles={['rider']}>
                  <RiderPortalPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </LodgeMartProvider>
    </MotionConfig>
  );
}
