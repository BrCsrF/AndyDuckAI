# AndyDuckAI Architecture

## Overview

AndyDuckAI is a voice-based spelling test assistant for Andy's School. Kids interact via voice on an iPad, and the system reads words aloud, listens to spelling, and provides encouraging feedback.

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         iPad                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Web App (Safari)                        │   │
│  │  - Friendly UI with duck mascot                     │   │
│  │  - Voice input (microphone)                         │   │
│  │  - Audio output (speaker)                           │   │
│  │  - Full-screen kiosk mode                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Mac Mini Server                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Node.js Backend                         │   │
│  │  - Serves web app                                   │   │
│  │  - Handles voice recognition (Whisper)              │   │
│  │  - Text-to-speech (say command / ElevenLabs)        │   │
│  │  - Spelling verification logic                      │   │
│  │  - Results tracking                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │   wordlists/  │  │    data/      │  │   assets/     │  │
│  │  (JSON sets)  │  │  (results)    │  │  (duck imgs)  │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## User Flow

```
1. WAKE
   Kid: "Hi AndyDuck!" (or tap screen)
   Duck: "Hi there! What's your name?"

2. IDENTIFY
   Kid: "I'm Eddie"
   Duck: "Hi Eddie! Which set do you want to practice?"

3. SELECT SET
   Kid: "Set 8"
   Duck: "Great! Set 8 has 7 words. Let's go!"

4. SPELL (repeat for each word)
   Duck: "Word 1: *apple*" (says the word)
   Kid: "A-P-P-L-E"
   Duck: "Perfect! 🎉" or "Almost! Try again?"

5. FINISH
   Duck: "Amazing job Eddie! You got 6 out of 7!"
   (Score saved to database, not shown to kid)
```

## Tech Stack

### Frontend (iPad)
- **HTML5/CSS3/JS** - Progressive Web App
- **Web Speech API** - Voice input (fallback to server-side Whisper)
- **Audio API** - Play TTS audio
- **Service Worker** - Offline support (optional)

### Backend (Mac Mini)
- **Node.js + Express** - Web server
- **Whisper** - Speech-to-text (accurate, handles kids' voices)
- **macOS `say`** - Text-to-speech (or ElevenLabs for better voice)
- **SQLite/JSON** - Store results

### Voice Recognition Strategy
1. Try Web Speech API first (lower latency)
2. Fall back to server-side Whisper if needed
3. Parse spelled letters: "A-P-P-L-E" → ["A","P","P","L","E"]

## Spelling Verification

```javascript
function checkSpelling(spoken, targetWord) {
  // Extract letters from spoken input
  // "A P P L E" or "A-P-P-L-E" or "apple" 
  const letters = extractLetters(spoken);
  const target = targetWord.toUpperCase().split('');
  
  // Compare
  return arraysEqual(letters, target);
}

function extractLetters(spoken) {
  // Handle different formats:
  // "A P P L E" → split by space
  // "A-P-P-L-E" → split by dash
  // "A, P, P, L, E" → split by comma
  // "apple" → just compare the word (pronunciation mode)
}
```

## Encouragement System

Random positive responses for correct answers:
- "Perfect! 🎉"
- "You got it!"
- "Excellent spelling!"
- "Way to go!"
- "That's right!"

For incorrect answers (gentle):
- "Almost! Want to try again?"
- "Not quite. Let me say it again..."
- "Good try! Listen carefully..."

Never:
- "Wrong!"
- "That's incorrect"
- Anything mean or discouraging

## Data Storage

### Word Lists (`wordlists/set-XX.json`)
```json
{
  "set": 8,
  "name": "Animals",
  "grade": "G2",
  "words": [
    {"word": "elephant", "hint": "A big gray animal with a trunk"}
  ]
}
```

### Results (`data/results.json`)
```json
{
  "results": [
    {
      "id": "uuid",
      "student": "Eddie",
      "set": 8,
      "date": "2026-02-05T10:30:00",
      "score": 6,
      "total": 7,
      "words": [
        {"word": "apple", "correct": true, "attempts": 1},
        {"word": "banana", "correct": false, "attempts": 2}
      ]
    }
  ]
}
```

## Security Considerations

- Results stored locally only
- No personal data beyond first names
- No internet required after initial setup (optional)
- Kiosk mode prevents exiting app

## Future Enhancements

- [ ] Student profiles with photos
- [ ] Progress tracking over time
- [ ] Leaderboard (opt-in)
- [ ] Multiple languages
- [ ] Custom word lists per student
- [ ] Parent/teacher dashboard
