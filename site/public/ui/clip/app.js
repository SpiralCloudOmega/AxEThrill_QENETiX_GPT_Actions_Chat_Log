async function postTool(body){
  const res = await fetch('/tool', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  return await res.json();
}

const f = document.getElementById('f');
const out = document.getElementById('out');
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('url').value.trim();
  const tags = document.getElementById('tags').value.trim();
  if (!url) { out.textContent = 'Enter a URL'; return; }
  out.textContent = 'Scraping…';
  try{
    const body = { action:'scrape:url', url, save:true };
    if (tags) body.tags = tags.split(',').map(s=>s.trim()).filter(Boolean);
    const resp = await postTool(body);
    out.textContent = JSON.stringify(resp, null, 2);
  }catch(err){ out.textContent = String(err); }
});
