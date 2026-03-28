import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/Layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Unidades } from './pages/Unidades';
import { Rentas } from './pages/Rentas';
import { RentaDetalle } from './pages/RentaDetalle';
import { CheckInOut } from './pages/CheckInOut';
import { Mantenimiento } from './pages/Mantenimiento';
import { Administracion } from './pages/Administracion';
import { AdministracionInicio } from './pages/AdministracionInicio';
import { Proveedores } from './pages/Proveedores';
import { ProveedorDetalle } from './pages/ProveedorDetalle';
import { ProveedoresReportes } from './pages/ProveedoresReportes';
import { Usuarios } from './pages/Usuarios';
import { Reportes } from './pages/Reportes';
import { Actividad } from './pages/Actividad';
import { Configuracion } from './pages/Configuracion';
import { Perfil } from './pages/Perfil';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ToastContainer />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="unidades" element={<Unidades />} />
            <Route path="rentas" element={<Rentas />} />
            <Route path="rentas/:id" element={<RentaDetalle />} />
            <Route path="checkinout" element={<CheckInOut />} />
            <Route path="mantenimiento" element={<Mantenimiento />} />
            <Route
              path="administracion"
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Administracion />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdministracionInicio />} />
              <Route path="proveedores" element={<Proveedores />} />
              <Route path="proveedores/:id" element={<ProveedorDetalle />} />
              <Route path="reportes-proveedores" element={<ProveedoresReportes />} />
            </Route>
            <Route
              path="usuarios"
              element={
                <ProtectedRoute allowedRoles={['administrador']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="reportes"
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Reportes />
                </ProtectedRoute>
              }
            />
            <Route
              path="actividad"
              element={
                <ProtectedRoute allowedRoles={['administrador', 'supervisor']}>
                  <Actividad />
                </ProtectedRoute>
              }
            />
            <Route
              path="configuracion"
              element={
                <ProtectedRoute allowedRoles={['administrador']}>
                  <Configuracion />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
