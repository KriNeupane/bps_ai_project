import React, { useState, useEffect } from 'react';
import { Play, Loader2, Database, Download, Sun, Moon, Square } from 'lucide-react';
import axios from 'axios';
import PongGame from './PongGame';
import './App.css';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';

function App() {
  const [city, setCity] = useState('Richardson, TX');
  const [industry, setIndustry] = useState('Real estate agent');
  const [customExclusions, setCustomExclusions] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState('Idle');
  
  // Theme state: 'light' or 'dark'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme-mode') || 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme-mode', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const getThemeIcon = () => {
    return theme === 'light' ? <Sun size={20} /> : <Moon size={20} />;
  };

  // Status Polling Effect
  useEffect(() => {
    let interval;
    if (isScanning && currentScanId) {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`${API_BASE}/status/${currentScanId}`);
          const data = response.data;
          
          setStatus(data.status);
          if (data.leads) setLeads(data.leads);

          if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
            setIsScanning(false);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Status check failed:", err);
          clearInterval(interval);
          setIsScanning(false);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isScanning, currentScanId]);

  const handleStart = async () => {
    try {
      setIsScanning(true);
      setLeads([]);
      setStatus('Starting...');
      
      const response = await axios.post(`${API_BASE}/scrape`, {
        city,
        industry,
        custom_exclusions: customExclusions
      });
      
      setCurrentScanId(response.data.scan_id);
    } catch (err) {
      alert("Failed to start scrape");
      setIsScanning(false);
      setStatus('Idle');
    }
  };

  const handleStop = async () => {
    if (!currentScanId) return;
    try {
      setStatus('Stopping...');
      await axios.post(`${API_BASE}/stop/${currentScanId}`);
    } catch (err) {
      console.error("Failed to stop scrape:", err);
    }
  };

  const handleDownload = (scanId) => {
    window.open(`${API_BASE}/download/${scanId}`, '_blank');
  };

  return (
    <main className="dashboard-container">
      <div className="main-content">
        <header className="top-header">
          <div className="title-area">
            <Database className="logo-icon" size={32} />
            <h1>Data Scraper</h1>
          </div>
          <button 
            className="theme-toggle-btn"
            onClick={cycleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '10px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {getThemeIcon()}
          </button>
        </header>

        <section className="control-grid">
          <div className="card">
            <div className="input-row">
              <div className="input-group">
                <label>LOCATION</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Richardson, TX, Plano, TX" />
                <span className="input-hint">Ex. Richardson, TX, Plano, TX, Dallas, TX (comma-separated)</span>
              </div>
              <div className="input-group">
                <label>KEYWORD</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ex. Real Estate Agent" />
                <span className="input-hint">The industry or niche to scrape</span>
              </div>
            </div>
            
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>PHONE NUMBER EXCLUSIONS (OPTIONAL)</label>
              <textarea 
                value={customExclusions} 
                onChange={(e) => setCustomExclusions(e.target.value)} 
                placeholder="Paste phone numbers to exclude (one per line)&#10;Ex.&#10;(555) 123-4567&#10;555-987-6543" 
                rows={4}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              {!isScanning ? (
                <button className="start-btn" onClick={handleStart}>
                  <Play size={20} fill="currentColor" />
                  Start Scraping
                </button>
              ) : (
                <button className="start-btn" onClick={handleStop} style={{ backgroundColor: '#ef4444' }}>
                  <Square size={20} fill="currentColor" />
                  Stop Scraper
                </button>
              )}
            </div>

            <PongGame isScanning={isScanning} theme={theme} />
          </div>

          <aside className="card status-card">
            <label>LEADS FOUND</label>
            <div className="stat-value">{leads.length}</div>
            
            {isScanning && (
              <div className="scanning-indicator">
                <Loader2 className="spin" size={20} />
                <span>{status}</span>
              </div>
            )}
            
            {leads.length > 0 && !isScanning && (
              <button className="export-btn" onClick={() => handleDownload(currentScanId)}>
                <Download size={20} />
                Download CSV
              </button>
            )}
          </aside>
        </section>

        <footer style={{
          textAlign: 'center',
          padding: '20px',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 'auto'
        }}>
          © 2026 Capstone Project — Built by Kri & Faheem. All rights reserved.
        </footer>
      </div>
    </main>
  );
}

export default App;
