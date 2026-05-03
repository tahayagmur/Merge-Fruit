const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function checkAll() {
    const dir = 'assets/images';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    
    for (const f of files) {
        const img = await Jimp.read(path.join(dir, f));
        let minX = img.bitmap.width, maxX = 0;
        let minY = img.bitmap.height, maxY = 0;
        
        img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
            const a = this.bitmap.data[idx + 3];
            if (a > 10) { 
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        });
        
        const w = maxX - minX;
        const h = maxY - minY;
        const ratioW = (w / img.bitmap.width).toFixed(2);
        console.log(`${f}: ${img.bitmap.width}x${img.bitmap.height} | Fruit: ${w}x${h} (Ratio: ${ratioW})`);
    }
}
checkAll().catch(console.error);
