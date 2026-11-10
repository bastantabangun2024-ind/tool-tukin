// api/[...jalur].mjs — pintu masuk Vercel untuk SEMUA /api/*.
//
// Vercel memanggil fungsi ini dengan (req, res) bergaya Node, sama seperti
// server lokal, jadi isi handler tidak diduplikasi: app.mjs dipakai bersama.
//
// Batas waktu 60 detik (maksimal paket Hobby). Karena itu halaman admin
// mengirim file Drive SATU PER SATU, bukan seluruh folder dalam satu request.

import { handler } from '../app.mjs';

export const config = { maxDuration: 60 };

export default function (req, res) {
  return handler(req, res);
}
