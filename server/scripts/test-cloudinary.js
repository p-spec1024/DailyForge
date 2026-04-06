import 'dotenv/config';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import cloudinary, { uploadToCloudinary } from '../src/lib/cloudinary.js';

const TMP_PATH = join(tmpdir(), 'dailyforge-test.png');

function createTestPng() {
  // Build a valid minimal 1x1 red PNG from scratch
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: 1x1, 8-bit RGB
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);  // width
  ihdrData.writeUInt32BE(1, 4);  // height
  ihdrData[8] = 8;              // bit depth
  ihdrData[9] = 2;              // color type (RGB)
  ihdrData[10] = 0;             // compression
  ihdrData[11] = 0;             // filter
  ihdrData[12] = 0;             // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk: zlib-compressed scanline (filter byte 0 + RGB red pixel)
  // Raw data: [0x00, 0xFF, 0x00, 0x00] (filter=none, R=255, G=0, B=0)
  // Wrapped in zlib: header(78 01) + deflate block + adler32
  const rawScanline = Buffer.from([0x00, 0xff, 0x00, 0x00]);
  const deflateBlock = Buffer.concat([
    Buffer.from([0x78, 0x01]),                    // zlib header
    Buffer.from([0x01]),                           // final block, uncompressed
    Buffer.from([0x04, 0x00, 0xfb, 0xff]),        // len=4, nlen=~4
    rawScanline,
    adler32(rawScanline),
  ]);
  const idat = makeChunk('IDAT', deflateBlock);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  writeFileSync(TMP_PATH, png);
  return TMP_PATH;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  return Buffer.concat([len, typeBuffer, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return result;
}

function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE(((b << 16) | a) >>> 0);
  return result;
}

async function main() {
  console.log('Creating test image...');
  const filePath = createTestPng();

  console.log('Uploading to Cloudinary...');
  const { url, public_id } = await uploadToCloudinary(filePath, 'dailyforge-test');
  console.log('Upload successful!');
  console.log('  URL:', url);
  console.log('  Public ID:', public_id);

  console.log('Cleaning up — deleting test upload from Cloudinary...');
  await cloudinary.uploader.destroy(public_id);
  console.log('Remote cleanup done.');

  unlinkSync(filePath);
  console.log('Local temp file removed.');
  console.log('Cloudinary connection verified!');
}

main().catch((err) => {
  console.error('Cloudinary test failed:', err.message);
  process.exit(1);
});
