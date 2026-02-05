/**
 * AndyDuckAI - Spelling Bee App
 * Voice-based spelling practice for kids
 */

// App State
const state = {
  studentName: '',
  currentSet: null,
  currentWordIndex: 0,
  words: [],
  results: [],
  isListening: false,
};

// DOM Elements
const screens = {
  welcome: document.getElementById('screen-welcome'),
  name: document.getElementById('screen-name'),
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

function setupEventListeners() {
  // Welcome screen
  document.getElementById('btn-start').addEventListener('click', () => showScreen('name'));
  document.getElementById('duck-mascot').addEventListener('click', () => showScreen('name'));
  
  // Name screen
  document.getElementById('btn-say-name').addEventListener('click', listenForName);
  document.getElementById('btn-submit-name').addEventListener('click', submitName);
  document.getElementById('input-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitName();
  });
  
  // Spelling screen
  document.getElementById('btn-spell').addEventListener('click', listenForSpelling);
  document.getElementById('btn-repeat').addEventListener('click', sayCurrentWord);
  
  // Finish screen
  document.getElementById('btn-again').addEventListener('click', () => startSet(state.currentSet));
  document.getElementById('btn-home').addEventListener('click', () => {
    state.studentName = '';
    showScreen('welcome');
  });
}

// Screen Management
function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Load Word Sets
async function loadWordSets() {
  try {
    // For now, load example sets - later this will fetch from server
    const response = await fetch('/api/wordsets');
    if (response.ok) {
      const sets = await response.json();
      renderSetGrid(sets);
    } else {
      // Use example data for development
      renderSetGrid(getExampleSets());
    }
  } catch (error) {
    console.log('Using example sets (server not available)');
    renderSetGrid(getExampleSets());
  }
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
  grid.innerHTML = sets.map(set => `
    <div class="set-card" data-set="${set.set}">
      <div class="set-number">Set ${set.set}</div>
      <div class="set-name">${set.name}</div>
      <div class="word-count">${set.wordCount} words</div>
    </div>
  `).join('');
  
  // Add click listeners
  grid.querySelectorAll('.set-card').forEach(card => {
    card.addEventListener('click', () => {
      const setNumber = parseInt(card.dataset.set);
      startSet(setNumber);
    });
  });
}

// Name Input
function listenForName() {
  const btn = document.getElementById('btn-say-name');
  btn.classList.add('listening');
  btn.textContent = '🎤 Listening...';
  
  startSpeechRecognition((transcript) => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Say Your Name';
    
    // Extract name from transcript
    const name = extractName(transcript);
    if (name) {
      document.getElementById('input-name').value = name;
    }
  });
}

function extractName(transcript) {
  // Simple name extraction - can be improved
  const words = transcript.split(' ');
  // Filter common words, get first capitalized word or first word
  const name = words.find(w => /^[A-Z][a-z]+$/.test(w)) || words[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : '';
}

function submitName() {
  const nameInput = document.getElementById('input-name');
  const name = nameInput.value.trim();
  
  if (name) {
    state.studentName = name;
    document.getElementById('student-name-display').textContent = name;
    speak(`Hi ${name}! Which set do you want to practice?`);
    showScreen('set');
  } else {
    shake(nameInput);
  }
}

// Set Selection & Spelling
async function startSet(setNumber) {
  state.currentSet = setNumber;
  state.currentWordIndex = 0;
  state.results = [];
  
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
  
  speak(`Great! Set ${setNumber} has ${state.words.length} words. Let's start!`, () => {
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
  
  // Update display
  wordDisplay.textContent = word.word;
  progressText.textContent = `Word ${state.currentWordIndex + 1} of ${state.words.length}`;
  progressFill.style.width = `${(state.currentWordIndex / state.words.length) * 100}%`;
  lettersDisplay.innerHTML = '';
  
  // Say the word
  sayCurrentWord();
}

function sayCurrentWord() {
  const word = state.words[state.currentWordIndex].word;
  speak(`Your word is: ${word}`);
  
  // Animate duck
  const duck = document.getElementById('duck-speaking');
  duck.classList.add('speaking');
  setTimeout(() => duck.classList.remove('speaking'), 2000);
}

function listenForSpelling() {
  const btn = document.getElementById('btn-spell');
  btn.classList.add('listening');
  btn.textContent = '🎤 Listening...';
  
  startSpeechRecognition((transcript) => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Spell It!';
    
    checkSpelling(transcript);
  });
}

function checkSpelling(transcript) {
  const targetWord = state.words[state.currentWordIndex].word.toUpperCase();
  const spokenLetters = extractLetters(transcript);
  
  // Display letters
  displayLetters(spokenLetters, targetWord.split(''));
  
  // Check if correct
  const isCorrect = spokenLetters.join('') === targetWord;
  
  // Record result
  state.results.push({
    word: state.words[state.currentWordIndex].word,
    correct: isCorrect,
    spoken: spokenLetters.join(''),
  });
  
  // Show feedback
  showFeedback(isCorrect, () => {
    if (state.currentWordIndex < state.words.length - 1) {
      state.currentWordIndex++;
      showCurrentWord();
    } else {
      finishSet();
    }
  });
}

function extractLetters(transcript) {
  // Clean up transcript and extract letters
  const clean = transcript.toUpperCase().replace(/[^A-Z\s-]/g, '');
  
  // Try different patterns
  // "A P P L E" - space separated
  // "A-P-P-L-E" - dash separated
  // "A, P, P, L, E" - comma separated
  let letters = [];
  
  if (clean.includes(' ')) {
    letters = clean.split(/\s+/).filter(l => l.length === 1);
  } else if (clean.includes('-')) {
    letters = clean.split('-').filter(l => l.length === 1);
  } else {
    // Individual characters
    letters = clean.split('').filter(l => /[A-Z]/.test(l));
  }
  
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
  const emoji = document.getElementById('feedback-emoji');
  const text = document.getElementById('feedback-text');
  
  if (isCorrect) {
    emoji.textContent = ['🎉', '⭐', '🌟', '👏', '🦆'][Math.floor(Math.random() * 5)];
    text.textContent = encouragement.correct[Math.floor(Math.random() * encouragement.correct.length)];
    container.classList.remove('incorrect');
  } else {
    emoji.textContent = ['💪', '🌟', '🦆'][Math.floor(Math.random() * 3)];
    text.textContent = encouragement.tryAgain[Math.floor(Math.random() * encouragement.tryAgain.length)];
    container.classList.add('incorrect');
  }
  
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
    await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
function startSpeechRecognition(callback) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported, using fallback');
    // TODO: Implement server-side Whisper fallback
    setTimeout(() => callback(''), 3000);
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log('Heard:', transcript);
    callback(transcript);
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    callback('');
  };
  
  recognition.onend = () => {
    state.isListening = false;
  };
  
  state.isListening = true;
  recognition.start();
}

// Text-to-Speech - Choose best available voice
let preferredVoice = null;
let useServerTTS = false; // Set to true if server TTS is available

// Initialize voices
function initVoices() {
  const voices = speechSynthesis.getVoices();
  
  // Preferred voices (natural sounding) in order of preference
  const preferredNames = [
    'Samantha',      // macOS/iOS - very natural
    'Karen',         // macOS - Australian, clear
    'Daniel',        // macOS - British, clear
    'Google US English', // Chrome
    'Microsoft Zira', // Windows
    'Alex',          // macOS
  ];
  
  for (const name of preferredNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) {
      preferredVoice = voice;
      console.log('Using voice:', voice.name);
      break;
    }
  }
  
  // If no preferred voice, try to find any English voice
  if (!preferredVoice) {
    preferredVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
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
  if (useServerTTS) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
