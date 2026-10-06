import java.util.Properties
import org.gradle.api.artifacts.dsl.LockMode

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// FCM hanya aktif bila google-services.json asli ditaruh owner di android/app/ (tidak pernah di repo).
val fcmAktif = file("google-services.json").isFile
if (fcmAktif) apply(plugin = "com.google.gms.google-services")

// Rahasia rilis: env-file + keystore DI LUAR repo, di-mount baca saja oleh apk/bangun.sh rilis.
// (Properties.load: hindari karakter '\' di sandi.)
val rahasiaRilis: Properties? = System.getenv("PADEV_RILIS_ENV")
    ?.let { file(it) }?.takeIf { it.isFile }
    ?.let { f -> Properties().apply { f.inputStream().use { load(it) } } }
val keystoreRilis: File? = System.getenv("PADEV_RILIS_KEYSTORE")?.let { file(it) }?.takeIf { it.isFile }
val rilisSiap = rahasiaRilis != null && keystoreRilis != null &&
    listOf("PADEV_KEYSTORE_SANDI", "PADEV_KUNCI_ALIAS", "PADEV_KUNCI_SANDI")
        .all { !rahasiaRilis.getProperty(it).isNullOrEmpty() }

android {
    namespace = "pro.padeveloper.studio"
    compileSdk = flutter.compileSdkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "pro.padeveloper.studio"
        minSdk = 30
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        buildConfigField("String", "RELAY_URL", "\"https://padev-studio.pa-developer.pro/api/v1/\"")
        buildConfigField("boolean", "FCM_AKTIF", fcmAktif.toString())
        // SEC-86 (KONTRAK §9 K7): penanda build sendiri untuk gerbang native (metode uji*, FLAG_SECURE mati, QR tanpa pin
        // RELAY_URL). Hanya build debug yang longgar; profile (demo) dan rilis ketat. Bukan BuildConfig.DEBUG.
        buildConfigField("boolean", "PENGEMBANGAN", "false")
        // K-07 (KONTRAK-apk-v2 §6.3): cermin sesi nyata (perintah cermin_*, kabar cermin*, cache riwayat) HANYA di build rilis;
        // debug & profile (demo) memakai data contoh. Penanda build sendiri, bukan BuildConfig.DEBUG (SEC-86).
        buildConfigField("boolean", "CERMIN_NYATA", "false")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (rilisSiap) {
            create("rilis") {
                storeFile = keystoreRilis
                storePassword = rahasiaRilis!!.getProperty("PADEV_KEYSTORE_SANDI")
                keyAlias = rahasiaRilis.getProperty("PADEV_KUNCI_ALIAS")
                keyPassword = rahasiaRilis.getProperty("PADEV_KUNCI_SANDI")
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        getByName("debug") {
            buildConfigField("boolean", "PENGEMBANGAN", "true")
        }
        // Flutter membuat profile dengan initWith(debug) → bawaannya debuggable. SEC-86: profile = APK demo, TIDAK debuggable
        // (run-as/debugger tidak bisa membaca token/kunci); tetap bertanda tangan kunci debug agar adb install jalan.
        getByName("profile") {
            isDebuggable = false
            buildConfigField("boolean", "PENGEMBANGAN", "false")
        }
        release {
            buildConfigField("boolean", "CERMIN_NYATA", "true")
            // Tanpa keystore owner tidak ada fallback ke kunci debug (lihat pemeriksaan taskGraph di bawah).
            signingConfig = if (rilisSiap) signingConfigs.getByName("rilis") else null
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    testOptions {
        unitTests.all {
            it.systemProperty("padev.kontrak", rootProject.file("../kontrak").absolutePath)
            it.systemProperty("padev.keluaran", rootProject.file("../build/uji-kotlin").absolutePath)
            it.testLogging { events("failed", "skipped"); showStandardStreams = true }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// SEC-78: semua konfigurasi (debug, profile, release, unit test) dipin; STRICT = konfigurasi tanpa status kunci GAGAL,
// bukan di-resolve bebas. Lock ditulis ulang hanya lewat `apk/bangun.sh kunci-dep`.
dependencyLocking {
    lockAllConfigurations()
    lockMode.set(LockMode.STRICT)
}

dependencies {
    implementation("com.google.crypto.tink:tink-android:1.23.0")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("com.google.firebase:firebase-messaging:25.1.3")
    // Pemindai QR pemasangan offline (SEC-77): CameraX + ZXing core, tanpa ML Kit/Play Services/telemetri.
    implementation("androidx.camera:camera-camera2:1.6.1")
    implementation("androidx.camera:camera-lifecycle:1.6.1")
    implementation("androidx.camera:camera-view:1.6.1")
    implementation("com.google.zxing:core:3.5.3")
    testImplementation("junit:junit:4.13.2")
}

// Hanya untuk `apk/bangun.sh kunci-dep`: build rilis TANPA tanda tangan (tidak bisa dipasang, tidak disalin ke keluaran)
// agar dependensi konfigurasi rilis ikut dikunci tanpa keystore owner (SEC-78).
val rilisTanpaTanda = providers.gradleProperty("padevRilisTanpaTanda").orNull == "true"

gradle.taskGraph.whenReady {
    val rilisDiminta = allTasks.any { t ->
        t.project == project && Regex("^(assemble|bundle|package)Release$").matches(t.name)
    }
    if (rilisDiminta && !rilisSiap && !rilisTanpaTanda) {
        throw GradleException(
            "Build rilis butuh keystore owner di luar repo: jalankan lewat apk/bangun.sh rilis " +
                "(PADEV_RILIS_ENV + PADEV_RILIS_KEYSTORE). Tidak ada fallback ke kunci debug."
        )
    }
}

// REV-52: profile (demo) tidak debuggable (SEC-86) sehingga AGP memasang lintVital ke assembleProfile — kerja tambahan di build
// harian (emulasi) dan konfigurasi profileLintChecksClasspath. Sumber kode sama dengan rilis; lintVitalAnalyzeRelease tetap
// berjalan di build rilis, jadi pemeriksaan fatal tidak hilang dari jalur rilis.
tasks.configureEach {
    if (name.startsWith("lintVital") && name.endsWith("Profile")) enabled = false
}
