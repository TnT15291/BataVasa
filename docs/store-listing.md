# Store Listing Prep

This file is the source copy/checklist for App Store Connect and Google Play.

## App Identity

- App name: BataVasa
- Subtitle / short description: Personal finance, reminders, journal, and habits
- Category: Productivity
- Secondary category: Finance
- Support URL: https://github.com/TnT15291/BataVasa
- Privacy policy URL: https://github.com/TnT15291/BataVasa/blob/main/docs/privacy-policy.md

## Short Description

BataVasa helps you track spending, reminders, journals, and habits in one
offline-first personal app with voice input and optional AI assistance.

## Long Description

BataVasa brings daily personal organization into one private workspace. Track
transactions, budgets, reminders, journal entries, moods, and habits without
switching between separate apps. Use text or voice input to quickly add entries,
review reports across weekly, monthly, yearly, and custom periods, and protect
your data with sign-in, local storage, cloud sync, and optional biometric lock.

Core features:

- Finance tracking with categories, budgets, reports, and AI-assisted entry
- Reminders with local notifications and advance notice
- Journals with mood tracking and reflection support
- Habits with completion history and streaks
- Universal quick add with text and voice input
- Offline-first SQLite storage with optional cloud sync
- Per-module data export and deletion
- Biometric lock for sensitive personal data

## Screenshot Set

Capture these screens on at least one iPhone and one Android phone size:

1. Daily Digest home
2. Finance list with period filter
3. Finance report
4. Universal Add with voice/AI parse
5. Reminders list or reminder form
6. Journal list/report
7. Habits list/report
8. Settings Data Management / Privacy

Use fresh captures from the 2026-05-28 UI polish build. Do not use older
screenshots that show raw AI markdown, Expo notification warnings, crowded
Journal bottom actions, or sign/category mismatch rows that look normal.

Recommended minimum device frames:

- iOS: 6.7-inch portrait and 6.5-inch portrait
- Android: phone portrait, 1080 x 1920 or larger

## Data Safety Notes

- Account creation/sign-in: email and password via Supabase Auth
- Financial info: user-entered transactions, budgets, categories
- Location: optional, user-controlled
- Audio: microphone is used only for voice input
- Notifications: used for reminders
- Biometrics: used locally by the operating system; biometric data is not stored
  by BataVasa
- Analytics: privacy-safe allow-listed events only

## H18 Remaining Manual Steps

- Capture production screenshots on real device or emulator.
- Confirm privacy policy URL is reachable from a public browser.
- Fill App Store Connect / Google Play Console metadata using this file.
- Build production binaries with EAS.
