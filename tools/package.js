'use strict';

/**
 * Builds the zip that goes to the Chrome Web Store.
 *
 * The store wants the extension and nothing else, so tests, tooling, types,
 * configuration and the readme all stay behind. There is no bundler and no
 * build output, so packaging is a copy with a filter, plus a check that the
 * filter and the code still agree with each other.
 *
 *   node tools/package.js [--out dist]
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');

/** Only these reach the store. Everything else is development scaffolding. */
const SHIPPED = ['manifest.json', 'src'];
const SKIP = /(^\.|\.test\.js$|\.DS_Store$)/;

function walk(root, relative, found) {
  const absolute = path.join(root, relative);
  const stats = fs.statSync(absolute);
  if (stats.isFile()) {
    found.push(relative);
    return found;
  }
  for (const entry of fs.readdirSync(absolute).sort()) {
    if (SKIP.test(entry)) continue;
    walk(root, path.join(relative, entry), found);
  }
  return found;
}

/** Every file that belongs in the package, in a stable order. */
function collectFiles(root) {
  const found = [];
  for (const entry of SHIPPED) {
    walk(root || ROOT, entry, found);
  }
  return found.map((file) => file.split(path.sep).join('/')).sort();
}

/**
 * Every file the extension says it needs: the manifest's own references, the
 * popup's markup, and the list of scripts the popup injects.
 */
function referencedFiles(root) {
  const base = root || ROOT;
  const read = (file) => fs.readFileSync(path.join(base, file), 'utf8');
  const manifest = JSON.parse(read('manifest.json'));
  const referenced = new Set(['manifest.json']);

  const popup = manifest.action && manifest.action.default_popup;
  if (popup) referenced.add(popup);
  for (const icon of Object.values(manifest.icons || {})) referenced.add(String(icon));
  for (const script of (manifest.background ? [manifest.background.service_worker] : [])) {
    if (script) referenced.add(script);
  }
  for (const entry of manifest.content_scripts || []) {
    for (const file of (entry.js || []).concat(entry.css || [])) referenced.add(file);
  }

  if (popup) {
    const markup = read(popup);
    const directory = path.posix.dirname(popup);
    for (const match of markup.matchAll(/(?:src|href)="([^"]+)"/g)) {
      referenced.add(path.posix.join(directory, match[1]));
    }
    // The popup injects the content scripts by path, relative to the root.
    const script = read(path.posix.join(directory, 'popup.js'));
    for (const match of script.matchAll(/'(src\/[^']+\.(?:js|css))'/g)) {
      referenced.add(match[1]);
    }
  }
  return referenced;
}

/**
 * Compares what would be shipped against what the code actually asks for.
 *
 * @returns {{missing: string[], unreferenced: string[]}} missing means the
 *   extension names a file the package would not contain, which would break it
 *   in the store; unreferenced means the package carries a file nothing loads.
 */
function verify(root) {
  const files = collectFiles(root);
  const referenced = referencedFiles(root);
  const present = new Set(files);
  return {
    missing: [...referenced].filter((file) => !present.has(file)).sort(),
    unreferenced: files.filter((file) => !referenced.has(file)).sort()
  };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/** A fixed timestamp, so the same input always produces the same archive. */
const DOS_TIME = 0;
const DOS_DATE = 33;

function buildZip(files, read) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const name of files) {
    const contents = read(name);
    const deflated = zlib.deflateRawSync(contents, { level: 9 });
    const useStore = deflated.length >= contents.length;
    const body = useStore ? contents : deflated;
    const method = useStore ? 0 : 8;
    const nameBytes = Buffer.from(name, 'utf8');
    const checksum = crc32(contents);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(contents.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, directory, end]);
}

function main() {
  // Piping the listing into head closes stdout early; that is not a failure.
  process.stdout.on('error', /** @param {NodeJS.ErrnoException} error */ function (error) {
    if (error && error.code === 'EPIPE') return;
    throw error;
  });

  const outIndex = process.argv.indexOf('--out');
  const outDir = path.join(ROOT, outIndex === -1 ? 'dist' : process.argv[outIndex + 1]);

  const problems = verify(ROOT);
  if (problems.missing.length) {
    process.stderr.write('the extension refers to files the package would not contain:\n');
    problems.missing.forEach((file) => process.stderr.write('  ' + file + '\n'));
    process.exit(1);
  }
  if (problems.unreferenced.length) {
    process.stderr.write('the package would carry files nothing loads:\n');
    problems.unreferenced.forEach((file) => process.stderr.write('  ' + file + '\n'));
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const files = collectFiles(ROOT);
  const archive = buildZip(files, (name) => fs.readFileSync(path.join(ROOT, name)));

  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, `plotdeck-${manifest.version}.zip`);
  fs.writeFileSync(target, archive);

  const size = (archive.length / 1024).toFixed(1);
  process.stdout.write(`${files.length} files, ${size} kB -> ${path.relative(ROOT, target)}\n`);
  files.forEach((file) => process.stdout.write('  ' + file + '\n'));
}

if (require.main === module) main();

module.exports = { collectFiles, referencedFiles, verify, buildZip, crc32, SHIPPED };
