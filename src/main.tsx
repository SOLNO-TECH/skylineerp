import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { addCollection } from '@iconify/react'
import { icons as mdiCollection } from '@iconify-json/mdi'
import './theme.css'
import App from './App.tsx'

/** Colección MDI local: iconos dinámicos (p. ej. actividad desde API) se resuelven sin depender del CDN. */
addCollection(mdiCollection)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
