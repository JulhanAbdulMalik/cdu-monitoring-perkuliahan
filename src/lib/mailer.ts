// src/lib/mailer.ts
// Modul Pengiriman Email Resmi Quality Assurance Unit (QAU) Nusa Putra University
// Menggunakan Nodemailer dengan Attachment PDF Rapor Dosen

import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export function getMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      "Konfigurasi SMTP belum lengkap di file .env (SMTP_USER dan SMTP_PASS)"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export interface SendRaporEmailPayload {
  toEmail: string;
  dosenNama: string;
  prodiNama: string;
  tahunAkademik: string;
  periode: string;
  kehadiranStr: string;
  kontenStr: string;
  kuesionerStr: string;
  nilaiAkhirStr: string;
  predikatStr: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export async function sendRaporDosenEmail(payload: SendRaporEmailPayload) {
  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM ||
    `Quality Assurance Unit - Nusa Putra University <${process.env.SMTP_USER}>`;

  const subject = `Lembar Evaluasi & Rapor Mutu Tridharma Dosen - ${payload.dosenNama} - Semester ${payload.tahunAkademik} (${payload.periode})`;

  // Cek ketersediaan file Logo Nusa Putra untuk CID inline attachment
  const logoPath = path.join(process.cwd(), "public", "images", "logo-nusa-putra.png");
  const hasLogo = fs.existsSync(logoPath);

  // HTML Body Email: Bersih, Rapi, Jarak Enter Padat, Logo Nusa Putra, dan Font Rockwell
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.cdnfonts.com/css/rockwell');

    body {
      font-family: 'Rockwell', 'Rockwell Nova', 'DejaVu Serif', 'Cambria', Georgia, serif;
      color: #1e293b;
      line-height: 1.55;
      margin: 0;
      padding: 32px 16px;
      background-color: #f1f5f9;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header-banner {
      background: linear-gradient(135deg, #a80063 0%, #7d0049 100%);
      padding: 20px 22px;
      text-align: left;
      border-bottom: 3px solid #fbcfe8;
      color: #ffffff;
    }
    .header-institution {
      font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;
      font-size: 10.5px;
      font-weight: bold;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #fce7f3;
      margin-bottom: 2px;
    }
    .header-title {
      font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 0.3px;
      line-height: 1.25;
      color: #ffffff;
      margin-bottom: 3px;
    }
    .header-subtitle {
      font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;
      font-size: 11.5px;
      color: #fbcfe8;
    }
    .content-body {
      padding: 26px 28px;
      font-size: 13.5px;
    }
    p {
      margin: 0 0 11px 0;
      line-height: 1.55;
    }
    .summary-card {
      background: #fdf2f8;
      border: 1px solid #fbcfe8;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 16px 0;
    }
    .summary-title {
      font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;
      font-size: 12px;
      font-weight: bold;
      color: #a80063;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .table-info {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .table-info td {
      padding: 5.5px 0;
      vertical-align: middle;
    }
    .table-info td.label {
      color: #475569;
      width: 44%;
    }
    .table-info td.value {
      font-weight: bold;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: bold;
    }
    .badge-success {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-cdu {
      background: #fce7f3;
      color: #a80063;
      border: 1px solid #fbcfe8;
    }
    .footer {
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      margin-top: 18px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header Banner Profesional & Clean dengan Logo Nusa Putra Presisi -->
    <div class="header-banner">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
          ${
            hasLogo
              ? `
          <td valign="middle" align="left" style="width: 66px; min-width: 66px; vertical-align: middle; padding-right: 5px;">
            <div style="display: inline-block; width: 60px; height: 60px; min-width: 60px; max-width: 60px; min-height: 60px; max-height: 60px; background: #ffffff; border-radius: 9px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); text-align: center; vertical-align: middle; box-sizing: border-box; padding: 4px;">
              <img src="cid:logo-nusa-putra" alt="Logo Nusa Putra" width="52" height="52" style="display: block; margin: 0 auto; width: 52px; height: 52px; border: 0; outline: none; object-fit: contain;" />
            </div>
          </td>
          `
              : ""
          }
          <td valign="middle" align="left" style="vertical-align: middle; text-align: left;">
            <div class="header-institution">NUSA PUTRA UNIVERSITY</div>
            <div class="header-title">LEMBAR EVALUASI &amp; RAPOR MUTU TRIDHARMA DOSEN</div>
            <div class="header-subtitle">Semester ${payload.tahunAkademik} (${payload.periode}) &bull; Quality Assurance Unit (QAU)</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Isi Konten Email -->
    <div class="content-body">
      <p style="margin-top: 0;">Kepada Yth.<br><strong style="font-size: 14px; color: #0f172a;">${payload.dosenNama}</strong><br><span style="color: #475569;">Program Studi ${payload.prodiNama}</span><br><span style="color: #475569;">Nusa Putra University</span></p>

      <p>Dengan hormat,</p>
      <p>Bersama ini kami sampaikan hasil evaluasi kinerja pembelajaran dan pemenuhan tridharma perguruan tinggi Bapak/Ibu pada Semester <strong>${payload.tahunAkademik} (${payload.periode})</strong> yang telah diterbitkan secara resmi oleh Quality Assurance Unit (QAU).</p>

      <!-- Ringkasan Kinerja Mini -->
      <div class="summary-card">
        <div class="summary-title">Ringkasan Hasil Evaluasi</div>
        <table class="table-info">
          <tr>
            <td class="label">Kehadiran Mengajar</td>
            <td class="value">${payload.kehadiranStr}</td>
          </tr>
          <tr>
            <td class="label">Kelengkapan Konten LMS (3P)</td>
            <td class="value">${payload.kontenStr}</td>
          </tr>
          <tr>
            <td class="label">Evaluasi Kuesioner Mahasiswa</td>
            <td class="value">${payload.kuesionerStr}</td>
          </tr>
          <tr>
            <td class="label">Nilai Akhir Evaluasi</td>
            <td class="value"><span class="badge badge-cdu">${payload.nilaiAkhirStr} / 5.00</span></td>
          </tr>
          <tr>
            <td class="label">Predikat Mutu</td>
            <td class="value"><span class="badge badge-success">${payload.predikatStr}</span></td>
          </tr>
        </table>
      </div>

      <p style="margin-bottom: 8px;">Rincian lengkap evaluasi mutu pembelajaran, analisis masukan mahasiswa, serta catatan kriteria tridharma terlampir pada dokumen <strong>PDF</strong> di bawah ini.</p>

      <p style="margin-top: 0;">Bapak/Ibu dapat mengunduh dan menyimpan dokumen terlampir sebagai arsip portofolio kinerja akademik.</p>

      <div class="footer">
        <p style="margin: 0 0 6px 0;">Apabila terdapat hal yang memerlukan konfirmasi atau klarifikasi, Bapak/Ibu dapat menghubungi kami melalui email ini (<strong>spmi@nusaputra.ac.id</strong>).</p>
        <p style="margin: 12px 0 0 0; font-weight: bold; color: #1e293b; font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;">
          Quality Assurance Unit (QAU)<br>
          <span style="font-weight: normal; color: #64748b; font-family: 'Rockwell', 'Rockwell Nova', Georgia, serif;">Nusa Putra University</span>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const attachments: any[] = [
    {
      filename: payload.pdfFilename,
      content: payload.pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  if (hasLogo) {
    attachments.push({
      filename: "logo-nusa-putra.png",
      path: logoPath,
      cid: "logo-nusa-putra",
    });
  }

  const info = await transporter.sendMail({
    from,
    to: payload.toEmail,
    subject,
    html,
    attachments,
  });

  return info;
}
