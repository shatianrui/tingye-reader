const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../node_modules/expo-audio/ios/AudioPlaylist.swift');
const before='self.updateStatus(with: ["currentTime": time.seconds])';
const after='self.updateStatus(with: [:]) // Tingye: sample time and item identity together';
const source=fs.readFileSync(file,'utf8');
if(source.includes(before))fs.writeFileSync(file,source.replace(before,after));
else if(!source.includes(after))throw Error('Review Expo playlist clock patch for this SDK version');
// A queued time callback may belong to the previous AVPlayerItem. Read the
// current item's own clock in currentStatus() instead of merging the stale time.
console.log('Applied coherent iOS audio item/clock snapshot.');
