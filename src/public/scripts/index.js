document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('darkModeToggle');
  if (!toggleBtn) {
    console.error('El botón darkModeToggle no fue encontrado.');
    return;
  }

  let userOverride = false; // Para detectar si el usuario cambió el modo manualmente

  function updateButtonText() {
    if (document.body.classList.contains('dark')) {
      toggleBtn.textContent = 'Modo Claro';
    } else {
      toggleBtn.textContent = 'Modo Oscuro';
    }
  }

  toggleBtn.addEventListener('click', () => {
    userOverride = true;
    document.body.classList.toggle('dark');
    updateButtonText();
  });

  // Detectar tema del sistema
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applySystemTheme(e) {
    if (!userOverride) {
      if (typeof e.matches === 'boolean') {
        document.body.classList.toggle('dark', e.matches);
      } else {
        // En la carga, 'e' es un MediaQueryList, no un evento
        document.body.classList.toggle('dark', e.matches);
      }
      updateButtonText();
    }
  }

  // Aplicar al cargar
  applySystemTheme(prefersDark);

  // Escuchar cambios futuros en el sistema
  if (prefersDark.addEventListener) {
    prefersDark.addEventListener('change', applySystemTheme);
  } else if (prefersDark.addListener) {
    // Soporte para navegadores antiguos
    prefersDark.addListener(applySystemTheme);
  }
});
