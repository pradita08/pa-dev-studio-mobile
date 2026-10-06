# Image build APK PADEV Studio (dipakai apk/bangun.sh; tidak dijalankan sebagai layanan).
# Flutter stabil dipin versi + digest. linux/amd64 karena alat Android SDK Linux (aapt2, build-tools) hanya x86_64;
# di Mac Apple Silicon berjalan lewat emulasi Docker Desktop.
FROM --platform=linux/amd64 ghcr.io/cirruslabs/flutter:3.44.0@sha256:46691e311715845de03a3ba4753a475476936805b29431b1f00f1816981033f8

# Cache pub & Gradle di volume bernama (lihat bangun.sh). Daemon Gradle/Kotlin mati: container sekali pakai,
# memori Docker Desktop ±3,8 GB (batas heap ada di android/gradle.properties). Kotlin dikompilasi di dalam proses Gradle
# (juga untuk build plugin Flutter yang di-include) agar tidak ada daemon Kotlin terpisah (±900 MB).
ENV PUB_CACHE=/cache/pub \
    GRADLE_USER_HOME=/cache/gradle \
    GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=2 -Dorg.gradle.project.kotlin.compiler.execution.strategy=in-process -Dkotlin.compiler.execution.strategy=in-process" \
    FLUTTER_SUPPRESS_ANALYTICS=true \
    CI=true

RUN flutter config --no-analytics --no-cli-animations >/dev/null \
    && dart --disable-analytics >/dev/null \
    && git config --global --add safe.directory '*'

WORKDIR /proyek
