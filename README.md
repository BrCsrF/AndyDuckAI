# AndyDuckAI 🦆

Spelling test assistant for Andy's School - helping G1-G6 kids learn English vocabulary!

## How it works

1. Kid identifies themselves: "Hi, I'm Eddie, I want to do Set 8"
2. AndyDuckAI reads a word aloud 🔊
3. Kid spells the word 🎤
4. AndyDuckAI checks and gives encouragement ✨
5. Repeat until all words done
6. Results saved (scores hidden from kids)

## Project Structure

```
AndyDuckAI/
├── wordlists/          # Word sets (JSON files)
│   ├── set-01.json
│   ├── set-02.json
│   └── ...
├── data/               # Results & tracking (gitignored)
├── app/                # Web app for tablet kiosk
└── README.md
```

## Word List Format

Each set is a JSON file in `wordlists/`:

```json
{
  "set": 1,
  "name": "Set 1 - Basic Animals",
  "grade": "G1-G2",
  "words": [
    { "word": "cat", "hint": "A pet that says meow" },
    { "word": "dog", "hint": "A pet that barks" },
    { "word": "bird", "hint": "It can fly" }
  ]
}
```

- `hint` is optional - used if kids need help

## Setup

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
cd /opt/AndyDuckAI
npm install
```

### Run the server
```bash
npm start
```

### Access the app
- Local: http://localhost:3000
- iPad: http://<mac-ip>:3000 (same network)

### Add word lists
Add JSON files to `wordlists/` folder (see format above).

## Project Structure

```
AndyDuckAI/
├── app/                # Frontend web app
│   ├── index.html      # Main HTML
│   ├── styles.css      # Kid-friendly styles
│   └── app.js          # App logic
├── server/             # Backend server
│   └── index.js        # Express server
├── wordlists/          # Word sets (JSON)
├── data/               # Results storage
├── docs/               # Documentation
│   └── ARCHITECTURE.md # System design
└── package.json
```

## Status

🚧 In development - v0.1.0

### Done
- [x] Project structure
- [x] Basic UI design
- [x] Frontend app (HTML/CSS/JS)
- [x] Express server
- [x] Word set loading
- [x] Results saving

### To Do
- [ ] Add actual duck mascot image
- [ ] Server-side Whisper for better voice recognition
- [ ] Better TTS voice
- [ ] Admin dashboard for viewing results
- [ ] Add word lists from Chris

---

Made with ❤️ for Andy's School
