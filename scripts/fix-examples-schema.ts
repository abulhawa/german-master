import fs from 'node:fs';
import path from 'node:path';

const POS_FILES = ['nouns.jsonl', 'verbs.jsonl', 'adjectives.jsonl'];

async function fixExamples() {
  for (const filename of POS_FILES) {
    const filePath = path.resolve(process.cwd(), `data/pos/${filename}`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found, skipping: ${filePath}`);
      continue;
    }

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const updatedLines: string[] = [];
    let updatedCount = 0;

    for (const line of lines) {
      if (!line.trim()) {
        updatedLines.push(line);
        continue;
      }

      try {
        const record = JSON.parse(line);
        let modified = false;

        if (record.examples && Array.isArray(record.examples) && record.examples.length > 0) {
          const firstExample = record.examples[0];
          
          // Handle incorrect nested schema { sentence, translations: { en } }
          if (firstExample.sentence && firstExample.translations && typeof firstExample.translations.en === 'string') {
            record.example_de = record.example_de || firstExample.sentence;
            record.example_en = record.example_en || firstExample.translations.en;
            
            // Map all items in the array to { de, en }
            record.examples = record.examples.map((ex: any) => {
              if (ex.sentence && ex.translations && typeof ex.translations.en === 'string') {
                return { de: ex.sentence, en: ex.translations.en };
              }
              return ex;
            });

            modified = true;
          } 
          // Handle correct schema but missing top-level examples
          else if (firstExample.de && firstExample.en) {
            if (!record.example_de || !record.example_en) {
              record.example_de = record.example_de || firstExample.de;
              record.example_en = record.example_en || firstExample.en;
              modified = true;
            }
          }
        }

        if (modified) {
          updatedCount++;
        }

        updatedLines.push(JSON.stringify(record));
      } catch (err) {
        console.error(`Error parsing line in ${filename}:`, line);
        updatedLines.push(line);
      }
    }

    if (updatedCount > 0) {
      fs.writeFileSync(filePath, updatedLines.join('\n'));
      console.log(`✅ Fixed ${updatedCount} records in ${filename}`);
    } else {
      console.log(`ℹ️ No records needed fixing in ${filename}`);
    }
  }
}

fixExamples().catch(console.error);