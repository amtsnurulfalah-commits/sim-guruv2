import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {currentRelease,releaseNotes} from '../../src/lib/release/notes';
test('published release catalog has one latest identity, unique versions and valid dates/content',()=>{
 assert.equal(currentRelease,releaseNotes[0]?.version);
 assert.equal(new Set(releaseNotes.map(note=>note.version)).size,releaseNotes.length);
 for(const [index,note] of releaseNotes.entries()){
  assert.ok(z.iso.date().safeParse(note.date).success);
  assert.ok(note.version.trim());
  assert.ok([...note.features,...note.fixes,...note.actions].every(item=>item.trim().length>0));
  assert.ok(note.features.length+note.fixes.length+note.actions.length>0);
  if(index)assert.ok(releaseNotes[index-1]!.date>=note.date);
 }
});
