const fs = require('fs');
let content = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// Replace standard generateCall
content = content.replace(/const response = await ai\.models\.generateContent\(\{/g, 'const response = await generateContentWithRetry(ai, {');

// Replace error throwing
content = content.replace(/throw handleGeminiError\(e\);/g, 'throw e;');

// Remove handleGeminiError function completely
const handleGeminiErrorRegex = /function handleGeminiError\(apiError: unknown\)\s*{[\s\S]*?return new Error[^}]+\}[^}]+\}/;
content = content.replace(handleGeminiErrorRegex, '');

fs.writeFileSync('src/lib/gemini.ts', content);
console.log("Updated gemini.ts successfully");
