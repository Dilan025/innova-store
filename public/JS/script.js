// ══════════════════════════════════════════
//   MÓDULO: VALIDACIÓN DE FORMULARIOS
// ══════════════════════════════════════════
const VALIDADORES = {
  nombre: (v) => v.trim().length >= 3,
  correo: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  telefono: (v) => {
    const soloDigitos = v.replace(/[\s\-()]/g, '');
    return /^\d{7,9}$/.test(soloDigitos);
  },
  requerido: (v) => v.trim().length > 0,
  cantidadPositiva: (v) => v.trim() === '' || (Number(v) >= 1 && Number.isFinite(Number(v)))
};

function mostrarErrorCampo(input, mensaje) {
  input.classList.add('input-invalido');
  let err = input.nextElementSibling;
  if (!err || !err.classList.contains('error-msg')) {
    err = document.createElement('span');
    err.className = 'error-msg';
    input.insertAdjacentElement('afterend', err);
  }
  err.textContent = mensaje;
}

function limpiarErrorCampo(input) {
  input.classList.remove('input-invalido');
  const err = input.nextElementSibling;
  if (err && err.classList.contains('error-msg')) err.remove();
}

/**
 * Valida un campo con la función indicada. Muestra/oculta el mensaje de error.
 * Devuelve true si es válido.
 */
function validarCampo(input, validatorFn, mensaje) {
  if (!input) return true;
  const valido = validatorFn(input.value);
  if (valido) {
    limpiarErrorCampo(input);
  } else {
    mostrarErrorCampo(input, mensaje);
  }
  return valido;
}

/**
 * Conecta validación en tiempo real (blur + input) a un campo.
 */
function activarValidacionEnVivo(input, validatorFn, mensaje) {
  if (!input) return;
  input.addEventListener('blur', () => {
    if (input.value.trim() !== '' || input.required) validarCampo(input, validatorFn, mensaje);
  });
  input.addEventListener('input', () => {
    if (input.classList.contains('input-invalido')) validarCampo(input, validatorFn, mensaje);
  });
}

// ══════════════════════════════════════════
//   MÓDULO: NOTIFICACIONES (reemplaza los alert() del navegador)
//   MEJORA: los alert() bloquean toda la página y se ven anticuados. Este
//   mostrarToast() muestra el mismo mensaje como una tarjeta flotante que
//   desaparece sola, sin interrumpir al usuario.
// ══════════════════════════════════════════
function obtenerContenedorToasts() {
  let cont = document.getElementById('toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-container';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  return cont;
}

function mostrarToast(mensaje, tipoForzado) {
  const texto = String(mensaje);
  let tipo = tipoForzado;
  if (!tipo) {
    if (texto.includes('✅')) tipo = 'exito';
    else if (texto.includes('❌') || texto.includes('⚠️')) tipo = 'error';
    else tipo = 'info';
  }

  const cont = obtenerContenedorToasts();
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.setAttribute('role', 'status');
  toast.textContent = texto;
  cont.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4500);
}

// ══════════════════════════════════════════
//   MÓDULO: CONFIRMACIÓN VISUAL (reemplaza el confirm() del navegador)
//   MEJORA: el confirm() nativo se ve anticuado y no combina con el resto
//   del diseño. confirmarAccion() muestra un modal con el mismo estilo del
//   sitio y devuelve una Promise<boolean>, así que se usa como:
//   if (!(await confirmarAccion('¿Seguro?'))) return;
// ══════════════════════════════════════════
function confirmarAccion(mensaje, tituloBoton = 'Confirmar') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal" role="alertdialog" aria-modal="true">
        <p class="confirm-mensaje">${mensaje}</p>
        <div class="confirm-botones">
          <button type="button" class="auth-btn outline" data-accion="cancelar">Cancelar</button>
          <button type="button" class="auth-btn primary" data-accion="confirmar">${tituloBoton}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cerrar = (resultado) => {
      overlay.remove();
      resolve(resultado);
    };

    overlay.querySelector('[data-accion="confirmar"]').addEventListener('click', () => cerrar(true));
    overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', () => cerrar(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
  });
}

// ══════════════════════════════════════════
//   MÓDULO: MOSTRAR/OCULTAR CONTRASEÑA
//   Botón 👁️ junto a los campos de contraseña de login y registro.
// ══════════════════════════════════════════
document.querySelectorAll('.toggle-password').forEach((boton) => {
  boton.addEventListener('click', () => {
    const input = document.getElementById(boton.dataset.target);
    if (!input) return;
    const oculto = input.type === 'password';
    input.type = oculto ? 'text' : 'password';
    boton.textContent = oculto ? '🙈' : '👁️';
    boton.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

// ══════════════════════════════════════════
//   MÓDULO: CORREO SIN ESPACIOS ACCIDENTALES
//   MEJORA: si el correo se copia y pega con un espacio al final (algo muy
//   común), antes no se reconocía como el mismo correo registrado. Ahora se
//   recorta automáticamente apenas se pega o se sale del campo.
// ══════════════════════════════════════════
function activarLimpiezaDeCorreo(input) {
  if (!input) return;
  const limpiar = () => { input.value = input.value.trim(); };
  input.addEventListener('blur', limpiar);
  input.addEventListener('paste', () => setTimeout(limpiar, 0));
}
['login-user', 'reg-correo', 'pedido-correo', 'recuperar-correo'].forEach((id) => activarLimpiezaDeCorreo(document.getElementById(id)));

// ══════════════════════════════════════════
//   MÓDULO: AUTENTICACIÓN Y SESIONES
// ══════════════════════════════════════════
const pantallaAuth = document.getElementById('pantalla-auth');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const contenido = document.getElementById('contenido-principal');
const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');

/**
 * Verifica si hay una sesión activa en el LocalStorage al cargar la página
 */
function actualizarBotonAbrirCuenta() {
  const btn = document.getElementById('btn-abrir-cuenta-header');
  if (!btn) return;
  const haySesion = localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('token');
  btn.style.display = haySesion ? 'none' : '';
}

/**
 * El botón que antes solo decía "Cerrar Sesión" ahora cambia según el estado:
 * si no hay sesión, dice "Iniciar Sesión" y abre la pantalla de login;
 * si hay sesión, dice "Cerrar Sesión" y cierra sesión como antes.
 */
function actualizarBotonSesion() {
  const btn = document.getElementById('btn-logout-desktop');
  if (!btn) return;
  const haySesion = localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('token');
  btn.querySelector('span').textContent = haySesion ? 'Cerrar Sesión' : 'Iniciar Sesión';
}

/**
 * Muestra la pantalla de login/registro por encima del sitio (para cuando
 * un visitante sin cuenta intenta hacer un pedido o ver "Mis Pedidos").
 */
function mostrarPantallaAuth() {
  if (contenido) contenido.style.display = 'none';
  if (pantallaAuth) {
    pantallaAuth.style.display = 'flex';
    mostrarLogin();
  }
  window.scrollTo(0, 0);
}

function ocultarPantallaAuth() {
  if (pantallaAuth) pantallaAuth.style.display = 'none';
  if (contenido) contenido.style.display = 'flex';
}

function verificarSesion() {
  if (localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('token')) {
    ocultarPantallaAuth();
  }
  
  const savedUser = localStorage.getItem('savedUser');
  if (savedUser) {
    document.getElementById('login-user').value = savedUser;
    document.getElementById('remember-me').checked = true;
  }

  actualizarBotonAbrirCuenta();
  actualizarBotonSesion();
}
verificarSesion();

/**
 * Controladores de interfaz para cambiar entre Login, Registro y Recuperar Contraseña
 */
const formRecuperar = document.getElementById('form-recuperar');
const formRestablecer = document.getElementById('form-restablecer');
const authTabs = document.querySelector('.auth-tabs');

function mostrarLogin() {
  formRegistro.style.display = 'none';
  if (formRecuperar) formRecuperar.style.display = 'none';
  if (formRestablecer) formRestablecer.style.display = 'none';
  if (authTabs) authTabs.style.display = 'flex';
  formLogin.style.display = 'block';
  tabRegistro.classList.remove('active');
  tabLogin.classList.add('active');
}

function mostrarRegistro() {
  formLogin.style.display = 'none';
  if (formRecuperar) formRecuperar.style.display = 'none';
  if (formRestablecer) formRestablecer.style.display = 'none';
  if (authTabs) authTabs.style.display = 'flex';
  formRegistro.style.display = 'block';
  tabLogin.classList.remove('active');
  tabRegistro.classList.add('active');
}

function mostrarRecuperar() {
  formLogin.style.display = 'none';
  formRegistro.style.display = 'none';
  if (formRestablecer) formRestablecer.style.display = 'none';
  if (authTabs) authTabs.style.display = 'none';
  if (formRecuperar) formRecuperar.style.display = 'block';
}

function mostrarRestablecer() {
  formLogin.style.display = 'none';
  formRegistro.style.display = 'none';
  if (formRecuperar) formRecuperar.style.display = 'none';
  if (authTabs) authTabs.style.display = 'none';
  if (formRestablecer) formRestablecer.style.display = 'block';
}

if (tabLogin) tabLogin.addEventListener('click', mostrarLogin);
if (tabRegistro) tabRegistro.addEventListener('click', mostrarRegistro);
document.getElementById('btn-pasar-a-registro')?.addEventListener('click', mostrarRegistro);
document.getElementById('btn-pasar-a-login')?.addEventListener('click', mostrarLogin);
document.getElementById('link-olvide-password')?.addEventListener('click', (e) => {
  e.preventDefault();
  mostrarRecuperar();
});
document.getElementById('btn-cancelar-recuperar')?.addEventListener('click', mostrarLogin);

// ══════════════════════════════════════════
//   MÓDULO: RECUPERAR / RESTABLECER CONTRASEÑA
// ══════════════════════════════════════════
formRecuperar?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const correoEl = document.getElementById('recuperar-correo');
  const correo = correoEl.value.trim();
  if (!validarCampo(correoEl, VALIDADORES.correo, 'Ingresa un correo electrónico válido.')) return;

  const btn = e.target.querySelector('button[type="submit"]');
  const txtOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/recuperar-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo })
    });
    const data = await res.json();
    mostrarToast((data.mensaje || data.error || 'Solicitud enviada.'), res.ok ? 'exito' : 'error');
    if (res.ok) {
      if (data.enlace_fallback) {
        let div = document.getElementById('fallback-link-box');
        if (!div) {
          div = document.createElement('div');
          div.id = 'fallback-link-box';
          div.style.marginTop = '15px';
          div.style.padding = '15px';
          div.style.backgroundColor = '#fff4e5';
          div.style.border = '1px solid #ff9800';
          div.style.borderRadius = '8px';
          formRecuperar.appendChild(div);
        }
        div.innerHTML = `<p style="color:#e65100;margin-bottom:8px;"><b>¡Render bloqueó el correo!</b></p>
        <p style="font-size:0.9rem;margin-bottom:8px;">El hosting gratuito impidió la salida del correo. Haz clic en este enlace seguro para continuar con el restablecimiento de tu contraseña (o cópialo):</p>
        <a href="${data.enlace_fallback}" style="word-break:break-all;color:#1a73e8;text-decoration:underline;font-weight:bold;">${data.enlace_fallback}</a>`;
        return; // Evita hacer reset o cambiar de vista para que el usuario pueda hacer clic
      }
      formRecuperar.reset();
      mostrarLogin();
    }
  } catch (err) {
    mostrarToast('❌ Error de conexión al solicitar la recuperación.');
  } finally {
    btn.disabled = false;
    btn.textContent = txtOriginal;
  }
});

formRestablecer?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const passEl = document.getElementById('restablecer-pass');
  const confirmarEl = document.getElementById('restablecer-pass-confirmar');

  if (passEl.value.length < 6) {
    return mostrarToast('❌ La contraseña debe tener al menos 6 caracteres.');
  }
  if (passEl.value !== confirmarEl.value) {
    return mostrarToast('❌ Las contraseñas no coinciden.');
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('resetToken');
  if (!token) return mostrarToast('❌ Enlace inválido. Solicita uno nuevo.');

  try {
    const res = await fetch('/api/restablecer-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, nuevaPassword: passEl.value })
    });
    const data = await res.json();
    mostrarToast((data.mensaje || data.error || 'Ocurrió un error.'), res.ok ? 'exito' : 'error');
    if (res.ok) {
      // Limpiamos el token de la URL para que no se reutilice por accidente
      window.history.replaceState({}, '', window.location.pathname);
      formRestablecer.reset();
      mostrarLogin();
    }
  } catch (err) {
    mostrarToast('❌ Error de conexión al restablecer la contraseña.');
  }
});

// Si el usuario llega desde el enlace del correo (?resetToken=...), abrimos
// directamente el formulario de nueva contraseña (encima de todo, aunque
// tenga una sesión iniciada).
(function revisarEnlaceDeRecuperacion() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('resetToken')) {
    if (contenido) contenido.style.display = 'none';
    if (pantallaAuth) pantallaAuth.style.display = 'flex';
    mostrarRestablecer();
  }
})();

/**
 * Envía los datos de registro al servidor
 */
async function manejarRegistro(e) {
  e.preventDefault();

  const nombreEl = document.getElementById('reg-nombre');
  const correoEl = document.getElementById('reg-correo');
  const telefonoEl = document.getElementById('reg-telefono');
  const passEl = document.getElementById('reg-pass');

  const nombreOk = validarCampo(nombreEl, VALIDADORES.nombre, 'Ingresa tu nombre completo (mín. 3 caracteres).');
  const correoOk = validarCampo(correoEl, VALIDADORES.correo, 'Ingresa un correo electrónico válido.');
  const telefonoOk = validarCampo(telefonoEl, VALIDADORES.telefono, 'Ingresa un número de teléfono válido (7 a 9 dígitos).');
  const passOk = validarCampo(passEl, (v) => v.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');

  if (!nombreOk || !correoOk || !telefonoOk || !passOk) {
    const primerInvalido = [nombreEl, correoEl, telefonoEl, passEl].find(el => el.classList.contains('input-invalido'));
    primerInvalido?.focus();
    return;
  }

  const nombre = nombreEl.value.trim();
  const correo = correoEl.value.trim();
  const telefono = telefonoEl.value.trim();
  const password = passEl.value;

  try {
    const response = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, telefono, password })
    });

    const data = await response.json();

    if (response.ok) {
      mostrarToast('✅ Registro exitoso. Ahora puedes iniciar sesión.');
      document.getElementById('form-registro').reset();
      mostrarLogin();
    } else {
      mostrarToast('❌ Error: ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarToast('❌ Error conectando con el servidor.');
  }
}

activarValidacionEnVivo(document.getElementById('reg-nombre'), VALIDADORES.nombre, 'Ingresa tu nombre completo (mín. 3 caracteres).');
activarValidacionEnVivo(document.getElementById('reg-correo'), VALIDADORES.correo, 'Ingresa un correo electrónico válido.');
activarValidacionEnVivo(document.getElementById('reg-telefono'), VALIDADORES.telefono, 'Ingresa un número de teléfono válido (7 a 9 dígitos).');
activarValidacionEnVivo(document.getElementById('reg-pass'), (v) => v.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');

/**
 * Verifica las credenciales en el servidor y crea la sesión
 */
async function manejarLogin(e) {
  e.preventDefault();
  
  const correo = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userData', JSON.stringify(data.userData));
      localStorage.setItem('isLoggedIn', 'true');
      
      if (pantallaAuth) pantallaAuth.style.display = 'none';
      if (contenido) contenido.style.display = 'flex';
      actualizarBotonAbrirCuenta();
      actualizarBotonSesion();
      irAVista(data.userData?.rol === 'admin' ? 'vista-admin' : 'vista-inicio');
      window.scrollTo(0, 0);
      
      document.getElementById('form-login').reset();
    } else {
      mostrarToast('❌ ' + data.error);
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarToast('❌ Error conectando con el servidor.');
  }
}

if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);
if (formLogin) formLogin.addEventListener('submit', manejarLogin);

/**
 * Elimina la sesión activa y devuelve al usuario al login
 */
function hacerLogout(e) {
  e.preventDefault();
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('token');
  localStorage.removeItem('userData');

  // Limpiar datos de sesión anterior para que el próximo usuario no vea información ajena
  const nom = document.getElementById('pedido-nombre');
  const tel = document.getElementById('pedido-telefono');
  const cor = document.getElementById('pedido-correo');
  if (nom) nom.value = '';
  if (tel) tel.value = '';
  if (cor) cor.value = '';

  const formPedido = document.getElementById('form-pedido');
  if (formPedido) formPedido.reset();

  vaciarCarrito();

  const tablaMisPedidos = document.getElementById('tabla-mis-pedidos');
  if (tablaMisPedidos) tablaMisPedidos.innerHTML = '';
  const tablaAdminPendientes = document.getElementById('tabla-admin-pendientes');
  if (tablaAdminPendientes) tablaAdminPendientes.innerHTML = '';
  const tablaAdminEntregados = document.getElementById('tabla-admin-entregados');
  if (tablaAdminEntregados) tablaAdminEntregados.innerHTML = '';

  ocultarPantallaAuth();
  irAVista('vista-inicio');
  actualizarBotonAbrirCuenta();
  actualizarBotonSesion();
  document.getElementById('menu-movil')?.classList.remove('abierto');
}

document.getElementById('btn-cerrar-auth')?.addEventListener('click', (e) => {
  e.preventDefault();
  ocultarPantallaAuth();
  irAVista('vista-inicio');
});

document.getElementById('btn-logout-desktop')?.addEventListener('click', (e) => {
  const haySesion = localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('token');
  if (haySesion) {
    hacerLogout(e);
  } else {
    mostrarPantallaAuth();
  }
});
document.getElementById('btn-logout-movil')?.addEventListener('click', hacerLogout);

// ══════════════════════════════════════════
//   MÓDULO: NAVEGACIÓN Y VISTAS (SPA)
// ══════════════════════════════════════════

// Vistas que pertenecen EXCLUSIVAMENTE al flujo de compra del Cliente.
// El Administrador no realiza pedidos: su rol es únicamente administrar el sistema.
const VISTAS_SOLO_CLIENTE = ['vista-pedido', 'vista-detalle-producto', 'vista-mis-pedidos'];

// Vistas que pertenecen EXCLUSIVAMENTE al Panel de Administración.
const VISTAS_SOLO_ADMIN = ['vista-admin'];

function obtenerUsuarioActual() {
  return JSON.parse(localStorage.getItem('userData') || '{}');
}

function esAdministrador() {
  return obtenerUsuarioActual().rol === 'admin';
}

function irAVista(id) {
  const userData = obtenerUsuarioActual();
  const esAdmin = esAdministrador();
  const haySesion = localStorage.getItem('isLoggedIn') === 'true' && localStorage.getItem('token');

  // Pedir inicio de sesión solo cuando el visitante quiere hacer un pedido
  // o ver su historial — el resto del sitio (Inicio, Productos, Catálogos,
  // Nosotros, Contacto) es de libre acceso sin necesidad de cuenta.
  if (!haySesion && (id === 'vista-pedido' || id === 'vista-mis-pedidos')) {
    mostrarPantallaAuth();
    return;
  }

  // Guardia de acceso: el Administrador no puede entrar a vistas de compra/pedido,
  // y un Cliente no puede entrar al Panel de Administración.
  if (esAdmin && VISTAS_SOLO_CLIENTE.includes(id)) {
    id = 'vista-admin';
  } else if (!esAdmin && VISTAS_SOLO_ADMIN.includes(id)) {
    id = 'vista-inicio';
  }

  document.querySelectorAll('.vista').forEach(v => v.classList.remove('vista-activa'));
  const vista = document.getElementById(id);
  if (vista) vista.classList.add('vista-activa');

  const titulosPorVista = {
    'vista-inicio': 'Innova SCAC - Diseño y Tecnología',
    'vista-detalle-producto': 'Artículos - Innova SCAC',
    'vista-catalogos': 'Categorías - Innova SCAC',
    'vista-pedido': 'Hacer Pedido - Innova SCAC',
    'vista-nosotros': 'Nosotros - Innova SCAC',
    'vista-contacto': 'Contacto - Innova SCAC',
    'vista-mis-pedidos': 'Mis Pedidos - Innova SCAC',
    'vista-admin': 'Panel Admin - Innova SCAC'
  };
  document.title = titulosPorVista[id] || 'Innova SCAC - Diseño y Tecnología';
  
  document.querySelectorAll('.nav-link, .nav-link-m').forEach(link => {
    link.classList.toggle('active', link.dataset.vista === id);
  });

  // ── Visibilidad de enlaces de navegación según el rol ──
  // Cliente: no ve "Panel Admin". Administrador: no ve "Mis Pedidos" ni el flujo de compra
  // (Categorías, Pedidos), ya que su función es exclusivamente administrar el sistema.
  document.querySelectorAll('[data-vista="vista-mis-pedidos"]').forEach(el => {
    el.style.display = (esAdmin || !userData.correo) ? 'none' : 'inline-block';
  });
  document.querySelectorAll('[data-vista="vista-admin"]').forEach(el => {
    el.style.display = esAdmin ? 'inline-block' : 'none';
  });
  document.querySelectorAll('[data-vista="vista-catalogos"], [data-vista="vista-pedido"]').forEach(el => {
    el.style.display = esAdmin ? 'none' : '';
  });
  document.querySelectorAll('.nav-link[data-vista="vista-inicio"], .nav-link-m[data-vista="vista-inicio"]').forEach(el => {
    el.style.display = esAdmin ? 'none' : '';
  });
  document.body.classList.toggle('modo-admin', esAdmin);

  if (id === 'vista-pedido' && userData.correo) {
    const nom = document.getElementById('pedido-nombre');
    const tel = document.getElementById('pedido-telefono');
    const cor = document.getElementById('pedido-correo');
    if (nom && !nom.value) nom.value = userData.nombre || '';
    if (tel && !tel.value) tel.value = userData.telefono || '';
    if (cor && !cor.value) cor.value = userData.correo || '';
  }

  if (id === 'vista-mis-pedidos') cargarMisPedidos();
  if (id === 'vista-admin') { setTimeout(() => { cargarKPIs(); cargarDashboardCharts(); }, 200); }
  if (id === 'vista-admin') inicializarPanelAdmin();
  // MEJORA: recarga las categorías/productos reales cada vez que se entra a
  // esta vista, para que una categoría recién creada en el admin aparezca
  // de inmediato sin tener que recargar toda la página.
  if (id === 'vista-catalogos' && typeof cargarCategoriasYProductos === 'function') cargarCategoriasYProductos();

  window.scrollTo({ top: 0, behavior: 'instant' });
}

// --- FUNCIONES PARA CONECTAR LAS TABLAS A LA BASE DE DATOS ---
async function cargarMisPedidos() {
  const token = localStorage.getItem('token');
  try {
    // Cargar puntos de lealtad
    fetch('/api/puntos', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json()).then(d => {
        const box = document.getElementById('puntos-lealtad-box');
        const val = document.getElementById('puntos-lealtad-valor');
        if (box) box.style.display = 'inline-block';
        if (val) val.textContent = d.puntos || 0;
      }).catch(() => {});

    const res = await fetch('/api/mis-pedidos', { headers: { 'Authorization': 'Bearer ' + token } });
    const pedidos = await res.json();
    window._misPedidosCache = pedidos;
    const tbody = document.getElementById('tabla-mis-pedidos');
    if (pedidos.length === 0) return tbody.innerHTML = '<tr><td colspan="7" class="tabla-vacia">No tienes pedidos registrados.</td></tr>';

    tbody.innerHTML = pedidos.map(p => {
      const detalleItems = (p.items && p.items.length > 0)
        ? p.items.map(i => `• ${i.cantidad}x ${i.nombre_producto}`).join('<br>')
        : p.detalles;
      const timeline = generarTimeline(p.estado);
      return `
      <tr>
        <td>#${p.id}</td>
        <td>${new Date(p.fecha).toLocaleDateString('es-PE')}</td>
        <td class="tabla-servicio">${p.servicio}${p.items && p.items.length > 1 ? ` <span class="badge-multi">${p.items.length} productos</span>` : ` (Cant: ${p.cantidad})`}</td>
        <td>${detalleItems}<br><small style="color:#aaa;">${timeline}</small></td>
        <td>${p.archivo ? `<a href="${p.archivo}" target="_blank" class="tabla-link-archivo">Ver 📄</a>` : '-'}</td>
        <td>${generarCeldaEstadoCliente(p)}</td>
        <td><button onclick="descargarRecibo(${p.id})" style="background:none;border:1.5px solid #ddd;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:0.8rem;" title="Descargar PDF">📥 PDF</button></td>
      </tr>`;
    }).join('');
  } catch (e) { console.error('Error cargando historial', e); }
}

function generarTimeline(estado) {
  const pasos = ['Pendiente', 'En producción', 'Enviado', 'Entregado'];
  const idx = pasos.findIndex(p => p === estado);
  return pasos.map((p, i) => {
    if (i < idx) return `<span style="color:#25d366;">✔ ${p}</span>`;
    if (i === idx) return `<span style="color:#ff6a00;font-weight:bold;">● ${p}</span>`;
    return `<span style="color:#ccc;">${p}</span>`;
  }).join(' → ');
}

function generarCeldaEstadoCliente(p) {
  if (p.estado === 'Confirmado') {
    return `<span class="estado-badge estado-badge--confirmado">✅ Recibido</span>`;
  }
  if (p.estado === 'Entregado') {
    return `<span class="estado-badge estado-badge--entregado">📦 Entregado</span>
      <button onclick="confirmarPedidoRecibido(${p.id})" class="btn-confirmar-recibido">Confirmar recibido</button>`;
  }
  return `<span class="estado-badge estado-badge--pendiente">⏳ Pendiente</span>`;
}

window.confirmarPedidoRecibido = async function(id) {
  if (!(await confirmarAccion('¿Confirmas que ya recibiste este pedido?'))) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/mis-pedidos/${id}/confirmar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    });
    cargarMisPedidos();
  } catch (e) {
    mostrarToast('Error de conexión al confirmar el pedido.');
  }
}

async function cargarHistorialPedidosAdmin() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/admin/pedidos', { headers: { 'Authorization': 'Bearer ' + token } });
    const pedidos = await res.json();
    
    const tbodyPendientes = document.getElementById('tabla-admin-pendientes');
    const tbodyEntregados = document.getElementById('tabla-admin-entregados');
    
    const pendientes = pedidos.filter(p => p.estado !== 'Entregado' && p.estado !== 'Confirmado');
    const entregados = pedidos.filter(p => p.estado === 'Entregado' || p.estado === 'Confirmado');
    
    if (pendientes.length === 0) {
      tbodyPendientes.innerHTML = '<tr><td colspan="5" style="padding:15px;text-align:center;">No hay pedidos pendientes.</td></tr>';
    } else {
      tbodyPendientes.innerHTML = pendientes.map(p => generarFilaAdmin(p, true)).join('');
    }

    if (entregados.length === 0) {
      tbodyEntregados.innerHTML = '<tr><td colspan="5" style="padding:15px;text-align:center;">El registro está vacío.</td></tr>';
    } else {
      tbodyEntregados.innerHTML = entregados.map(p => generarFilaAdmin(p, false)).join('');
    }

    return pedidos;
  } catch (e) {
    console.error('Error cargando historial', e);
    return [];
  }
}

function generarFilaAdmin(p, esPendiente) {
  const btnEstado = esPendiente 
    ? `<button onclick="cambiarEstadoPedido(${p.id}, 'Entregado')" style="background:#25d366; color:white; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; margin-bottom:5px; width:100%;">✔️ Entregado</button>`
    : `<button onclick="cambiarEstadoPedido(${p.id}, 'Pendiente')" style="background:#ff9900; color:white; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; margin-bottom:5px; width:100%;">↩️ Deshacer</button>`;

  const etiquetaConfirmado = p.estado === 'Confirmado'
    ? `<span style="display:inline-block; margin-bottom:6px; padding:3px 8px; border-radius:999px; background:rgba(26,26,46,0.08); color:#1a1a2e; font-size:0.72rem; font-weight:700;">✅ Confirmado por cliente</span><br>`
    : '';

  // MEJORA: mostrar desglose de ítems si el pedido tiene carrito multi-producto
  const detalleServicio = (p.items && p.items.length > 0)
    ? p.items.map(i => `${i.cantidad}x ${i.nombre_producto}`).join(', ')
    : `${p.servicio} (Cant: ${p.cantidad})`;

  return `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding:10px;"><b>#${p.id}</b><br><small>${new Date(p.fecha).toLocaleDateString()}</small></td>
      <td style="padding:10px;"><b>${p.nombre}</b><br><a href="mailto:${p.correo}">${p.correo}</a><br><a href="https://wa.me/51${p.telefono.replace(/\s+/g,'')}" target="_blank" style="color:#25d366; font-weight:bold;">WhatsApp 💬</a></td>
      <td style="padding:10px; color:#ff2d55; font-weight:bold;">${detalleServicio}<br><span style="color:#666; font-weight:normal; font-size:0.85rem;">${p.detalles}</span></td>
      <td style="padding:10px;">${p.archivo ? `<a href="${p.archivo}" target="_blank" style="background:#ffcd00; color:#333; padding:5px 10px; border-radius:5px; text-decoration:none; font-weight:bold;">Descargar</a>` : 'N/A'}</td>
      <td style="padding:10px; min-width: 130px;">
        ${etiquetaConfirmado}
        ${btnEstado}
        <button onclick="eliminarPedidoAdmin(${p.id})" style="background:#ff2d55; color:white; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; width:100%;">🗑️ Eliminar</button>
      </td>
    </tr>`;
}

window.cambiarEstadoPedido = async function(id, nuevoEstado) {
  if(!(await confirmarAccion(`¿Mover este pedido a ${nuevoEstado}?`))) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/admin/pedidos/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ estado: nuevoEstado })
    });
    cargarHistorialPedidosAdmin();
  } catch(e) { mostrarToast('Error de conexión'); }
}

window.eliminarPedidoAdmin = async function(id) {
  if(!(await confirmarAccion('¿Estás seguro de eliminar este pedido PERMANENTEMENTE? Esta acción no se puede deshacer.', 'Eliminar'))) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`/api/admin/pedidos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    cargarHistorialPedidosAdmin();
  } catch(e) { mostrarToast('Error de conexión'); }
}

// ══════════════════════════════════════════
//   MÓDULO: PANEL DE ADMINISTRACIÓN (Dashboard)
//   El Administrador solo administra el sistema:
//   Dashboard, Productos, Categorías, Clientes,
//   Historial de Pedidos, Reportes y Configuración.
//   NO tiene acceso a "Realizar Pedido" (función exclusiva del Cliente).
// ══════════════════════════════════════════
function tokenAdmin() {
  return localStorage.getItem('token');
}

/** Helper genérico de fetch con manejo de errores homogéneo para el panel admin */
async function fetchAdmin(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: { 'Authorization': 'Bearer ' + tokenAdmin(), ...(opciones.headers || {}) }
  });
  // CORRECCIÓN: antes, si el servidor respondía con error (ej. "stock máximo
  // alcanzado" o "no se puede tener stock negativo"), esta función lanzaba un
  // error genérico ANTES de leer el mensaje real que mandó el backend, así que
  // el usuario siempre veía "No se pudo actualizar el stock." sin saber por qué.
  // Ahora siempre leemos el JSON primero, y si viene un error, lo propagamos tal cual.
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const mensaje = (data && data.error) ? data.error : ('Respuesta no válida de ' + url);
    throw new Error(mensaje);
  }
  return data;
}

function mensajeTablaError(colspan, texto) {
  return `<tr><td colspan="${colspan}" class="tabla-vacia">${texto}</td></tr>`;
}

// ── Cambio de pestañas ──
const adminTabs = document.getElementById('admin-tabs');
adminTabs?.addEventListener('click', (e) => {
  const btn = e.target.closest('.admin-tab');
  if (!btn) return;
  activarTabAdmin(btn.dataset.adminTab);
});

function activarTabAdmin(tab) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b.dataset.adminTab === tab));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('admin-panel-activo', p.id === `admin-panel-${tab}`));

  if (tab === 'dashboard') cargarDashboardAdmin();
  if (tab === 'productos') cargarProductosAdmin();
  if (tab === 'categorias') cargarCategoriasAdmin();
  if (tab === 'clientes') cargarClientesAdmin();
  if (tab === 'pedidos') cargarHistorialPedidosAdmin();
  if (tab === 'reportes') cargarMovimientosStockAdmin();
  if (tab === 'configuracion') cargarConfiguracionAdmin();
}

// ── HISTORIAL DE MOVIMIENTOS DE STOCK ──
async function cargarMovimientosStockAdmin() {
  const tbody = document.getElementById('tabla-admin-movimientos-stock');
  if (!tbody) return;
  try {
    const movimientos = await fetchAdmin('/api/admin/movimientos-stock');
    if (movimientos.length === 0) {
      tbody.innerHTML = mensajeTablaError(6, 'Todavía no hay movimientos de stock registrados.');
      return;
    }
    tbody.innerHTML = movimientos.map(m => `
      <tr>
        <td>${new Date(m.fecha).toLocaleString('es-PE')}</td>
        <td>${m.producto_nombre || '(producto eliminado)'}</td>
        <td style="color:${m.cambio >= 0 ? '#1fb673' : '#e5304d'}; font-weight:700;">${m.cambio >= 0 ? '+' : ''}${m.cambio}</td>
        <td>${m.stock_resultante}</td>
        <td>${m.motivo || '-'}</td>
        <td>${m.usuario || '-'}</td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = mensajeTablaError(6, '⚠️ No se pudo cargar el historial de stock.');
  }
}

/** Se ejecuta cada vez que se entra a la vista Admin: siempre arranca en el Dashboard */
function inicializarPanelAdmin() {
  activarTabAdmin('dashboard');
}

// ── DASHBOARD: KPIs generales ──
async function cargarDashboardAdmin() {
  try {
    const pedidos = await fetchAdmin('/api/admin/pedidos');
    const pendientes = pedidos.filter(p => p.estado !== 'Entregado' && p.estado !== 'Confirmado');
    const entregados = pedidos.filter(p => p.estado === 'Entregado' || p.estado === 'Confirmado');
    document.getElementById('kpi-total-pedidos').textContent = pedidos.length;
    document.getElementById('kpi-pendientes').textContent = pendientes.length;
    document.getElementById('kpi-entregados').textContent = entregados.length;
  } catch (e) {
    ['kpi-total-pedidos', 'kpi-pendientes', 'kpi-entregados'].forEach(id => document.getElementById(id).textContent = '–');
  }

  try {
    const clientes = await fetchAdmin('/api/admin/clientes');
    document.getElementById('kpi-clientes').textContent = clientes.length;
  } catch (e) {
    document.getElementById('kpi-clientes').textContent = '–';
  }

  // NUEVO: contador de categorías en el Dashboard
  try {
    const categorias = await fetchAdmin('/api/admin/categorias');
    const kpiCats = document.getElementById('kpi-categorias');
    if (kpiCats) kpiCats.textContent = categorias.length;
  } catch (e) {
    const kpiCats = document.getElementById('kpi-categorias');
    if (kpiCats) kpiCats.textContent = '–';
  }

  try {
    const productos = await fetchAdmin('/api/admin/productos');
    document.getElementById('kpi-productos').textContent = productos.length;

    // MEJORA: alerta de stock bajo/agotado directo en el Dashboard.
    const UMBRAL_STOCK_BAJO = 5;
    const stockBajo = productos.filter(p => p.stock > 0 && p.stock < UMBRAL_STOCK_BAJO);
    const agotados = productos.filter(p => p.stock === 0);
    const kpiStockBajo = document.getElementById('kpi-stock-bajo');
    if (kpiStockBajo) {
      kpiStockBajo.textContent = stockBajo.length + agotados.length;
      if (agotados.length > 0) {
        kpiStockBajo.parentElement.title = `Agotados: ${agotados.map(p => p.nombre).join(', ')}`;
      }
    }
  } catch (e) {
    document.getElementById('kpi-productos').textContent = '–';
    const kpiStockBajo = document.getElementById('kpi-stock-bajo');
    if (kpiStockBajo) kpiStockBajo.textContent = '–';
  }
}

// ── PRODUCTOS: listar, agregar, editar, eliminar, actualizar stock ──
let categoriasCache = [];

async function cargarProductosAdmin() {
  const tbody = document.getElementById('tabla-admin-productos');
  try {
    const productos = await fetchAdmin('/api/admin/productos');
    if (productos.length === 0) {
      tbody.innerHTML = mensajeTablaError(6, 'No hay productos registrados todavía.');
      return;
    }
    tbody.innerHTML = productos.map(p => `
      <tr>
        <td>${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" class="admin-thumb">` : '<span class="admin-thumb admin-thumb--vacio">📦</span>'}</td>
        <td><b>${p.nombre}</b></td>
        <td>${p.categoria || '-'}</td>
        <td>S/ ${Number(p.precio).toFixed(2)}</td>
        <td>
          <span class="stock-valor" id="stock-${p.id}">${p.stock}</span>
          ${p.stock === 0 ? '<span class="badge-stock badge-stock--agotado">Agotado</span>' : (p.stock < 5 ? '<span class="badge-stock badge-stock--bajo">Stock bajo</span>' : '')}
          <button type="button" class="admin-mini-btn" onclick="ajustarStockProducto(${p.id}, -1)">−</button>
          <button type="button" class="admin-mini-btn" onclick="ajustarStockProducto(${p.id}, 1)">+</button>
        </td>
        <td>
          <button type="button" class="admin-mini-btn" onclick='editarProductoAdmin(${JSON.stringify(p)})'>✏️ Editar</button>
          <button type="button" class="admin-mini-btn admin-mini-btn--rojo" onclick="eliminarProductoAdmin(${p.id})">🗑️ Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = mensajeTablaError(6, '⚠️ No se pudo conectar con /api/admin/productos. Conecta el backend para gestionar productos.');
  }
}

async function cargarSelectCategorias() {
  const select = document.getElementById('producto-categoria');
  if (!select) return;
  try {
    categoriasCache = await fetchAdmin('/api/admin/categorias');
    select.innerHTML = '<option value="">Categoría</option>' + categoriasCache.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
  } catch (e) {
    select.innerHTML = '<option value="">(sin categorías disponibles)</option>';
  }
}

const formProducto = document.getElementById('form-producto');
document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => {
  formProducto.reset();
  document.getElementById('producto-id').value = '';
  cargarSelectCategorias();
  formProducto.style.display = 'grid';
});
document.getElementById('btn-cancelar-producto')?.addEventListener('click', () => {
  formProducto.style.display = 'none';
});

window.editarProductoAdmin = function(p) {
  document.getElementById('producto-id').value = p.id;
  document.getElementById('producto-nombre').value = p.nombre;
  document.getElementById('producto-precio').value = p.precio;
  document.getElementById('producto-stock').value = p.stock;
  const inputImagen = document.getElementById('producto-imagen');
  if (inputImagen) inputImagen.value = '';
  cargarSelectCategorias().then(() => {
    document.getElementById('producto-categoria').value = p.categoria || '';
  });
  formProducto.style.display = 'grid';
  formProducto.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

formProducto?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('producto-id').value;
  const payload = {
    nombre: document.getElementById('producto-nombre').value.trim(),
    categoria: document.getElementById('producto-categoria').value,
    precio: Number(document.getElementById('producto-precio').value),
    stock: Number(document.getElementById('producto-stock').value)
  };
  try {
    const url = id ? `/api/admin/productos/${id}` : '/api/admin/productos';
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tokenAdmin() 
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      mostrarToast('❌ Error: ' + (data.error || 'No se pudo guardar el producto'));
      return;
    }

    // NUEVO: si se eligió una foto, se sube por separado (necesitamos el ID
    // del producto, que recién existe después de guardarlo arriba).
    const archivoImagen = document.getElementById('producto-imagen')?.files[0];
    if (archivoImagen) {
      const productoId = id || data.id;
      const formImagen = new FormData();
      formImagen.append('imagen', archivoImagen);
      try {
        await fetchAdmin(`/api/admin/productos/${productoId}/imagen`, { method: 'POST', body: formImagen });
      } catch (errImagen) {
        mostrarToast('⚠️ El producto se guardó, pero la foto no se pudo subir: ' + errImagen.message);
      }
    }
    
    formProducto.style.display = 'none';
    cargarProductosAdmin();
  } catch (e) {
    console.error('Error guardando producto:', e);
    mostrarToast('⚠️ Error de conexión al guardar el producto: ' + e.message);
  }
});

window.ajustarStockProducto = async function(id, delta) {
    try {
        // Si fetchAdmin lanza error (400 con mensaje del backend, ej. stock
        // negativo o stock máximo alcanzado), cae directo al catch de abajo
        // con el mensaje real, así que ya no hace falta revisar response.error.
        await fetchAdmin(`/api/admin/productos/${id}/stock`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta })
        });
        // Refrescamos la tabla para ver el nuevo valor
        await cargarProductosAdmin();
    } catch (e) {
        mostrarToast('⚠️ ' + (e.message || 'No se pudo actualizar el stock.'));
    }
}

window.eliminarProductoAdmin = async function(id) {
  if (!(await confirmarAccion('¿Eliminar este producto permanentemente?', 'Eliminar'))) return;
  try {
    await fetchAdmin(`/api/admin/productos/${id}`, { method: 'DELETE' });
    cargarProductosAdmin();
  } catch (e) {
    mostrarToast('⚠️ No se pudo eliminar el producto.');
  }
}

// ── CATEGORÍAS: listar, agregar, eliminar, subir imagen, reordenar ──
async function cargarCategoriasAdmin() {
  const tbody = document.getElementById('tabla-admin-categorias');
  try {
    const categorias = await fetchAdmin('/api/admin/categorias');
    categoriasCache = categorias;
    if (categorias.length === 0) {
      tbody.innerHTML = mensajeTablaError(4, 'No hay categorías registradas todavía.');
      return;
    }
    tbody.innerHTML = categorias.map(c => `
      <tr>
        <td>
          ${c.imagen
            ? `<img src="${c.imagen}" alt="${c.nombre}" class="admin-thumb" style="border-radius:8px;">`
            : `<label class="admin-thumb admin-thumb--vacio" title="Subir foto de portada" style="cursor:pointer;" onclick="subirFotoCategoria(${c.id})">🖼️</label>`}
          <button type="button" class="admin-mini-btn" style="margin-top:4px;display:block;" onclick="subirFotoCategoria(${c.id})">📷 Foto</button>
        </td>
        <td><b>${c.nombre}</b></td>
        <td>
          <input type="number" min="0" class="orden-input" value="${c.orden || 0}" style="width:64px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:4px 6px;"
            onchange="actualizarOrdenCategoria(${c.id}, this.value)" title="Orden de aparición (menor = primero)">
        </td>
        <td><button type="button" class="admin-mini-btn admin-mini-btn--rojo" onclick="eliminarCategoriaAdmin(${c.id})">🗑️ Eliminar</button></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = mensajeTablaError(4, '⚠️ No se pudo conectar con /api/admin/categorias. Conecta el backend para gestionar categorías.');
  }
}

// NUEVO: input oculto para subir foto de categoría reutilizando el mismo sistema que productos.
let _inputFotoCategoria = null;
function subirFotoCategoria(id) {
  if (!_inputFotoCategoria) {
    _inputFotoCategoria = document.createElement('input');
    _inputFotoCategoria.type = 'file';
    _inputFotoCategoria.accept = 'image/*';
    _inputFotoCategoria.style.display = 'none';
    document.body.appendChild(_inputFotoCategoria);
  }
  _inputFotoCategoria.value = '';
  _inputFotoCategoria.onchange = async () => {
    const archivo = _inputFotoCategoria.files[0];
    if (!archivo) return;
    const formData = new FormData();
    formData.append('imagen', archivo);
    try {
      await fetchAdmin(`/api/admin/categorias/${id}/imagen`, { method: 'POST', body: formData });
      mostrarToast('✅ Foto de portada actualizada.');
      cargarCategoriasAdmin();
      cargarCategoriasYProductos(); // actualizar también la vista cliente
    } catch (err) {
      mostrarToast('⚠️ No se pudo subir la foto: ' + err.message);
    }
  };
  _inputFotoCategoria.click();
}
window.subirFotoCategoria = subirFotoCategoria;

// NUEVO: actualizar el orden manual de una categoría desde el panel admin.
window.actualizarOrdenCategoria = async function(id, valor) {
  try {
    await fetchAdmin(`/api/admin/categorias/${id}/orden`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: Number(valor) || 0 })
    });
    // Actualizar la vista de categorías del cliente también
    cargarCategoriasYProductos();
  } catch (e) {
    mostrarToast('⚠️ No se pudo guardar el orden.');
  }
};

document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('categoria-nombre');
  const nombre = input.value.trim();
  if (!nombre) return;
  try {
    await fetchAdmin('/api/admin/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });
    input.value = '';
    cargarCategoriasAdmin();
  } catch (e) {
    mostrarToast('⚠️ No se pudo guardar la categoría.');
  }
});

window.eliminarCategoriaAdmin = async function(id) {
  if (!(await confirmarAccion('¿Eliminar esta categoría?', 'Eliminar'))) return;
  try {
    await fetchAdmin(`/api/admin/categorias/${id}`, { method: 'DELETE' });
    cargarCategoriasAdmin();
  } catch (e) {
    // MEJORA: si el backend responde con un error 409 (tiene productos),
    // mostramos el mensaje exacto del servidor en vez de uno genérico.
    mostrarToast('⚠️ ' + (e.message || 'No se pudo eliminar la categoría.'));
  }
}

// ── CLIENTES: solo lectura ──
async function cargarClientesAdmin() {
  const tbody = document.getElementById('tabla-admin-clientes');
  try {
    const clientes = await fetchAdmin('/api/admin/clientes');
    if (clientes.length === 0) {
      tbody.innerHTML = mensajeTablaError(4, 'No hay clientes registrados todavía.');
      return;
    }
    tbody.innerHTML = clientes.map(c => `
      <tr>
        <td><b>${c.nombre}</b></td>
        <td><a href="mailto:${c.correo}">${c.correo}</a></td>
        <td>${c.telefono || '-'}</td>
        <td>${c.fechaRegistro ? new Date(c.fechaRegistro).toLocaleDateString() : '-'}</td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = mensajeTablaError(4, '⚠️ No se pudo conectar con /api/admin/clientes. Conecta el backend para ver los clientes registrados.');
  }
}

// ── REPORTES: exportar historial de pedidos a Excel (.xlsx) con formato ──
document.getElementById('btn-descargar-reporte')?.addEventListener('click', async () => {
  try {
    if (typeof ExcelJS === 'undefined') {
      mostrarToast('⚠️ No se pudo cargar la librería para generar el Excel (ExcelJS). Revisa que este dispositivo tenga conexión a internet y que nada esté bloqueando cdnjs.cloudflare.com (antivirus, firewall, extensión del navegador).');
      return;
    }

    const pedidos = await fetchAdmin('/api/admin/pedidos');
    if (!pedidos.length) return mostrarToast('No hay pedidos para incluir en el reporte.');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Innova SCAC';
    wb.created = new Date();

    const ws = wb.addWorksheet('Pedidos', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Cliente', key: 'nombre', width: 28 },
      { header: 'Correo', key: 'correo', width: 30 },
      { header: 'Servicio', key: 'servicio', width: 16 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Detalles', key: 'detalles', width: 55 },
      { header: 'Estado', key: 'estado', width: 16 }
    ];

    pedidos.forEach(p => {
      ws.addRow({
        id: p.id,
        fecha: new Date(p.fecha).toLocaleDateString(),
        nombre: p.nombre,
        correo: p.correo,
        servicio: p.servicio,
        cantidad: p.cantidad,
        detalles: p.detalles || '',
        estado: p.estado || 'Pendiente'
      });
    });

    // ── Estilo del encabezado ──
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB3261E' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
    headerRow.height = 22;

    // ── Estilo de las filas de datos ──
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
      if (rowNumber % 2 === 0) {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F0F0' } };
        });
      }
      row.getCell('detalles').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      // Eliminado row.height = 20 para permitir auto-ajuste de altura
    });

    ws.autoFilter = { from: 'A1', to: `H${ws.rowCount}` };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-pedidos-innovascac-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    mostrarToast('⚠️ No se pudo generar el reporte. Conecta el backend en /api/admin/pedidos.');
  }
});

// ── CONFIGURACIÓN: datos generales del sistema ──
const CONFIG_KEY = 'innova_config_sistema';

function cargarConfiguracionAdmin() {
  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    document.getElementById('config-telefono').value = config.telefono || '';
    document.getElementById('config-whatsapp').value = config.whatsapp || '';
    document.getElementById('config-horario-semana').value = config.horarioSemana || '';
    document.getElementById('config-horario-domingo').value = config.horarioDomingo || '';
  } catch (e) { /* sin configuración previa */ }
}

document.getElementById('form-configuracion')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const config = {
    telefono: document.getElementById('config-telefono').value.trim(),
    whatsapp: document.getElementById('config-whatsapp').value.trim(),
    horarioSemana: document.getElementById('config-horario-semana').value.trim(),
    horarioDomingo: document.getElementById('config-horario-domingo').value.trim()
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  try {
    await fetchAdmin('/api/admin/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch (e) { /* backend opcional: la config queda guardada localmente igual */ }

  const msg = document.getElementById('config-guardado-msg');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
});

// Asignar eventos de navegación
document.querySelectorAll('[data-vista]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    irAVista(el.dataset.vista);
    document.getElementById('menu-movil')?.classList.remove('abierto');
  });
});

// Inicializar la primera vista (según el rol de la sesión activa, si existe)
irAVista(esAdministrador() ? 'vista-admin' : 'vista-inicio');

// ══════════════════════════════════════════
//   MÓDULO: MENÚ MÓVIL
// ══════════════════════════════════════════
document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
  document.getElementById('menu-movil')?.classList.toggle('abierto');
});

document.getElementById('menu-movil-cerrar')?.addEventListener('click', () => {
  document.getElementById('menu-movil')?.classList.remove('abierto');
});

// Cerrar menú al hacer click fuera
document.addEventListener('click', (e) => {
  const menu = document.getElementById('menu-movil');
  const btn = document.getElementById('btn-menu-mobile');
  if (menu && menu.classList.contains('abierto') && !menu.contains(e.target) && !btn?.contains(e.target)) {
    menu.classList.remove('abierto');
  }
});

// ══════════════════════════════════════════
//   MÓDULO: BANNER CAROUSEL
// ══════════════════════════════════════════
const bannerTrack = document.getElementById('banner-track');
const bannerDots = document.getElementById('banner-dots');
let bannerCurrent = 0;
let bannerSlides = bannerTrack?.querySelectorAll('.banner-slide') || [];
let bannerInterval;

function updateBanner(index) {
  if (!bannerTrack || bannerSlides.length === 0) return;
  bannerCurrent = (index + bannerSlides.length) % bannerSlides.length;
  bannerTrack.style.transform = `translateX(-${bannerCurrent * 100}%)`;
  
  bannerDots.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === bannerCurrent);
  });
}

function initBannerDots() {
  if (!bannerDots) return;
  bannerDots.innerHTML = '';
  bannerSlides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => {
      updateBanner(i);
      resetBannerAutoplay();
    });
    bannerDots.appendChild(dot);
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function startBannerAutoplay() {
  if (prefersReducedMotion) return;
  if (bannerInterval) clearInterval(bannerInterval);
  bannerInterval = setInterval(() => {
    updateBanner(bannerCurrent + 1);
  }, 5000);
}

function resetBannerAutoplay() {
  if (bannerInterval) clearInterval(bannerInterval);
  startBannerAutoplay();
}

if (bannerTrack) {
  bannerTrack.setAttribute('aria-live', 'polite');
}

if (bannerTrack && bannerSlides.length > 0) {
  initBannerDots();
  startBannerAutoplay();
  
  // Pausar autoplay al hover
  bannerTrack.addEventListener('mouseenter', () => {
    if (bannerInterval) clearInterval(bannerInterval);
  });
  bannerTrack.addEventListener('mouseleave', startBannerAutoplay);

  // Swipe táctil
  let bannerTouchStartX = 0;
  let bannerTouchEndX = 0;

  bannerTrack.addEventListener('touchstart', (e) => {
    bannerTouchStartX = e.changedTouches[0].screenX;
    if (bannerInterval) clearInterval(bannerInterval);
  }, { passive: true });

  bannerTrack.addEventListener('touchend', (e) => {
    bannerTouchEndX = e.changedTouches[0].screenX;
    const delta = bannerTouchEndX - bannerTouchStartX;
    if (Math.abs(delta) > 40) {
      updateBanner(bannerCurrent + (delta < 0 ? 1 : -1));
    }
    startBannerAutoplay();
  }, { passive: true });
}

document.getElementById('banner-prev')?.addEventListener('click', () => {
  updateBanner(bannerCurrent - 1);
  resetBannerAutoplay();
});
document.getElementById('banner-next')?.addEventListener('click', () => {
  updateBanner(bannerCurrent + 1);
  resetBannerAutoplay();
});

// ══════════════════════════════════════════
//   MÓDULO: CARRUSEL DE SERVICIOS
// ══════════════════════════════════════════
const carTrack = document.getElementById('carrusel-track');
const carSlides = carTrack?.querySelectorAll('.car-slide') || [];
const carDots = document.getElementById('car-dots');
let carCurrent = 0;
let carVisibles = getCarVisibles();

function getCarVisibles() {
  return window.innerWidth < 640 ? 1 : (window.innerWidth < 992 ? 2 : 3);
}

function initCarDots() {
  if (!carDots) return;
  carDots.innerHTML = '';
  const total = Math.ceil(carSlides.length / carVisibles);
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.classList.add('dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToCar(i * carVisibles));
    carDots.appendChild(dot);
  }
}

function goToCar(index) {
  if (!carTrack || carSlides.length === 0) return;
  carVisibles = getCarVisibles();
  const max = carSlides.length - carVisibles;
  carCurrent = Math.max(0, Math.min(index, max));
  const slideW = carSlides[0].offsetWidth + 20;
  carTrack.style.transform = `translateX(-${carCurrent * slideW}px)`;
  carDots?.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i * carVisibles === carCurrent);
  });
}

let carAutoplay;

function startCarAutoplay() {
  if (carAutoplay) clearInterval(carAutoplay);
  carAutoplay = setInterval(() => {
    const next = carCurrent + carVisibles >= carSlides.length ? 0 : carCurrent + carVisibles;
    goToCar(next);
  }, 4000);
}

if (carTrack && carSlides.length > 0) {
  initCarDots();
  setTimeout(() => goToCar(0), 100);
  startCarAutoplay();
  
  carTrack.addEventListener('mouseenter', () => {
    if (carAutoplay) clearInterval(carAutoplay);
  });
  carTrack.addEventListener('mouseleave', startCarAutoplay);
}

window.addEventListener('resize', () => {
  carVisibles = getCarVisibles();
  initCarDots();
  goToCar(0);
});

document.getElementById('car-prev')?.addEventListener('click', () => goToCar(carCurrent - carVisibles));
document.getElementById('car-next')?.addEventListener('click', () => goToCar(carCurrent + carVisibles));

// ══════════════════════════════════════════
//   MÓDULO: EFECTO STICKY HEADER
// ══════════════════════════════════════════
window.addEventListener('scroll', () => {
  const header = document.getElementById('header-main');
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 50);
  }
});

// ══════════════════════════════════════════
//   MÓDULO: ENVÍO DE PEDIDOS
// ══════════════════════════════════════════
const formPedido = document.getElementById('form-pedido');
const pedidoNombreEl = document.getElementById('pedido-nombre');
const pedidoTelefonoEl = document.getElementById('pedido-telefono');
const pedidoCorreoEl = document.getElementById('pedido-correo');
// ══════════════════════════════════════════
//   MÓDULO: CATEGORÍAS DINÁMICAS (lado cliente)
//   Llena los selects de "Catálogos" y "Pedido" con las categorías
//   reales guardadas en la base de datos (las que administras en
//   Panel Admin → Categorías), en vez de una lista fija.
// ══════════════════════════════════════════
async function cargarCategoriasCliente() {
  try {
    const categorias = await (await fetch('/api/categorias')).json();

    const selectPedido = document.getElementById('pedido-servicio');
    if (selectPedido) {
      const extra = categorias.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
      selectPedido.innerHTML = `<option value="">Seleccione un servicio</option>${extra}`;
    }
  } catch (e) {
    console.error('No se pudieron cargar las categorías del cliente:', e);
  }
}
cargarCategoriasCliente();

const pedidoServicioEl = document.getElementById('pedido-servicio');
const pedidoCantidadEl = document.getElementById('pedido-cantidad');
const archivoInput = document.getElementById('pedido-archivo');
const archivoPreview = document.getElementById('pedido-archivo-preview');

// ══════════════════════════════════════════
//   MÓDULO: PRODUCTO Y STOCK REAL EN EL PEDIDO
//   CORRECCIÓN: antes el cliente solo elegía una categoría ("servicio"),
//   así que si esa categoría tenía más de un producto, el backend no podía
//   saber a cuál descontarle stock (le tocaba al primero que encontraba).
//   Ahora, si la categoría elegida tiene productos reales dados de alta en
//   el Panel Admin, se muestra un segundo select para elegir el producto
//   exacto y se avisa cuánto stock queda disponible.
// ══════════════════════════════════════════
let productoSeleccionado = null;

const pedidoProductoWrapper = document.getElementById('pedido-producto-wrapper');
const pedidoProductoEl = document.getElementById('pedido-producto');
const pedidoStockInfoEl = document.getElementById('pedido-stock-info');

async function cargarProductosPorCategoria(categoria) {
  productoSeleccionado = null;
  if (!pedidoProductoWrapper || !pedidoProductoEl) return;

  if (!categoria || categoria === 'TODOS') {
    pedidoProductoWrapper.style.display = 'none';
    if (pedidoStockInfoEl) pedidoStockInfoEl.textContent = '';
    return;
  }

  try {
    const productos = await (await fetch('/api/productos?categoria=' + encodeURIComponent(categoria))).json();

    if (!Array.isArray(productos) || productos.length === 0) {
      // Categoría todavía sin productos específicos en el inventario:
      // se deja pedir "en general" como antes, sin descuento de stock.
      pedidoProductoWrapper.style.display = 'none';
      if (pedidoStockInfoEl) pedidoStockInfoEl.textContent = '';
      return;
    }

    pedidoProductoEl.innerHTML = '<option value="">Seleccione un producto</option>' +
      productos.map(p => `<option value="${p.id}" data-stock="${p.stock}" ${p.stock === 0 ? 'disabled' : ''}>${p.nombre}${p.stock === 0 ? ' (Agotado)' : ' (Stock: ' + p.stock + ')'}</option>`).join('');
    pedidoProductoWrapper.style.display = '';
    if (pedidoStockInfoEl) pedidoStockInfoEl.textContent = '';
  } catch (e) {
    console.error('No se pudieron cargar los productos de la categoría:', e);
    pedidoProductoWrapper.style.display = 'none';
  }
}

pedidoServicioEl?.addEventListener('change', () => {
  cargarProductosPorCategoria(pedidoServicioEl.value);
});

pedidoProductoEl?.addEventListener('change', () => {
  const opcion = pedidoProductoEl.selectedOptions[0];
  const stock = opcion ? Number(opcion.dataset.stock) : null;
  productoSeleccionado = pedidoProductoEl.value || null;

  if (pedidoCantidadEl && stock != null && !Number.isNaN(stock)) {
    pedidoCantidadEl.max = stock;
  }
  if (pedidoStockInfoEl) {
    pedidoStockInfoEl.textContent = (stock != null && !Number.isNaN(stock))
      ? `Stock disponible: ${stock} unidades.`
      : '';
  }
});
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

// Validación en tiempo real de los campos del formulario de pedido
activarValidacionEnVivo(pedidoNombreEl, VALIDADORES.nombre, 'Ingresa tu nombre completo (mín. 3 caracteres).');
activarValidacionEnVivo(pedidoTelefonoEl, VALIDADORES.telefono, 'Ingresa un número de teléfono válido (7 a 9 dígitos).');
activarValidacionEnVivo(pedidoCorreoEl, VALIDADORES.correo, 'Ingresa un correo electrónico válido.');
activarValidacionEnVivo(pedidoServicioEl, VALIDADORES.requerido, 'Selecciona un servicio.');
activarValidacionEnVivo(pedidoCantidadEl, VALIDADORES.cantidadPositiva, 'La cantidad debe ser un número mayor a 0.');
pedidoServicioEl?.addEventListener('change', () => validarCampo(pedidoServicioEl, VALIDADORES.requerido, 'Selecciona un servicio.'));

function validarFormularioPedido() {
  const nombreOk = validarCampo(pedidoNombreEl, VALIDADORES.nombre, 'Ingresa tu nombre completo (mín. 3 caracteres).');
  const telefonoOk = validarCampo(pedidoTelefonoEl, VALIDADORES.telefono, 'Ingresa un número de teléfono válido (7 a 9 dígitos).');
  // El correo es opcional: solo se valida el formato si el cliente escribió algo.
  const correoOk = pedidoCorreoEl.value.trim() === '' || validarCampo(pedidoCorreoEl, VALIDADORES.correo, 'Ingresa un correo electrónico válido.');
  const servicioOk = validarCampo(pedidoServicioEl, VALIDADORES.requerido, 'Selecciona un servicio.');
  const cantidadOk = validarCampo(pedidoCantidadEl, VALIDADORES.cantidadPositiva, 'La cantidad debe ser un número mayor a 0.');

  // Validar método de pago (obligatorio)
  const metodoPagoEl = document.getElementById('pedido-metodo-pago');
  const metodoPagoOk = metodoPagoEl && metodoPagoEl.value !== '';
  if (metodoPagoEl) {
    if (!metodoPagoOk) {
      metodoPagoEl.classList.add('input-invalido');
      mostrarToast('⚠️ Selecciona un método de pago.');
    } else {
      metodoPagoEl.classList.remove('input-invalido');
    }
  }


  // Validar comprobante separado
  let archivoOk = true;
  const compInputEl = document.getElementById('pedido-comprobante');
  if (metodoPagoEl && ['Yape', 'Plin', 'Transferencia'].includes(metodoPagoEl.value)) {
    if (!compInputEl || compInputEl.files.length === 0) {
      archivoOk = false;
      compInputEl?.classList.add('input-invalido');
      mostrarToast('⚠️ Debes adjuntar tu comprobante de pago.');
    } else {
      compInputEl?.classList.remove('input-invalido');
    }
  } else {
    compInputEl?.classList.remove('input-invalido');
  }

  if (!nombreOk || !telefonoOk || !correoOk || !servicioOk || !cantidadOk || !metodoPagoOk || !archivoOk) {
    const primerInvalido = [pedidoNombreEl, pedidoTelefonoEl, pedidoCorreoEl, pedidoServicioEl, pedidoCantidadEl, metodoPagoEl, compInputEl]
      .find(el => el && el.classList.contains('input-invalido'));
    primerInvalido?.focus();
    primerInvalido?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

// ── Vista previa del archivo adjunto ──
function limpiarPreviewArchivo() {
  if (archivoPreview) archivoPreview.innerHTML = '';
}

archivoInput?.addEventListener('change', () => {
  limpiarPreviewArchivo();
  const file = archivoInput.files[0];
  if (!file || !archivoPreview) return;

  const item = document.createElement('div');
  item.className = 'archivo-preview-item';

  if (file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Vista previa del archivo adjunto';
    item.appendChild(img);
  } else {
    const icono = document.createElement('span');
    icono.className = 'archivo-preview-icon';
    icono.textContent = '📄';
    item.appendChild(icono);
  }

  const nombre = document.createElement('span');
  nombre.className = 'archivo-preview-nombre';
  nombre.textContent = file.name;
  item.appendChild(nombre);

  const btnQuitar = document.createElement('button');
  btnQuitar.type = 'button';
  btnQuitar.className = 'archivo-preview-quitar';
  btnQuitar.setAttribute('aria-label', 'Quitar archivo');
  btnQuitar.textContent = '✕';
  btnQuitar.addEventListener('click', () => {
    archivoInput.value = '';
    limpiarPreviewArchivo();
  });
  item.appendChild(btnQuitar);

  archivoPreview.appendChild(item);
});

// ── Estado de carga del botón "Enviar Pedido" ──
function ponerBotonEnCarga(cargando) {
  if (!btnEnviarPedido) return;
  const texto = btnEnviarPedido.querySelector('.btn-texto');
  btnEnviarPedido.disabled = cargando;
  btnEnviarPedido.classList.toggle('btn-loading', cargando);
  if (texto) {
    texto.innerHTML = cargando ? '<span class="btn-spinner"></span>Enviando...' : 'Enviar Pedido 📦';
  }
}

formPedido?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = localStorage.getItem('token');
  if (!token) {
    mostrarToast('❌ Debes iniciar sesión primero para realizar un pedido.');
    irAVista('vista-inicio');
    return;
  }

  if (!validarFormularioPedido()) return;

  const formData = new FormData();
  formData.append('servicio', pedidoServicioEl.value);
  formData.append('cantidad', pedidoCantidadEl.value || 1);
  formData.append('detalles', document.getElementById('pedido-detalles').value);
  // CORRECCIÓN: si el cliente eligió un producto específico (la categoría
  // tenía productos reales en el inventario), se manda su ID para que el
  // backend descuente el stock exacto, sin ambigüedad.
  if (productoSeleccionado) {
    formData.append('producto_id', productoSeleccionado);
  }
  
  // Agregar método de pago y cupón
  const metodoPagoEl = document.getElementById('pedido-metodo-pago');
  if (metodoPagoEl) formData.append('metodo_pago', metodoPagoEl.value);
  const cuponEl = document.getElementById('pedido-cupon');
  if (cuponEl) formData.append('cupon', cuponEl.value);

  if (archivoInput && archivoInput.files.length > 0) {
    formData.append('archivo', archivoInput.files[0]);
  }
  const compInputEl = document.getElementById('pedido-comprobante');
  if (compInputEl && compInputEl.files.length > 0) {
    formData.append('comprobante', compInputEl.files[0]);
  }

  ponerBotonEnCarga(true);

  try {
    const seleccion = obtenerSeleccionCompleta();
    let endpoint = '/api/pedidos';
    
    if (seleccion.length > 1) {
       endpoint = '/api/pedidos-carrito';
       const items = seleccion.map(l => ({
         producto_id: l.productoId,
         nombre: l.nombre,
         cantidad: l.cantidad,
         precio_unitario: (productosPorCategoriaCache[l.categoria] || []).find(p => p.id == l.productoId)?.precio || 0,
         categoria: l.categoria
       }));
       formData.append('items', JSON.stringify(items));
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      irAVista('vista-inicio');
      const toast = document.getElementById('toast');
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 4000);
      e.target.reset();
      limpiarPreviewArchivo();
      vaciarCarrito();
      productoSeleccionado = null;
      if (pedidoProductoWrapper) pedidoProductoWrapper.style.display = 'none';
      if (pedidoStockInfoEl) pedidoStockInfoEl.textContent = '';
      [pedidoNombreEl, pedidoTelefonoEl, pedidoCorreoEl, pedidoServicioEl, pedidoCantidadEl].forEach(limpiarErrorCampo);
    } else {
      mostrarToast('❌ ' + data.error);
    }
  } catch (error) {
    mostrarToast('❌ Error de conexión al enviar el pedido.');
  } finally {
    ponerBotonEnCarga(false);
  }
});


// ══════════════════════════════════════════
//   (Antiguo módulo "Catálogos" de documentos PDF por servicio — eliminado.
//   La navegación por categoría/producto ahora vive en el mismo lugar,
//   cargando datos reales desde el backend más abajo.)
// ══════════════════════════════════════════

// ══════════════════════════════════════════
//   MÓDULO: CATEGORÍAS Y PRODUCTOS REALES
//   MEJORA: antes este catálogo era una lista fija escrita a mano en el
//   código (Polos, Tazas...), totalmente desconectada de lo que administras
//   en Panel Admin. Ahora se carga en vivo desde el backend: las categorías
//   vienen de /api/categorias y los productos de /api/productos, así que
//   cualquier categoría o producto que crees en el admin aparece aquí solo,
//   sin tocar código.
// ══════════════════════════════════════════

// Ícono de referencia por categoría (solo decorativo). Si creas una
// categoría que no está en este mapa, se usa un ícono genérico — no hace
// falta editar esto para que la categoría funcione.
const ICONOS_POR_CATEGORIA = {
  'Banners y Viniles': '🖼️',
  'DTF Textil': '👕',
  'Diseño Gráfico': '🎨',
  'Equipos Tecnológicos': '💻',
  'Lámparas': '💡',
  'Sublimación': '☕',
  'UV DTF': '🖼️',
  'Juegos': '🎮'
};
const ICONO_CATEGORIA_DEFAULT = '🏷️';

// Carrito persistente: guarda las cantidades por categoría/producto en
// localStorage para que no se pierdan si el cliente navega o recarga.
const CARRITO_KEY = 'innova_carrito_seleccion';

function cargarCarritoGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CARRITO_KEY) || '{}');
  } catch {
    return {};
  }
}

function guardarCarrito() {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carritoGlobal));
}

function vaciarCarrito() {
  carritoGlobal = {};
  localStorage.removeItem(CARRITO_KEY);
  actualizarBadgeCarrito();
}

let carritoGlobal = cargarCarritoGuardado(); // { nombreCategoria: { productoId: cantidad, ... }, ... }
let cantidadesSeleccionadas = {};
let categoriaActual = null;
let productosPorCategoriaCache = {}; // { nombreCategoria: [ {id, nombre, precio, stock, imagen}, ... ] }
let PRODUCTOS_GLOBAL = []; // cache global para el buscador inteligente

const categoriasGrid = document.getElementById('categorias-grid');
const detalleTitulo = document.getElementById('detalle-producto-titulo');
const detalleSub = document.getElementById('detalle-producto-sub');
const detalleGrid = document.getElementById('detalle-producto-grid');
const detalleResumenBox = document.getElementById('detalle-resumen-box');
const detalleResumenTxt = document.getElementById('detalle-resumen-texto');

// Trae categorías + productos reales y dibuja la cuadrícula de categorías.
async function cargarCategoriasYProductos() {
  if (!categoriasGrid) return;

  // MEJORA: spinner de carga mientras llegan los datos (antes era texto plano)
  categoriasGrid.innerHTML = Array(4).fill(0).map(() => `
    <div class="vista-box skeleton-box" style="height:180px;">
      <div class="skeleton-img" style="height:90px;border-radius:10px;"></div>
      <div class="skeleton-text" style="width:60%;margin:10px auto 6px;"></div>
      <div class="skeleton-text" style="width:40%;margin:0 auto;"></div>
    </div>`).join('');

  try {
    const [categorias, productos] = await Promise.all([
      (await fetch('/api/categorias')).json(),
      (await fetch('/api/productos')).json()
    ]);

    PRODUCTOS_GLOBAL = productos;
    productosPorCategoriaCache = {};
    productos.forEach(p => {
      const clave = p.categoria || 'Sin categoría';
      if (!productosPorCategoriaCache[clave]) productosPorCategoriaCache[clave] = [];
      productosPorCategoriaCache[clave].push(p);
    });

    if (categorias.length === 0) {
      categoriasGrid.innerHTML = '<div class="empty-state fade-in-up"><div class="empty-state-icon">📁</div><div class="empty-state-title">Sin categorías</div><div class="empty-state-message">Aún no se han registrado categorías. Vuelve pronto.</div></div>';
      return;
    }

    categoriasGrid.innerHTML = categorias.map((cat, _idx) => {
      const productosDeCategoria = productosPorCategoriaCache[cat.nombre] || [];
      const icono = ICONOS_POR_CATEGORIA[cat.nombre] || ICONO_CATEGORIA_DEFAULT;
      const precios = productosDeCategoria.map(p => Number(p.precio));
      const precioDesde = precios.length > 0 ? Math.min(...precios) : null;

      // NUEVO: si la categoría tiene foto de portada, la usamos; si no, mostramos el emoji
      const portada = cat.imagen
        ? `<div class="vbox-portada"><img src="${cat.imagen}" alt="${cat.nombre}" class="vbox-portada-img"></div>`
        : `<div class="vbox-icon" aria-hidden="true">${icono}</div>`;

      return `
        <div class="vista-box vista-box-clickable hover-lift fade-in-up" data-categoria="${cat.nombre}" style="animation-delay:${_idx*0.05}s;">
          ${portada}
          <h3>${cat.nombre}</h3>
          <p>${productosDeCategoria.length} producto${productosDeCategoria.length === 1 ? '' : 's'} disponible${productosDeCategoria.length === 1 ? '' : 's'}</p>
          ${precioDesde !== null ? `<span class="vbox-precio">Desde S/ ${precioDesde.toFixed(2)}</span>` : '<span class="vbox-precio vbox-precio--vacio">Aún sin productos</span>'}
          <span class="vbox-ver-mas">Ver productos →</span>
        </div>`;
    }).join('');
  } catch (e) {
    categoriasGrid.innerHTML = '<p class="tabla-vacia">⚠️ No se pudieron cargar las categorías.</p>';
    console.error('Error cargando categorías/productos:', e);
  }
}

// Delegación de clicks: como las tarjetas de categoría ahora se generan
// dinámicamente, escuchamos en el contenedor (que sí existe desde el inicio)
// en vez de sobre las tarjetas mismas.
categoriasGrid?.addEventListener('click', (e) => {
  const card = e.target.closest('[data-categoria]');
  if (!card) return;
  mostrarProductosDeCategoria(card.dataset.categoria);
  irAVista('vista-detalle-producto');
});

function mostrarProductosDeCategoria(nombreCategoria, ordenForzado) {
  if (!detalleGrid) return;

  categoriaActual = nombreCategoria;
  let productos = (productosPorCategoriaCache[nombreCategoria] || []).slice(); // copia para ordenar
  const guardadas = carritoGlobal[nombreCategoria] || {};
  cantidadesSeleccionadas = {};
  productos.forEach(p => { cantidadesSeleccionadas[p.id] = guardadas[p.id] || 0; });

  // NUEVO: aplicar orden seleccionado por el usuario
  const ordenSelect = document.getElementById('detalle-orden-select');
  const orden = ordenForzado || (ordenSelect ? ordenSelect.value : 'defecto');
  productos = ordenarProductos(productos, orden);

  const precios = productos.map(p => Number(p.precio));
  const precioDesde = precios.length > 0 ? Math.min(...precios) : null;

  detalleTitulo.textContent = nombreCategoria;
  detalleSub.innerHTML = precioDesde !== null
    ? `Elige la cantidad de cada producto que necesitas · <span class="precio-desde-badge">Precio desde S/ ${precioDesde.toFixed(2)}</span>`
    : 'Todavía no hay productos dados de alta en esta categoría.';

  if (productos.length === 0) {
    detalleGrid.innerHTML = '<div class="empty-state fade-in-up"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Sin productos</div><div class="empty-state-message">Aún no hay productos aquí. Contáctanos para consultar disponibilidad.</div></div>';
    actualizarResumen();
    return;
  }

  detalleGrid.innerHTML = productos.map((p, _pidx) => {
    const agotado = p.stock === 0;
    const icono = ICONOS_POR_CATEGORIA[nombreCategoria] || ICONO_CATEGORIA_DEFAULT;
    return `
    <div class="vista-box articulo-card hover-lift fade-in-up ${agotado ? 'articulo-card--agotado' : ''}" data-articulo="${p.id}" style="animation-delay:${_pidx*0.04}s;">
      <div class="articulo-card-header">
        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" class="articulo-imagen">` : `<div class="vbox-icon">${icono}</div>`}
        <span class="articulo-precio">S/ ${Number(p.precio).toFixed(2)}</span>
      </div>
      <h3>${p.nombre}</h3>
      <div class="articulo-stock">
        <span class="stock-icono" aria-hidden="true">📦</span>
        ${agotado ? '<b style="color:#e5304d;">Agotado</b>' : `Stock: <b>${p.stock.toLocaleString('es-PE')}</b> uds.`}
      </div>
      <div class="cantidad-selector">
        <button type="button" class="cantidad-btn cantidad-restar" data-articulo="${p.id}" aria-label="Restar" ${agotado ? 'disabled' : ''}>−</button>
        <input type="number" class="cantidad-input" id="cantidad-${p.id}" value="${cantidadesSeleccionadas[p.id] || 0}" min="0" max="${p.stock}" ${agotado ? 'disabled' : ''}>
        <button type="button" class="cantidad-btn cantidad-sumar" data-articulo="${p.id}" aria-label="Sumar" ${agotado ? 'disabled' : ''}>+</button>
      </div>
      <button type="button" class="btn-consultar-disponibilidad" data-articulo="${p.id}" ${agotado ? 'disabled' : ''}>${agotado ? 'Sin stock' : 'Consultar disponibilidad'}</button>
    </div>
  `;
  }).join('');

  actualizarResumen();

  // Buscador de productos dentro de la categoría
  const buscador = document.getElementById('detalle-buscador-input');
  if (buscador) {
    buscador.value = '';
    buscador.oninput = () => {
      const texto = buscador.value.trim().toLowerCase();
      detalleGrid.querySelectorAll('.articulo-card').forEach(card => {
        const nombre = card.querySelector('h3')?.textContent.toLowerCase() || '';
        card.style.display = nombre.includes(texto) ? '' : 'none';
      });
    };
  }
}

// NUEVO: función de ordenación de productos.
function ordenarProductos(productos, criterio) {
  const lista = productos.slice();
  switch (criterio) {
    case 'precio-asc':  return lista.sort((a, b) => Number(a.precio) - Number(b.precio));
    case 'precio-desc': return lista.sort((a, b) => Number(b.precio) - Number(a.precio));
    case 'stock-desc':  return lista.sort((a, b) => b.stock - a.stock);
    case 'stock-asc':   return lista.sort((a, b) => a.stock - b.stock);
    case 'nombre-asc':  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    default:            return lista;
  }
}

// NUEVO: relanzar re-render al cambiar el orden, sin perder las cantidades elegidas.
document.getElementById('detalle-orden-select')?.addEventListener('change', () => {
  if (categoriaActual) mostrarProductosDeCategoria(categoriaActual);
});

function cambiarCantidad(productoId, delta) {
  const productos = productosPorCategoriaCache[categoriaActual] || [];
  const producto = productos.find(p => String(p.id) === String(productoId));
  if (!producto) return;
  const limite = producto.stock; // límite real, tomado del inventario del admin

  const actual = cantidadesSeleccionadas[productoId] || 0;
  const nueva = Math.min(limite, Math.max(0, actual + delta));

  if (actual === limite && delta > 0) {
    mostrarToast(`Solo hay ${limite} unidades en stock de este producto.`, 'info');
    return;
  }

  cantidadesSeleccionadas[productoId] = nueva;

  if (delta > 0 && actual < limite) {
    mostrarToast(`✅ ${producto.nombre} agregado al carrito`);
  }

  const input = document.getElementById(`cantidad-${productoId}`);
  if (input) input.value = nueva;

  carritoGlobal[categoriaActual] = { ...cantidadesSeleccionadas };
  guardarCarrito();

  actualizarResumen();
}

function actualizarResumen() {
  const total = Object.values(cantidadesSeleccionadas).reduce((a, b) => a + b, 0);
  if (!detalleResumenBox || !detalleResumenTxt) return;

  if (total > 0) {
    detalleResumenBox.style.display = 'flex';
    detalleResumenTxt.textContent = `${total} producto${total === 1 ? '' : 's'} seleccionado${total === 1 ? '' : 's'}`;
  } else {
    detalleResumenBox.style.display = 'none';
  }

  actualizarBadgeCarrito();
}

/**
 * Junta las selecciones de TODAS las categorías en una lista de líneas
 * legibles (para el texto del pedido) y también en una lista de objetos
 * {categoria, productoId, nombre, cantidad} (para autocompletar el formulario).
 */
function obtenerSeleccionCompleta() {
  const lineas = [];
  Object.keys(carritoGlobal).forEach(categoria => {
    const productos = productosPorCategoriaCache[categoria] || [];
    const cantidades = carritoGlobal[categoria];
    Object.keys(cantidades).forEach(productoId => {
      const cant = cantidades[productoId] || 0;
      if (cant <= 0) return;
      const producto = productos.find(p => String(p.id) === String(productoId));
      if (!producto) return;
      lineas.push({ categoria, productoId: producto.id, nombre: producto.nombre, cantidad: cant });
    });
  });
  return lineas;
}

function obtenerResumenCarritoCompleto() {
  return obtenerSeleccionCompleta().map(l => `${l.cantidad}x ${l.nombre}`).join(', ');
}

function totalArticulosCarrito() {
  const seleccion = obtenerSeleccionCompleta();
  return seleccion.length;
}

function actualizarBadgeCarrito() {
  const total = totalArticulosCarrito();
  const btnCarrito = document.getElementById('btn-carrito-dropdown');
  document.querySelectorAll('.cart-badge').forEach(badge => {
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  });

  if (btnCarrito && total > 0) {
    btnCarrito.classList.remove('pulse-anim');
    void btnCarrito.offsetWidth; // trigger reflow
    btnCarrito.classList.add('pulse-anim');
  }
}

if (detalleGrid) {
  detalleGrid.addEventListener('click', e => {
    const btnSumar = e.target.closest('.cantidad-sumar');
    const btnRestar = e.target.closest('.cantidad-restar');
    const btnConsultar = e.target.closest('.btn-consultar-disponibilidad');
    if (btnSumar && !btnSumar.disabled) cambiarCantidad(btnSumar.dataset.articulo, 1);
    if (btnRestar && !btnRestar.disabled) cambiarCantidad(btnRestar.dataset.articulo, -1);
    if (btnConsultar && !btnConsultar.disabled) {
      if (!cantidadesSeleccionadas[btnConsultar.dataset.articulo]) {
        cambiarCantidad(btnConsultar.dataset.articulo, 1);
      }
      document.getElementById('btn-detalle-pedir')?.click();
    }
  });
}

document.getElementById('btn-detalle-pedir')?.addEventListener('click', async () => {
  const seleccion = obtenerSeleccionCompleta();
  if (seleccion.length === 0) return;

  const token = localStorage.getItem('token');
  if (!token) {
    mostrarPantallaAuth();
    return;
  }

  // NUEVO: si hay más de 1 producto en el carrito, enviamos el pedido
  // completo vía /api/pedidos-carrito (multi-producto real)
  /* Pedidos multi-producto ahora pasan por el formulario */

  // Rellenar formulario
  const textarea = document.querySelector('#form-pedido textarea');
  if (textarea && seleccion.length > 0) {
    textarea.value = `Pedido: ${seleccion.map(l => `${l.cantidad}x ${l.nombre}`).join(', ')}`;
  }

  const totalUnidades = totalArticulosCarrito();
  const inputCantidad = document.getElementById('pedido-cantidad');
  if (inputCantidad && totalUnidades > 0) {
    inputCantidad.value = totalUnidades;
  }

  const selectServicio = document.getElementById('pedido-servicio');
  if (selectServicio && seleccion.length > 0) {
    const categoriaPrincipal = seleccion[0].categoria;
    selectServicio.value = categoriaPrincipal;
    selectServicio.classList.remove('input-invalido');
    const err = selectServicio.nextElementSibling;
    if (err && err.classList.contains('error-msg')) err.remove();

    await cargarProductosPorCategoria(categoriaPrincipal);

    if (seleccion.length === 1) {
      const selectProducto = document.getElementById('pedido-producto');
      if (selectProducto) {
        selectProducto.value = seleccion[0].productoId;
        selectProducto.dispatchEvent(new Event('change'));
      }
      if (inputCantidad) inputCantidad.value = seleccion[0].cantidad;
    }
  }

  irAVista('vista-pedido');
});

actualizarBadgeCarrito();

// NUEVO: productos más pedidos (datos reales)
async function cargarProductosDestacados() {
  const seccion = document.getElementById('seccion-mas-pedidos');
  const grid = document.getElementById('mas-pedidos-grid');
  if (!seccion || !grid) return;

  try {
    const productos = await (await fetch('/api/productos/destacados')).json();
    if (!Array.isArray(productos) || productos.length === 0) {
      seccion.style.display = 'none';
      return;
    }

    seccion.style.display = '';
    grid.innerHTML = productos.map(p => {
      const icono = ICONOS_POR_CATEGORIA[p.categoria] || ICONO_CATEGORIA_DEFAULT;
      return `
      <div class="mas-pedidos-card vista-box-clickable" data-categoria="${p.categoria || ''}" style="cursor:pointer;">
        <div class="mas-pedidos-img">
          ${p.imagen
            ? `<img src="${p.imagen}" alt="${p.nombre}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : `<div style="font-size:2.4rem;">${icono}</div>`}
        </div>
        <div class="mas-pedidos-info">
          <h4>${p.nombre}</h4>
          <span class="articulo-precio" style="font-size:1rem;">S/ ${Number(p.precio).toFixed(2)}</span>
          ${p.total_pedidos > 0 ? `<small style="color:#888;">📦 ${p.total_pedidos} pedido${p.total_pedidos === 1 ? '' : 's'}</small>` : ''}
        </div>
      </div>`;
    }).join('');

    // Click en tarjeta → navegar a la categoría
    grid.querySelectorAll('[data-categoria]').forEach(card => {
      card.addEventListener('click', async () => {
        const cat = card.dataset.categoria;
        if (cat) {
          if (Object.keys(productosPorCategoriaCache).length === 0) {
            irAVista('vista-catalogos'); // Muestra el spinner de carga
            await cargarCategoriasYProductos(); // Espera a que lleguen los productos reales
          }
          mostrarProductosDeCategoria(cat);
          irAVista('vista-detalle-producto');
        }
      });
    });
  } catch (e) {
    seccion.style.display = 'none';
    console.error('Error cargando destacados:', e);
  }
}
cargarProductosDestacados();

// ══════════════════════════════════════════
//   MÓDULO: MODAL POLÍTICAS
// ══════════════════════════════════════════
const modalPolitica = document.getElementById('modal-politica');
const btnPolitica = document.getElementById('btn-politica-cambios');
const cerrarModalPolitica = document.getElementById('cerrar-modal-politica');

if (btnPolitica && modalPolitica) {
  btnPolitica.addEventListener('click', e => {
    e.preventDefault();
    modalPolitica.classList.add('activo');
  });
  cerrarModalPolitica?.addEventListener('click', () => modalPolitica.classList.remove('activo'));
  modalPolitica.addEventListener('click', e => {
    if (e.target === modalPolitica) modalPolitica.classList.remove('activo');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') modalPolitica.classList.remove('activo');
  });
}

// ══════════════════════════════════════════
//   MÓDULO: SERVICIOS (scroll a sección)
// ══════════════════════════════════════════
function irAServicios(e) {
  e.preventDefault();
  irAVista('vista-inicio');
  setTimeout(() => {
    document.getElementById('seccion-servicios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
  document.getElementById('menu-movil')?.classList.remove('abierto');
}

document.getElementById('footer-link-servicios')?.addEventListener('click', irAServicios);
document.getElementById('btn-ver-servicios')?.addEventListener('click', irAServicios); // <-- Agrega esta línea
// ══════════════════════════════════════════
//   MÓDULO: BOTÓN "ABRIR CUENTA" (redirige a registro)
// ══════════════════════════════════════════
document.getElementById('btn-abrir-cuenta-header')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (pantallaAuth && pantallaAuth.style.display !== 'none') {
    mostrarRegistro();
    pantallaAuth.scrollIntoView({ behavior: 'smooth' });
  } else {
    // Si ya está logueado, redirige a pedidos o similar
    irAVista('vista-pedido');
  }
});

console.log('🚀 Innova SCAC - Aplicación cargada correctamente');
console.log('📌 Estilo inspirado en BCP con colores propios');


// ── BUSCADOR GLOBAL (Fase 3) ─────────────────────────────────────────────────
(function() {
  const inp = document.getElementById('search-global');
  const results = document.getElementById('search-global-results');
  if (!inp || !results) return;

  let timer;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inp.value.trim();
    if (!q) { results.style.display = 'none'; return; }
    timer = setTimeout(async () => {
      try {
        const data = await (await fetch(`/api/productos/buscar?q=${encodeURIComponent(q)}`)).json();
        if (!data.length) { results.innerHTML = '<p style="padding:12px;color:#999;font-size:0.88rem;">Sin resultados.</p>'; results.style.display = 'block'; return; }
        results.innerHTML = data.map(p => `
          <div class="search-result-item" style="display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;"
            onclick="mostrarProductosDeCategoria('${p.categoria}');irAVista('vista-detalle-producto');inp_close();">
            ${p.imagen ? `<img src="${p.imagen}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">` : '<span style="font-size:1.5rem;">📦</span>'}
            <div>
              <div style="font-weight:600;font-size:0.9rem;">${p.nombre}</div>
              <div style="font-size:0.8rem;color:#999;">${p.categoria} · S/ ${Number(p.precio).toFixed(2)}</div>
            </div>
          </div>`).join('');
        results.style.display = 'block';
      } catch(e) { results.style.display = 'none'; }
    }, 300);
  });

  window.inp_close = () => { inp.value = ''; results.style.display = 'none'; };
  document.addEventListener('click', e => { if (!e.target.closest('#search-global-wrapper')) results.style.display = 'none'; });
})();


// ── DARK MODE (Fase 6) ───────────────────────────────────────────────────────
(function() {
  const btn = document.getElementById('btn-dark-mode');
  if (!btn) return;
  const saved = localStorage.getItem('darkMode');
  if (saved === '1') { document.body.classList.add('dark-mode'); btn.textContent = '☀️'; }
  btn.addEventListener('click', () => {
    const on = document.body.classList.toggle('dark-mode');
    btn.textContent = on ? '☀️' : '🌙';
    localStorage.setItem('darkMode', on ? '1' : '0');
  });
})();


// ── CUPONES (Fase 4) ─────────────────────────────────────────────────────────
document.getElementById('btn-notificaciones')?.addEventListener('click', async (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById('notif-dropdown');
  const body = document.getElementById('notif-dropdown-body');
  
  if (dropdown && dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    return;
  }
  
  // Ocultar carrito si está abierto
  const carritoDropdown = document.getElementById('carrito-dropdown');
  if (carritoDropdown) carritoDropdown.style.display = 'none';

  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch('/api/notificaciones', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) throw new Error('Error al obtener notificaciones');
    const data = await res.json();
    
    if (body) {
      if (data.length === 0) {
        body.innerHTML = `
          <div class="empty-state-box">
            <svg class="empty-state-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <p>No tienes notificaciones nuevas</p>
          </div>
        `;
      } else {
        body.innerHTML = data.slice(0,10).map(n => `
          <div style="padding: 10px 15px; border-bottom: 1px solid var(--color-border); font-size: 0.9rem;">
            ${n.leida ? '📭' : '📬'} ${n.mensaje}
            <div style="font-size:0.75rem; color:var(--color-texto-mutado); margin-top:4px;">
               ${new Date(n.fecha).toLocaleString()}
            </div>
          </div>
        `).join('');
      }
    }
    
    if (dropdown) dropdown.style.display = 'block';

    // Mark all as read
    await fetch('/api/notificaciones/leer-todas', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
    setTimeout(cargarNotificaciones, 1000);
  } catch(e) {}
});

document.getElementById('btn-cerrar-notif')?.addEventListener('click', () => {
  const d = document.getElementById('notif-dropdown');
  if (d) d.style.display = 'none';
});

// Cerrar notificaciones si se hace clic afuera (el del carrito ya lo hace para el carrito)
document.addEventListener('click', e => {
  const dropdown = document.getElementById('notif-dropdown');
  if (dropdown && dropdown.style.display === 'block' && !e.target.closest('#notif-wrapper')) {
    dropdown.style.display = 'none';
  }
});
let cuponAplicado = null;
document.getElementById('btn-validar-cupon')?.addEventListener('click', async () => {
  const inp = document.getElementById('pedido-cupon');
  const msg = document.getElementById('cupon-mensaje');
  const codigo = (inp?.value || '').trim().toUpperCase();
  if (!codigo) { msg.innerHTML = '<span style="color:#e5304d;">Ingresa un código.</span>'; return; }
  const token = localStorage.getItem('token');
  if (!token) { msg.innerHTML = '<span style="color:#e5304d;">Debes iniciar sesión.</span>'; return; }
  let total = 0;
  Object.keys(carritoGlobal || {}).forEach(cat => {
    const prods = productosPorCategoriaCache[cat] || [];
    const qs = carritoGlobal[cat];
    Object.keys(qs).forEach(pid => {
      const p = prods.find(x => String(x.id) === String(pid));
      if (p && qs[pid]) total += Number(p.precio) * qs[pid];
    });
  });
  try {
    const res = await fetch('/api/cupones/validar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ codigo, total_carrito: total })
    });
    const d = await res.json();
    if (res.ok) {
      cuponAplicado = d;
      msg.innerHTML = `<span style="color:#25d366;">✅ Cupón válido. Descuento: -S/ ${d.descuento.toFixed(2)}</span>`;
      if (inp) inp.disabled = true;
      document.getElementById('btn-validar-cupon').disabled = true;
    } else {
      cuponAplicado = null;
      msg.innerHTML = `<span style="color:#e5304d;">❌ ${d.error}</span>`;
    }
  } catch(e) { msg.innerHTML = '<span style="color:#e5304d;">Error de conexión.</span>'; }
});

function resetCupon() {
  cuponAplicado = null;
  const inp = document.getElementById('pedido-cupon');
  const msg = document.getElementById('cupon-mensaje');
  const btn = document.getElementById('btn-validar-cupon');
  if (inp) { inp.value = ''; inp.disabled = false; }
  if (msg) msg.innerHTML = '';
  if (btn) btn.disabled = false;
}


// ── PDF RECIBOS (Fase 5) ─────────────────────────────────────────────────────
window.descargarRecibo = function(id) {
  const pedido = (window._misPedidosCache || []).find(p => p.id === id);
  if (!pedido) { mostrarToast('Pedido no encontrado.'); return; }
  if (typeof window.jspdf === 'undefined') { mostrarToast('Librería PDF no cargada.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(20); doc.setTextColor(255, 106, 0);
  doc.text('INNOVA SCAC', 14, 22);
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text('Recibo de Pedido #' + pedido.id, 14, 30);
  doc.text('Fecha: ' + new Date(pedido.fecha).toLocaleDateString('es-PE'), 14, 36);
  doc.text('Estado: ' + pedido.estado, 14, 42);
  doc.text('Trujillo, La Libertad, Perú', 14, 48);
  const rows = (pedido.items && pedido.items.length)
    ? pedido.items.map(i => [i.nombre_producto, i.cantidad, 'S/ ' + Number(i.precio_unitario||0).toFixed(2), 'S/ ' + (i.cantidad*Number(i.precio_unitario||0)).toFixed(2)])
    : [[pedido.servicio, pedido.cantidad, '-', '-']];
  doc.autoTable({ startY: 54, head: [['Producto','Cantidad','P.Unitario','Subtotal']], body: rows, theme: 'striped', headStyles: { fillColor: [255,106,0] } });
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text('Gracias por confiar en Innova SCAC 🧡', 14, doc.lastAutoTable.finalY + 10);
  doc.save('Recibo_Innova_' + pedido.id + '.pdf');
};


// ── NOTIFICACIONES (Fase 6) ──────────────────────────────────────────────────
async function cargarNotificaciones() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const data = await (await fetch('/api/notificaciones', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    const noLeidas = data.filter(n => !n.leida).length;
    const badge = document.getElementById('notif-count');
    const wrapper = document.getElementById('notif-wrapper');
    if (wrapper) wrapper.style.display = 'inline-block';
    if (badge) {
      badge.textContent = noLeidas;
      badge.style.display = noLeidas > 0 ? 'inline-block' : 'none';
    }
  } catch(e) {}
}

document.getElementById('btn-notificaciones')?.addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const data = await (await fetch('/api/notificaciones', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    const msg = data.slice(0,5).map(n => `${n.leida ? '📭' : '📬'} ${n.mensaje}`).join('\n') || 'No hay notificaciones.';
    mostrarToast(data.length > 0 ? data[0].mensaje : 'No hay notificaciones nuevas.');
    // Mark all as read
    await fetch('/api/notificaciones/leer-todas', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token } });
    cargarNotificaciones();
  } catch(e) {}
});


// ── QR DE PAGO (Fase 3) ─────────────────────────────────────────────────────
async function cargarConfiguracionQR() {
  try {
    const d = await (await fetch('/api/configuracion-publica')).json();
    window._configPublica = d;
  } catch(e) {}
}
cargarConfiguracionQR();

function mostrarQRPago(metodo) {
  const box = document.getElementById('qr-pago-box');
  const img = document.getElementById('qr-pago-img');
  const titulo = document.getElementById('qr-pago-titulo');
  if (!box) return;
  const cfg = window._configPublica || {};
  const qr = metodo === 'Yape' ? cfg.qr_yape : metodo === 'Plin' ? cfg.qr_plin : null;
  if (qr) {
    img.src = qr; titulo.textContent = `QR de pago — ${metodo}`; box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}


// ── DASHBOARD CHARTS (Fase 5) ────────────────────────────────────────────────
let _chartMes = null, _chartTop = null;
async function cargarDashboardCharts() {
  const token = localStorage.getItem('token');
  try {
    const d = await (await fetch('/api/admin/estadisticas', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    // KPIs
    if (document.getElementById('kpi-total-pedidos')) {
      document.getElementById('kpi-total-pedidos').textContent = d.pedidos?.total ?? '–';
      document.getElementById('kpi-pendientes').textContent    = d.pedidos?.pendientes ?? '–';
      document.getElementById('kpi-entregados').textContent    = d.pedidos?.entregados ?? '–';
      document.getElementById('kpi-clientes').textContent      = d.clientes ?? '–';
      document.getElementById('kpi-productos').textContent     = '–';
      document.getElementById('kpi-categorias').textContent    = '–';
      document.getElementById('kpi-stock-bajo').textContent    = d.productos_agotados ?? '–';
    }
  } catch(e) { console.error('Error cargando dashboard', e); }
}


// ── ADMIN: CUPONES (Fase 4) ───────────────────────────────────────────────────
async function cargarAdminCupones() {
  const token = localStorage.getItem('token');
  const tbody = document.getElementById('tabla-admin-cupones');
  if (!tbody) return;
  try {
    const rows = await (await fetch('/api/admin/cupones', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="tabla-vacia">Sin cupones.</td></tr>'; return; }
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td><b>${c.codigo}</b></td>
        <td>${c.tipo === 'porcentaje' ? c.valor + '%' : 'S/ ' + c.valor}</td>
        <td>${c.tipo}</td>
        <td>${c.usos_actuales}/${c.usos_max}</td>
        <td>${c.fecha_expira ? c.fecha_expira.split('T')[0] : '—'}</td>
        <td><button onclick="eliminarCupon(${c.id})" style="background:#ff2d55;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;">Eliminar</button></td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="tabla-vacia">Error.</td></tr>'; }
}

window.eliminarCupon = async function(id) {
  if (!await confirmarAccion('¿Eliminar este cupón?')) return;
  const token = localStorage.getItem('token');
  await fetch('/api/admin/cupones/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
  cargarAdminCupones();
};

document.getElementById('form-cupon')?.addEventListener('submit', async e => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const body = {
    codigo:    document.getElementById('cupon-codigo').value,
    tipo:      document.getElementById('cupon-tipo').value,
    valor:     document.getElementById('cupon-valor').value,
    usos_max:  document.getElementById('cupon-usos').value,
    fecha_expira: document.getElementById('cupon-expira').value || null
  };
  const res = await fetch('/api/admin/cupones', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body) });
  const d = await res.json();
  if (res.ok) { mostrarToast('✅ Cupón creado: ' + body.codigo); e.target.reset(); cargarAdminCupones(); }
  else mostrarToast('❌ ' + d.error);
});

// ── ADMIN: RESEÑAS ────────────────────────────────────────────────────────────
async function cargarAdminResenas() {
  const token = localStorage.getItem('token');
  const tbody = document.getElementById('tabla-admin-resenas');
  if (!tbody) return;
  try {
    const rows = await (await fetch('/api/admin/resenas', { headers: { 'Authorization': 'Bearer ' + token } })).json();
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="tabla-vacia">Sin reseñas.</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.producto}</td>
        <td>${r.autor}</td>
        <td>${'⭐'.repeat(r.estrellas)}</td>
        <td>${r.comentario || '—'}</td>
        <td>${new Date(r.fecha).toLocaleDateString('es-PE')}</td>
        <td><button onclick="eliminarResena(${r.id})" style="background:#ff2d55;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;">Eliminar</button></td>
      </tr>`).join('');
  } catch(e) { tbody.innerHTML = '<tr><td colspan="6" class="tabla-vacia">Error.</td></tr>'; }
}

window.eliminarResena = async function(id) {
  if (!await confirmarAccion('¿Eliminar esta reseña?')) return;
  const token = localStorage.getItem('token');
  await fetch('/api/admin/resenas/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
  cargarAdminResenas();
};

// ── ADMIN: QR UPLOAD con detección y recorte automático ──────────────────────

// Almacena los blobs ya recortados listos para subir
const _qrCroppedBlobs = { yape: null, plin: null };

/**
 * Carga una imagen, usa jsQR para detectar el código QR,
 * recorta con padding y lo dibuja en el canvas.
 * Devuelve true si detectó el QR.
 */
async function procesarImagenQR(file, canvasId, estadoId) {
  const canvas  = document.getElementById(canvasId);
  const estadoEl = document.getElementById(estadoId);
  if (!canvas || !estadoEl) return false;

  estadoEl.innerHTML = '⏳ Analizando imagen…';

  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        // Dibuja la imagen original en un canvas temporal para leer píxeles
        const tmp = document.createElement('canvas');
        tmp.width = img.width; tmp.height = img.height;
        const ctx = tmp.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, tmp.width, tmp.height);

        // Detectar QR con jsQR
        const code = typeof jsQR !== 'undefined'
          ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
          : null;

        if (code) {
          // Calcular bounding box del QR con padding del 8%
          const pts = [code.location.topLeftCorner, code.location.topRightCorner,
                       code.location.bottomLeftCorner, code.location.bottomRightCorner];
          const minX = Math.min(...pts.map(p => p.x));
          const minY = Math.min(...pts.map(p => p.y));
          const maxX = Math.max(...pts.map(p => p.x));
          const maxY = Math.max(...pts.map(p => p.y));
          const pad = Math.max(maxX - minX, maxY - minY) * 0.10;
          const x = Math.max(0, Math.floor(minX - pad));
          const y = Math.max(0, Math.floor(minY - pad));
          const w = Math.min(img.width  - x, Math.ceil(maxX - minX + pad * 2));
          const h = Math.min(img.height - y, Math.ceil(maxY - minY + pad * 2));

          // Dibujar en el canvas de preview con fondo blanco
          const size = Math.max(w, h);
          canvas.width = size; canvas.height = size;
          const ctx2 = canvas.getContext('2d');
          ctx2.fillStyle = '#ffffff';
          ctx2.fillRect(0, 0, size, size);
          const offX = Math.floor((size - w) / 2);
          const offY = Math.floor((size - h) / 2);
          ctx2.drawImage(tmp, x, y, w, h, offX, offY, w, h);
          canvas.style.display = 'block';

          // Convertir a Blob para subir
          canvas.toBlob(blob => {
            estadoEl.innerHTML = '✅ QR detectado y recortado. Vista previa:';
            resolve(blob);
          }, 'image/png');
        } else {
          // No se detectó QR: mostrar la imagen original
          canvas.width = Math.min(img.width, 300);
          canvas.height = Math.round(img.height * (canvas.width / img.width));
          const ctx2 = canvas.getContext('2d');
          ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.style.display = 'block';
          estadoEl.innerHTML = '⚠️ No se detectó QR automáticamente. Se usará la imagen tal cual.';
          canvas.toBlob(blob => resolve(blob), 'image/png');
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Al seleccionar imagen de Yape
document.getElementById('config-qr-yape')?.addEventListener('change', async function() {
  if (!this.files[0]) return;
  _qrCroppedBlobs.yape = await procesarImagenQR(this.files[0], 'canvas-qr-yape', 'estado-qr-yape');
  actualizarBtnQR();
});

// Al seleccionar imagen de Plin
document.getElementById('config-qr-plin')?.addEventListener('change', async function() {
  if (!this.files[0]) return;
  _qrCroppedBlobs.plin = await procesarImagenQR(this.files[0], 'canvas-qr-plin', 'estado-qr-plin');
  actualizarBtnQR();
});

function actualizarBtnQR() {
  const btn = document.getElementById('btn-guardar-qr');
  if (btn) btn.disabled = !_qrCroppedBlobs.yape && !_qrCroppedBlobs.plin;
}

document.getElementById('btn-guardar-qr')?.addEventListener('click', async () => {
  if (!_qrCroppedBlobs.yape && !_qrCroppedBlobs.plin) { mostrarToast('Selecciona al menos un QR.'); return; }
  const token = localStorage.getItem('token');
  const fd = new FormData();
  if (_qrCroppedBlobs.yape) fd.append('qr_yape', _qrCroppedBlobs.yape, 'qr_yape.png');
  if (_qrCroppedBlobs.plin)  fd.append('qr_plin',  _qrCroppedBlobs.plin,  'qr_plin.png');
  const btn = document.getElementById('btn-guardar-qr');
  if (btn) { btn.disabled = true; btn.textContent = 'Subiendo…'; }
  try {
    const res = await fetch('/api/admin/configuracion/qr', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd });
    const d = await res.json();
    if (res.ok) {
      mostrarToast('✅ QRs actualizados correctamente.');
      const msg = document.getElementById('qr-guardado-msg');
      if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 4000); }
      cargarConfiguracionQR();
      _qrCroppedBlobs.yape = null; _qrCroppedBlobs.plin = null;
      if (btn) { btn.textContent = '⬆️ Subir QRs recortados'; btn.disabled = true; }
    } else {
      mostrarToast('❌ ' + d.error);
      if (btn) { btn.disabled = false; btn.textContent = '⬆️ Subir QRs recortados'; }
    }
  } catch(e) {
    mostrarToast('Error de conexión.');
    if (btn) { btn.disabled = false; btn.textContent = '⬆️ Subir QRs recortados'; }
  }
});


// ── MOSTRAR QR según método de pago ─────────────────────────────────────────
document.getElementById('pedido-metodo-pago')?.addEventListener('change', function() {
  const metodo = this.value;
  mostrarQRPago(metodo);
  
  const comprobanteBox = document.getElementById('comprobante-box');
  const compInput = document.getElementById('pedido-comprobante');
  if (comprobanteBox) {
    if (['Yape', 'Plin', 'Transferencia'].includes(metodo)) {
      comprobanteBox.style.display = 'block';
      if(compInput) compInput.required = true;
    } else {
      comprobanteBox.style.display = 'none';
      if(compInput) {
        compInput.required = false;
        compInput.value = ''; // Limpiar si cambian a efectivo
      }
    }
  }
});



// Mostrar barra de búsqueda para clientes logueados
function toggleSearchBar(show) {
  const sb = document.getElementById('search-global-wrapper');
  if (sb) sb.style.display = show ? 'block' : 'none';
}


// Auto-cargar notificaciones si hay sesión activa
(function() {
  const token = localStorage.getItem('token');
  if (token) {
    setTimeout(cargarNotificaciones, 800);
  }
})();


// ==========================================
// LOGICA DEL CARRITO DROPDOWN Y QUANTITY INPUT
// ==========================================

document.addEventListener('input', e => {
  if (e.target.classList.contains('cantidad-input')) {
    const val = parseInt(e.target.value) || 0;
    const prodId = e.target.id.replace('cantidad-', '');
    const oldVal = cantidadesSeleccionadas[prodId] || 0;
    const delta = val - oldVal;
    
    if (delta !== 0) {
       cambiarCantidad(prodId, delta);
       e.target.value = cantidadesSeleccionadas[prodId] || 0;
    }
  }
});

const btnCarritoDropdown = document.getElementById('btn-carrito-dropdown');
const btnCerrarCarrito = document.getElementById('btn-cerrar-carrito');
const carritoDropdown = document.getElementById('carrito-dropdown');
const carritoBody = document.getElementById('carrito-dropdown-body');
const carritoTotal = document.getElementById('carrito-dropdown-total');
const btnProcesarCarrito = document.getElementById('btn-procesar-carrito');

function renderizarCarritoDropdown() {
  if (!carritoBody) return;
  
  const seleccion = obtenerSeleccionCompleta();
  if (seleccion.length === 0) {
    carritoBody.innerHTML = `
      <div class="empty-state-box">
        <svg class="empty-state-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
        <p>Tu carrito está vacío</p>
        <button class="btn-primary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="document.getElementById('carrito-dropdown').style.display='none'; document.querySelector('.nav-link[data-vista=\\'vista-catalogos\\']').click()">Explorar catálogo</button>
      </div>
    `;
    if(carritoTotal) carritoTotal.textContent = 'S/ 0.00';
    if(btnProcesarCarrito) btnProcesarCarrito.disabled = true;
    return;
  }
  
  if(btnProcesarCarrito) btnProcesarCarrito.disabled = false;
  
  let totalSoles = 0;
  carritoBody.innerHTML = seleccion.map(item => {
    const pList = productosPorCategoriaCache[item.categoria] || [];
    const prod = pList.find(p => String(p.id) === String(item.productoId));
    const precio = prod ? Number(prod.precio) : 0;
    const subtotal = precio * item.cantidad;
    totalSoles += subtotal;
    
    return `
      <div class="carrito-item">
        <div class="carrito-item-info">
          <span class="carrito-item-title">${item.cantidad}x ${item.nombre}</span>
          <span class="carrito-item-price">S/ ${subtotal.toFixed(2)}</span>
        </div>
        <button class="carrito-remover-btn" data-id="${item.productoId}" data-cat="${item.categoria}" title="Remover">✕</button>
      </div>
    `;
  }).join('');
  
  if(carritoTotal) carritoTotal.textContent = `S/ ${totalSoles.toFixed(2)}`;
}

if (btnCarritoDropdown) {
  btnCarritoDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    renderizarCarritoDropdown();
    if(carritoDropdown.style.display === 'none') {
      carritoDropdown.style.display = 'flex';
      document.getElementById('notif-dropdown')?.style && (document.getElementById('notif-dropdown').style.display = 'none');
    } else {
      carritoDropdown.style.display = 'none';
    }
  });
}

if (btnCerrarCarrito) {
  btnCerrarCarrito.addEventListener('click', () => {
    carritoDropdown.style.display = 'none';
  });
}

if (carritoBody) {
  carritoBody.addEventListener('click', e => {
    const btn = e.target.closest('.carrito-remover-btn');
    if (btn) {
      const pid = btn.dataset.id;
      const cat = btn.dataset.cat;
      const actual = cantidadesSeleccionadas[pid] || 0;
      if (actual > 0) {
        cambiarCantidad(pid, -actual);
      }
      renderizarCarritoDropdown();
      if (categoriaActual === cat) {
         mostrarProductosDeCategoria(cat);
      }
    }
  });
}

if (btnProcesarCarrito) {
  btnProcesarCarrito.addEventListener('click', () => {
    carritoDropdown.style.display = 'none';
    const btnDetalle = document.getElementById('btn-detalle-pedir');
    if (btnDetalle) btnDetalle.click();
  });
}

document.addEventListener('click', e => {
  if (carritoDropdown && carritoDropdown.style.display === 'flex' && !e.target.closest('#carrito-wrapper')) {
    carritoDropdown.style.display = 'none';
  }
});
