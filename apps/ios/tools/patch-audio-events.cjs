const fs=require('node:fs'),path=require('node:path');
// expo-audio pauses playlists on audio interruptions and route changes without
// telling JS, and ignores AVPlayerItem failures entirely. The UI then shows
// "playing" over silent audio. Emit status events for both so the reader can
// reflect the true paused state or surface a corrupt clip.
const patches=[
 {
  file:'expo-audio/ios/AudioPlaylist.swift',
  before:`        if status == .readyToPlay {
          self.updateStatus(with: ["isLoaded": true])
        }`,
  after:`        if status == .readyToPlay {
          self.updateStatus(with: ["isLoaded": true])
        }
        if status == .failed {
          // Tingye: AVQueuePlayer does not skip a failed item; report it.
          self.updateStatus(with: ["itemFailed": true])
        }`,
 },
 {
  file:'expo-audio/ios/AudioModule.swift',
  before:`        case .doNotMix, .mixWithOthers:
          playable.pause()
        }`,
  after:`        case .doNotMix, .mixWithOthers:
          playable.pause()
          (playable as? AudioPlaylist)?.updateStatus(with: ["externalPause": true]) // Tingye: tell JS the system paused playback
        }`,
 },
 {
  file:'expo-audio/ios/AudioModule.swift',
  before:`        case .doNotMix, .mixWithOthers:
          playable.resumePlayback()
        }`,
  after:`        case .doNotMix, .mixWithOthers:
          playable.resumePlayback()
          (playable as? AudioPlaylist)?.updateStatus(with: ["externalResume": true]) // Tingye: tell JS the system resumed playback
        }`,
 },
 {
  file:'expo-audio/ios/AudioModule.swift',
  before:`      if playable.isPlaying {
        playable.wasPlaying = true
        playable.pause()
      }`,
  after:`      if playable.isPlaying {
        playable.wasPlaying = true
        playable.pause()
        (playable as? AudioPlaylist)?.updateStatus(with: ["externalPause": true]) // Tingye: tell JS the system paused playback
      }`,
 },
];
for(const {file,before,after} of patches){
 const target=path.resolve(__dirname,'../node_modules',file);
 const source=fs.readFileSync(target,'utf8');
 if(source.includes(before))fs.writeFileSync(target,source.replace(before,after));
 else if(!source.includes(after))throw Error(`Review expo-audio event patch for this SDK version: ${file}`);
}
console.log('Applied expo-audio external pause/resume and item failure events.');
