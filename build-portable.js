#!/usr/bin/env node

/**
 * Build Portable App - Compatible với cách release cũ
 * Tạo folder portable + zip file như trước, nhưng có thêm auto-update support
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function log(message, color = '\x1b[0m') {
    console.log(`${color}${message}\x1b[0m`);
}

function exec(command) {
    try {
        const output = execSync(command, { encoding: 'utf8' });
        console.log(output);
        return output.trim();
    } catch (error) {
        log(`❌ Error: ${error.message}`, '\x1b[31m');
        process.exit(1);
    }
}

async function createZip(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            log(`✅ Zip created: ${path.basename(outputPath)} (${sizeMB} MB)`, '\x1b[32m');
            resolve();
        });

        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function main() {
    log('\n📦 Building Portable App with Auto-Update Support\n', '\x1b[36m');

    // Get version
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = pkg.version;
    log(`📦 Version: ${version}`, '\x1b[34m');

    // Step 1: Build with electron-packager (cách cũ)
    log('\n📝 Step 1: Building with electron-packager...', '\x1b[36m');
    exec('npm run pack');

    // Step 2: Check output
    const distDir = path.join(__dirname, 'dist');
    const appDir = path.join(distDir, 'test-automation-screen-auto-win32-x64');
    
    if (!fs.existsSync(appDir)) {
        log('❌ Build failed: App directory not found', '\x1b[31m');
        process.exit(1);
    }

    log('✅ Portable app built successfully', '\x1b[32m');

    // Step 3: Create latest.yml for auto-update
    log('\n📝 Step 2: Creating update metadata...', '\x1b[36m');
    
    const exePath = path.join(appDir, 'test-automation-screen-auto.exe');
    const stats = fs.statSync(exePath);
    const fileSize = stats.size;
    
    // Create simple latest.yml
    const latestYml = `version: ${version}
files:
  - url: test-automation-screen-auto-portable-${version}.zip
    sha512: placeholder-hash
    size: ${fileSize}
path: test-automation-screen-auto-portable-${version}.zip
sha512: placeholder-hash
releaseDate: '${new Date().toISOString()}'
`;

    fs.writeFileSync(path.join(distDir, 'latest.yml'), latestYml);
    log('✅ Update metadata created', '\x1b[32m');

    // Step 4: Create zip file
    log('\n📝 Step 3: Creating zip file...', '\x1b[36m');
    const zipName = `test-automation-screen-auto-portable-${version}.zip`;
    const zipPath = path.join(distDir, zipName);
    
    await createZip(appDir, zipPath);

    // Step 5: Summary
    log('\n🎉 Build completed!', '\x1b[32m');
    log('\n📦 Files created:', '\x1b[34m');
    log(`  📁 dist/test-automation-screen-auto-win32-x64/  (portable folder)`, '\x1b[37m');
    log(`  📦 dist/${zipName}  (zip file)`, '\x1b[37m');
    log(`  📄 dist/latest.yml  (update metadata)`, '\x1b[37m');

    log('\n🚀 Ready to upload to GitHub:', '\x1b[36m');
    log(`  1. Create release: gh release create v${version}`, '\x1b[37m');
    log(`  2. Upload files:`, '\x1b[37m');
    log(`     - ${zipName}`, '\x1b[37m');
    log(`     - latest.yml`, '\x1b[37m');
    log(`  3. Users download zip → extract → run .exe`, '\x1b[37m');
    log(`  4. Auto-update will work! ✅`, '\x1b[37m');
}

// Check if archiver is installed
try {
    require('archiver');
} catch (error) {
    log('❌ Missing dependency: archiver', '\x1b[31m');
    log('Installing archiver...', '\x1b[33m');
    exec('npm install archiver --save-dev');
    log('✅ Archiver installed', '\x1b[32m');
}

main().catch(error => {
    log(`❌ Build failed: ${error.message}`, '\x1b[31m');
    process.exit(1);
});

