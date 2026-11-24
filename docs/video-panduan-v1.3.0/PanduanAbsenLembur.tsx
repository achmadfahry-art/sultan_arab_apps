import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FPS = 30;
const SCENES = [
  { id: 1, start: 0, duration: 315, vo: "absen-guide/vo_01.mp3" },
  { id: 2, start: 315, duration: 315, vo: "absen-guide/vo_02.mp3" },
  { id: 3, start: 630, duration: 456, vo: "absen-guide/vo_03.mp3" },
  { id: 4, start: 1086, duration: 255, vo: "absen-guide/vo_04.mp3" },
  { id: 5, start: 1341, duration: 414, vo: "absen-guide/vo_05.mp3" },
  { id: 6, start: 1755, duration: 414, vo: "absen-guide/vo_06.mp3" },
];
const TOTAL_FRAMES = 2169;

const COLORS = {
  maroon: "#870000",
  maroonDark: "#5A0000",
  gold: "#D97706",
  goldLight: "#F5CB23",
  cream: "#F7F4EC",
  ink: "#1E1B18",
  white: "#FFFFFF",
};

const SubtitleBar: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: 52,
        right: 52,
        background: "rgba(30, 27, 24, 0.90)",
        border: `2px solid ${COLORS.goldLight}`,
        borderRadius: 24,
        padding: "22px 28px",
        color: COLORS.white,
        fontSize: 33,
        lineHeight: 1.38,
        fontWeight: 700,
        textAlign: "center",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        boxShadow: "0 14px 32px rgba(0,0,0,0.35)",
        opacity,
      }}
    >
      {text}
    </div>
  );
};

const StepHeader: React.FC<{ badge: string; title: string }> = ({ badge, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const y = spring({ frame, fps, from: -30, to: 0, config: { damping: 14 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 66,
        left: 56,
        right: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        transform: `translateY(${y}px)`,
        opacity,
      }}
    >
      <div
        style={{
          background: COLORS.maroon,
          color: COLORS.goldLight,
          padding: "10px 26px",
          borderRadius: 999,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 1.2,
          fontFamily: "Segoe UI, system-ui, sans-serif",
          boxShadow: "0 6px 18px rgba(135,0,0,0.28)",
        }}
      >
        {badge}
      </div>
      <div
        style={{
          color: COLORS.ink,
          fontSize: 46,
          fontWeight: 900,
          textAlign: "center",
          lineHeight: 1.18,
          fontFamily: "Segoe UI, system-ui, sans-serif",
        }}
      >
        {title}
      </div>
    </div>
  );
};

const PhoneMockup: React.FC<{
  src: string;
  tapX?: number;
  tapY?: number;
  tapDelay?: number;
  zoom?: number;
  top?: number;
  height?: number;
}> = ({ src, tapX, tapY, tapDelay = 30, zoom = 1, top = 285, height = 1140 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterScale = spring({ frame, fps, from: 0.92, to: 1, config: { damping: 14 } });
  const pulse =
    frame >= tapDelay
      ? 1 + 0.14 * Math.sin(((frame - tapDelay) / 10) * Math.PI)
      : 0;
  const width = Math.round(((height - 32) * 390) / 844) + 32;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: "50%",
        transform: `translateX(-50%) scale(${enterScale})`,
        width,
        height,
        borderRadius: 48,
        background: "#18181B",
        padding: 16,
        boxShadow: "0 30px 70px rgba(30,27,24,0.34), 0 0 0 4px #D4C5A9",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 34,
          overflow: "hidden",
          position: "relative",
          background: "#FFFFFF",
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "top center",
            transform: `scale(${zoom})`,
            transformOrigin: "center 55%",
          }}
        />
        {tapX !== undefined && tapY !== undefined && frame >= tapDelay && (
          <div
            style={{
              position: "absolute",
              left: `${tapX}%`,
              top: `${tapY}%`,
              width: 78,
              height: 78,
              marginLeft: -39,
              marginTop: -39,
              borderRadius: "50%",
              border: `6px solid ${COLORS.goldLight}`,
              background: "rgba(217, 119, 6, 0.28)",
              boxShadow: "0 0 0 10px rgba(135, 0, 0, 0.25)",
              transform: `scale(${pulse})`,
            }}
          />
        )}
      </div>
    </div>
  );
};

const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, from: 0.6, to: 1, config: { damping: 12 } });
  const titleY = spring({ frame: Math.max(0, frame - 8), fps, from: 40, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${COLORS.maroon} 0%, ${COLORS.maroonDark} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 64,
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 230,
          height: 230,
          borderRadius: "50%",
          overflow: "hidden",
          border: `8px solid ${COLORS.goldLight}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          transform: `scale(${logoScale})`,
          marginBottom: 42,
        }}
      >
        <Img src={staticFile("absen-guide/logo_sultan_arab.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          background: COLORS.goldLight,
          color: COLORS.maroonDark,
          padding: "12px 32px",
          borderRadius: 999,
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 1.5,
          marginBottom: 28,
        }}
      >
        UPDATE APLIKASI ABSENSI v1.3
      </div>
      <div
        style={{
          color: COLORS.white,
          fontSize: 66,
          fontWeight: 900,
          textAlign: "center",
          lineHeight: 1.15,
          transform: `translateY(${titleY}px)`,
          marginBottom: 24,
        }}
      >
        Panduan Absen &amp;{"\n"}Fitur Lembur Baru
      </div>
      <div
        style={{
          color: "#FDE68A",
          fontSize: 34,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 140,
        }}
      >
        absen.sultanarab.store
      </div>
      <SubtitleBar text="Halo tim Sultan Arab! Mulai besok ada pembaruan di aplikasi absensi kita, khususnya untuk pencatatan lembur." />
    </AbsoluteFill>
  );
};

const Scene5Tarif: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rates = [
    { jam: "1 JAM", rp: "Rp 15.000", delay: 45 },
    { jam: "2 JAM", rp: "Rp 30.000", delay: 80 },
    { jam: "3 JAM", rp: "Rp 50.000", delay: 115 },
    { jam: "4 JAM", rp: "Rp 65.000", delay: 155 },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.cream, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
      <StepHeader badge="LANGKAH 4 • TARIF LEMBUR" title="Pilih Durasi 1–4 Jam & Isi Keterangan" />
      <PhoneMockup src="absen-guide/modal_lembur.png" tapX={50} tapY={67} tapDelay={20} top={275} height={1060} />
      <div
        style={{
          position: "absolute",
          bottom: 315,
          left: 56,
          right: 56,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {rates.map((r) => {
          const s = spring({ frame: Math.max(0, frame - r.delay), fps, from: 0.7, to: 1, config: { damping: 12 } });
          const op = interpolate(frame, [r.delay, r.delay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={r.jam}
              style={{
                background: COLORS.maroon,
                border: `3px solid ${COLORS.goldLight}`,
                borderRadius: 20,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 10px 24px rgba(135,0,0,0.28)",
                transform: `scale(${s})`,
                opacity: op,
              }}
            >
              <span style={{ color: COLORS.goldLight, fontSize: 30, fontWeight: 900 }}>{r.jam}</span>
              <span style={{ color: COLORS.white, fontSize: 32, fontWeight: 900 }}>{r.rp}</span>
            </div>
          );
        })}
      </div>
      <SubtitleBar text="Pilih durasi lembur: 1 jam Rp 15rb, 2 jam Rp 30rb, 3 jam Rp 50rb, atau 4 jam Rp 65rb. Isi keterangan, lalu Simpan." />
    </AbsoluteFill>
  );
};

const Scene6Rules: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rules = [
    { num: "1", title: "Maksimal 1x Input per Hari", desc: "Langsung tercatat & otomatis masuk hitungan Rekap Bulanan.", delay: 12 },
    { num: "2", title: "Khusus Hadir Toko", desc: "Tidak berlaku untuk Kunjungan Luar (cukup absen kunjungan luar).", delay: 75 },
    { num: "3", title: "Ada Salah Input?", desc: "Segera lapor ke Manager atau Owner untuk dikoreksi di Rekap.", delay: 150 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(165deg, ${COLORS.maroon} 0%, ${COLORS.maroonDark} 100%)`,
        padding: "120px 60px",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: COLORS.goldLight, fontSize: 30, fontWeight: 800, letterSpacing: 1.5, marginBottom: 14 }}>
        ATURAN PENTING LEMBUR
      </div>
      <div style={{ textAlign: "center", color: COLORS.white, fontSize: 54, fontWeight: 900, marginBottom: 60 }}>
        Hal yang Wajib Diingat
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {rules.map((r) => {
          const x = spring({ frame: Math.max(0, frame - r.delay), fps, from: -60, to: 0, config: { damping: 14 } });
          const op = interpolate(frame, [r.delay, r.delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={r.num}
              style={{
                background: COLORS.cream,
                borderRadius: 26,
                padding: "28px 30px",
                display: "flex",
                alignItems: "center",
                gap: 24,
                borderLeft: `12px solid ${COLORS.gold}`,
                boxShadow: "0 16px 36px rgba(0,0,0,0.3)",
                transform: `translateX(${x}px)`,
                opacity: op,
              }}
            >
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: "50%",
                  background: COLORS.maroon,
                  color: COLORS.goldLight,
                  fontSize: 38,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {r.num}
              </div>
              <div>
                <div style={{ color: COLORS.maroon, fontSize: 34, fontWeight: 900, marginBottom: 6 }}>{r.title}</div>
                <div style={{ color: COLORS.ink, fontSize: 27, fontWeight: 600, lineHeight: 1.35 }}>{r.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 70, display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <Img
          src={staticFile("absen-guide/logo_sultan_arab.jpg")}
          style={{ width: 92, height: 92, borderRadius: "50%", border: `4px solid ${COLORS.goldLight}`, objectFit: "cover" }}
        />
        <div>
          <div style={{ color: COLORS.white, fontSize: 36, fontWeight: 900 }}>SULTAN ARAB</div>
          <div style={{ color: "#FDE68A", fontSize: 26, fontWeight: 700 }}>absen.sultanarab.store</div>
        </div>
      </div>

      <SubtitleBar text="Lembur maks 1x/hari & bukan untuk kunjungan luar. Salah input? Lapor Manager/Owner. Semangat kerja tim Sultan Arab!" />
    </AbsoluteFill>
  );
};

export const PanduanAbsenLemburVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("absen-guide/bgm_soft.mp3")} volume={0.85} />
      {SCENES.map((s) => (
        <Sequence key={`vo-${s.id}`} from={s.start + 6} durationInFrames={s.duration - 6}>
          <Audio src={staticFile(s.vo)} volume={1.0} />
        </Sequence>
      ))}

      <Sequence from={SCENES[0].start} durationInFrames={SCENES[0].duration}>
        <Scene1Intro />
      </Sequence>

      <Sequence from={SCENES[1].start} durationInFrames={SCENES[1].duration}>
        <AbsoluteFill style={{ background: COLORS.cream }}>
          <StepHeader badge="LANGKAH 1 • ABSEN MASUK" title="Buka Beranda & Klik Absen Masuk" />
          <PhoneMockup src="absen-guide/home_belum_absen.png" tapX={50} tapY={56} tapDelay={85} />
          <SubtitleBar text="Buka absen.sultanarab.store di HP, login pakai akun masing-masing, lalu klik tombol merah Absen Masuk Sekarang." />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={SCENES[2].start} durationInFrames={SCENES[2].duration}>
        <AbsoluteFill style={{ background: COLORS.cream, fontFamily: "Segoe UI, system-ui, sans-serif" }}>
          <StepHeader badge="LANGKAH 2 • PILIH SHIFT & SELFIE" title="Pilih Tipe Hadir & Jadwal Shift" />
          <PhoneMockup src="absen-guide/form_absen.png" tapX={50} tapY={48} tapDelay={45} top={275} height={1050} />
          <div
            style={{
              position: "absolute",
              bottom: 310,
              left: 56,
              right: 56,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <div style={{ background: "#FFFFFF", border: `3px solid ${COLORS.gold}`, borderRadius: 18, padding: "14px 18px", fontSize: 25, fontWeight: 800, color: COLORS.ink, textAlign: "center" }}>
              ✓ Staff / Admin (08–17)
            </div>
            <div style={{ background: "#FFFFFF", border: `3px solid ${COLORS.gold}`, borderRadius: 18, padding: "14px 18px", fontSize: 25, fontWeight: 800, color: COLORS.ink, textAlign: "center" }}>
              ✓ Crew Pagi (08–17)
            </div>
            <div style={{ background: "#FFFFFF", border: `3px solid ${COLORS.gold}`, borderRadius: 18, padding: "14px 18px", fontSize: 25, fontWeight: 800, color: COLORS.ink, textAlign: "center" }}>
              ✓ Crew Siang (12–21)
            </div>
            <div style={{ background: COLORS.maroon, border: `3px solid ${COLORS.goldLight}`, borderRadius: 18, padding: "14px 18px", fontSize: 25, fontWeight: 900, color: COLORS.goldLight, textAlign: "center" }}>
              ✕ Shift Lembur Dihapus
            </div>
          </div>
          <SubtitleBar text="Pilih tipe hadir & shift (Staff, Crew Pagi, atau Crew Siang). Shift Lembur sudah tidak ada. Aktifkan GPS, selfie, lalu kirim." />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={SCENES[3].start} durationInFrames={SCENES[3].duration}>
        <AbsoluteFill style={{ background: COLORS.cream }}>
          <StepHeader badge="LANGKAH 3 • FITUR BARU" title="Klik Tombol Oranye Catat Lembur" />
          <PhoneMockup src="absen-guide/home_tombol_lembur.png" tapX={50} tapY={72} tapDelay={55} />
          <SubtitleBar text="Jika ada pekerjaan tambahan di tengah jam kerja, klik tombol oranye + Catat Lembur di Beranda setelah kamu absen masuk." />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={SCENES[4].start} durationInFrames={SCENES[4].duration}>
        <Scene5Tarif />
      </Sequence>

      <Sequence from={SCENES[5].start} durationInFrames={SCENES[5].duration}>
        <Scene6Rules />
      </Sequence>
    </AbsoluteFill>
  );
};

export const PanduanAbsenLemburRegistration: React.FC = () => (
  <Composition
    id="PanduanAbsenLembur"
    component={PanduanAbsenLemburVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
