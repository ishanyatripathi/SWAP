import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import favicon from '../assets/favion.png'

const faviconLink = document.querySelector('link[rel="icon"]') || document.createElement('link')
faviconLink.rel = 'icon'
faviconLink.href = favicon
document.head.appendChild(faviconLink)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
