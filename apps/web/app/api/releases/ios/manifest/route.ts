import {iosRelease} from "@/lib/ios-release";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const origin = new URL(process.env.APP_ORIGIN || request.url).origin;
  const ipaUrl = new URL(iosRelease.ipaPath, origin).toString();
  const iconUrl = new URL(iosRelease.iconPath, origin).toString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict>
<key>assets</key><array>
<dict><key>kind</key><string>software-package</string><key>url</key><string>${ipaUrl}</string></dict>
<dict><key>kind</key><string>display-image</string><key>url</key><string>${iconUrl}</string></dict>
</array>
<key>metadata</key><dict>
<key>bundle-identifier</key><string>${iosRelease.bundleIdentifier}</string>
<key>bundle-version</key><string>${iosRelease.buildNumber}</string>
<key>kind</key><string>software</string><key>title</key><string>微读</string>
</dict></dict></array></dict></plist>`;
  return new Response(xml, {headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"no-store"}});
}
