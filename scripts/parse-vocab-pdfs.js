/**
 * Parse vocabulary PDFs and convert to AndyDuckAI word lists
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const VOCS_DIR = '/Users/AndyAI/vocs';
const OUTPUT_DIR = '/opt/AndyDuckAI/wordlists';

// Level mapping with set number ranges
const LEVELS = {
  'Starters': { grade: 'Starters', prefix: 'S' },
  'Movers': { grade: 'Movers', prefix: 'M' },
  'Flyers': { grade: 'Flyers', prefix: 'F' },
  'SuperFlyers': { grade: 'SuperFlyers', prefix: 'SF' },
};

async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

function parseVocabularyText(text, level, semester) {
  const sets = [];
  const levelInfo = LEVELS[level];
  
  // Check which format this PDF uses
  const hasSetWithUnit = /Set\s+\d+\s*\([^)]*\)/i.test(text);
  const hasNumberedWords = /^\d+[a-zA-Z]/m.test(text);
  
  if (hasSetWithUnit) {
    // Format 1: Starters/Movers - "Set N (UN)" followed by words
    const setPattern = /Set\s+(\d+)\s*\([^)]*\)/gi;
    const parts = text.split(setPattern);
    
    for (let i = 1; i < parts.length; i += 2) {
      const setNum = parseInt(parts[i]);
      const content = parts[i + 1] || '';
      
      const words = [];
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      for (const line of lines) {
        if (/finished|^set\s+\d/i.test(line)) continue;
        if (line.length > 30) continue;
        
        let word = line
          .replace(/\([^)]*\)/g, '')
          .replace(/[^a-zA-Z\s'-]/g, '')
          .trim()
          .toLowerCase();
        
        if (word && word.length >= 2 && word.length <= 25) {
          words.push({ word, hint: '' });
        }
      }
      
      if (words.length > 0) {
        sets.push({
          setNumber: setNum,
          semester: parseInt(semester),
          name: `${level} Sem${semester} Set ${setNum}`,
          grade: levelInfo.grade,
          words: words
        });
      }
    }
  } else if (hasNumberedWords) {
    // Format 2: Flyers/SuperFlyers - numbered words with definitions, "Set N" at end
    // Split by "Set N" markers (they appear after the word lists)
    const sections = text.split(/Set\s+(\d+)/i);
    
    // Process the text to extract words with definitions
    // Pattern: number followed by word followed by definition
    const wordPattern = /(\d+)\s*([a-zA-Z][a-zA-Z\s'-]*?)([A-Z][^0-9]*?)(?=\d+[a-zA-Z]|Finished|Set\s+\d|$)/g;
    
    let currentWords = [];
    let setNum = 1;
    
    // Find all word entries
    const entries = text.matchAll(/(\d+)([a-zA-Z][a-zA-Z\s()\/.-]*?)([A-Z][^0-9\n]*?)(?=\d+[a-zA-Z]|Finished|$)/g);
    
    for (const match of entries) {
      const num = parseInt(match[1]);
      let word = match[2].trim().toLowerCase();
      let hint = match[3].trim();
      
      // Clean up the word
      word = word
        .replace(/\([^)]*\)/g, '') // Remove (Br.) (Am.) etc
        .replace(/\s*\/\s*/g, '/') // Clean up slashes
        .replace(/[^a-z\s'-]/g, '')
        .trim();
      
      // Clean up hint (limit length)
      hint = hint.substring(0, 100);
      
      if (word && word.length >= 2 && word.length <= 30) {
        currentWords.push({ word, hint });
      }
      
      // When we hit word 15 or similar, save the set
      if (num >= 15 || (num < currentWords.length && currentWords.length >= 10)) {
        if (currentWords.length > 0) {
          sets.push({
            setNumber: setNum,
            semester: parseInt(semester),
            name: `${level} Sem${semester} Set ${setNum}`,
            grade: levelInfo.grade,
            words: [...currentWords]
          });
          setNum++;
          currentWords = [];
        }
      }
    }
    
    // Save any remaining words
    if (currentWords.length > 0) {
      sets.push({
        setNumber: setNum,
        semester: parseInt(semester),
        name: `${level} Sem${semester} Set ${setNum}`,
        grade: levelInfo.grade,
        words: currentWords
      });
    }
  }
  
  return sets;
}

async function processFile(filename) {
  const filePath = path.join(VOCS_DIR, filename);
  console.log(`\nProcessing: ${filename}`);
  
  // Extract level and semester from filename
  const match = filename.match(/^(\w+)_Sem(\d)\.pdf$/);
  if (!match) {
    console.log(`  Skipping - doesn't match pattern`);
    return [];
  }
  
  const [, level, semester] = match;
  if (!LEVELS[level]) {
    console.log(`  Unknown level: ${level}`);
    return [];
  }
  
  try {
    const text = await parsePDF(filePath);
    const sets = parseVocabularyText(text, level, semester);
    
    const totalWords = sets.reduce((sum, s) => sum + s.words.length, 0);
    console.log(`  Found ${sets.length} sets with ${totalWords} total words`);
    
    return sets;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('=== AndyDuckAI Vocabulary PDF Parser ===\n');
  
  // Remove old auto-generated sets (keep manual examples)
  const existingFiles = fs.readdirSync(OUTPUT_DIR);
  for (const file of existingFiles) {
    if (file.match(/^set-\d+-.*\.json$/) && !file.includes('example')) {
      // Keep sets 1-4 (examples), remove others
      const setNum = parseInt(file.match(/set-(\d+)/)?.[1] || '0');
      if (setNum > 4) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        console.log(`Removed old: ${file}`);
      }
    }
  }
  
  // Get all PDF files
  const files = fs.readdirSync(VOCS_DIR).filter(f => f.endsWith('.pdf')).sort();
  console.log(`\nFound ${files.length} PDF files`);
  
  let allSets = [];
  
  for (const file of files) {
    const sets = await processFile(file);
    allSets = allSets.concat(sets);
  }
  
  // Sort by level and set number
  const levelOrder = ['Starters', 'Movers', 'Flyers', 'SuperFlyers'];
  allSets.sort((a, b) => {
    const levelA = levelOrder.indexOf(a.grade);
    const levelB = levelOrder.indexOf(b.grade);
    if (levelA !== levelB) return levelA - levelB;
    if (a.semester !== b.semester) return a.semester - b.semester;
    return a.setNumber - b.setNumber;
  });
  
  // Assign sequential set numbers starting from 10
  let setCounter = 10;
  
  console.log(`\n=== Saving ${allSets.length} word sets ===`);
  
  for (const set of allSets) {
    const numericSet = setCounter++;
    const filename = `set-${String(numericSet).padStart(2, '0')}-${set.grade.toLowerCase()}-sem${set.semester}-${set.setNumber}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Update set number for the file
    const saveData = {
      set: numericSet,
      name: set.name,
      grade: set.grade,
      words: set.words
    };
    
    fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2));
    console.log(`  ${filename} (${set.words.length} words)`);
  }
  
  // Summary
  console.log('\n=== Summary ===');
  for (const level of levelOrder) {
    const levelSets = allSets.filter(s => s.grade === level);
    const totalWords = levelSets.reduce((sum, s) => sum + s.words.length, 0);
    console.log(`  ${level}: ${levelSets.length} sets, ${totalWords} words`);
  }
  
  console.log(`\n✅ Done! ${allSets.length} word sets saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
