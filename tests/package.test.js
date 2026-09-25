'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const packager = require('../tools/package.js');

const ROOT = path.join(__dirname, '..');

/** A minimal reader, so the writer is checked against something independent. */
function readArchive(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(end, -1, 'no end of central directory');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'bad central header');
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { count, names };
}

test('the package carries the extension and nothing else', () => {
  const files = packager.collectFiles(ROOT);
  assert.ok(files.includes('manifest.json'));
  assert.ok(files.includes('src/content/content.js'));
  assert.ok(files.includes('src/popup/popup.html'));
  assert.ok(files.some((file) => file.startsWith('src/images/')));
});

test('development scaffolding stays behind', () => {
  const files = packager.collectFiles(ROOT);
  const unwanted = ['tests/', 'tools/', 'types/', 'node_modules/', 'dist/',
    'package.json', 'tsconfig.json', 'README.md', '.github/'];
  for (const prefix of unwanted) {
    assert.ok(!files.some((file) => file.startsWith(prefix)),
      `${prefix} should not be packaged`);
  }
});

test('the file list is stable, so two builds agree', () => {
  assert.deepEqual(packager.collectFiles(ROOT), packager.collectFiles(ROOT));
  assert.deepEqual(packager.collectFiles(ROOT), packager.collectFiles(ROOT).slice().sort());
});

test('everything the extension loads is in the package', () => {
  assert.deepEqual(packager.verify(ROOT).missing, []);
});

test('the package carries nothing the extension never loads', () => {
  assert.deepEqual(packager.verify(ROOT).unreferenced, []);
});

test('the scripts the popup injects are all accounted for', () => {
  const referenced = packager.referencedFiles(ROOT);
  assert.ok(referenced.has('src/lib/latex.js'));
  assert.ok(referenced.has('src/lib/autofit.js'));
  assert.ok(referenced.has('src/content/content.js'));
  assert.ok(referenced.has('src/popup/popup.css'));
});

test('the archive reads back as a zip with the same entries', () => {
  const files = ['a.txt', 'nested/b.txt'];
  const contents = { 'a.txt': Buffer.from('hello hello hello hello'), 'nested/b.txt': Buffer.from('x') };
  const archive = packager.buildZip(files, (name) => contents[name]);
  assert.equal(archive.readUInt32LE(0), 0x04034b50, 'starts with a local header');
  const read = readArchive(archive);
  assert.equal(read.count, 2);
  assert.deepEqual(read.names, files);
});

test('building twice produces the same bytes', () => {
  const files = ['a.txt'];
  const read = () => Buffer.from('the same input');
  assert.ok(packager.buildZip(files, read).equals(packager.buildZip(files, read)));
});

test('an empty archive is still a valid one', () => {
  const archive = packager.buildZip([], () => Buffer.alloc(0));
  assert.equal(readArchive(archive).count, 0);
});

test('the checksum matches the known value for a known input', () => {
  assert.equal(packager.crc32(Buffer.from('123456789')), 0xcbf43926);
});
