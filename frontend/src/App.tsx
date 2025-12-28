import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { BotDetailsPage } from './pages/BotDetailsPage';
import { AdminSystemPage } from './pages/AdminSystemPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<BotDetailsPage />} /> {/* Temp home */}
          <Route path="/bot/:id" element={<BotDetailsPage />} />
          <Route path="/admin-system" element={<AdminSystemPage />} />
          {/* Add other routes here */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;