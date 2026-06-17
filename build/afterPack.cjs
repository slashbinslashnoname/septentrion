// electron-builder afterPack hook.
//
// Ad-hoc code-sign the macOS .app so unsigned arm64 builds are NOT reported as
// "damaged" by Gatekeeper (Apple Silicon refuses to run binaries without a
// valid signature). This is not a Developer ID signature and does not notarize
// — users still get an "unidentified developer" prompt (right-click → Open) —
// but it prevents the hard "damaged / move to Trash" failure.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'inherit'
    })
    console.log(`  • ad-hoc signed ${appName}.app`)
  } catch (err) {
    console.warn(`  • ad-hoc signing failed: ${err.message}`)
  }
}
