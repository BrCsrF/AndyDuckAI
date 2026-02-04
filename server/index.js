/**
 * AndyDuckAI Server
 * Serves the web app and handles API endpoints
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const WORDLISTS_DIR = path.join(__dirname, '..', 'wordlists');
const DATA_DIR = path.join(__dirname, '..', 'data');
const APP_DIR = path.join(__dirname, '..', 'app');

// Middleware
app.use(express.json());
app.use(express.static(APP_DIR));

// API: Get all word sets (metadata only)
app.get('/api/wordsets', async (req, res) => {
  try {
    const files = await fs.readdir(WORDLISTS_DIR);
    const sets = [];
    
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('.')) {
        const content = await fs.readFile(path.join(WORDLISTS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        sets.push({
          set: data.set,
          name: data.name,
          grade: data.grade,
          wordCount: data.words.length,
        });
      }
    }
    
    // Sort by set number
    sets.sort((a, b) => a.set - b.set);
    res.json(sets);
  } catch (error) {
    console.error('Error loading word sets:', error);
    res.status(500).json({ error: 'Failed to load word sets' });
  }
});

// API: Get specific word set
app.get('/api/wordsets/:setNumber', async (req, res) => {
  try {
    const setNumber = parseInt(req.params.setNumber);
    const files = await fs.readdir(WORDLISTS_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(WORDLISTS_DIR, file), 'utf8');
        const data = JSON.parse(content);
        if (data.set === setNumber) {
          return res.json(data);
        }
      }
    }
    
    res.status(404).json({ error: 'Word set not found' });
  } catch (error) {
    console.error('Error loading word set:', error);
    res.status(500).json({ error: 'Failed to load word set' });
  }
});

// API: Save results
app.post('/api/results', async (req, res) => {
  try {
    const result = req.body;
    result.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Load existing results
    const resultsFile = path.join(DATA_DIR, 'results.json');
    let results = { results: [] };
    
    try {
      const content = await fs.readFile(resultsFile, 'utf8');
      results = JSON.parse(content);
    } catch {
      // File doesn't exist yet, use empty array
    }
    
    // Add new result
    results.results.push(result);
    
    // Save
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`Result saved: ${result.student} - Set ${result.set} - ${result.score}/${result.total}`);
    res.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error saving result:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// API: Get results (for teacher/admin dashboard)
app.get('/api/results', async (req, res) => {
  try {
    const resultsFile = path.join(DATA_DIR, 'results.json');
    const content = await fs.readFile(resultsFile, 'utf8');
    const results = JSON.parse(content);
    
    // Optional filters
    const { student, set, from, to } = req.query;
    let filtered = results.results;
    
    if (student) {
      filtered = filtered.filter(r => r.student.toLowerCase().includes(student.toLowerCase()));
    }
    if (set) {
      filtered = filtered.filter(r => r.set === parseInt(set));
    }
    if (from) {
      filtered = filtered.filter(r => new Date(r.date) >= new Date(from));
    }
    if (to) {
      filtered = filtered.filter(r => new Date(r.date) <= new Date(to));
    }
    
    res.json({ results: filtered });
  } catch (error) {
    res.json({ results: [] });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(APP_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🦆 AndyDuckAI Server Running!
  
  Local:   http://localhost:${PORT}
  Network: http://${getLocalIP()}:${PORT}
  
  Ready to help kids learn spelling! 📚
  `);
});

// Get local IP for network access
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
