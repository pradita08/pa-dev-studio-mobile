package pro.padeveloper.studio.kunci

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction

/** Nilai JSON null (membedakan "field bernilai null" dari "field tidak ada"). */
object JsonNull

class JsonSalah(pesan: String) : Exception(pesan)

/**
 * Parser JSON ketat (RFC 8259) tanpa dependensi: kunci ganda ditolak, kedalaman dibatasi, sisa teks ditolak.
 * Objek → LinkedHashMap<String, Any>, larik → List<Any>, bilangan bulat → Long, lainnya → Double,
 * string → String, true/false → Boolean, null → [JsonNull].
 */
object JsonKetat {
    private const val KEDALAMAN_MAKS = 32
    const val SAFE_MAKS = 9007199254740991L // 2^53 − 1

    fun utf8(b: ByteArray): String = try {
        Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(b)).toString()
    } catch (e: CharacterCodingException) {
        throw JsonSalah("UTF-8 tidak sah")
    }

    fun parse(teks: String): Any {
        val p = Pengurai(teks)
        p.spasi()
        val v = p.nilai(0)
        p.spasi()
        if (p.i != teks.length) throw JsonSalah("sisa teks setelah JSON")
        return v
    }

    @Suppress("UNCHECKED_CAST")
    fun objek(teks: String): Map<String, Any> =
        parse(teks) as? Map<String, Any> ?: throw JsonSalah("bukan objek JSON")

    private class Pengurai(val s: String) {
        var i = 0

        fun spasi() {
            while (i < s.length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++
        }

        fun nilai(d: Int): Any {
            if (d > KEDALAMAN_MAKS) throw JsonSalah("terlalu dalam")
            if (i >= s.length) throw JsonSalah("JSON terpotong")
            return when (s[i]) {
                '{' -> objek(d)
                '[' -> larik(d)
                '"' -> string()
                't' -> kata("true", true)
                'f' -> kata("false", false)
                'n' -> kata("null", JsonNull)
                else -> angka()
            }
        }

        private fun kata(k: String, v: Any): Any {
            if (!s.startsWith(k, i)) throw JsonSalah("token tidak dikenal")
            i += k.length
            return v
        }

        private fun objek(d: Int): Map<String, Any> {
            i++
            val m = LinkedHashMap<String, Any>()
            spasi()
            if (i < s.length && s[i] == '}') { i++; return m }
            while (true) {
                spasi()
                if (i >= s.length || s[i] != '"') throw JsonSalah("kunci objek harus string")
                val k = string()
                spasi()
                if (i >= s.length || s[i] != ':') throw JsonSalah("':' hilang")
                i++
                spasi()
                if (m.containsKey(k)) throw JsonSalah("kunci ganda")
                m[k] = nilai(d + 1)
                spasi()
                if (i >= s.length) throw JsonSalah("objek terpotong")
                if (s[i] == ',') { i++; continue }
                if (s[i] == '}') { i++; return m }
                throw JsonSalah("',' atau '}' hilang")
            }
        }

        private fun larik(d: Int): List<Any> {
            i++
            val l = ArrayList<Any>()
            spasi()
            if (i < s.length && s[i] == ']') { i++; return l }
            while (true) {
                spasi()
                l.add(nilai(d + 1))
                spasi()
                if (i >= s.length) throw JsonSalah("larik terpotong")
                if (s[i] == ',') { i++; continue }
                if (s[i] == ']') { i++; return l }
                throw JsonSalah("',' atau ']' hilang")
            }
        }

        private fun string(): String {
            i++
            val sb = StringBuilder()
            while (true) {
                if (i >= s.length) throw JsonSalah("string terpotong")
                val c = s[i++]
                when {
                    c == '"' -> return sb.toString()
                    c == '\\' -> {
                        if (i >= s.length) throw JsonSalah("escape terpotong")
                        when (val e = s[i++]) {
                            '"' -> sb.append('"'); '\\' -> sb.append('\\'); '/' -> sb.append('/')
                            'b' -> sb.append('\b'); 'f' -> sb.append('\u000c'); 'n' -> sb.append('\n')
                            'r' -> sb.append('\r'); 't' -> sb.append('\t')
                            'u' -> {
                                if (i + 4 > s.length) throw JsonSalah("escape \\u terpotong")
                                val h = s.substring(i, i + 4)
                                if (!h.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) throw JsonSalah("escape \\u salah")
                                sb.append(h.toInt(16).toChar())
                                i += 4
                            }
                            else -> throw JsonSalah("escape tidak sah: $e")
                        }
                    }
                    c < ' ' -> throw JsonSalah("karakter kontrol di string")
                    else -> sb.append(c)
                }
            }
        }

        private fun angka(): Any {
            val m = Regex("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?").matchAt(s, i)
                ?: throw JsonSalah("token tidak dikenal")
            val t = m.value
            i += t.length
            if (m.groups[2] == null && m.groups[3] == null) {
                t.toLongOrNull()?.let { return it }
            }
            val d = t.toDouble()
            if (d.isInfinite() || d.isNaN()) throw JsonSalah("angka di luar jangkauan")
            return d
        }
    }
}

/**
 * JCS — RFC 8785 (JSON Canonicalization Scheme). Kunci objek diurutkan per unit UTF-16, string di-escape seperti
 * ECMAScript JSON.stringify, angka diformat seperti Number.prototype.toString (−0 → "0").
 * Long di luar ±(2^53−1), NaN/Infinity, dan surrogate tunggal ditolak (gagal tertutup).
 */
object Jcs {
    fun teks(v: Any?): String = StringBuilder().also { tulis(it, v) }.toString()

    fun bytes(v: Any?): ByteArray = teks(v).toByteArray(Charsets.UTF_8)

    private fun tulis(sb: StringBuilder, v: Any?) {
        when (v) {
            null, JsonNull -> sb.append("null")
            is Boolean -> sb.append(if (v) "true" else "false")
            is String -> string(sb, v)
            is Int -> sb.append(v.toLong().toString())
            is Long -> {
                if (v > JsonKetat.SAFE_MAKS || v < -JsonKetat.SAFE_MAKS) throw JsonSalah("bilangan bulat di luar jangkauan aman")
                sb.append(v.toString())
            }
            is Double -> sb.append(angkaEs(v))
            is Map<*, *> -> {
                val kunci = v.keys.map { it as? String ?: throw JsonSalah("kunci objek harus string") }.sorted()
                sb.append('{')
                kunci.forEachIndexed { idx, k ->
                    if (idx > 0) sb.append(',')
                    string(sb, k)
                    sb.append(':')
                    tulis(sb, v[k])
                }
                sb.append('}')
            }
            is List<*> -> {
                sb.append('[')
                v.forEachIndexed { idx, x -> if (idx > 0) sb.append(','); tulis(sb, x) }
                sb.append(']')
            }
            else -> throw JsonSalah("tipe tidak didukung JCS: ${v::class.java.simpleName}")
        }
    }

    private fun string(sb: StringBuilder, s: String) {
        sb.append('"')
        var i = 0
        while (i < s.length) {
            val c = s[i]
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\b' -> sb.append("\\b")
                c == '\u000c' -> sb.append("\\f")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c < ' ' -> sb.append("\\u").append(String.format("%04x", c.code))
                Character.isHighSurrogate(c) -> {
                    if (i + 1 >= s.length || !Character.isLowSurrogate(s[i + 1])) throw JsonSalah("surrogate tunggal")
                    sb.append(c).append(s[i + 1])
                    i++
                }
                Character.isLowSurrogate(c) -> throw JsonSalah("surrogate tunggal")
                else -> sb.append(c)
            }
            i++
        }
        sb.append('"')
    }

    /** Number.prototype.toString (ECMA-262 §7.1.12.1) untuk double hingga. */
    fun angkaEs(d: Double): String {
        if (d.isNaN() || d.isInfinite()) throw JsonSalah("angka tidak hingga")
        if (d == 0.0) return "0"
        if (d < 0) return "-" + angkaEs(-d)
        val tepat = BigDecimal(d)
        var r: BigDecimal? = null
        for (p in 1..17) {
            val c = tepat.round(MathContext(p, RoundingMode.HALF_EVEN))
            if (c.toDouble() == d) { r = c; break }
        }
        val x = r ?: throw JsonSalah("angka tidak dapat diformat")
        val digitPenuh = x.unscaledValue().toString()
        val n = digitPenuh.length - x.scale() // nilai = 0.digit × 10^n
        val s = digitPenuh.trimEnd('0')
        val k = s.length
        return when {
            n in k..21 -> s + "0".repeat(n - k)
            n in 1..21 -> s.substring(0, n) + "." + s.substring(n)
            n in -5..0 -> "0." + "0".repeat(-n) + s
            else -> {
                val e = n - 1
                val tanda = if (e >= 0) "+" else "-"
                (if (k == 1) s else s.substring(0, 1) + "." + s.substring(1)) + "e" + tanda + kotlin.math.abs(e)
            }
        }
    }
}
