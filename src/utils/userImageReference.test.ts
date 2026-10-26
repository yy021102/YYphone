import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { UserPersona } from '../types';
import { hasUserFaceReference, parseImageSubject, selectChatImageReferences, userFaceReferenceInstructions, validUserFaceFields } from './userImageReference';

const photo = 'data:image/png;base64,iVBORw0KGgo=';
const rolePhoto = 'data:image/jpeg;base64,AQID';
const persona: UserPersona = { id: 'a', name: '预设', nickname: '小月', identity: '', personality: '', background: '', speakingStyle: '', faceReferenceImage: photo };

test('player face reference only follows images explicitly containing that player', () => {
  assert.deepEqual(selectChatImageReferences('user', persona, rolePhoto, 0.6), [{ image: photo, subject: 'user', similarity: 0.85 }]);
  assert.deepEqual(selectChatImageReferences('together', persona, rolePhoto, 0.6), [
    { image: photo, subject: 'user', similarity: 0.85 }, { image: rolePhoto, subject: 'character', similarity: 0.6 },
  ]);
  for (const subject of ['character', 'other', undefined] as const) {
    assert.deepEqual(selectChatImageReferences(subject, persona, rolePhoto, 0.6), [{ image: rolePhoto, similarity: 0.6 }]);
    assert.deepEqual(selectChatImageReferences(subject, persona), []);
  }
  assert.deepEqual(selectChatImageReferences('user', { ...persona, id: 'other', faceReferenceImage: undefined }), []);
  assert.deepEqual(selectChatImageReferences('user', { ...persona, faceReferenceEnabled: false }), []);
  assert.deepEqual(selectChatImageReferences('user', { ...persona, faceReferenceImage: '' }), []);
  assert.deepEqual(selectChatImageReferences('user', { ...persona, faceReferenceSimilarity: 0 }), [{ image: photo, subject: 'user', similarity: 0 }]);
});

test('face photo settings accept older personas and validate local photos, switches and strength', () => {
  assert(validUserFaceFields({}));
  assert(validUserFaceFields(persona));
  assert(validUserFaceFields({ faceReferenceImage: '', faceReferenceEnabled: false, faceReferenceSimilarity: 1 }));
  assert(!validUserFaceFields({ faceReferenceImage: 'https://untrusted.test/photo' }));
  assert(!validUserFaceFields({ faceReferenceImage: 'data:text/html;base64,AQID' }));
  assert(!validUserFaceFields({ faceReferenceEnabled: 'true' }));
  assert(!validUserFaceFields({ faceReferenceSimilarity: NaN }));
  assert(!validUserFaceFields({ faceReferenceSimilarity: 1.1 }));
  assert(!hasUserFaceReference({ ...persona, faceReferenceEnabled: false }));
  assert.equal(parseImageSubject('together'), 'together');
  assert.equal(parseImageSubject(['user']), undefined);
  assert.equal(parseImageSubject('someone'), undefined);
});

test('chat instructions describe reference routing without embedding the stored photo in text prompts', () => {
  const instructions = userFaceReferenceInstructions(persona);
  assert.match(instructions, /imageSubject/);
  assert.match(instructions, /"together"/);
  assert(!instructions.includes(photo));
  assert.equal(userFaceReferenceInstructions({ ...persona, faceReferenceEnabled: false }), '');
  assert.equal(userFaceReferenceInstructions(undefined), '');
});
