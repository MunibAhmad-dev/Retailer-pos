# OsaTech POS — Android Keystore & Build Instructions

## 1. Generate the Release Keystore

Run this command once from the `android/app/` directory. Keep the generated
keystore file safe — losing it means you can never update your Play Store app.

```bash
keytool -genkey -v \
  -keystore android/app/osatechpos.keystore \
  -alias osatechpos \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass osatechpos2025 \
  -keypass osatechpos2025 \
  -dname "CN=OsaTech POS, OU=OsaTech, O=OsaTech, L=Lahore, S=Punjab, C=PK"
```

On Windows (single line):

```powershell
keytool -genkey -v -keystore android\app\osatechpos.keystore -alias osatechpos -keyalg RSA -keysize 2048 -validity 10000 -storepass osatechpos2025 -keypass osatechpos2025 -dname "CN=OsaTech POS, OU=OsaTech, O=OsaTech, L=Lahore, S=Punjab, C=PK"
```

The keystore properties are already configured in `android/gradle.properties`:

```
MYAPP_RELEASE_STORE_FILE=osatechpos.keystore
MYAPP_RELEASE_KEY_ALIAS=osatechpos
MYAPP_RELEASE_STORE_PASSWORD=osatechpos2025
MYAPP_RELEASE_KEY_PASSWORD=osatechpos2025
```

> Security note: For production, move the passwords out of gradle.properties and
> use environment variables or a secrets manager. Never commit the `.keystore`
> file or passwords to a public repository.

---

## 2. Build a Debug APK

```bash
# From the project root
cd android
./gradlew assembleDebug        # macOS / Linux
gradlew.bat assembleDebug      # Windows
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Install directly on a connected device:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or use the React Native CLI shortcut:

```bash
npx react-native run-android
```

---

## 3. Build a Release APK

Make sure the keystore file exists at `android/app/osatechpos.keystore` first.

```bash
cd android
./gradlew assembleRelease       # macOS / Linux
gradlew.bat assembleRelease     # Windows
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

Install on a device:

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Build a Release AAB (for Play Store)

Google Play requires the Android App Bundle format.

```bash
cd android
./gradlew bundleRelease         # macOS / Linux
gradlew.bat bundleRelease       # Windows
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload this `.aab` file to the Google Play Console.

---

## 5. Signing Configuration Summary

The signing is wired in `android/app/build.gradle`:

```groovy
signingConfigs {
    release {
        if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        ...
    }
}
```

The four `MYAPP_RELEASE_*` values are read from `android/gradle.properties`.

---

## File Checklist Before Building

- [ ] `android/app/osatechpos.keystore` — generated with keytool (step 1)
- [ ] `android/gradle.properties` — keystore props filled in
- [ ] `node_modules/` — run `npm install` or `yarn` first
- [ ] Android SDK installed (API 34) and `ANDROID_HOME` env var set
- [ ] Java 17 installed (`java -version` should show 17.x)
