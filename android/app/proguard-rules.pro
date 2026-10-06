# PADEV Studio — aturan R8 rilis (obfuscate aktif).
# Tanpa log di rilis (SEC-54: tidak ada isi ke Logcat).
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}
# Tink mengirim aturan konsumen sendiri; anotasi errorprone/jsr305 hanya saat kompilasi.
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
