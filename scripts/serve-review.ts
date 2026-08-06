/* Serves the repository root so audio-review.html can reach public/audio/. */
const port = Number(process.env.PORT ?? 5210);
const root = new URL("../", import.meta.url).pathname;

Bun.serve({
  port,
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(root + (path === "/" ? "audio-review.html" : path.slice(1)));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});

console.log(`audio review → http://localhost:${port}/`);
