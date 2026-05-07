import { readFileSync, writeFileSync } from 'fs';
const file = './src/lib/gemini.ts';
let content = readFileSync(file, 'utf8');

const target1 = '(Lời thoại phải chính xác nằm trong khoảng 350 đến 400 kí tự).';
const replacement1 = '(CRITICAL: The script MUST be 350-400 characters, approx 70-90 words).';

content = content.split(target1).join(replacement1);

writeFileSync(file, content);
console.log('Replaced more occurrences successfully.');
