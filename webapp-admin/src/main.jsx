import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AdminDashboard from './AdminDashboard'
import { ToastProvider } from './components/Toast'

function App(){
  // Wrap with BrowserRouter so components like <Link> have router context.
  return (
    <BrowserRouter>
      <ToastProvider>
        <AdminDashboard />
      </ToastProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
