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
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('Idle');
  
  // Theme state: 'light' or 'dark'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme-mode') || 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme-mode', theme);
  }, [theme]);

  const cycleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    return theme === 'light' ? <Sun size={20} /> : <Moon size={20} />;
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/scans`);
      const scansDict = response.data;
      const scansArray = Object.keys(scansDict).map(id => ({
        id,
        ...scansDict[id]
      })).reverse();
      setHistory(scansArray);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
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
            fetchHistory();
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

  useEffect(() => {
    fetchHistory();
  }, []);

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
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-section">
            <Database className="logo-icon" size={24} />
            <h2>History</h2>
          </div>
        </div>
        <div className="history-list">
          {history.length === 0 && <div className="empty-history">No past scans</div>}
          {history.map((scan) => (
            <div key={scan.id} className="history-card">
              <div className="history-info">
                <p className="history-main">{scan.industry}</p>
                <p className="history-sub">{scan.city}</p>
                <p className={`history-status ${scan.status}`}>{scan.status}</p>
              </div>
              {(scan.status === 'completed' || scan.status === 'stopped') && (
                <button onClick={() => handleDownload(scan.id)} className="download-icon-btn" title="Download CSV">
                  <Download size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="title-area" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Database className="logo-icon" size={32} style={{ color: 'var(--accent)' }} />
            <h1 style={{ margin: 0 }}>Data Scraper</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              className="theme-toggle-btn"
              onClick={cycleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: '10px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {getThemeIcon()}
            </button>
          </div>
        </header>

        <section className="control-grid">
          <div className="card input-section">
            <div className="input-row">
              <div className="input-group">
                <label>LOCATION</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Dallas, TX, Richardson, TX" />
                <span className="input-hint">Ex. Richardson, TX, Plano, TX, Dallas, TX (comma-separated)</span>
              </div>
              <div className="input-group">
                <label>KEYWORD</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ex. Real Estate Agent" />
                <span className="input-hint">The industry or niche to scrape</span>
              </div>
            </div>
            
            <div className="input-row" style={{ marginTop: '1rem' }}>
              <div className="input-group" style={{ width: '100%' }}>
                <label>PHONE NUMBER EXCLUSIONS (OPTIONAL)</label>
                <textarea 
                  value={customExclusions} 
                  onChange={(e) => setCustomExclusions(e.target.value)} 
                  placeholder="Paste phone numbers to exclude (one per line)&#10;Ex.&#10;(555) 123-4567&#10;555-987-6543" 
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginTop: '0.25rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              {!isScanning ? (
                <button className="start-btn" onClick={handleStart} style={{ flex: 1, padding: '16px', justifyContent: 'center', gap: '8px' }}>
                  <Play size={20} fill="currentColor" />
                  Start Scraping
                </button>
              ) : (
                <button className="start-btn" onClick={handleStop} style={{ flex: 1, padding: '16px', justifyContent: 'center', gap: '8px', backgroundColor: '#ef4444' }}>
                  <Square size={20} fill="currentColor" />
                  Stop Scraper
                </button>
              )}
            </div>

            <PongGame isScanning={isScanning} theme={theme} />
          </div>

          <div className="card status-card">
            <label>LEADS FOUND</label>
            <div className="stat-value">{leads.length}</div>
            {isScanning && (
              <div className="scanning-indicator">
                <Loader2 className="spin" size={20} />
                <span>{status}</span>
              </div>
            )}
            
            {leads.length > 0 && !isScanning && (
              <button 
                className="export-btn" 
                onClick={() => handleDownload(currentScanId)}
                style={{ width: '100%', padding: '12px', justifyContent: 'center', gap: '8px' }}
              >
                <Download size={20} />
                Download CSV
              </button>
            )}
          </div>
        </section>

        <section className="results-section">
          <div className="section-header">
            <h3>Recent Results</h3>
            <span className="results-count">{leads.length} leads</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Address</th>
                  <th>Phone Number</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr key={i}>
                    <td className="font-medium">{lead['Company Name']}</td>
                    <td>{lead['Address']}</td>
                    <td>{lead['Phone Number']}</td>
                    <td>
                      {lead['Website'] !== 'N/A' ? (
                        <a href={lead['Website']} target="_blank" rel="noreferrer" className="website-link">
                          Visit Site
                        </a>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan="4" className="no-data">No leads found yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
