/**
 * AndyDuckAI - Spelling Bee App
 * Voice-based spelling practice for kids
 */

// App State
const state = {
  studentName: '',
  currentLevel: '',
  currentSet: null,
  currentWordIndex: 0,
  words: [],
  results: [],
  isListening: false,
  allSets: [], // Cache all sets
};

// DOM Elements
const screens = {
  welcome: document.getElementById('screen-welcome'),
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
  
  // Finish screen
  document.getElementById('btn-again').addEventListener('click', () => startSet(state.currentSet));
  document.getElementById('btn-home').addEventListener('click', () => {
    state.studentName = '';
    state.currentLevel = '';
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
    const response = await fetch('/api/wordsets');
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
    
    if (transcript) {
      // Extract name from transcript
      const name = extractName(transcript);
      if (name) {
        document.getElementById('input-name').value = name;
        speak(`Did you say ${name}? Tap the button to confirm!`);
      }
    } else {
      speak("I didn't hear that. Try again or type your name!");
    }
  }, { timeout: 4000 });
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
    speak(`Hi ${name}! What's your level?`);
    showScreen('level');
  } else {
    shake(nameInput);
  }
}

// Level Selection
function selectLevel(level) {
  state.currentLevel = level;
  document.getElementById('level-display').textContent = level;
  speak(`${level}! Now pick a set to practice.`);
  renderSetGrid(state.allSets.filter(s => s.grade === level));
  showScreen('set');
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
  
  // Give kids more time to spell
  startSpeechRecognition((transcript) => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Spell It!';
    
    if (transcript) {
      checkSpelling(transcript);
    } else {
      // No speech detected - prompt to try again
      speak("I didn't hear that. Tap the button and try again!");
    }
  }, { timeout: 8000, forSpelling: true });
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
