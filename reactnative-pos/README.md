# OsaTech POS — React Native Mobile App

Admin dashboard mobile app for OsaTech POS Cloud. Lets the owner monitor all registered retail stores, licenses, revenue, CRM data, and reports from an Android phone.

---

## Overview

OsaTech POS is a cloud-connected POS system for Pakistani retailers. This React Native app is the **admin client** — it talks directly to the cloud backend (`https://osatechcloud.cloud`) and provides a real-time view of all tenant stores (instances), licenses, sales analytics, customer/vendor ledgers, and push notifications.

---

## Features

- **Dashboard** — Revenue strip cards, 7-day/30-day/3-month area chart, smart alert chips (expiring licenses, pending stores), quick-stats grid, top products, top stores by revenue
- **Inventory** — Browse products across all stores with search and filters; product detail view
- **CRM** — Customers, Vendors, Loans tabs per store; customer/vendor balance and detail screens
- **Reports** — Revenue, Profit & Loss, Top Products, Categories charts with date-range picker and share export
- **Settings** — Theme toggle (dark/light/system), language (English/Urdu), PIN lock, biometric auth, backend URL override, logout
- **Auth** — JWT login, forgot password flow, token refresh via `/auth/me`
- **Offline resilience** — MMKV-cached auth + user data; stale-while-revalidate via TanStack Query
- **Deep links** — `osatechpos://` URL scheme
- **i18n** — English and Urdu (RTL-ready)
- **Custom tab bar** — Floating pill with branded indigo active indicator

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Runtime | React Native | 0.73.6 |
| Language | TypeScript | 5.0.4 |
| Navigation | React Navigation (native-stack + bottom-tabs) | 6.x |
| State | Zustand | 4.5 |
| Server state | TanStack Query | 5.x |
| HTTP | Axios | 1.6 |
| Storage | react-native-mmkv | 2.12 |
| UI components | react-native-paper (MD3) | 5.12 |
| Charts | victory-native | 41.x |
| Gradients | react-native-linear-gradient | 2.8 |
| Icons | react-native-vector-icons (MaterialCommunityIcons) | 10.x |
| i18n | react-i18next + i18next | 14.x / 23.x |
| Gestures | react-native-gesture-handler | 2.x |
| Safe area | react-native-safe-area-context | 4.x |
| Toast | react-native-toast-message | 2.2 |
| Biometrics | react-native-biometrics | 3.x |
| Date utils | date-fns | 3.x |

---

## Project Structure

```
reactnative-pos/
├── android/                    Android native project
├── src/
│   ├── api/
│   │   ├── auth.ts             login(), logout(), getMe()
│   │   ├── client.ts           Axios instance + JWT interceptors
│   │   ├── dashboard.ts        getStats(), getAnalytics()
│   │   ├── instances.ts        getInstances(), getInstance(), per-instance data
│   │   ├── licenses.ts         getLicenses(), createLicense(), deleteLicense()
│   │   └── notifications.ts    getNotifications(), createNotification(), deleteNotification()
│   ├── components/
│   │   ├── shared/             RevenueChart, BarChart, PieChart, Header, StoreCard ...
│   │   └── ui/                 Skeleton, Badge, Button, Card, Input, SearchBar ...
│   ├── hooks/
│   │   ├── useAuth.ts          Thin wrapper over authStore
│   │   ├── useFormatCurrency.ts formatPKR(), fmtShort() — Pakistani number format
│   │   └── useTheme.ts         Colors, spacing, radius, typography, toggleTheme
│   ├── i18n/
│   │   ├── en.ts               English strings
│   │   ├── ur.ts               Urdu strings
│   │   └── index.ts            i18next initialisation
│   ├── navigation/
│   │   ├── AppNavigator.tsx    Auth gate (Splash → Auth stack | Main tabs)
│   │   ├── AuthStack.tsx       Login, ForgotPassword, ServerConfig
│   │   ├── MainNavigator.tsx   Bottom tab navigator + floating pill tab bar
│   │   ├── screens.ts          SCREENS constant (all route name strings)
│   │   └── index.ts            Re-exports
│   ├── screens/
│   │   ├── auth/               LoginScreen, ForgotPasswordScreen, SplashScreen, ServerConfigScreen
│   │   ├── crm/                CRMTabScreen, CustomersScreen, VendorsScreen, LoansScreen,
│   │   │                       CustomerDetailScreen, VendorDetailScreen
│   │   ├── dashboard/          DashboardScreen
│   │   ├── inventory/          InventoryScreen, ProductDetailScreen
│   │   ├── notifications/      NotificationsScreen
│   │   ├── reports/            ReportsScreen
│   │   └── settings/           SettingsScreen, PinSetupScreen, EditProfileScreen
│   ├── store/
│   │   ├── authStore.ts        Zustand auth state (user, token, isAuthenticated)
│   │   └── settingsStore.ts    Theme, language, biometric, PIN, backend URL
│   ├── theme/
│   │   ├── colors.ts           DARK_COLORS, LIGHT_COLORS, useThemeColors()
│   │   ├── typography.ts       Font scale constants
│   │   ├── spacing.ts          8pt grid
│   │   └── shadows.ts          Platform-aware shadow helpers
│   ├── types/                  Shared TypeScript types
│   └── utils/
│       ├── storage.ts          MMKV singleton + typed get/set helpers
│       └── date.ts             Date formatting utilities
├── App.tsx                     Root component — all providers stacked
├── index.js                    React Native entry point
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

---

## Setup & Installation

### Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18 LTS |
| npm | 9+ |
| JDK | 17 (Temurin / Zulu recommended) |
| Android Studio | Hedgehog (2023.1) or newer |
| Android SDK | API level 33 (target) / 21 (min) |
| Android NDK | 25.1.x (installed via SDK Manager) |

Make sure `ANDROID_HOME` and `JAVA_HOME` environment variables are set.

### Install dependencies

```bash
npm install
```

### Link native modules

React Native 0.73 uses autolinking. No manual `npx react-native link` step is needed for most packages. If you add a new native module, run:

```bash
cd android && ./gradlew clean
```

---

## Generating an Android Keystore

Required for signed release APKs/AABs. Run once:

```bash
keytool -genkeypair -v \
  -keystore android/app/osatechpos.keystore \
  -alias osatechpos \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Then set these in `android/gradle.properties` (or via CI environment variables):

```
MYAPP_UPLOAD_STORE_FILE=osatechpos.keystore
MYAPP_UPLOAD_KEY_ALIAS=osatechpos
MYAPP_UPLOAD_STORE_PASSWORD=<your password>
MYAPP_UPLOAD_KEY_PASSWORD=<your password>
```

---

## Running the App

### Development (debug)

Connect an Android device or start an emulator, then:

```bash
npm run android
# or: npx react-native run-android
```

### Release APK (side-loadable)

```bash
npm run build:android:release
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### AAB (Google Play Store)

```bash
npm run build:android:bundle
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## Environment Configuration

The app reads the backend URL from MMKV at runtime (key: `backend_url`), falling back to `https://osatechcloud.cloud`. Users can override this in **Settings > Backend URL**.

No `.env` file is required for basic usage. If you want build-time constants, add a `.env` file:

```
API_BASE_URL=https://osatechcloud.cloud
```

And install `react-native-config` if needed.

---

## API Configuration

All API calls go through `src/api/client.ts`:

- **Base URL**: `https://osatechcloud.cloud` (or MMKV override)
- **Auth**: `Authorization: Bearer <token>` header injected automatically
- **Token storage key**: `admin_token` in MMKV
- **401 handling**: Emits a `logout` event via `authEvents` → authStore clears state → app returns to login

---

## Build Configuration

`android/app/build.gradle` key settings:

```groovy
compileSdkVersion = 33
targetSdkVersion = 33
minSdkVersion = 21
versionCode = 1
versionName = "1.0.0"
```

Increment `versionCode` by 1 for every Play Store upload. Update `versionName` for user-facing releases.

---

## Troubleshooting

**Metro bundler port conflict**
```bash
npx react-native start --port 8082
npx react-native run-android --port 8082
```

**Gradle build fails with "JAVA_HOME not set"**
Set `JAVA_HOME` to your JDK 17 path, e.g.:
```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.10.7-hotspot
```

**`react-native-vector-icons` icons not showing (Android)**
Make sure `android/app/build.gradle` contains:
```groovy
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

**MMKV crash on first install**
MMKV requires NDK. Ensure NDK 25.x is installed in Android Studio SDK Manager.

**"Unable to load script" on device**
Enable USB debugging, run `adb reverse tcp:8081 tcp:8081`, then retry.

**Cleartext traffic blocked**
The app targets HTTPS only. If testing against a local HTTP server, add a network security config to `android/app/src/main/res/xml/network_security_config.xml`.

---

## Architecture

### Navigation

```
AppNavigator (auth gate)
├── SplashScreen            (shown while MMKV token is validated)
├── AuthStack
│   ├── LoginScreen
│   ├── ForgotPasswordScreen
│   └── ServerConfigScreen
└── MainNavigator (bottom tabs)
    ├── Tab: Dashboard
    │   ├── DashboardScreen
    │   └── NotificationsScreen
    ├── Tab: Inventory
    │   ├── InventoryScreen
    │   └── ProductDetailScreen
    ├── Tab: CRM
    │   ├── CRMTabScreen (Customers | Vendors | Loans segments)
    │   ├── CustomerDetailScreen
    │   └── VendorDetailScreen
    ├── Tab: Reports
    │   └── ReportsScreen
    └── Tab: Settings
        ├── SettingsScreen
        ├── PinSetupScreen
        └── EditProfileScreen
```

### State Management

- **authStore** (Zustand) — JWT token, user object, `isAuthenticated`, `isLoading`. Persisted in MMKV. Loaded on app start via `loadFromStorage()`.
- **settingsStore** (Zustand) — Theme, language, biometric/PIN toggles, backend URL. Persisted in MMKV.
- **TanStack Query** — All server data (stats, analytics, instances, notifications). Stale-while-revalidate with per-query `staleTime`.

### API Layer

Each domain has its own file in `src/api/`. All calls go through the shared `client.ts` Axios instance which auto-attaches the JWT and handles 401 → logout. Helper functions `get()`, `post()`, `del()` provide typed wrappers.
