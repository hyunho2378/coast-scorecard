import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './krds/dark.generated.css'
import './krds/layout.tokens.css'
import './krds/status.tokens.css'
import './krds/base.css'
import './krds/shell.css'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
