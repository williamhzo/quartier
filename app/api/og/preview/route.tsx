import { NextResponse } from "next/server";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OG Preview</title>
  <meta name="robots" content="noindex" />
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { background: #111; color: #eee; font-family: system-ui, sans-serif; padding: 24px 32px; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    h1 { font-size: 18px; font-weight: 600; }
    .controls { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #888; }
    .controls label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .controls button { font-size: 13px; padding: 4px 12px; border-radius: 6px; border: 1px solid #333; background: #222; color: #ccc; cursor: pointer; }
    .controls button:hover { border-color: #555; }
    .variants { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; }
    .variants button { font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #888; cursor: pointer; }
    .variants button.active { border-color: #666; background: #333; color: #fff; font-weight: 600; }
    .preview { width: 100%; max-width: 1200px; aspect-ratio: 1200/630; border-radius: 8px; overflow: hidden; border: 1px solid #333; background: #000; }
    .preview img { width: 100%; height: 100%; object-fit: contain; }
    .meta { margin-top: 12px; font-size: 12px; color: #555; display: flex; gap: 16px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>OG Image Preview</h1>
    <div class="controls">
      <label><input type="checkbox" id="auto" checked /> Auto-refresh (2s)</label>
      <button onclick="refresh()">Refresh (R)</button>
    </div>
  </div>
  <div class="variants" id="variants"></div>
  <div class="preview"><img id="img" /></div>
  <div class="meta">
    <span>1200 x 630</span>
    <span id="path"></span>
    <span>Arrow keys to navigate</span>
  </div>
  <script>
    const variants = [
      { label: 'Generic', src: '/api/og' },
      ...Array.from({ length: 20 }, (_, i) => ({
        label: (i + 1) + (i === 0 ? 'er' : 'e'),
        src: '/api/og/' + (i + 1),
      })),
    ];
    let selected = 0;
    const img = document.getElementById('img');
    const pathEl = document.getElementById('path');
    const container = document.getElementById('variants');
    const autoCheck = document.getElementById('auto');

    function renderButtons() {
      while (container.firstChild) container.removeChild(container.firstChild);
      variants.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.textContent = v.label;
        btn.className = i === selected ? 'active' : '';
        btn.onclick = () => { selected = i; renderButtons(); refresh(); };
        container.appendChild(btn);
      });
      pathEl.textContent = variants[selected].src;
    }

    function refresh() { img.src = variants[selected].src + '?t=' + Date.now(); }

    setInterval(() => { if (autoCheck.checked) refresh(); }, 2000);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) refresh();
      if (e.key === 'ArrowLeft') { selected = (selected - 1 + variants.length) % variants.length; renderButtons(); refresh(); }
      if (e.key === 'ArrowRight') { selected = (selected + 1) % variants.length; renderButtons(); refresh(); }
    });

    renderButtons();
    refresh();
  </script>
</body>
</html>`;

export function GET() {
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
