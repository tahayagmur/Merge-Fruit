const Jimp = require('jimp');

async function removeWhiteBg() {
    const imgPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\b710ff61-1a24-4cdb-ae1e-85e7c3272056\\media__1777750136856.png';
    const outPath = 'assets/images/peach.png';
    const image = await Jimp.read(imgPath);
    
    // Tolerance for white
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        if (r >= 235 && g >= 235 && b >= 235) {
            this.bitmap.data[idx + 3] = 0; // Alpha to 0
        }
    });
    
    await image.writeAsync(outPath);
    console.log('Done');
}

removeWhiteBg().catch(console.error);
