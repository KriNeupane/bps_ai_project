import React, { useState, useEffect } from 'react';
import { Play, Loader2, Database, Download, Sun, Moon, Square, LogOut, Lock } from 'lucide-react';
import axios from 'axios';
import PongGame from './PongGame';
import './App.css';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('username', res.data.username);
      onLogin(res.data.username);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: '0 24px'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Database size={40} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Data Scraper</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '6px' }}>
            Sign in to access your dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group">
            <label>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </div>
          <div className="input-group">
            <label>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="start-btn"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : <Lock size={18} />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Contact */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          marginTop: '20px'
        }}>
          Don't have access?{' '}
          <a href="mailto:krineupane07@gmail.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Contact krineupane07@gmail.com
          </a>
        </p>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '32px' }}>
          © 2026 Capstone Project — Built by Kri & Faheem. All rights reserved.
        </p>
      </div>
    </main>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ username, onLogout }) {
  const [city, setCity]                   = useState('Richardson, TX');
  const [industry, setIndustry]           = useState('Real estate agent');
  const [customExclusions, setCustomExclusions] = useState('');
  const [isScanning, setIsScanning]       = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [leads, setLeads]                 = useState([]);
  const [status, setStatus]               = useState('Idle');
  const [hasScrapedToday, setHasScrapedToday] = useState(false);
  const [theme, setTheme]                 = useState(() => localStorage.getItem('theme-mode') || 'dark');

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme-mode', theme);
  }, [theme]);

  // Check if user already scraped today on mount
  useEffect(() => {
    axios.get(`${API_BASE}/auth/me`, authHeaders)
      .then(res => setHasScrapedToday(res.data.has_scraped_today))
      .catch(() => {});
  }, []);

  // Status polling
  useEffect(() => {
    let interval;
    if (isScanning && currentScanId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/status/${currentScanId}`, authHeaders);
          const data = res.data;
          setStatus(data.status);
          if (data.leads) setLeads(data.leads);
          if (['completed', 'failed', 'stopped'].includes(data.status)) {
            setIsScanning(false);
            if (data.status === 'completed') setHasScrapedToday(true);
            clearInterval(interval);
          }
        } catch {
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
      setStatus('Scraping...');
      const res = await axios.post(`${API_BASE}/scrape`, { city, industry, custom_exclusions: customExclusions }, authHeaders);
      if (res.data.error) {
        setStatus(`Error: ${res.data.error}`);
        setIsScanning(false);
        return;
      }
      setLeads(res.data.leads || []);
      setCurrentScanId(res.data.scan_id);
      setStatus('Completed');
      setHasScrapedToday(true);
      setIsScanning(false);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to start scrape.';
      setStatus(msg);
      setIsScanning(false);
    }
  };

  const handleStop = async () => {
    if (!currentScanId) return;
    try {
      setStatus('Stopping...');
      await axios.post(`${API_BASE}/stop/${currentScanId}`, {}, authHeaders);
    } catch {}
  };

  const handleDownload = () => {
    window.open(`${API_BASE}/download/${currentScanId}?token=${token}`, '_blank');
  };

  return (
    <main className="dashboard-container">
      <div className="main-content">
        <header className="top-header">
          <div className="title-area">
            <Database className="logo-icon" size={32} />
            <h1>Data Scraper</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {username}
            </span>
            <button
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title="Toggle theme"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', padding:'10px', borderRadius:'8px', cursor:'pointer' }}
            >
              {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={onLogout}
              title="Sign out"
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'transparent', border:'1px solid var(--border-subtle)', color:'var(--text-muted)', padding:'10px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'0.8rem' }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </header>

        <section className="control-grid">
          <div className="card">
            <div className="input-row">
              <div className="input-group">
                <label>LOCATION</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex. Richardson, TX" />
                <span className="input-hint">Ex. Richardson, TX, Plano, TX (comma-separated)</span>
              </div>
              <div className="input-group">
                <label>KEYWORD</label>
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Ex. Real Estate Agent" />
                <span className="input-hint">The industry or niche to scrape</span>
              </div>
            </div>

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>PHONE NUMBER EXCLUSIONS (OPTIONAL)</label>
              <textarea
                value={customExclusions}
                onChange={e => setCustomExclusions(e.target.value)}
                placeholder={"Paste phone numbers to exclude (one per line)\nEx.\n(555) 123-4567\n555-987-6543"}
                rows={4}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              {hasScrapedToday ? (
                <div style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f59e0b',
                  padding: '12px 16px',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}>
                  ⚠️ Daily limit reached — you've already run a scrape today. Come back tomorrow.
                </div>
              ) : !isScanning ? (
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
              <button className="export-btn" onClick={handleDownload}>
                <Download size={20} />
                Download CSV
              </button>
            )}
          </aside>
        </section>

        <footer style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'0.75rem', borderTop:'1px solid var(--border-subtle)', marginTop:'auto' }}>
          © 2026 Capstone Project — Built by Kri & Faheem. All rights reserved.
        </footer>
      </div>
    </main>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('username') || null);
  const [token]                 = useState(() => localStorage.getItem('token') || null);

  const isLoggedIn = !!(token && username);

  const handleLogin = (uname) => setUsername(uname);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUsername(null);
  };

  return isLoggedIn
    ? <Dashboard username={username} onLogout={handleLogout} />
    : <LoginScreen onLogin={handleLogin} />;
}

export default App;
