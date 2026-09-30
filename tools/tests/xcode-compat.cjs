const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const appRequire=createRequire(path.resolve('package.json'));
const xcode=appRequire('xcode');
const parser=appRequire('xcode/lib/parser/pbxproj');

// xcode only calls uuid.v4(). Keep its CommonJS consumer and project writer
// covered while overriding the obsolete uuid dependency with the patched v11.
const project=xcode.project('compatibility.pbxproj');
project.hash={project:{archiveVersion:1,classes:{},objectVersion:54,objects:{PBXGroup:{},PBXFileReference:{}}}};
const ids=new Set();
for(let i=0;i<32;i++){
 const group=project.addPbxGroup([],`Group${i}`);
 assert.match(group.uuid,/^[A-F0-9]{24}$/);
 ids.add(group.uuid);
}
assert.equal(ids.size,32);
const restored=parser.parse(project.writeSync());
for(const id of ids)assert.equal(restored.project.objects.PBXGroup[id].isa,'PBXGroup');
console.log('xcode UUID generation and project round-trip passed.');
