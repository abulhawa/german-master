import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { normaliseLegacyPartOfSpeech } from '../shared/pos-normalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT_DIR, 'data', 'wortschatz', 'b2-beruf.csv');

interface Issue {
  line: number;
  word: string;
  type: 'ERROR' | 'WARNING';
  message: string;
}

function validate() {
  console.log(`\x1b[36m--- GermanVerbMaster Data Highlighter ---\x1b[0m`);
  console.log(`Target: ${CSV_PATH}\n`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error('\x1b[31m[ERROR]\x1b[0m CSV file not found at expected path.');
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: false, // We want to see if the data itself is untrimmed
  });

  const issues: Issue[] = [];

  records.forEach((record: any, index: number) => {
    const lineNumber = index + 2;
    const rawWord = record['Word'] || '';
    const word = rawWord.trim();
    const english = (record['English Translation'] || '').trim();
    const exampleDe = (record['Example Sentence'] || '').trim();
    const exampleEn = (record['English Translation (Sentence)'] || '').trim();
    const posRaw = (record['POS'] || '').trim();

    // 1. Whitespace & Formatting
    if (rawWord !== rawWord.trim()) {
        issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Lemma has leading or trailing whitespace.' });
    }
    if (word.includes('  ')) {
        issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Lemma contains double spaces.' });
    }
    if (/[“”‘’]/.test(word + exampleDe)) {
        issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Contains "curly" quotes instead of standard straight quotes.' });
    }

    // 2. POS Validation
    const pos = normaliseLegacyPartOfSpeech(posRaw);
    if (!pos) {
      issues.push({ line: lineNumber, word, type: 'ERROR', message: `Invalid or missing POS tag: "${posRaw}"` });
    }

    // 3. Lemma Cleaning (Inline Parentheses)
    if (word.includes('(') || word.includes(')')) {
      if (/\(.*?\)$/.test(word)) {
        issues.push({
          line: lineNumber, word, type: 'WARNING',
          message: `Trailing metadata found: "${word}". Cleanup recommended.`
        });
      }

      // Inline parentheses check
      if (/^\(.*?\)/.test(word) || /\(.*?\)\w/.test(word)) {
        issues.push({
          line: lineNumber, word, type: 'WARNING',
          message: `Inline parentheses found (e.g. "(sich)" or "(un)-"). Manual cleaning suggested.`
        });
      }
    }

    // 4. Noun Checks
    if (pos === 'N') {
        if (!word.includes(',')) {
            issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Noun is missing plural (pattern "Lemma, Plural").' });
        } else if (word.split(',')[1]?.trim() === '-') {
            // Optional: flag if you want to explicitly check "no plural" entries
        }
    } else if (word.includes(',')) {
        issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Non-noun lemma contains a comma.' });
    }

    // 5. Completeness
    if (!word) issues.push({ line: lineNumber, word: '[EMPTY]', type: 'ERROR', message: 'Word is empty.' });
    if (!english) issues.push({ line: lineNumber, word, type: 'ERROR', message: 'Missing English translation.' });
    if (!exampleDe || !exampleEn) issues.push({ line: lineNumber, word, type: 'ERROR', message: 'Incomplete example sentence pair.' });

    // 6. Ending Punctuation
    if (word.endsWith('.')) {
        issues.push({ line: lineNumber, word, type: 'WARNING', message: 'Lemma ends with a period.' });
    }
  });

  // Output
  const errors = issues.filter(i => i.type === 'ERROR');
  const warnings = issues.filter(i => i.type === 'WARNING');

  issues.forEach(issue => {
    const color = issue.type === 'ERROR' ? '\x1b[31m' : '\x1b[33m';
    console.log(`${color}[${issue.type}]\x1b[0m Line ${issue.line.toString().padEnd(4)} | ${issue.word.padEnd(30)} | ${issue.message}`);
  });

  console.log(`\n\x1b[36m--- Summary ---\x1b[0m`);
  console.log(`Errors:   ${errors.length} (Must fix for DB push)`);
  console.log(`Warnings: ${warnings.length} (Highlighting for manual review)`);

  if (errors.length > 0) process.exit(1);
}

validate();
