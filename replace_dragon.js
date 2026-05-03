const Jimp = require('jimp');

const imgPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\894a2624-b6f2-4414-b621-2f9cea1f4a34\\dragon_fruit_noface_1777799571933.png';
const outPath = 'assets/images/dragonfruit.png';

async function processImage() {
    try {
        const image = await Jimp.read(imgPath);
        
        // Remove white background
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            // Remove white and light backgrounds
            if (r >= 225 && g >= 225 && b >= 225) {
                this.bitmap.data[idx + 3] = 0;
            }
        });
        
        // Tight crop around non-transparent pixels to fix the hitbox issue
        let minX = image.bitmap.width, maxX = 0;
        let minY = image.bitmap.height, maxY = 0;
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
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
        
        if (w > 0 && h > 0) {
            image.crop(minX, minY, w, h);
            console.log(`Cropped to ${w}x${h}`);
        } else {
            console.log('Could not crop, bounding box invalid');
        }
        
        image.scaleToFit(256, 256, Jimp.RESIZE_BICUBIC);
        
        await image.writeAsync(outPath);
        console.log('Successfully processed dragon fruit image.');
    } catch (e) {
        console.error('Error:', e);
    }
}

processImage();
