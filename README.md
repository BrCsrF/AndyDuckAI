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

Coming soon...

## Status

🚧 In development

---

Made with ❤️ for Andy's School
