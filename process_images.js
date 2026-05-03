const Jimp = require('jimp');
const path = require('path');

const brainDir = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\b710ff61-1a24-4cdb-ae1e-85e7c3272056';
const outDir = 'assets/images';

const files = [
    { name: 'apple', file: 'gen_apple_1777751043872.png' },
    { name: 'dragonfruit', file: 'gen_dragonfruit_1777751112445.png' },
    { name: 'grape', file: 'gen_grape_1777751031418.png' },
    { name: 'mango', file: 'gen_mango_1777751096854.png' },
    { name: 'melon', file: 'gen_melon_1777751144585.png' },
    { name: 'orange', file: 'gen_orange_1777751069213.png' },
    { name: 'peach', file: 'gen_peach_1777751085013.png' },
    { name: 'pineapple', file: 'gen_pineapple_1777751131845.png' },
    { name: 'plum', file: 'gen_plum_1777751004839.png' },
    { name: 'strawberry', file: 'gen_strawberry_1777751019165.png' },
    { name: 'watermelon', file: 'gen_watermelon_1777751156652.png' }
];

async function processImages() {
    for (const f of files) {
        const imgPath = path.join(brainDir, f.file);
        const outPath = path.join(outDir, `${f.name}.png`);
        
        try {
            const image = await Jimp.read(imgPath);
            
            // Remove white background (tolerance)
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
                const r = this.bitmap.data[idx + 0];
                const g = this.bitmap.data[idx + 1];
                const b = this.bitmap.data[idx + 2];
                // Slightly aggressive to remove white halos
                if (r >= 230 && g >= 230 && b >= 230) {
                    this.bitmap.data[idx + 3] = 0;
                }
            });
            
            // Autocrop transparent borders so it fits the hitbox perfectly
            image.autocrop();
            
            // Resize to 256 to save memory and ensure crispness
            image.scaleToFit(256, 256, Jimp.RESIZE_BICUBIC);
            
            await image.writeAsync(outPath);
            console.log(`Processed ${f.name}`);
        } catch (e) {
            console.error(`Failed ${f.name}:`, e.message);
        }
    }
    console.log('All done');
}

processImages();
