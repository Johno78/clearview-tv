#!/usr/bin/env python3
"""Make the generated Capacitor Android project Fire TV / Android TV friendly."""
import os, re, pathlib, shutil, sys

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
if "<queries>" not in x:
    x = x.replace("<application", '<queries><package android:name="org.videolan.vlc" /><intent><action android:name="android.intent.action.VIEW" /><data android:mimeType="video/*" /></intent></queries>\n    <application', 1)
manifest.write_text(x)

banner = root / "resources/banner.png"
dest = root / "android/app/src/main/res/drawable"
dest.mkdir(parents=True, exist_ok=True)
if banner.exists():
    shutil.copy(banner, dest / "banner.png")
# launcher icons (match the Clearview orb logo): replace Capacitor's defaults, drop the adaptive-icon xml so these are used
res = root / "android/app/src/main/res"
icons = root / "resources/android"
if icons.exists():
    for d in icons.iterdir():
        if d.is_dir():
            (res / d.name).mkdir(parents=True, exist_ok=True)
            for f in d.iterdir():
                shutil.copy(f, res / d.name / f.name)
    shutil.rmtree(res / "mipmap-anydpi-v26", ignore_errors=True)
    print("launcher icons replaced")
print("patched", manifest)

# ---- External player plugin (hands streams to VLC / any video app) ----
java_dir = root / "android/app/src/main/java/app/clearview/tv"
java_dir.mkdir(parents=True, exist_ok=True)

(java_dir / "ExternalPlayerPlugin.java").write_text('''package app.clearview.tv;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalPlayer")
public class ExternalPlayerPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        String title = call.getString("title", "");
        String pkg = call.getString("pkg", "");
        Integer pos = call.getInt("positionMs", 0);

        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndTypeAndNormalize(Uri.parse(url), "video/*");
        i.putExtra("title", title);
        if (pos != null && pos > 0) {
            i.putExtra("position", (long) pos);
        }

        JSObject ret = new JSObject();
        String err = "";
        boolean hasPkg = pkg != null && !pkg.isEmpty();
        if (!hasPkg) {
            try {
                Intent c = Intent.createChooser(i, "Play with");
                c.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(c);
                ret.put("launched", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not open player: " + e.getMessage());
            }
            return;
        }
        // Try several ways of reaching the player app; VLC builds differ.
        Intent[] tries = new Intent[4];
        Intent a = new Intent(i); a.setPackage(pkg); tries[0] = a;
        Intent b = new Intent(Intent.ACTION_VIEW, Uri.parse(url)); b.setPackage(pkg); b.putExtra("title", title); tries[1] = b;
        Intent c2 = new Intent(Intent.ACTION_VIEW); c2.setDataAndType(Uri.parse(url), "video/*");
        c2.setClassName(pkg, "org.videolan.vlc.gui.video.VideoPlayerActivity"); c2.putExtra("title", title);
        if (pos != null && pos > 0) c2.putExtra("position", (long) pos);
        tries[2] = c2;
        tries[3] = getActivity().getPackageManager().getLaunchIntentForPackage(pkg);
        boolean ok = false;
        for (Intent t : tries) {
            if (t == null) continue;
            try {
                t.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(t);
                ok = true;
                break;
            } catch (Exception e) {
                err = e.getClass().getSimpleName() + ": " + e.getMessage();
            }
        }
        ret.put("launched", ok);
        if (!ok) ret.put("reason", err);
        call.resolve(ret);
    }
}
''')

(java_dir / "MainActivity.java").write_text('''package app.clearview.tv;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
''')
print("external player plugin written")

# ---- version: Android only lets an app update if versionCode goes up, so use the CI run number ----
vc = os.environ.get("VERSION_CODE")
gradle = root / "android/app/build.gradle"
if vc and vc.isdigit() and gradle.exists():
    g = gradle.read_text()
    g = re.sub(r"versionCode\s+\d+", "versionCode " + vc, g, count=1)
    g = re.sub(r'versionName\s+"[^"]*"', 'versionName "0.1.' + vc + '"', g, count=1)
    gradle.write_text(g)
    print("versionCode", vc)
