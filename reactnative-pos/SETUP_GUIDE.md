# OsaTech POS Mobile — Setup Guide

## Prerequisites
- Node.js 18+ (check: node --version)
- JDK 17 (check: java -version)
- Android Studio Ladybug or newer
- Android SDK API 34
- React Native CLI: npm install -g @react-native/cli

## Step 1: Install Dependencies
```bash
cd reactnative-pos
npm install
```

## Step 2: Android Environment
Set ANDROID_HOME in your environment:
- Windows: ANDROID_HOME = C:\Users\{user}\AppData\Local\Android\Sdk
- Add to PATH: %ANDROID_HOME%\platform-tools

## Step 3: Generate Release Keystore
```bash
keytool -genkey -v -keystore android/app/osatechpos.keystore \
  -alias osatechpos -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass osatechpos2025 -keypass osatechpos2025 \
  -dname "CN=OsaTech, OU=Mobile, O=OsaTech Technologies, L=Lahore, ST=Punjab, C=PK"
```

## Step 4: Running in Development
```bash
# Start Metro bundler
npm start

# In another terminal, run on connected Android device
npm run android
```

## Step 5: Building Release APK
```bash
npm run build:android:release
# Output: android/app/build/outputs/apk/release/app-release.apk
```

## Step 6: Building AAB (Google Play)
```bash
npm run build:android:bundle
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

## Troubleshooting
- "SDK location not found": Set ANDROID_HOME
- "Could not resolve": Run `cd android && ./gradlew --refresh-dependencies`
- Metro cache issue: `npm start -- --reset-cache`
- Build failed: `cd android && ./gradlew clean`
