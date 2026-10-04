#!/usr/bin/env python3
"""Make the generated Capacitor Android project Fire TV / Android TV friendly."""
import re, pathlib, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
manifest = root / "android/app/src/main/AndroidManifest.xml"
if not manifest.exists():
    sys.exit("android project not found - run `npx cap add android` first")

x = manifest.read_text()

# TV hardware features: no touchscreen needed, leanback optional so it also installs on phones
feat = (
    '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n'
    '    <uses-feature android:name="android.software.leanback" android:required="false" />\n'
)
if "android.software.leanback" not in x:
    x = x.replace("<application", feat + "\n    <application", 1)

# Launcher category for the TV home screen + banner + cleartext http for Xtream servers
if "LEANBACK_LAUNCHER" not in x:
    x = x.replace(
        '<category android:name="android.intent.category.LAUNCHER" />',
        '<category android:name="android.intent.category.LAUNCHER" />\n'
        '                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />', 1)
if "android:banner" not in x:
    x = x.replace("<application", '<application android:banner="@drawable/banner"', 1)
if "usesCleartextTraffic" not in x:
    x = x.replace("<application", '<application android:usesCleartextTraffic="true"', 1)
# landscape only, handle remote/keyboard config changes
x = re.sub(r'(<activity\b)', r'\1 android:screenOrientation="sensorLandscape"', x, count=1) if "screenOrientation" not in x else x
manifest.write_text(x)

banner = root / "resources/banner.png"
dest = root / "android/app/src/main/res/drawable"
dest.mkdir(parents=True, exist_ok=True)
if banner.exists():
    shutil.copy(banner, dest / "banner.png")
print("patched", manifest)
