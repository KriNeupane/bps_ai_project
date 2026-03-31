import React, { useState, useEffect } from 'react';
import { Play, Loader2, Database, Download } from 'lucide-react';
import axios from 'axios';
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



  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/scans`);
      setHistory(Object.entries(res.data).reverse());
    } catch (err) {
      console.error('History fetch failed');
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleStart = async () => {
    if (!city || !industry) return;
    setIsScanning(true);
    setLeads([]);
    setStatus('Extracting...');
    try {
      const res = await axios.post(`${API_BASE}/scrape`, { city, industry, custom_exclusions: customExclusions || "" });
      
      if (res.data.error) {
        setStatus(`Error: ${res.data.error}`);
        return;
      }
      
      setLeads(res.data.leads || []);
      setCurrentScanId(res.data.scan_id);
      setStatus('Completed');
      fetchHistory();
    } catch (err) {
      console.error(err);
      setStatus('Error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDownload = (id) => {
    window.open(`${API_BASE}/download/${id}`, '_blank');
  };

  return (
    <div className="dashboard-container">


      {/* Main Content */}
      <main className="main-content">
        <header className="top-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="title-area" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Database className="logo-icon" size={32} style={{ color: 'var(--accent)' }} />
            <h1 style={{ margin: 0 }}>Data Scraper</h1>
          </div>
          <div className="status-badge">
            <div className={`dot ${isScanning ? 'pulse' : ''}`} />
            {status}
          </div>
        </header>

        <section className="control-grid">
          <div className="card input-section">
            <div className="input-row">
              <div className="input-group">
                <label>CITY</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Dallas, TX" />
              </div>
              <div className="input-group">
                <label>INDUSTRY</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Dentist" />
              </div>
            </div>
            
            <div className="input-row" style={{ marginTop: '1rem' }}>
              <div className="input-group" style={{ width: '100%' }}>
                <label>PHONE NUMBER EXCLUSIONS (OPTIONAL)</label>
                <textarea 
                  value={customExclusions} 
                  onChange={(e) => setCustomExclusions(e.target.value)} 
                  placeholder="Paste phone numbers to exclude (one per line)&#10;e.g.&#10;(555) 123-4567&#10;555-987-6543" 
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'white',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginTop: '0.25rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="start-btn" onClick={handleStart} disabled={isScanning} style={{ flex: 1, padding: '16px', justifyContent: 'center', gap: '8px' }}>
                {isScanning ? (
                  <>
                    <Loader2 className="spin" size={24} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Scraping...</span>
                  </>
                ) : (
                  <Play size={24} />
                )}
              </button>
            </div>
          </div>

          <div className="card stats-section">
            <h3>LEADS</h3>
            <div className="stat-content">
              <div className="stat-value">{leads.length}</div>
            </div>
            {leads.length > 0 && (
              <button 
                className="export-btn"
                style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '16px' }}
                onClick={() => handleDownload(currentScanId)}
                title="Export Dataset"
              >
                <Download size={24} />
              </button>
            )}
          </div>
        </section>


      </main>
    </div>
  );
}

export default App;
