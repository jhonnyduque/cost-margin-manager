import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function migrateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Text pixel maps
    content = content.replace(/text-\[10px\]/g, 'text-xs');
    content = content.replace(/text-\[11px\]/g, 'text-xs');
    content = content.replace(/text-\[12px\]/g, 'text-xs');
    content = content.replace(/text-\[13px\]/g, 'text-sm');
    content = content.replace(/text-\[14px\]/g, 'text-sm');
    content = content.replace(/text-\[15px\]/g, 'text-base');
    content = content.replace(/text-\[16px\]/g, 'text-base');
    content = content.replace(/text-\[18px\]/g, 'text-lg');
    content = content.replace(/text-\[20px\]/g, 'text-xl');
    content = content.replace(/text-\[24px\]/g, 'text-2xl');
    content = content.replace(/text-\[30px\]/g, 'text-3xl');
    content = content.replace(/text-\[32px\]/g, 'text-3xl');

    // For any remaining text-[XXpx] fallback to closest size
    content = content.replace(/text-\[(\d+)px\]/g, (match, px) => {
        const size = parseInt(px);
        if (size <= 12) return 'text-xs';
        if (size <= 14) return 'text-sm';
        if (size <= 16) return 'text-base';
        if (size <= 18) return 'text-lg';
        if (size <= 24) return 'text-xl';
        return 'text-2xl';
    });

    // 2. Color maps (WCAG)
    content = content.replace(/text-gray-400/g, 'text-slate-500');
    content = content.replace(/text-slate-400/g, 'text-slate-500');

    // 3. React Inline styles
    // style={{ fontSize: '14px' }} or style={{ fontSize: 14 }}
    content = content.replace(/style=\{\{\s*fontSize:\s*['"]?(\d+)px['"]?\s*\}\}/g, '');
    content = content.replace(/style=\{\{\s*fontSize:\s*(\d+)\s*\}\}/g, '');
    // If empty style={{ }}, remove it entirely
    content = content.replace(/style=\{\{\s*\}\}/g, '');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Migrated: ${filePath}`);
    }
}

function scanDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath);
        } else if (/\.(tsx|ts|jsx|js|css)$/.test(file)) {
            migrateFile(fullPath);
        }
    }
}

scanDirectory(srcDir);
console.log('Migration complete.');
