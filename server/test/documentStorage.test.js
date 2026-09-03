import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanOriginalFilename, detectAssetDocument } from '../src/documentStorage.js';

test('detecta documentos por firma binaria y no por la extensión declarada', () => {
  assert.deepEqual(detectAssetDocument(Buffer.from('%PDF-1.7\n')), { mimeType: 'application/pdf', extension: '.pdf' });
  assert.deepEqual(detectAssetDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { mimeType: 'image/png', extension: '.png' });
  assert.deepEqual(detectAssetDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), { mimeType: 'image/jpeg', extension: '.jpg' });
  assert.equal(detectAssetDocument(Buffer.from('MZ ejecutable.pdf')), null);
});

test('conserva sólo el nombre visible del archivo y elimina controles', () => {
  assert.equal(cleanOriginalFilename('../../factura\u0000.pdf'), 'factura.pdf');
  assert.equal(cleanOriginalFilename(''), 'documento');
});
