import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AuctioneerView from './pages/AuctioneerView'
import ManagerView from './pages/ManagerView'
import useAuctionStore from './store/auctionStore'

function ProtectedRoute({ children, requiredRole }) {
  const user = useAuctionStore((s) => s.user)
  const token = useAuctionStore((s) => s.token)

  if (!token || !user) return <Navigate to="/" replace />
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'AUCTIONEER' ? '/auctioneer' : '/manager'} replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/auctioneer"
          element={
            <ProtectedRoute requiredRole="AUCTIONEER">
              <AuctioneerView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute requiredRole="TEAM_MANAGER">
              <ManagerView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
