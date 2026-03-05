import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONT_URL = 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-VariableFont_slnt%2Cwght.woff2';
const DEST_DIR = path.join(__dirname, '..', 'public', 'fonts');
const DEST_FILE = path.join(DEST_DIR, 'inter-var.woff2');

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

console.log(`Downloading Inter Variable Font from: ${FONT_URL}...`);

const file = fs.createWriteStream(DEST_FILE);
https.get(FONT_URL, (response) => {
    if (response.statusCode !== 200) {
        console.error(`Failed to download font: Status Code ${response.statusCode}`);
        process.exit(1);
    }
    response.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log(`✅ Font downloaded successfully to: ${DEST_FILE}`);
    });
}).on('error', (err) => {
    if (fs.existsSync(DEST_FILE)) fs.unlink(DEST_FILE, () => { });
    console.error(`Error downloading font: ${err.message}`);
    process.exit(1);
});
