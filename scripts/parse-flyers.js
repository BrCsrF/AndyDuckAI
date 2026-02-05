/**
 * Parse Flyers/SuperFlyers PDFs (different format than Starters/Movers)
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const VOCS_DIR = '/Users/AndyAI/vocs';
const OUTPUT_DIR = '/opt/AndyDuckAI/wordlists';

async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

function extractWordsFromFlyersFormat(text) {
  const allWords = [];
  
  // Try Format 1: number followed by word (e.g., "1laptop", "2telescope")
  const numberedMatches = text.match(/\d+([a-zA-Z][a-zA-Z\s()\/.-]*?)(?=[A-Z]|$)/g) || [];
  
  for (const match of numberedMatches) {
    const word = match.replace(/^\d+/, '').trim().toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z\s'-]/g, '')
      .trim();
    
    if (word && word.length >= 2 && word.length <= 25) {
      allWords.push(word);
    }
  }
  
  // If Format 1 didn't work well, try Format 2: word followed by capital letter definition
  // e.g., "blouseA nice shirt..." -> "blouse"
  if (allWords.length < 50) {
    const altMatches = text.match(/([a-z][a-z\s\/-]*?)(?=[A-Z][a-z])/g) || [];
    
    for (const match of altMatches) {
      const word = match.trim().toLowerCase()
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z\s'-]/g, '')
        .replace(/^\s+|\s+$/g, '')
        .trim();
      
      // Filter out common non-words and very short/long strings
      if (word && 
          word.length >= 2 && 
          word.length <= 25 &&
          !word.includes('finished') &&
          !word.match(/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|with|from|this|that|have|they|will|what|when|where|which|your)$/)) {
        allWords.push(word);
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(allWords)];
}

async function processFile(filename, startSetNum) {
  const filePath = path.join(VOCS_DIR, filename);
  console.log(`\nProcessing: ${filename}`);
  
  const match = filename.match(/^(\w+)_Sem(\d)\.pdf$/);
  if (!match) return { sets: [], nextSetNum: startSetNum };
  
  const [, level, semester] = match;
  
  try {
    const text = await parsePDF(filePath);
    const words = extractWordsFromFlyersFormat(text);
    
    console.log(`  Found ${words.length} words total`);
    
    // Group into sets of 15 words (Flyers format uses 15 per set)
    const WORDS_PER_SET = 15;
    const sets = [];
    let setNum = startSetNum;
    
    for (let i = 0; i < words.length; i += WORDS_PER_SET) {
      const setWords = words.slice(i, i + WORDS_PER_SET);
      if (setWords.length > 0) {
        const setIndex = Math.floor(i / WORDS_PER_SET) + 1;
        sets.push({
          set: setNum,
          name: `${level} Sem${semester} Set ${setIndex}`,
          grade: level,
          words: setWords.map(w => ({ word: w, hint: '' }))
        });
        setNum++;
      }
    }
    
    console.log(`  Created ${sets.length} sets`);
    return { sets, nextSetNum: setNum };
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return { sets: [], nextSetNum: startSetNum };
  }
}

async function main() {
  console.log('=== Parsing Flyers & SuperFlyers PDFs ===\n');
  
  // Remove old flyers/superflyers files
  const existingFiles = fs.readdirSync(OUTPUT_DIR);
  for (const file of existingFiles) {
    if (file.includes('flyers') || file.includes('superflyers')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
      console.log(`Removed: ${file}`);
    }
  }
  
  const files = [
    'Flyers_Sem1.pdf',
    'Flyers_Sem2.pdf', 
    'SuperFlyers_Sem1.pdf',
    'SuperFlyers_Sem2.pdf'
  ];
  
  let setNum = 70; // Start after Movers
  
  for (const file of files) {
    const result = await processFile(file, setNum);
    
    for (const set of result.sets) {
      const filename = `set-${String(set.set).padStart(2, '0')}-${set.grade.toLowerCase()}.json`;
      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        JSON.stringify(set, null, 2)
      );
      console.log(`  Saved: ${filename} (${set.words.length} words)`);
    }
    
    setNum = result.nextSetNum;
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
