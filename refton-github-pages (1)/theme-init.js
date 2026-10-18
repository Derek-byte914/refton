// Set saved palette before first paint. Missing preference uses the reference palette.
try { const theme=localStorage.getItem('tidefold-theme');if(['midnight','forest','light'].includes(theme))document.documentElement.dataset.theme=theme; } catch {}
