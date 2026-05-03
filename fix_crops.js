const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function fixCrops() {
    const dir = 'assets/images';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    
    for (const f of files) {
        const imgPath = path.join(dir, f);
        const img = await Jimp.read(imgPath);
        
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
        
        if (w > 0 && h > 0 && (w < img.bitmap.width - 2 || h < img.bitmap.height - 2)) {
            console.log(`Cropping ${f} from ${img.bitmap.width}x${img.bitmap.height} to ${w}x${h}`);
            img.crop(minX, minY, w, h);
            
            // Resize back to 256 just to keep size standard, or just save as is. 
            // Saving as is is totally fine because game.js draws at radius*2 anyway!
            await img.writeAsync(imgPath);
        }
    }
    console.log('All crops fixed!');
}
fixCrops().catch(console.error);
