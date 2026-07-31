import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDisplayText, repairMojibake } from '../src/lib/text.mjs'

test('repairs UTF-8 text decoded as Windows-1252', () => {
  assert.equal(repairMojibake('MontrÃ©al'), 'Montréal')
})

test('repairs Arabic mojibake visible in imported job locations', () => {
  assert.equal(repairMojibake('Ø¸Ø§Ù‡Ø±'), 'ظاهر')
})

test('preserves valid international text', () => {
  assert.equal(normalizeDisplayText('München · São Paulo'), 'München · São Paulo')
})

test('removes control characters and collapses whitespace', () => {
  assert.equal(normalizeDisplayText('  Ottawa\u0007   Ontario  '), 'Ottawa Ontario')
})

test('uses fallback for missing values', () => {
  assert.equal(normalizeDisplayText(null, 'Unknown company'), 'Unknown company')
})

test('repairMojibake always returns a string for arbitrary input', () => {
  assert.equal(repairMojibake(42), '')
  assert.equal(repairMojibake({ value: 'MontrÃ©al' }), '')
  assert.equal(repairMojibake(false), '')
})
