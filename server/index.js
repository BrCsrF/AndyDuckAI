/**
 * AndyDuckAI Server (Security Hardened)
 * Serves the web app and handles API endpoints
 */

const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

// Optional: OpenAI for TTS
let openai = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI();
    console.log('✓ OpenAI TTS enabled');
  }
} catch (e) {
  console.log('OpenAI not configured, using browser TTS');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SECURITY CONFIG ====================

// Access PIN (set via environment variable or default)
const ACCESS_PIN = process.env.ANDYDUCK_PIN || '8888';

// Path traversal protection
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+\.json$/;

// Max results to keep
const MAX_RESULTS = 10000;

// Allowed characters for student names (A-Z only, max 20)
const SAFE_NAME_REGEX = /^[A-Za-z]{1,20}$/;

// ==================== SECURITY MIDDLEWARE ====================

// CORS - restrict to same origin
app.use((req, res, next) => {
  // Only allow same-origin requests for API
  if (req.path.startsWith('/api/')) {
    const origin = req.get('origin');
    const host = req.get('host');
    
    // Allow requests with no origin (same-origin) or matching host
    if (!origin || origin.includes(host)) {
      res.set('Access-Control-Allow-Origin', origin || '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Access-Pin');
    }
  }
  next();
});

// Path traversal protection helper
function isPathSafe(filePath, baseDir) {
  const resolved = path.resolve(baseDir, filePath);
  return resolved.startsWith(path.resolve(baseDir));
}

// PIN verification for sensitive endpoints
const requirePin = (req, res, next) => {
  const pin = req.get('X-Access-Pin') || req.query.pin;
  if (pin !== ACCESS_PIN) {
    return res.status(401).json({ error: 'Invalid access PIN' });
  }
  next();
};

// Input sanitization helper
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return null;
  // Strip non A-Z characters first, then limit to 20
  const cleaned = name.replace(/[^A-Za-z]/g, '').substring(0, 20);
  if (!cleaned || !SAFE_NAME_REGEX.test(cleaned)) {
    return null;
  }
  return cleaned;
}

// ==================== PATHS ====================

const WORDLISTS_DIR = path.join(__dirname, '..', 'wordlists');
const DATA_DIR = path.join(__dirname, '..', 'data');
const APP_DIR = path.join(__dirname, '..', 'app');

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.static(APP_DIR));

// ==================== PUBLIC API ====================

// API: Verify PIN (for frontend login)
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === ACCESS_PIN) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

// API: Get all word sets (metadata only) - requires PIN
app.get('/api/wordsets', requirePin, async (req, res) => {
  try {
    const files = await fs.readdir(WORDLISTS_DIR);
    const sets = [];
    
    for (const file of files) {
      // Path traversal protection: only allow safe filenames
      if (!SAFE_FILENAME_REGEX.test(file)) continue;
      
      const filePath = path.join(WORDLISTS_DIR, file);
      
      // Double-check path is within allowed directory
      if (!isPathSafe(file, WORDLISTS_DIR)) continue;
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        sets.push({
          set: data.set,
          name: data.name,
          grade: data.grade,
          level: data.level,
          wordCount: data.words.length,
        });
      } catch (e) {
        // Skip invalid files
        console.warn(`Skipping invalid wordlist file: ${file}`);
      }
    }
    
    sets.sort((a, b) => a.set - b.set);
    res.json(sets);
  } catch (error) {
    console.error('Error loading word sets:', error);
    res.status(500).json({ error: 'Failed to load word sets' });
  }
});

// API: Get specific word set - requires PIN
app.get('/api/wordsets/:setNumber', requirePin, async (req, res) => {
  try {
    // Validate set number (strict integer check)
    const setNumber = parseInt(req.params.setNumber, 10);
    if (isNaN(setNumber) || setNumber < 0 || setNumber > 999 || 
        String(setNumber) !== req.params.setNumber.replace(/^0+/, '') && req.params.setNumber !== '0') {
      return res.status(400).json({ error: 'Invalid set number' });
    }
    
    const files = await fs.readdir(WORDLISTS_DIR);
    
    for (const file of files) {
      // Path traversal protection
      if (!SAFE_FILENAME_REGEX.test(file)) continue;
      if (!isPathSafe(file, WORDLISTS_DIR)) continue;
      
      try {
        const filePath = path.join(WORDLISTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        if (data.set === setNumber) {
          return res.json(data);
        }
      } catch (e) {
        // Skip invalid files
      }
    }
    
    res.status(404).json({ error: 'Word set not found' });
  } catch (error) {
    console.error('Error loading word set:', error);
    res.status(500).json({ error: 'Failed to load word set' });
  }
});

// API: Save results - requires PIN + input validation
app.post('/api/results', requirePin, async (req, res) => {
  try {
    const { student, set, score, total, words, date } = req.body;
    
    // Validate required fields
    const sanitizedStudent = sanitizeName(student);
    if (!sanitizedStudent) {
      return res.status(400).json({ error: 'Invalid student name' });
    }
    
    if (typeof set !== 'number' || set < 0 || set > 999) {
      return res.status(400).json({ error: 'Invalid set number' });
    }
    
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    
    if (typeof total !== 'number' || total < 0 || total > 100) {
      return res.status(400).json({ error: 'Invalid total' });
    }
    
    // Validate words array
    if (!Array.isArray(words) || words.length > 50) {
      return res.status(400).json({ error: 'Invalid words array' });
    }
    
    const sanitizedWords = words.map(w => {
      const word = String(w.word || '').substring(0, 30);
      const spoken = String(w.spoken || '').replace(/[^A-Za-z]/g, '');
      // Limit spoken to word length (ignoring spaces in word)
      const wordLength = word.replace(/\s+/g, '').length;
      return {
        word,
        correct: Boolean(w.correct),
        spoken: spoken.substring(0, wordLength).toUpperCase()
      };
    });
    
    const result = {
      id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      student: sanitizedStudent,
      set,
      score,
      total,
      words: sanitizedWords,
      date: date || new Date().toISOString()
    };
    
    // Load existing results
    const resultsFile = path.join(DATA_DIR, 'results.json');
    let results = { results: [] };
    
    try {
      const content = await fs.readFile(resultsFile, 'utf8');
      results = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }
    
    // Enforce max results (FIFO)
    if (results.results.length >= MAX_RESULTS) {
      results.results = results.results.slice(-MAX_RESULTS + 1);
    }
    
    results.results.push(result);
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`Result saved: ${result.student} - Set ${result.set} - ${result.score}/${result.total}`);
    res.json({ success: true, id: result.id });
  } catch (error) {
    console.error('Error saving result:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// API: Get results - requires PIN
app.get('/api/results', requirePin, async (req, res) => {
  try {
    const resultsFile = path.join(DATA_DIR, 'results.json');
    const content = await fs.readFile(resultsFile, 'utf8');
    const results = JSON.parse(content);
    
    const { student, set, from, to, limit } = req.query;
    let filtered = results.results;
    
    if (student) {
      const s = sanitizeName(student);
      if (s) {
        filtered = filtered.filter(r => r.student.toLowerCase().includes(s.toLowerCase()));
      }
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
    
    // Limit results returned
    const maxLimit = Math.min(parseInt(limit) || 100, 500);
    filtered = filtered.slice(-maxLimit);
    
    res.json({ results: filtered });
  } catch (error) {
    res.json({ results: [] });
  }
});

// API: Check if TTS is available
app.get('/api/tts/check', (req, res) => {
  res.json({ available: !!openai });
});

// API: Generate TTS audio - requires PIN
app.post('/api/tts', requirePin, async (req, res) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string' || text.length > 200) {
    return res.status(400).json({ error: 'Invalid text' });
  }
  
  if (!openai) {
    return res.status(503).json({ error: 'TTS not configured' });
  }
  
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text.substring(0, 200),
      speed: 0.9,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (error) {
    console.error('TTS error:', error.message);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// ==================== STUDENT MANAGEMENT ====================

const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const WORD_ATTEMPTS_FILE = path.join(DATA_DIR, 'word_attempts.json');

// Valid levels
const VALID_LEVELS = ['Starters', 'Movers', 'Flyers', 'SuperFlyers'];

// Valid branches (分校)
const BRANCHES = {
  'MQ': '民權分校',
  'MS': '民生分校',
  'MT': '民族分校',
  'JK': '健康分校',
  'YS': '延壽分校',
  'XS': '西松分校'
};
const VALID_BRANCHES = Object.keys(BRANCHES);

// API: Get all students - requires PIN
app.get('/api/students', requirePin, async (req, res) => {
  try {
    const content = await fs.readFile(STUDENTS_FILE, 'utf8');
    const data = JSON.parse(content);
    
    // Filter by branch and studyYear if specified
    const { branch, studyYear } = req.query;
    if (branch && VALID_BRANCHES.includes(branch)) {
      data.students = data.students.filter(s => s.branch === branch);
    }
    if (studyYear) {
      const year = parseInt(studyYear);
      if (!isNaN(year)) {
        data.students = data.students.filter(s => s.studyYear === year);
      }
    }
    
    res.json(data);
  } catch {
    res.json({ students: [] });
  }
});

// API: Add/update student - requires PIN
app.post('/api/students', requirePin, async (req, res) => {
  try {
    const { name, level, branch, studyYear } = req.body;
    
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid name (A-Z only, max 20 chars)' });
    }
    
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    if (!VALID_BRANCHES.includes(branch)) {
      return res.status(400).json({ error: 'Invalid branch' });
    }
    
    // Validate studyYear (e.g., 11301, 11302, 11401, 11402)
    const year = parseInt(studyYear);
    if (isNaN(year) || year < 10000 || year > 20000 || ![1, 2].includes(year % 100)) {
      return res.status(400).json({ error: 'Invalid studyYear (e.g., 11401, 11402)' });
    }
    
    // Load existing students
    let data = { students: [] };
    try {
      const content = await fs.readFile(STUDENTS_FILE, 'utf8');
      data = JSON.parse(content);
    } catch {}
    
    // Unique key: branch + studyYear + level + name
    const existing = data.students.find(s => 
      s.name.toLowerCase() === sanitizedName.toLowerCase() && 
      s.branch === branch &&
      s.studyYear === year &&
      s.level === level
    );
    if (existing) {
      // Update lastActive
      existing.lastActive = new Date().toISOString();
    } else {
      // Add new student
      data.students.push({
        name: sanitizedName,
        branch,
        studyYear: year,
        level,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
    }
    
    await fs.writeFile(STUDENTS_FILE, JSON.stringify(data, null, 2));
    console.log(`Student saved: ${sanitizedName} (${branch} ${year} ${level})`);
    res.json({ success: true, name: sanitizedName, branch, studyYear: year, level });
  } catch (error) {
    console.error('Error saving student:', error);
    res.status(500).json({ error: 'Failed to save student' });
  }
});

// API: Import students from CSV - requires PIN
// CSV format: Branch,StudyYear,Level,Name
app.post('/api/students/import', requirePin, async (req, res) => {
  try {
    const { students: importList } = req.body;
    
    if (!Array.isArray(importList)) {
      return res.status(400).json({ error: 'Invalid import data' });
    }
    
    // Load existing students
    let data = { students: [] };
    try {
      const content = await fs.readFile(STUDENTS_FILE, 'utf8');
      data = JSON.parse(content);
    } catch {}
    
    let added = 0, updated = 0, errors = [];
    
    for (let i = 0; i < importList.length; i++) {
      const item = importList[i];
      const lineNum = i + 1;
      
      const name = sanitizeName(item.name);
      const branch = String(item.branch || '').toUpperCase();
      const studyYear = parseInt(item.studyYear);
      const level = item.level;
      
      // Validate all fields
      if (!name) {
        errors.push(`Line ${lineNum}: Invalid name "${item.name}" (A-Z only)`);
        continue;
      }
      if (!VALID_BRANCHES.includes(branch)) {
        errors.push(`Line ${lineNum}: Invalid branch "${item.branch}" (use MQ/MS/MT/JK/YS/XS)`);
        continue;
      }
      if (isNaN(studyYear) || studyYear < 10000 || studyYear > 20000 || ![1, 2].includes(studyYear % 100)) {
        errors.push(`Line ${lineNum}: Invalid studyYear "${item.studyYear}" (e.g., 11401, 11402)`);
        continue;
      }
      if (!VALID_LEVELS.includes(level)) {
        errors.push(`Line ${lineNum}: Invalid level "${level}" (use Starters/Movers/Flyers/SuperFlyers)`);
        continue;
      }
      
      // Unique key: branch + studyYear + level + name
      const existing = data.students.find(s => 
        s.name.toLowerCase() === name.toLowerCase() && 
        s.branch === branch &&
        s.studyYear === studyYear &&
        s.level === level
      );
      
      if (existing) {
        existing.lastActive = new Date().toISOString();
        updated++;
      } else {
        data.students.push({
          name,
          branch,
          studyYear,
          level,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        });
        added++;
      }
    }
    
    await fs.writeFile(STUDENTS_FILE, JSON.stringify(data, null, 2));
    console.log(`Import complete: ${added} added, ${updated} updated, ${errors.length} errors`);
    res.json({ success: true, added, updated, errors });
  } catch (error) {
    console.error('Error importing students:', error);
    res.status(500).json({ error: 'Failed to import students' });
  }
});

// API: Get branches list
app.get('/api/branches', (req, res) => {
  res.json({ branches: BRANCHES });
});

// ==================== WORD ATTEMPT TRACKING ====================

// AI Analysis: Analyze why spelling failed
function analyzeSpellingError(word, failedAttempts) {
  if (!failedAttempts || failedAttempts.length === 0) return '';
  
  const target = word.toUpperCase().replace(/\s+/g, '');
  const analyses = [];
  
  // Count letter substitutions
  const substitutions = {};
  const missing = {};
  const extra = {};
  
  for (const attempt of failedAttempts) {
    const spoken = attempt.toUpperCase();
    
    // Compare each position
    for (let i = 0; i < Math.max(target.length, spoken.length); i++) {
      const expected = target[i] || null;
      const actual = spoken[i] || null;
      
      if (expected && actual && expected !== actual) {
        // Substitution
        const key = `${expected}→${actual}`;
        substitutions[key] = (substitutions[key] || 0) + 1;
      } else if (expected && !actual) {
        // Missing letter
        missing[expected] = (missing[expected] || 0) + 1;
      } else if (!expected && actual) {
        // Extra letter
        extra[actual] = (extra[actual] || 0) + 1;
      }
    }
  }
  
  // Generate analysis
  const subKeys = Object.keys(substitutions).sort((a, b) => substitutions[b] - substitutions[a]);
  const missingKeys = Object.keys(missing).sort((a, b) => missing[b] - missing[a]);
  const extraKeys = Object.keys(extra).sort((a, b) => extra[b] - extra[a]);
  
  // Common sound confusions
  const soundConfusions = {
    'D→T': 'D/T sounds confused',
    'T→D': 'D/T sounds confused',
    'B→P': 'B/P sounds confused',
    'P→B': 'B/P sounds confused',
    'G→K': 'G/K sounds confused',
    'K→G': 'G/K sounds confused',
    'V→F': 'V/F sounds confused',
    'F→V': 'V/F sounds confused',
    'S→Z': 'S/Z sounds confused',
    'Z→S': 'S/Z sounds confused',
    'M→N': 'M/N sounds confused',
    'N→M': 'M/N sounds confused',
    'A→E': 'A/E vowels confused',
    'E→A': 'A/E vowels confused',
    'I→E': 'I/E vowels confused',
    'E→I': 'I/E vowels confused',
    'O→U': 'O/U vowels confused',
    'U→O': 'O/U vowels confused',
  };
  
  for (const sub of subKeys.slice(0, 2)) {
    if (soundConfusions[sub]) {
      analyses.push(soundConfusions[sub]);
    } else {
      const [from, to] = sub.split('→');
      analyses.push(`${from} heard as ${to}`);
    }
  }
  
  if (missingKeys.length > 0) {
    analyses.push(`Missing: ${missingKeys.slice(0, 2).join(', ')}`);
  }
  
  if (extraKeys.length > 0) {
    analyses.push(`Extra: ${extraKeys.slice(0, 2).join(', ')}`);
  }
  
  // Check for length issues
  const avgLength = failedAttempts.reduce((sum, a) => sum + a.length, 0) / failedAttempts.length;
  if (avgLength < target.length * 0.7) {
    analyses.push('Too few letters spoken');
  } else if (avgLength > target.length * 1.3) {
    analyses.push('Too many letters spoken');
  }
  
  return analyses.slice(0, 3).join('; ') || 'Recognition unclear';
}

// API: Record word attempt - requires PIN
app.post('/api/word-attempts', requirePin, async (req, res) => {
  try {
    const { student, level, set, word, correct, spoken, branch, studyYear } = req.body;
    
    const sanitizedStudent = sanitizeName(student);
    if (!sanitizedStudent) {
      return res.status(400).json({ error: 'Invalid student name' });
    }
    
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    if (!VALID_BRANCHES.includes(branch)) {
      return res.status(400).json({ error: 'Invalid branch' });
    }
    
    const year = parseInt(studyYear);
    if (isNaN(year) || year < 10000 || year > 20000) {
      return res.status(400).json({ error: 'Invalid studyYear' });
    }
    
    if (typeof set !== 'number' || set < 0 || set > 999) {
      return res.status(400).json({ error: 'Invalid set number' });
    }
    
    const sanitizedWord = String(word || '').substring(0, 30);
    const sanitizedSpoken = String(spoken || '').replace(/[^A-Za-z]/g, '').substring(0, 30).toUpperCase();
    
    // Load existing attempts
    let data = { attempts: [] };
    try {
      const content = await fs.readFile(WORD_ATTEMPTS_FILE, 'utf8');
      data = JSON.parse(content);
    } catch {}
    
    // Find existing record for this student+branch+studyYear+level+set+word
    let record = data.attempts.find(a => 
      a.name.toLowerCase() === sanitizedStudent.toLowerCase() &&
      a.branch === branch &&
      a.studyYear === year &&
      a.level === level &&
      a.set === set &&
      a.word.toLowerCase() === sanitizedWord.toLowerCase()
    );
    
    if (record) {
      // Update existing record
      record.totalTimes++;
      if (!correct) {
        record.failTimes++;
        record.failTries.push(sanitizedSpoken);
        // Keep only last 10 failed attempts
        if (record.failTries.length > 10) {
          record.failTries = record.failTries.slice(-10);
        }
        // Update AI analysis
        record.aiJudge = analyzeSpellingError(sanitizedWord, record.failTries);
      }
      record.lastAttempt = new Date().toISOString();
    } else {
      // Create new record
      record = {
        name: sanitizedStudent,
        branch,
        studyYear: year,
        level,
        set,
        word: sanitizedWord,
        failTimes: correct ? 0 : 1,
        totalTimes: 1,
        failTries: correct ? [] : [sanitizedSpoken],
        aiJudge: correct ? '' : analyzeSpellingError(sanitizedWord, [sanitizedSpoken]),
        lastAttempt: new Date().toISOString()
      };
      data.attempts.push(record);
    }
    
    await fs.writeFile(WORD_ATTEMPTS_FILE, JSON.stringify(data, null, 2));
    console.log(`Word attempt: ${sanitizedStudent} - ${sanitizedWord} - ${correct ? 'correct' : 'failed'}`);
    res.json({ success: true, record });
  } catch (error) {
    console.error('Error saving word attempt:', error);
    res.status(500).json({ error: 'Failed to save word attempt' });
  }
});

// API: Get word attempts - requires PIN
app.get('/api/word-attempts', requirePin, async (req, res) => {
  try {
    const content = await fs.readFile(WORD_ATTEMPTS_FILE, 'utf8');
    const data = JSON.parse(content);
    
    const { student, level, set, branch, studyYear } = req.query;
    let filtered = data.attempts;
    
    if (branch && VALID_BRANCHES.includes(branch)) {
      filtered = filtered.filter(a => a.branch === branch);
    }
    if (studyYear) {
      const year = parseInt(studyYear);
      if (!isNaN(year)) {
        filtered = filtered.filter(a => a.studyYear === year);
      }
    }
    if (student) {
      const s = sanitizeName(student);
      if (s) {
        filtered = filtered.filter(a => a.name.toLowerCase() === s.toLowerCase());
      }
    }
    if (level && VALID_LEVELS.includes(level)) {
      filtered = filtered.filter(a => a.level === level);
    }
    if (set) {
      filtered = filtered.filter(a => a.set === parseInt(set));
    }
    
    res.json({ attempts: filtered });
  } catch {
    res.json({ attempts: [] });
  }
});

// API: Export word attempts as CSV - requires PIN
app.get('/api/word-attempts/export', requirePin, async (req, res) => {
  try {
    const content = await fs.readFile(WORD_ATTEMPTS_FILE, 'utf8');
    const data = JSON.parse(content);
    
    const { branch, studyYear } = req.query;
    let filtered = data.attempts;
    if (branch && VALID_BRANCHES.includes(branch)) {
      filtered = filtered.filter(a => a.branch === branch);
    }
    if (studyYear) {
      const year = parseInt(studyYear);
      if (!isNaN(year)) {
        filtered = filtered.filter(a => a.studyYear === year);
      }
    }
    
    // CSV header
    let csv = 'Branch,StudyYear,Name,Level,Set,Word,FailTimes,TotalTimes,FailTries,AIJudge\n';
    
    for (const a of filtered) {
      const failTries = a.failTries.join('; ');
      const aiJudge = (a.aiJudge || '').replace(/"/g, '""');
      csv += `${a.branch || ''},${a.studyYear || ''},${a.name},${a.level},${a.set},"${a.word}",${a.failTimes},${a.totalTimes},"${failTries}","${aiJudge}"\n`;
    }
    
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="word_attempts${branch ? '_' + branch : ''}${studyYear ? '_' + studyYear : ''}.csv"`
    });
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ==================== PHOTO CAPTURE ====================

const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

// API: Save login photo - requires PIN
app.post('/api/photos', requirePin, async (req, res) => {
  try {
    const { student, image, branch } = req.body;
    
    const sanitizedStudent = sanitizeName(student);
    if (!sanitizedStudent) {
      return res.status(400).json({ error: 'Invalid student name' });
    }
    
    if (!VALID_BRANCHES.includes(branch)) {
      return res.status(400).json({ error: 'Invalid branch' });
    }
    
    // Validate base64 image
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    
    // Extract base64 data
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Limit file size (max 500KB)
    if (buffer.length > 500 * 1024) {
      return res.status(400).json({ error: 'Image too large' });
    }
    
    // Generate filename: branch_studentname_timestamp.jpg
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${branch}_${sanitizedStudent}_${timestamp}.${ext}`;
    const filepath = path.join(PHOTOS_DIR, filename);
    
    await fs.writeFile(filepath, buffer);
    
    console.log(`Photo saved: ${filename}`);
    res.json({ success: true, filename });
  } catch (error) {
    console.error('Error saving photo:', error);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// API: List photos - requires PIN
app.get('/api/photos', requirePin, async (req, res) => {
  try {
    const files = await fs.readdir(PHOTOS_DIR);
    const { branch } = req.query;
    
    let photos = files
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => {
        const parts = f.split('_');
        // Format: branch_studentname_timestamp.jpg
        const photoBranch = parts[0];
        const student = parts[1];
        const timestamp = parts.slice(2).join('_').replace(/\.(jpg|jpeg|png)$/i, '').replace(/-/g, ':').replace('T', ' ');
        return { filename: f, branch: photoBranch, student, timestamp };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename)); // Newest first
    
    // Filter by branch if specified
    if (branch && VALID_BRANCHES.includes(branch)) {
      photos = photos.filter(p => p.branch === branch);
    }
    
    res.json({ photos });
  } catch {
    res.json({ photos: [] });
  }
});

// API: Get photo - requires PIN
app.get('/api/photos/:filename', requirePin, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Security: only allow safe filenames (branch_name_timestamp.ext)
    if (!/^[A-Z]{2}_[A-Za-z]+_[\d\-T]+\.(jpg|jpeg|png)$/i.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(PHOTOS_DIR, filename);
    
    // Check path traversal
    if (!filepath.startsWith(PHOTOS_DIR)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    
    const data = await fs.readFile(filepath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    
    res.set('Content-Type', mimeType);
    res.send(data);
  } catch {
    res.status(404).json({ error: 'Photo not found' });
  }
});

// Serve app for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(APP_DIR, 'index.html'));
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`  HTTP:  http://localhost:${PORT}`);
});

const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const certsDir = path.join(__dirname, '..', 'certs');

try {
  const httpsOptions = {
    key: fsSync.readFileSync(path.join(certsDir, 'key.pem')),
    cert: fsSync.readFileSync(path.join(certsDir, 'cert.pem')),
  };
  
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`
  🦆 AndyDuckAI Server Running! (Security Hardened)
  
  HTTP:    http://localhost:${PORT}
  HTTPS:   https://${getLocalIP()}:${HTTPS_PORT}
  
  🔐 Access PIN: ${ACCESS_PIN}
  🛡️ Path Traversal Protection: ON
  📁 Max Results: ${MAX_RESULTS}
  
  Ready to help kids learn spelling! 📚
    `);
  });
} catch (e) {
  console.log(`
  🦆 AndyDuckAI Server Running! (HTTP only)
  
  HTTP: http://localhost:${PORT}
  `);
}

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
