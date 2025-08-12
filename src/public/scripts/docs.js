document.addEventListener('DOMContentLoaded', () => {
  function copy(id) {
    const code = document.getElementById(id)?.textContent;
    if (code === undefined) {
      alert('Elemento no encontrado para copiar.');
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      alert("Copiado al portapapeles");
    });
  }

  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  let userOverride = false;

  function updateToggleText() {
    if (!themeToggle) return;
    themeToggle.textContent = body.classList.contains('dark-mode') ? 'Modo Claro' : 'Modo Oscuro';
  }

  if (themeToggle) {
    // Init theme on page load
    (function initTheme() {
      try {
        const saved = localStorage.getItem('debug_theme');
        if (saved === 'dark-mode') {
          body.classList.add('dark-mode');
        } else if (saved === 'light') {
          body.classList.remove('dark-mode');
        } else {
          // No saved preference, apply system preference
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            body.classList.add('dark-mode');
          } else {
            body.classList.remove('dark-mode');
          }
        }
      } catch {
        // ignore localStorage errors
      }
      updateToggleText();
    })();

    // Toggle button click handler
    themeToggle.addEventListener('click', () => {
      userOverride = true;
      if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        try { localStorage.setItem('debug_theme', 'light'); } catch {}
      } else {
        body.classList.add('dark-mode');
        try { localStorage.setItem('debug_theme', 'dark-mode'); } catch {}
      }
      updateToggleText();
    });

    // Listen to system theme changes
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) {
        mq.addEventListener('change', e => {
          if (!userOverride) {
            if (e.matches) {
              body.classList.add('dark-mode');
            } else {
              body.classList.remove('dark-mode');
            }
            updateToggleText();
          }
        });
      } else if (mq.addListener) {
        mq.addListener(e => {
          if (!userOverride) {
            if (e.matches) {
              body.classList.add('dark-mode');
            } else {
              body.classList.remove('dark-mode');
            }
            updateToggleText();
          }
        });
      }
    }
  } else {
    console.error('El botón de toggle de tema (id="themeToggle") no fue encontrado.');
  }

  // Expose copy function globally if needed
  window.copy = copy;
});
