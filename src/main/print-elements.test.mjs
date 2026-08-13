import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePrintElements, normalizePrintImage } from './print-elements.ts'

const image = {
  src: 'data:image/png;base64,iVBORw0KGgo=',
  xMm: 0,
  yMm: 0,
  widthMm: 20,
  heightMm: 10
}

const text = {
  content: '测试',
  xMm: 0,
  yMm: 0,
  widthMm: 20,
  heightMm: 10
}

test('rejects image dimensions above the millimeter limit', () => {
  assert.throws(
    () => normalizePrintImage({ ...image, widthMm: 1200.1 }, 'elements[0]'),
    /不能超过 1200/
  )
})

test('preserves the order of elements', () => {
  const elements = normalizePrintElements({
    elements: [
      { type: 'text', ...text, content: '底层文字' },
      { type: 'image', ...image },
      { type: 'text', ...text, content: '顶层文字' }
    ]
  })

  assert.deepEqual(
    elements.map((element) => element.type),
    ['text', 'image', 'text']
  )
})

test('keeps the legacy image-before-text order', () => {
  const elements = normalizePrintElements({ images: [image], texts: [text] })
  assert.deepEqual(
    elements.map((element) => element.type),
    ['image', 'text']
  )
})

test('rejects mixing elements with legacy arrays', () => {
  assert.throws(
    () => normalizePrintElements({ elements: [], images: [] }),
    /不能与 images 或 texts 同时使用/
  )
})
