import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');

const prohibitedPatterns = [
    { regex: /text-\[\d+px\]/g, message: 'Hardcoded tailwind pixel text size (e.g. text-[14px])' },
    { regex: /font-size:/g, message: 'Inline font-size styling or CSS' },
    { regex: /text-gray-400/g, message: 'Prohibited color spacing text-gray-400 (Violates WCAG)' },
    { regex: /text-slate-400/g, message: 'Prohibited color spacing text-slate-400 (Low Contrast)' },
    { regex: /style={{.*?fontSize/g, message: 'Inline React style font-size' },
];

let violationsFound = 0;

function scanDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                scanDirectory(fullPath);
            }
        } else if (/\.(tsx|ts|jsx|js|css)$/.test(file)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            let fileViolations = 0;

            prohibitedPatterns.forEach(pattern => {
                const matches = content.match(pattern.regex);
                if (matches) {
                    matches.forEach(() => {
                        if (fileViolations === 0) {
                            console.error(`\n❌ Design governance violation detected in: ${fullPath}`);
                        }
                        console.error(`   - Rule broken: ${pattern.message}`);
                        fileViolations++;
                        violationsFound++;
                    });
                }
            });
        }
    }
}

console.log('🔍 Executing BETO OS Design Governance Audit (GOV-TYPE-001)...');

scanDirectory(srcDir);

if (violationsFound > 0) {
    console.error(`\n🚨 AUDIT FAILED: ${violationsFound} design system violations found.`);
    console.error('All UI elements must comply with BETO_OS_TYPOGRAPHY_GOVERNANCE.md');
    process.exit(1);
} else {
    console.log('\n✅ AUDIT PASSED: Typography styling is clear.');
}
