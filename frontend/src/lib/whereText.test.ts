import assert from 'node:assert/strict';
import test from 'node:test';
import { describeWhere, whereFromText } from './whereText.ts';

const states = ['Abia', 'Akwa Ibom', 'Lagos'];

test('describeWhere builds the text shown in the box', () => {
  assert.equal(describeWhere('Akwa Ibom', 'Uyo'), 'Uyo, Akwa Ibom');
  assert.equal(describeWhere('Akwa Ibom', ''), 'Akwa Ibom');
  assert.equal(describeWhere('', 'Uyo'), 'Uyo');
  assert.equal(describeWhere('', ''), '');
});

test('typed text that matches a state is treated as a state', () => {
  assert.deepEqual(whereFromText('  akwa ibom ', states), { state: 'Akwa Ibom', city: '' });
});

test('any other typed text is treated as a place name', () => {
  assert.deepEqual(whereFromText('Uyo', states), { state: '', city: 'Uyo' });
  assert.deepEqual(whereFromText('   ', states), { state: '', city: '' });
});
