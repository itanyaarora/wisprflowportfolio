// Cloudflare Pages sends whole video files even when the browser asks for a piece.
// iPhones need pieces (a "Range" request) to play and seek videos, so cut them out here.
// Only Apple devices use these /stream/ links; everyone else gets /assets/ straight (no request limit).
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/stream\//, "/assets/");
  const res = await env.ASSETS.fetch(new Request(url, { headers: request.headers }));
  const range = request.headers.get("Range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (res.status !== 200 || !m) {
    const out = new Response(res.body, res);
    out.headers.set("Accept-Ranges", "bytes");
    return out;
  }
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(start === 0 && end === size - 1 ? buf : buf.slice(start, end + 1), { status: 206, headers });
}
