import React, { useState, useEffect } from 'react';
import { Search, MapPin, Play, Loader2, Database, History, CheckCircle2, AlertCircle, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000/api';

function App() {
  const [city, setCity] = useState('Richardson, TX');
  const [industry, setIndustry] = useState('Real estate agent');
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [leads, setLeads] = useState([]);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('Idle');

  useEffect(() => {
    let interval;
    if (isScanning && currentScanId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/status/${currentScanId}`);
          if (res.data.status === 'completed') {
            setIsScanning(false);
            setLeads(res.data.leads || []);
            setStatus('Complete');
            fetchHistory();
          } else if (res.data.status === 'failed') {
            setIsScanning(false);
            setStatus('Failed');
          } else {
            setStatus('Scanning...');
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isScanning, currentScanId]);

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
    setIsScanning(true);
    setLeads([]);
    setStatus('Initializing...');
    try {
      const res = await axios.post(`${API_BASE}/scrape`, { city, industry });
      setCurrentScanId(res.data.scan_id);
    } catch (err) {
      setIsScanning(false);
      setStatus('Error');
    }
  };

  const handleDownload = (id) => {
    window.open(`${API_BASE}/download/${id}`, '_blank');
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <Database className="logo-icon" size={24} />
          <span className="logo-text">Data Scraper</span>
        </div>
        <nav className="nav-section">
          <div className="nav-item active"><Search size={18} /> Data Extractor</div>
          <div className="nav-item"><History size={18} /> History</div>
          <div className="nav-item"><Download size={18} /> Exports</div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="title-area">
            <h1>Data Scraper</h1>
            <p className="subtitle">Universal Data Scraper for any industry</p>
          </div>
          <div className="status-badge">
            <div className={`dot ${isScanning ? 'pulse' : ''}`} />
            {status}
          </div>
        </header>

        <section className="control-grid">
          <div className="card input-section">
            <h3>Configuration</h3>
            <div className="input-row">
              <div className="input-group">
                <label>TARGET CITY</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Dallas, TX" />
              </div>
              <div className="input-group">
                <label>TARGET INDUSTRY</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Dentist" />
              </div>
            </div>
            <button className="start-btn" onClick={handleStart} disabled={isScanning}>
              {isScanning ? <Loader2 className="spin" size={20} /> : <Play size={20} />}
              {isScanning ? 'Extending Results...' : 'Start Extraction Task'}
            </button>
          </div>

          <div className="card stats-section">
            <h3>Session Payload</h3>
            <div className="stat-content">
              <div className="stat-value">{leads.length}</div>
              <p className="subtitle">Qualified leads identified</p>
            </div>
            {leads.length > 0 && (
              <button 
                className="export-btn"
                onClick={() => handleDownload(currentScanId)}
              >
                <Download size={16} /> Export Dataset
              </button>
            )}
          </div>
        </section>

        <section className="table-container">
          <div className="table-header">
            <h3>Archived Extractions</h3>
            <span className="subtitle">{history.length} operations logged</span>
          </div>
          <div className="history-list">
            <AnimatePresence mode="popLayout">
              {history.map(([id, data]) => (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={id} 
                  className="history-item"
                >
                  <div className="h-info">
                    <strong>{data.industry}</strong>
                    <span>{data.city} | {new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="h-actions">
                    <span className="lead-count-badge">{data.leads?.length || 0} LEADS</span>
                    {data.status === 'completed' ? (
                      <button className="icon-action-btn" onClick={() => handleDownload(id)} title="Download Results">
                        <Download size={18} />
                      </button>
                    ) : (
                      <Loader2 className="spin" size={18} />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
