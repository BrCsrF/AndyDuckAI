/**
 * AndyDuckAI - Spelling Bee App
 * Voice-based spelling practice for kids
 */

// App State
const state = {
  accessPin: '',  // Store verified PIN
  currentBranch: '', // MQ, MS, MT, JK, YS, XS
  currentStudyYear: 11401, // Default: 114學年上學期
  studentName: '',
  studentLevel: '', // Starters, Movers, Flyers, SuperFlyers
  currentLevel: '',  // Grade level for UI (G1, G2, etc.)
  currentSet: null,
  currentWordIndex: 0,
  currentAttempt: 0,  // Track attempts per word (max 3)
  words: [],
  results: [],
  isListening: false,
  allSets: [], // Cache all sets
  allStudents: [], // Cache all students
};

// Branch names
const BRANCHES = {
  'MQ': '民權分校',
  'MS': '民生分校',
  'MT': '民族分校',
  'JK': '健康分校',
  'YS': '延壽分校',
  'XS': '西松分校'
};

// Format study year for display (11401 → 114上)
function formatStudyYear(year) {
  const y = String(year);
  if (y.length === 5) {
    const yearNum = y.substring(0, 3);
    const semester = y.substring(3) === '01' ? '上' : '下';
    return `${yearNum}${semester}`;
  }
  return y;
}

// Get semester from study year (11401 → "Sem1", 11402 → "Sem2")
function getSemesterFromYear(year) {
  const y = String(year);
  if (y.length === 5) {
    return y.substring(3) === '01' ? 'Sem1' : 'Sem2';
  }
  return 'Sem1'; // Default
}

// Filter sets by level and semester
function filterSets(level) {
  const semester = getSemesterFromYear(state.currentStudyYear);
  return state.allSets.filter(s => {
    // Match level (grade field or level field)
    const levelMatch = s.level === level || s.grade === level;
    // Match semester (check if name contains Sem1 or Sem2)
    const semesterMatch = s.name && s.name.includes(semester);
    return levelMatch && semesterMatch;
  });
}

// API helper with PIN
async function apiCall(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Access-Pin': state.accessPin,
    ...options.headers
  };
  const response = await fetch(url, { ...options, headers });
  return response;
}

// DOM Elements
const screens = {
  pin: document.getElementById('screen-pin'),
  branch: document.getElementById('screen-branch'),
  name: document.getElementById('screen-name'),
  level: document.getElementById('screen-level'),
  set: document.getElementById('screen-set'),
  spelling: document.getElementById('screen-spelling'),
  feedback: document.getElementById('screen-feedback'),
  finish: document.getElementById('screen-finish'),
};

// Encouraging messages
const encouragement = {
  correct: [
    "Perfect! 🎉",
    "You got it! ⭐",
    "Excellent! 🌟",
    "Way to go! 👏",
    "Super spelling! 🦆",
    "Amazing! 💪",
    "That's right! ✨",
    "Wonderful! 🎊",
  ],
  tryAgain: [
    "Almost! Try again? 💪",
    "So close! One more try? 🌟",
    "Good effort! Let's try once more 🦆",
    "You're close! Give it another shot ⭐",
  ],
  hint: [
    "Here's a hint: ",
    "Let me help you: ",
    "Tip: ",
  ]
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  setupEventListeners();
  loadWordSets();
  console.log('AndyDuckAI initialized! 🦆');
}

async function submitPin() {
  const pinInput = document.getElementById('input-pin');
  const pinError = document.getElementById('pin-error');
  const pin = pinInput.value.trim();
  
  if (!pin) {
    pinInput.focus();
    return;
  }
  
  try {
    const response = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    
    if (response.ok) {
      state.accessPin = pin;
      pinError.style.display = 'none';
      showScreen('branch'); // Go to branch selection first
      loadWordSets(); // Load word sets after PIN verified
    } else {
      pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  } catch (error) {
    console.error('PIN verification error:', error);
    pinError.textContent = 'Connection error. Try again.';
    pinError.style.display = 'block';
  }
}

function setupEventListeners() {
  // PIN screen
  document.getElementById('btn-submit-pin').addEventListener('click', submitPin);
  document.getElementById('input-pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitPin();
  });
  
  // Year selection
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStudyYear = parseInt(btn.dataset.year);
    });
  });
  
  // Branch selection
  document.querySelectorAll('.branch-card').forEach(card => {
    card.addEventListener('click', () => {
      selectBranch(card.dataset.branch);
    });
  });
  
  // Name screen - tap duck to show hint
  document.getElementById('duck-mascot').addEventListener('click', () => {
    speak("Tap the big button and say your name!");
  });
  
  // Name screen - tap to start listening
  document.getElementById('btn-say-name').addEventListener('click', () => {
    hideHeardName();
    listenForName();
  });
  document.getElementById('btn-submit-name').addEventListener('click', submitName);
  const nameInput = document.getElementById('input-name');
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitName();
  });
  // Validate name input: A-Z only, max 20
  nameInput.addEventListener('input', (e) => {
    e.target.value = validateNameInput(e.target.value);
  });
  nameInput.setAttribute('maxlength', '20');
  nameInput.setAttribute('pattern', '[A-Za-z]+');
  
  // Level screen
  document.querySelectorAll('.level-card').forEach(card => {
    card.addEventListener('click', () => {
      const level = card.dataset.level;
      selectLevel(level);
    });
  });
  
  // Set screen - back button
  document.getElementById('btn-back-level').addEventListener('click', () => {
    showScreen('level');
    speak("Pick your level!");
  });
  
  // Spelling screen
  document.getElementById('btn-spell').addEventListener('click', listenForSpelling);
  document.getElementById('btn-repeat').addEventListener('click', sayCurrentWord);
  
  // Exit button
  const exitBtn = document.getElementById('btn-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', exitToLogin);
  }
  
  // Finish screen
  document.getElementById('btn-again').addEventListener('click', () => startSet(state.currentSet));
  document.getElementById('btn-next-student').addEventListener('click', goToNextStudent);
}

// Screen Management
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Load Word Sets
async function loadWordSets() {
  if (!state.accessPin) {
    console.log('No PIN, skipping word set load');
    return;
  }
  try {
    const response = await apiCall('/api/wordsets');
    if (response.ok) {
      state.allSets = await response.json();
      console.log(`Loaded ${state.allSets.length} word sets`);
    } else {
      state.allSets = getExampleSets();
    }
  } catch (error) {
    console.log('Using example sets (server not available)');
    state.allSets = getExampleSets();
  }
}

// Go to next student (after finishing test)
function goToNextStudent() {
  // Reset student state but keep branch
  state.studentName = '';
  state.studentLevel = '';
  state.currentLevel = '';
  state.currentSet = null;
  state.words = [];
  state.results = [];
  
  // Clear input
  document.getElementById('input-name').value = '';
  hideHeardName();
  
  // Go back to name screen - NO auto listen
  showScreen('name');
  speak("Next student! Tap the button and say your name!");
}

// Exit test and return to kid login
function exitToLogin() {
  // Stop any ongoing speech/recognition
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {}
  }
  isListeningForSpelling = false;
  
  // Reset student state but keep branch
  state.studentName = '';
  state.studentLevel = '';
  state.currentLevel = '';
  state.currentSet = null;
  state.words = [];
  state.results = [];
  
  // Clear input
  document.getElementById('input-name').value = '';
  hideHeardName();
  
  // Go back to name screen
  showScreen('name');
  speak("Tap the button and say your name!");
}

// Select branch
function selectBranch(branch) {
  state.currentBranch = branch;
  
  // Update header display
  document.getElementById('branch-display').textContent = `${branch} ${BRANCHES[branch]}`;
  document.getElementById('year-display').textContent = formatStudyYear(state.currentStudyYear);
  
  // Load students for this branch and year
  loadStudents();
  
  // Go directly to kid login screen
  showScreen('name');
  hideHeardName();
  speak(`Welcome! Tap the button and say your name!`);
}

// Load Students for current branch and studyYear
async function loadStudents() {
  if (!state.accessPin || !state.currentBranch) return;
  try {
    const response = await apiCall(`/api/students?branch=${state.currentBranch}&studyYear=${state.currentStudyYear}`);
    if (response.ok) {
      const data = await response.json();
      state.allStudents = data.students || [];
      console.log(`Loaded ${state.allStudents.length} students for ${state.currentBranch} ${state.currentStudyYear}`);
    }
  } catch (error) {
    console.log('Could not load students');
    state.allStudents = [];
  }
}

// Save student to server
async function saveStudent(name, level) {
  try {
    await apiCall('/api/students', {
      method: 'POST',
      body: JSON.stringify({ name, level })
    });
    console.log(`Student saved: ${name} (${level})`);
  } catch (error) {
    console.log('Could not save student');
  }
}

// Track word attempt
async function trackWordAttempt(word, correct, spoken) {
  if (!state.studentName || !state.studentLevel || !state.currentBranch) return;
  
  try {
    await apiCall('/api/word-attempts', {
      method: 'POST',
      body: JSON.stringify({
        student: state.studentName,
        branch: state.currentBranch,
        studyYear: state.currentStudyYear,
        level: state.studentLevel,
        set: state.currentSet,
        word: word,
        correct: correct,
        spoken: spoken
      })
    });
    console.log(`Word attempt tracked: ${word} - ${correct ? 'correct' : 'failed'}`);
  } catch (error) {
    console.log('Could not track word attempt');
  }
}

// ==================== CAMERA CAPTURE ====================

// Capture photo after login for verification
async function captureLoginPhoto(studentName) {
  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user', width: 640, height: 480 } 
    });
    
    // Create video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    await video.play();
    
    // Wait a moment for camera to adjust
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capture to canvas
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Stop camera
    stream.getTracks().forEach(track => track.stop());
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Send to server
    await apiCall('/api/photos', {
      method: 'POST',
      body: JSON.stringify({
        student: studentName,
        branch: state.currentBranch,
        image: imageData
      })
    });
    
    console.log('Login photo captured for:', studentName);
    return true;
  } catch (error) {
    console.log('Could not capture photo:', error.message);
    // Don't block login if camera fails
    return false;
  }
}

// Start login with photo capture
async function completeLogin(studentName, studentLevel, callback) {
  state.studentName = studentName;
  state.studentLevel = studentLevel;
  document.getElementById('student-name-display').textContent = studentName;
  
  // Capture photo (non-blocking)
  speak(`Hi ${studentName}! Smile for the camera!`, async () => {
    await captureLoginPhoto(studentName);
    speak(`Let's practice ${studentLevel}!`, callback);
  });
}

function getExampleSets() {
  return [
    { set: 1, name: "Basic Words", grade: "G1", wordCount: 5 },
    { set: 2, name: "Animals", grade: "G1", wordCount: 6 },
    { set: 3, name: "Colors", grade: "G1", wordCount: 7 },
    { set: 4, name: "Numbers", grade: "G2", wordCount: 5 },
    { set: 5, name: "Family", grade: "G2", wordCount: 6 },
    { set: 6, name: "Food", grade: "G2", wordCount: 8 },
    { set: 7, name: "School", grade: "G3", wordCount: 7 },
    { set: 8, name: "Nature", grade: "G3", wordCount: 6 },
  ];
}

function renderSetGrid(sets) {
  const grid = document.getElementById('set-grid');
  // Sort by set number (1, 2, 3... not 10, 11, 1, 2...)
  const sortedSets = [...sets].sort((a, b) => a.set - b.set);
  grid.innerHTML = sortedSets.map(set => {
    // Extract display number from name (e.g., "Starters Sem1 Set 5" → "5")
    const match = set.name.match(/Set\s*(\d+)/i);
    const displayNum = match ? match[1] : set.set;
    return `
    <div class="set-card" data-set="${set.set}">
      <div class="set-number">Set ${displayNum}</div>
      <div class="set-name">${set.name}</div>
      <div class="word-count">${set.wordCount} words</div>
    </div>
  `;}).join('');
  
  // Add click listeners
  grid.querySelectorAll('.set-card').forEach(card => {
    card.addEventListener('click', () => {
      const setNumber = parseInt(card.dataset.set);
      startSet(setNumber);
    });
  });
}

// Name Input
// Show what was heard on screen
function showHeardName(name, found) {
  const display = document.getElementById('heard-display');
  const nameEl = document.getElementById('heard-name');
  
  display.style.display = 'block';
  nameEl.textContent = name || '???';
  nameEl.className = 'heard-name ' + (found ? 'found' : 'not-found');
}

// Hide heard display
function hideHeardName() {
  document.getElementById('heard-display').style.display = 'none';
}

function listenForName() {
  // Stop any ongoing speech first!
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  
  const btn = document.getElementById('btn-say-name');
  btn.classList.add('listening');
  btn.textContent = '🎤 Listening...';
  
  // Small delay to ensure TTS is fully stopped
  setTimeout(() => {
    startSpeechRecognition((transcript) => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Tap and Say Your Name!';
    
    if (transcript && transcript.length > 1) {
      // Extract name from transcript
      const name = extractName(transcript);
      if (name && name.length > 1) {
        // Check if student exists
        const existing = state.allStudents.find(s => s.name.toLowerCase() === name.toLowerCase());
        
        // Show what was heard
        showHeardName(name, !!existing);
        
        if (existing) {
          // Found! Login
          completeLogin(existing.name, existing.level, () => {
            hideHeardName();
            document.getElementById('level-display').textContent = existing.level;
            const filteredSets = filterSets(existing.level);
            renderSetGrid(filteredSets.length > 0 ? filteredSets : state.allSets);
            showScreen('set');
          });
        } else {
          // Not found - NO auto retry, just show message
          speak(`I don't know ${name}. Tap the button and try again!`);
        }
      } else {
        // Show raw transcript if name extraction failed
        showHeardName(transcript, false);
        speak("I didn't understand. Tap the button and say your name clearly!");
      }
    } else {
      // Nothing heard - NO auto retry
      speak("I didn't hear anything. Tap the button and say your name!");
    }
  }, { timeout: 5000 });
  }, 200); // 200ms delay after stopping TTS
}

function extractName(transcript) {
  // Extract name: A-Z only, max 20 characters, min 2 characters
  const words = transcript.split(/[\s,.-]+/).filter(w => w.length >= 2);
  
  // Filter out common filler words
  const fillerWords = ['the', 'my', 'name', 'is', 'am', 'hi', 'hello', 'im', "i'm"];
  const filtered = words.filter(w => !fillerWords.includes(w.toLowerCase()));
  
  // Get first capitalized word or first valid word
  const name = filtered.find(w => /^[A-Z][a-z]+$/.test(w)) || filtered[0];
  if (!name || name.length < 2) return '';
  
  // Clean to A-Z only, limit to 20, min 2 chars
  const cleaned = name.replace(/[^A-Za-z]/g, '').substring(0, 20);
  if (cleaned.length < 2) return '';
  
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function validateNameInput(input) {
  // Only allow A-Z, max 20 characters
  const cleaned = input.replace(/[^A-Za-z]/g, '').substring(0, 20);
  return cleaned;
}

function submitName() {
  const nameInput = document.getElementById('input-name');
  // Validate: A-Z only, max 20
  const name = validateNameInput(nameInput.value.trim());
  
  console.log('submitName:', name, 'students loaded:', state.allStudents.length);
  
  if (name && name.length > 0) {
    // Check if student exists in the list
    const existing = state.allStudents.find(s => s.name.toLowerCase() === name.toLowerCase());
    console.log('Found student:', existing);
    
    if (existing) {
      // Found! Login with photo capture
      showHeardName(name, true);
      completeLogin(existing.name, existing.level, () => {
        hideHeardName();
        document.getElementById('level-display').textContent = existing.level;
        const filteredSets = filterSets(existing.level);
        renderSetGrid(filteredSets.length > 0 ? filteredSets : state.allSets);
        showScreen('set');
      });
    } else {
      // Name not found - NO auto retry
      showHeardName(name, false);
      shake(nameInput);
      speak(`I don't know ${name}. Check your spelling or tap the mic button!`);
    }
  } else {
    shake(nameInput);
    speak("Please enter your name!");
  }
}

// Level Selection
function selectLevel(level) {
  // Map display level to student level
  const levelMap = {
    'G1': 'Starters', 'G2': 'Starters',
    'G3': 'Movers', 'G4': 'Movers',
    'G5': 'Flyers', 'G6': 'Flyers',
    'Starters': 'Starters',
    'Movers': 'Movers',
    'Flyers': 'Flyers',
    'SuperFlyers': 'SuperFlyers'
  };
  
  state.currentLevel = level;
  state.studentLevel = levelMap[level] || level;
  
  // Save new student
  if (state.studentName && !state.allStudents.find(s => s.name.toLowerCase() === state.studentName.toLowerCase())) {
    saveStudent(state.studentName, state.studentLevel);
    state.allStudents.push({ name: state.studentName, level: state.studentLevel });
  }
  
  document.getElementById('level-display').textContent = state.studentLevel;
  speak(`${state.studentLevel}! Now pick a set to practice.`);
  
  // Filter sets by the student's level and semester
  const filteredSets = filterSets(state.studentLevel);
  renderSetGrid(filteredSets.length > 0 ? filteredSets : state.allSets);
  showScreen('set');
}

// Set Selection & Spelling
async function startSet(setNumber) {
  state.currentSet = setNumber;
  state.currentWordIndex = 0;
  state.results = [];
  
  // Find display number from set name
  const setInfo = state.allSets.find(s => s.set === setNumber);
  let displayNum = setNumber;
  if (setInfo && setInfo.name) {
    const match = setInfo.name.match(/Set\s*(\d+)/i);
    if (match) displayNum = parseInt(match[1]);
  }
  
  try {
    // Fetch words for this set
    const response = await fetch(`/api/wordsets/${setNumber}`);
    if (response.ok) {
      const setData = await response.json();
      state.words = setData.words;
    } else {
      // Use example words
      state.words = getExampleWords(setNumber);
    }
  } catch {
    state.words = getExampleWords(setNumber);
  }
  
  speak(`Great! Set ${numberToWords(displayNum)} has ${numberToWords(state.words.length)} words. Let's start!`, () => {
    showScreen('spelling');
    showCurrentWord();
  });
}

function getExampleWords(setNumber) {
  // Example words for development
  const exampleSets = {
    1: ['cat', 'dog', 'sun', 'moon', 'tree'],
    2: ['lion', 'tiger', 'bear', 'fish', 'bird', 'horse'],
    3: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink'],
    4: ['one', 'two', 'three', 'four', 'five'],
    5: ['mother', 'father', 'sister', 'brother', 'baby', 'family'],
    6: ['apple', 'banana', 'orange', 'bread', 'milk', 'water', 'rice', 'egg'],
    7: ['book', 'pencil', 'teacher', 'student', 'school', 'class', 'desk'],
    8: ['flower', 'grass', 'river', 'mountain', 'sky', 'cloud'],
  };
  return (exampleSets[setNumber] || exampleSets[1]).map(word => ({ word, hint: '' }));
}

function showCurrentWord() {
  const word = state.words[state.currentWordIndex];
  const wordDisplay = document.getElementById('current-word');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const lettersDisplay = document.getElementById('letters-display');
  
  // Reset attempt counter for new word
  state.currentAttempt = 0;
  
  // Update display - HIDE the word initially (show ? marks, ignore spaces in display)
  const wordNoSpaces = word.word.replace(/\s+/g, '');
  wordDisplay.textContent = '?'.repeat(wordNoSpaces.length);
  wordDisplay.dataset.word = word.word; // Store actual word
  wordDisplay.classList.add('hidden-word');
  wordDisplay.classList.remove('revealed-word');
  progressText.textContent = `Word ${state.currentWordIndex + 1} of ${state.words.length}`;
  progressFill.style.width = `${(state.currentWordIndex / state.words.length) * 100}%`;
  lettersDisplay.innerHTML = '';
  
  // Say the word
  sayCurrentWord();
}

function revealWord() {
  const wordDisplay = document.getElementById('current-word');
  wordDisplay.textContent = wordDisplay.dataset.word;
  wordDisplay.classList.remove('hidden-word');
  wordDisplay.classList.add('revealed-word');
}

function sayCurrentWord() {
  const word = state.words[state.currentWordIndex].word;
  speak(`Your word is: ${word}`);
  
  // Animate duck
  const duck = document.getElementById('duck-speaking');
  duck.classList.add('speaking');
  setTimeout(() => duck.classList.remove('speaking'), 2000);
}

let isListeningForSpelling = false;

function listenForSpelling() {
  // Prevent double-tap
  if (isListeningForSpelling) {
    console.log('Already listening, ignoring tap');
    return;
  }
  
  // Stop any ongoing speech first!
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  
  isListeningForSpelling = true;
  const btn = document.getElementById('btn-spell');
  btn.classList.add('listening');
  btn.textContent = '🎤 Listening...';
  btn.disabled = true;
  
  // Longer delay to ensure TTS is fully stopped
  setTimeout(() => {
    startSpeechRecognition((transcript) => {
      isListeningForSpelling = false;
      btn.classList.remove('listening');
      btn.textContent = '🎤 Spell It!';
      btn.disabled = false;
      
      if (transcript) {
        checkSpelling(transcript);
      } else {
        // No speech detected - NO auto action
        speak("I didn't hear that. Tap the button and try again!");
      }
    }, { timeout: 8000, forSpelling: true });
  }, 500); // 500ms delay after stopping TTS
}

function checkSpelling(transcript) {
  // Remove spaces from target word for comparison
  const targetWord = state.words[state.currentWordIndex].word.toUpperCase().replace(/\s+/g, '');
  const maxLength = targetWord.length;
  
  // Extract letters and limit to word length
  let spokenLetters = extractLetters(transcript);
  if (spokenLetters.length > maxLength) {
    spokenLetters = spokenLetters.slice(0, maxLength);
  }
  
  // Display letters (compare against word without spaces)
  displayLetters(spokenLetters, targetWord.split(''));
  
  // Check if correct (ignore spaces)
  const isCorrect = spokenLetters.join('') === targetWord;
  
  state.currentAttempt++;
  
  if (isCorrect) {
    // Track successful attempt
    trackWordAttempt(state.words[state.currentWordIndex].word, true, spokenLetters.join(''));
    
    // Record correct result
    state.results.push({
      word: state.words[state.currentWordIndex].word,
      correct: true,
      spoken: spokenLetters.join(''),
      attempts: state.currentAttempt,
    });
    
    // Show success feedback and move to next word
    showFeedback(true, () => {
      if (state.currentWordIndex < state.words.length - 1) {
        state.currentWordIndex++;
        showCurrentWord();
      } else {
        finishSet();
      }
    });
  } else {
    // Track failed attempt
    trackWordAttempt(state.words[state.currentWordIndex].word, false, spokenLetters.join(''));
    
    // Wrong answer
    if (state.currentAttempt < 3) {
      // Give another try (up to 3 attempts)
      const attemptsLeft = 3 - state.currentAttempt;
      speak(`Not quite! You have ${numberToWords(attemptsLeft)} more ${attemptsLeft === 1 ? 'try' : 'tries'}. Tap the button to try again!`);
    } else {
      // 3 attempts used, record and move on
      state.results.push({
        word: state.words[state.currentWordIndex].word,
        correct: false,
        spoken: spokenLetters.join(''),
        attempts: state.currentAttempt,
      });
      
      // Reveal the word and show encouragement
      revealWord();
      speak(`The word is ${state.words[state.currentWordIndex].word}. Good try! Let's move on.`, () => {
        setTimeout(() => {
          if (state.currentWordIndex < state.words.length - 1) {
            state.currentWordIndex++;
            showCurrentWord();
          } else {
            finishSet();
          }
        }, 1500);
      });
    }
  }
}

function extractLetters(transcript) {
  console.log('Raw transcript:', transcript);
  
  // Common phonetic letter names → actual letters
  const phoneticMap = {
    'ay': 'A', 'a': 'A', 'eh': 'A',
    'bee': 'B', 'be': 'B', 'b': 'B',
    'see': 'C', 'sea': 'C', 'c': 'C', 'si': 'C',
    'dee': 'D', 'd': 'D', 'di': 'D',
    'ee': 'E', 'e': 'E',
    'eff': 'F', 'ef': 'F', 'f': 'F',
    'gee': 'G', 'g': 'G', 'ji': 'G',
    'aitch': 'H', 'h': 'H', 'age': 'H', 'ach': 'H',
    'eye': 'I', 'i': 'I', 'ai': 'I',
    'jay': 'J', 'j': 'J',
    'kay': 'K', 'k': 'K', 'ca': 'K',
    'el': 'L', 'l': 'L', 'ell': 'L',
    'em': 'M', 'm': 'M',
    'en': 'N', 'n': 'N',
    'oh': 'O', 'o': 'O',
    'pee': 'P', 'p': 'P', 'pi': 'P',
    'cue': 'Q', 'q': 'Q', 'queue': 'Q', 'kyu': 'Q',
    'are': 'R', 'r': 'R', 'ar': 'R',
    'ess': 'S', 's': 'S', 'es': 'S',
    'tee': 'T', 't': 'T', 'ti': 'T',
    'you': 'U', 'u': 'U', 'yu': 'U',
    'vee': 'V', 'v': 'V', 'vi': 'V',
    'double you': 'W', 'double u': 'W', 'w': 'W', 'dub': 'W',
    'ex': 'X', 'x': 'X', 'ecks': 'X',
    'why': 'Y', 'y': 'Y', 'wai': 'Y',
    'zee': 'Z', 'zed': 'Z', 'z': 'Z', 'zi': 'Z',
  };
  
  // Clean up transcript
  let clean = transcript.toLowerCase().trim();
  
  // Try to match spoken letter names
  let letters = [];
  
  // Split by common delimiters
  const parts = clean.split(/[\s,.\-]+/).filter(p => p.length > 0);
  
  for (const part of parts) {
    // Check phonetic map first
    if (phoneticMap[part]) {
      letters.push(phoneticMap[part]);
    } 
    // Single letter
    else if (part.length === 1 && /[a-z]/i.test(part)) {
      letters.push(part.toUpperCase());
    }
    // Check if it's a letter name we missed
    else {
      // Try partial matches
      for (const [phonetic, letter] of Object.entries(phoneticMap)) {
        if (part === phonetic || part.startsWith(phonetic)) {
          letters.push(letter);
          break;
        }
      }
    }
  }
  
  // If no letters found, try extracting single letters from the raw text
  if (letters.length === 0) {
    letters = clean.toUpperCase().split('').filter(c => /[A-Z]/.test(c));
  }
  
  console.log('Extracted letters:', letters);
  return letters;
}

function displayLetters(spoken, target) {
  const container = document.getElementById('letters-display');
  container.innerHTML = '';
  
  spoken.forEach((letter, i) => {
    const box = document.createElement('div');
    box.className = 'letter-box';
    box.textContent = letter;
    
    // Color based on correctness
    if (i < target.length && letter === target[i]) {
      box.classList.add('correct');
    } else {
      box.classList.add('incorrect');
    }
    
    box.style.animationDelay = `${i * 0.1}s`;
    container.appendChild(box);
  });
}

function showFeedback(isCorrect, callback) {
  const container = document.getElementById('feedback-container');
  const wordDisplay = document.getElementById('feedback-word');
  const emoji = document.getElementById('feedback-emoji');
  const text = document.getElementById('feedback-text');
  
  // Show the correct word in big letters!
  const currentWord = state.words[state.currentWordIndex].word;
  wordDisplay.textContent = currentWord.toUpperCase();
  
  // Reveal the word on spelling screen too
  revealWord();
  emoji.textContent = ['🎉', '⭐', '🌟', '👏', '🦆'][Math.floor(Math.random() * 5)];
  text.textContent = encouragement.correct[Math.floor(Math.random() * encouragement.correct.length)];
  container.classList.remove('incorrect');
  
  speak(text.textContent.replace(/[🎉⭐🌟👏🦆💪]/g, ''));
  showScreen('feedback');
  
  setTimeout(() => {
    showScreen('spelling');
    callback();
  }, 2000);
}

function finishSet() {
  const correct = state.results.filter(r => r.correct).length;
  const total = state.results.length;
  const percentage = Math.round((correct / total) * 100);
  
  // Update finish screen
  const message = document.getElementById('finish-message');
  if (percentage === 100) {
    message.textContent = `Perfect score, ${state.studentName}! 🏆`;
  } else if (percentage >= 80) {
    message.textContent = `Great job, ${state.studentName}! 🌟`;
  } else if (percentage >= 60) {
    message.textContent = `Good effort, ${state.studentName}! 💪`;
  } else {
    message.textContent = `Nice try, ${state.studentName}! Keep practicing! 🦆`;
  }
  
  // Show stars (based on percentage)
  const starsContainer = document.getElementById('stars-container');
  const numStars = Math.ceil(percentage / 20); // 0-100% = 1-5 stars
  starsContainer.innerHTML = Array(5).fill(0).map((_, i) => 
    `<span class="star">${i < numStars ? '⭐' : '☆'}</span>`
  ).join('');
  
  speak(message.textContent.replace(/[🏆🌟💪🦆]/g, ''));
  showScreen('finish');
  
  // Save results (send to server)
  saveResults(correct, total);
}

async function saveResults(correct, total) {
  const result = {
    student: state.studentName,
    set: state.currentSet,
    date: new Date().toISOString(),
    score: correct,
    total: total,
    words: state.results,
  };
  
  try {
    await apiCall('/api/results', {
      method: 'POST',
      body: JSON.stringify(result),
    });
    console.log('Results saved:', result);
  } catch (error) {
    console.log('Could not save results (server offline):', result);
    // Store locally for later sync
    const localResults = JSON.parse(localStorage.getItem('andyduck-results') || '[]');
    localResults.push(result);
    localStorage.setItem('andyduck-results', JSON.stringify(localResults));
  }
}

// Speech Recognition
let recognitionInstance = null;

function startSpeechRecognition(callback, options = {}) {
  const { 
    timeout = 5000,  // Max listening time
    forSpelling = false 
  } = options;
  
  // Check for support
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported');
    alert('Your browser does not support speech recognition. Please use Chrome or Safari.');
    callback('');
    return;
  }
  
  // Stop any existing recognition
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {}
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognitionInstance = new SpeechRecognition();
  
  // Settings optimized for spelling
  recognitionInstance.continuous = false;
  recognitionInstance.interimResults = true; // Show interim results
  recognitionInstance.lang = 'en-US';
  recognitionInstance.maxAlternatives = 3; // Get alternatives for better matching
  
  let finalTranscript = '';
  let timeoutId = null;
  
  // Auto-stop after timeout
  timeoutId = setTimeout(() => {
    console.log('Recognition timeout');
    try {
      recognitionInstance.stop();
    } catch (e) {}
    if (finalTranscript) {
      callback(finalTranscript);
    } else {
      callback('');
    }
  }, timeout);
  
  recognitionInstance.onresult = (event) => {
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
        console.log('Final:', transcript);
        
        // For spelling, also log alternatives
        if (forSpelling && event.results[i].length > 1) {
          for (let j = 1; j < event.results[i].length; j++) {
            console.log('Alt ' + j + ':', event.results[i][j].transcript);
          }
        }
      } else {
        interimTranscript += transcript;
        console.log('Interim:', transcript);
      }
    }
  };
  
  recognitionInstance.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    clearTimeout(timeoutId);
    
    if (event.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone access and try again.');
    } else if (event.error === 'no-speech') {
      console.log('No speech detected');
    }
    
    callback(finalTranscript || '');
  };
  
  recognitionInstance.onend = () => {
    clearTimeout(timeoutId);
    state.isListening = false;
    console.log('Recognition ended, final:', finalTranscript);
    callback(finalTranscript.trim());
  };
  
  // Start listening
  state.isListening = true;
  try {
    recognitionInstance.start();
    console.log('Recognition started');
  } catch (error) {
    console.error('Failed to start recognition:', error);
    callback('');
  }
}

// Text-to-Speech - Choose best available voice
let preferredVoice = null;
let useServerTTS = false; // Set to true if server TTS is available

// Initialize voices
function initVoices() {
  const voices = speechSynthesis.getVoices();
  console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
  
  // Preferred voices (natural sounding) in order of preference
  // Chrome on Mac: look for "Google" voices or macOS system voices
  const preferredNames = [
    'Samantha',           // macOS/iOS - very natural (Safari)
    'Google US English',  // Chrome - decent quality
    'Google UK English Female', // Chrome - good for kids
    'Karen',              // macOS - Australian, clear
    'Moira',              // macOS - Irish, friendly
    'Tessa',              // macOS - South African
    'Daniel',             // macOS - British, clear
    'Microsoft Zira',     // Windows
    'Alex',               // macOS
  ];
  
  for (const name of preferredNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) {
      preferredVoice = voice;
      console.log('Using voice:', voice.name);
      break;
    }
  }
  
  // If no preferred voice, try to find any female English voice (usually clearer for kids)
  if (!preferredVoice) {
    preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) 
      || voices.find(v => v.lang.startsWith('en')) 
      || voices[0];
    console.log('Using fallback voice:', preferredVoice?.name);
  }
}

// Load voices when available
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = initVoices;
  initVoices(); // Try immediately too
}

// Check if server TTS is available
async function checkServerTTS() {
  try {
    const response = await fetch('/api/tts/check');
    if (response.ok) {
      const data = await response.json();
      useServerTTS = data.available;
      console.log('Server TTS available:', useServerTTS);
    }
  } catch {
    useServerTTS = false;
  }
}
checkServerTTS();

async function speak(text, callback) {
  // Try server TTS first (AI voice)
  if (useServerTTS && state.accessPin) {
    try {
      const response = await apiCall('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = callback;
        audio.play();
        return;
      }
    } catch (error) {
      console.log('Server TTS failed, using browser TTS');
    }
  }
  
  // Fallback to browser TTS with best available voice
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.85; // Slower for kids to understand
    utterance.pitch = 1.0; // Natural pitch
    utterance.volume = 1.0;
    
    utterance.onend = callback;
    utterance.onerror = (e) => {
      console.error('TTS error:', e);
      if (callback) callback();
    };
    
    speechSynthesis.speak(utterance);
  } else {
    console.log('Speaking:', text);
    if (callback) setTimeout(callback, 1000);
  }
}

// Number to English words (for TTS to avoid Chinese pronunciation)
function numberToWords(n) {
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 
                'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty'];
  
  if (n < 20) return ones[n];
  if (n < 40) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  return String(n); // Fallback for larger numbers
}

// Utility
function shake(element) {
  element.classList.add('shake');
  setTimeout(() => element.classList.remove('shake'), 500);
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
  .shake { animation: shake 0.5s ease; }
`;
document.head.appendChild(style);
