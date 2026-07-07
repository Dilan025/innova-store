require('dotenv').config();
const express = require('express');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const db = require('./pg_db.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1); // Necesario para que express-rate-limit funcione detrás de Render
const PORT = process.env.PORT || 3000;

const SECRET_KEY = process.env.JWT_SECRET || 'innova_secreto_super_seguro';
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET no está definido en .env — usando clave por defecto (solo para desarrollo).');
}

const ADMIN_EMAIL = 'admin@innovascac.com';
const STOCK_MAXIMO = Number(process.env.STOCK_MAXIMO) || 100000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());

// Límite global: 200 peticiones por minuto por IP en cualquier ruta /api/
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', globalLimiter);
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false
});
const registroLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados registros desde esta conexión. Espera unos minutos e intenta de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false
});
const recuperarLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiadas solicitudes de recuperación. Espera unos minutos e intenta de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false
});

let transportadorCorreo = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transportadorCorreo = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        requireTLS: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
} else {
    console.warn('⚠️  EMAIL_USER/EMAIL_PASS no configurados — los enlaces de recuperación se mostrarán en consola.');
}

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
            return cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes o PDF.'));
        }
        cb(null, true);
    }
});

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const uploadImagenProducto = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!TIPOS_IMAGEN.includes(file.mimetype)) {
            return cb(new Error('Solo se aceptan imágenes (JPG, PNG, WEBP o GIF) para la foto del producto.'));
        }
        cb(null, true);
    }
});



// ── CREACIÓN / MIGRACIÓN DE TABLAS ──────────────────────────────────────────
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT, correo TEXT UNIQUE, telefono TEXT, password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER, servicio TEXT, cantidad INTEGER,
        detalles TEXT, archivo TEXT,
        estado TEXT DEFAULT 'Pendiente',
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS catalogos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        servicio TEXT, titulo TEXT, subtitulo TEXT, icono TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT, categoria TEXT, precio REAL DEFAULT 0, stock INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE, imagen TEXT, orden INTEGER DEFAULT 0
    )`);

    // NUEVO: tabla de ítems del pedido para soporte de carrito multi-producto.
    db.run(`CREATE TABLE IF NOT EXISTS pedido_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER,
        nombre_producto TEXT,
        cantidad INTEGER DEFAULT 1,
        precio_unitario REAL DEFAULT 0,
        FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS movimientos_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER, producto_nombre TEXT,
        cambio INTEGER, stock_resultante INTEGER,
        motivo TEXT, usuario TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        telefono TEXT, whatsapp TEXT, horario_semana TEXT, horario_domingo TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS cupones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        tipo TEXT DEFAULT 'porcentaje',
        valor REAL DEFAULT 0,
        usos_max INTEGER DEFAULT 1,
        usos_actuales INTEGER DEFAULT 0,
        fecha_expira DATETIME,
        activo INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS resenas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        estrellas INTEGER DEFAULT 5,
        comentario TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(producto_id) REFERENCES productos(id),
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS puntos_lealtad (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER UNIQUE NOT NULL,
        puntos INTEGER DEFAULT 0,
        puntos_totales INTEGER DEFAULT 0,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS historial_puntos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        cambio INTEGER,
        motivo TEXT,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        mensaje TEXT,
        tipo TEXT DEFAULT 'info',
        leida INTEGER DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);


    // Migraciones PostgreSQL
    db.run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    db.run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'cliente'`);
    db.run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    db.run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_expira TIMESTAMP`);
    db.run(`UPDATE usuarios SET rol = 'admin' WHERE correo = $1`, [ADMIN_EMAIL]);

    db.run(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS producto_id INTEGER`);
    db.run(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pago TEXT`);
    db.run(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante TEXT`);
    
    db.run(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS qr_yape TEXT`);
    db.run(`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS qr_plin TEXT`);
    
    db.run(`ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen TEXT`);
    db.run(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagen TEXT`);
    db.run(`ALTER TABLE categorias ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0`);

    // Datos semilla
    db.get("SELECT COUNT(*) AS count FROM categorias", (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare("INSERT INTO categorias (nombre) VALUES (?)");
            ["DTF Textil", "UV DTF", "Banners y Viniles", "Diseño Gráfico", "Sublimación", "Equipos Tecnológicos"]
                .forEach(n => stmt.run(n));
            stmt.finalize();
        }
    });

    db.get("SELECT COUNT(*) AS count FROM configuracion", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO configuracion (id, telefono, whatsapp, horario_semana, horario_domingo) VALUES (1, ?, ?, ?, ?)`,
                ['925 950 350', '51925950350', '9:00 am – 7:00 pm', '10:00 am – 2:00 pm']);
        }
    });

    db.get("SELECT COUNT(*) AS count FROM catalogos", (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare("INSERT INTO catalogos (servicio, titulo, subtitulo, icono) VALUES (?, ?, ?, ?)");
            stmt.run("DTF Textil", "Catálogo DTF Verano 2026", "Estampados full color", "👕");
            stmt.run("DTF Textil", "DTF para Casacas y Polos", "Alta durabilidad al lavado", "🧥");
            stmt.run("UV DTF", "UV DTF para Vidrio y Metal", "Superficies rígidas", "🖼️");
            stmt.run("Banners y Viniles", "Banners Publicitarios", "Gran formato exterior", "🏷️");
            stmt.finalize();
        }
    });
});


// Backup local deshabilitado por uso de PostgreSQL en la nube

// ── MIDDLEWARES DE AUTENTICACIÓN ─────────────────────────────────────────────
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'No autorizado. Inicia sesión.' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
        req.usuario = decoded;
        next();
    });
};

const requiereAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso restringido: esta acción es solo para el Administrador.' });
    }
    next();
};

// ── FUNCIÓN AUXILIAR ─────────────────────────────────────────────────────────
function registrarMovimientoStock(productoId, productoNombre, cambio, stockResultante, motivo, usuario) {
    db.run(
        "INSERT INTO movimientos_stock (producto_id, producto_nombre, cambio, stock_resultante, motivo, usuario) VALUES (?, ?, ?, ?, ?, ?)",
        [productoId, productoNombre, cambio, stockResultante, motivo, usuario || 'sistema'],
        (err) => { if (err) console.error('No se pudo registrar el movimiento de stock:', err.message); }
    );
}

// ── RUTAS PÚBLICAS ───────────────────────────────────────────────────────────
app.post('/api/registro', registroLimiter, async (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const correo = (req.body.correo || '').trim();
    const telefono = (req.body.telefono || '').trim();
    const { password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO usuarios (nombre, correo, telefono, password, fecha_registro, rol) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'cliente')`,
            [nombre, correo, telefono, hashedPassword],
            function(err) {
                if (err) return res.status(400).json({ error: 'El correo ya está registrado.' });
                res.status(201).json({ mensaje: 'Usuario registrado.' });
            }
        );
    } catch (error) { res.status(500).json({ error: 'Error del servidor.' }); }
});

app.post('/api/login', loginLimiter, (req, res) => {
    const correo = (req.body.correo || '').trim();
    const { password } = req.body;
    db.get(`SELECT * FROM usuarios WHERE correo = ?`, [correo], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        const token = jwt.sign({ id: user.id, correo: user.correo, rol: user.rol || 'cliente' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, userData: { nombre: user.nombre, correo: user.correo, telefono: user.telefono, rol: user.rol || 'cliente' } });
    });
});

app.post('/api/recuperar-password', recuperarLimiter, (req, res) => {
    const correo = (req.body.correo || '').trim();
    if (!correo) return res.status(400).json({ error: 'Ingresa tu correo.' });

    db.get('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, user) => {
        if (err) return res.status(500).json({ error: 'Error de base de datos.' });
        if (!user) return res.status(404).json({ error: 'Este correo no está registrado en el sistema.' });
        
        const token = crypto.randomBytes(32).toString('hex');
        const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        db.run('UPDATE usuarios SET reset_token = ?, reset_expira = ? WHERE id = ?', [token, expira, user.id], async (errUpdate) => {
            if (errUpdate) return res.status(500).json({ error: 'No se pudo generar el enlace.' });
            const enlace = `${req.protocol}://${req.get('host')}/?resetToken=${token}`;
            
            if (transportadorCorreo) {
                try {
                    // Timeout de 5 segundos para evitar que Render congele la petición
                    const sendMailPromise = transportadorCorreo.sendMail({
                        from: process.env.EMAIL_USER,
                        to: user.correo,
                        subject: 'Recupera tu contraseña — Innova SCAC',
                        html: `<p>Hola ${user.nombre || ''},</p>
                               <p>Haz clic en el siguiente enlace (válido por 1 hora):</p>
                               <p><a href="${enlace}">${enlace}</a></p>
                               <p>Si no pediste esto, ignora este correo.</p>`
                    });

                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
                    
                    await Promise.race([sendMailPromise, timeoutPromise]);
                    return res.json({ mensaje: '¡Listo! Hemos enviado el enlace de recuperación a tu correo.' });
                } catch (errCorreo) {
                    console.error('Error al enviar correo (posible bloqueo de Render):', errCorreo.message);
                    return res.json({ 
                        mensaje: 'El correo tardó demasiado o no se pudo enviar. Puedes usar este enlace para continuar tu prueba:',
                        enlace_fallback: enlace 
                    });
                }
            } else {
                return res.json({ 
                    mensaje: 'Correo no configurado. Usa este enlace para continuar la prueba:',
                    enlace_fallback: enlace 
                });
            }
        });
    });
});

app.post('/api/restablecer-password', (req, res) => {
    const { token, nuevaPassword } = req.body;
    if (!token || !nuevaPassword || nuevaPassword.length < 6)
        return res.status(400).json({ error: 'Datos inválidos. La contraseña debe tener al menos 6 caracteres.' });

    db.get('SELECT * FROM usuarios WHERE reset_token = ?', [token], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Enlace inválido o ya utilizado.' });
        if (!user.reset_expira || new Date(user.reset_expira) < new Date())
            return res.status(400).json({ error: 'El enlace expiró. Solicita uno nuevo.' });

        const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
        db.run('UPDATE usuarios SET password = ?, reset_token = NULL, reset_expira = NULL WHERE id = ?',
            [hashedPassword, user.id], (errUpdate) => {
                if (errUpdate) return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
                res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
            });
    });
});

// MEJORA: ordena por campo 'orden' (manual) con fallback alfabético.
app.get('/api/categorias', (req, res) => {
    db.all("SELECT id, nombre, imagen, orden FROM categorias ORDER BY orden ASC, nombre ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener categorías.' });
        res.json(rows);
    });
});

// NUEVO: top productos más pedidos (calculado con pedido_items reales).
app.get('/api/productos/destacados', (req, res) => {
    const sql = `
        SELECT p.id, p.nombre, p.categoria, p.precio, p.stock, p.imagen,
               COUNT(pi.id) AS total_pedidos
        FROM productos p
        LEFT JOIN pedido_items pi ON pi.producto_id = p.id
        WHERE p.stock > 0
        GROUP BY p.id
        ORDER BY total_pedidos DESC, p.stock DESC
        LIMIT 6`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener destacados.' });
        res.json(rows);
    });
});

app.get('/api/productos', (req, res) => {
    const { categoria } = req.query;
    const sql = categoria
        ? "SELECT id, nombre, categoria, precio, stock, imagen FROM productos WHERE categoria = ? ORDER BY nombre"
        : "SELECT id, nombre, categoria, precio, stock, imagen FROM productos ORDER BY nombre";
    const params = categoria ? [categoria] : [];
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener productos.' });
        res.json(rows);
    });
});

app.get('/api/configuracion', (req, res) => {
    db.get(
        "SELECT telefono, whatsapp, horario_semana AS horarioSemana, horario_domingo AS horarioDomingo FROM configuracion WHERE id = 1",
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Error al obtener la configuración.' });
            res.json(row || {});
        }
    );
});

// ── NUEVO: PEDIDO MULTI-PRODUCTO (carrito completo) ──────────────────────────
app.post('/api/pedidos-carrito', verificarToken, upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'comprobante', maxCount: 1 }]), (req, res) => {
    let { items, detalles, metodo_pago } = req.body;
    const archivoUrl = (req.files && req.files['archivo']) ? '/uploads/' + req.files['archivo'][0].filename : null;
    const comprobanteUrl = (req.files && req.files['comprobante']) ? '/uploads/' + req.files['comprobante'][0].filename : null;
    
    if (['Yape', 'Plin', 'Transferencia'].includes(metodo_pago) && !comprobanteUrl) {
        return res.status(400).json({ error: 'Debes adjuntar el comprobante de pago.' });
    }
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: 'El carrito está vacío.' });

    const productosActualizados = [];

    const procesarItem = (index) => {
        if (index === items.length) {
            // Todos los ítems pasaron → crear el pedido
            const servicioPrincipal = items[0].categoria || items[0].nombre || 'Pedido múltiple';
            const cantidadTotal = items.reduce((s, i) => s + i.cantidad, 0);
            const resumen = items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
            const detallesFinal = detalles ? `${detalles} | ${resumen}` : resumen;

            db.run(
                `INSERT INTO pedidos (usuario_id, servicio, cantidad, detalles, estado, comprobante, metodo_pago, archivo) VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?)`,
                [req.usuario.id, servicioPrincipal, cantidadTotal, detallesFinal, comprobanteUrl, metodo_pago, archivoUrl],
                function(errPedido) {
                    if (errPedido) {
                        productosActualizados.forEach(p => {
                            if (p.id) db.run('UPDATE productos SET stock = stock + ? WHERE id = ?', [p.cantidad, p.id]);
                        });
                        return res.status(500).json({ error: 'Error al crear el pedido.' });
                    }

                    const pedidoId = this.lastID;
                    const stmtItem = db.prepare(
                        `INSERT INTO pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)`
                    );
                    items.forEach(item => {
                        stmtItem.run(pedidoId, item.producto_id || null, item.nombre, item.cantidad, item.precio_unitario || 0);
                        const stockFinal = (productosActualizados.find(p => p.id == item.producto_id)?.stockFinal) || 0;
                        if (item.producto_id) {
                            registrarMovimientoStock(item.producto_id, item.nombre, -item.cantidad, stockFinal,
                                `Descuento por pedido #${pedidoId} (carrito)`, req.usuario?.correo);
                        }
                    });
                    stmtItem.finalize();
                    // ─ Otorgar puntos de lealtad ─────────────────────────
                    otorgarPuntos(req.usuario.id, pedidoId, items.length);
                    // ─ Notificación in-app ────────────────────────────────
                    crearNotificacion(req.usuario.id,
                        `✅ Pedido #${pedidoId} recibido. Pronto nos pondremos en contacto contigo.`,
                        'pedido');
                    // ─ Email de confirmación ──────────────────────────────
                    if (transportadorCorreo) {
                        db.get('SELECT nombre, correo FROM usuarios WHERE id = ?',
                            [req.usuario.id], async (eU, usr) => {
                                if (usr && usr.correo) {
                                    try {
                                        await transportadorCorreo.sendMail({
                                            from: `"Innova SCAC" <${process.env.EMAIL_USER}>`,
                                            to: usr.correo,
                                            subject: `✅ Pedido #${pedidoId} confirmado — Innova SCAC`,
                                            html: `<div style="font-family:sans-serif;max-width:500px;">
                                                   <h2 style="color:#ff6a00;">¡Hola ${usr.nombre || ''}! 🧡</h2>
                                                   <p>Tu pedido <strong>#${pedidoId}</strong> fue recibido correctamente.</p>
                                                   <p><strong>Productos:</strong><br>${items.map(i => `• ${i.cantidad}x ${i.nombre}`).join('<br>')}</p>
                                                   <p>Te avisaremos cuando esté en camino. ¡Gracias por confiar en Innova SCAC!</p>
                                                   <hr><p style="font-size:12px;color:#999;">Trujillo, La Libertad, Perú · innovascac.peru</p></div>`
                                        });
                                    } catch(eM) { console.error('Email pedido no enviado:', eM.message); }
                                }
                            });
                    }
                    res.json({ mensaje: 'Pedido registrado con éxito', id_pedido: pedidoId, items_guardados: items.length });
                }
            );
            return;
        }

        const item = items[index];
        const cantNum = Math.max(1, Number(item.cantidad) || 1);

        if (!item.producto_id) {
            productosActualizados.push({ id: null, cantidad: cantNum, stockFinal: 0 });
            return procesarItem(index + 1);
        }

        db.run(
            'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
            [cantNum, item.producto_id, cantNum],
            function(err) {
                if (err || this.changes === 0) {
                    productosActualizados.forEach(p => {
                        if (p.id) db.run('UPDATE productos SET stock = stock + ? WHERE id = ?', [p.cantidad, p.id]);
                    });
                    return res.status(400).json({ error: `Stock insuficiente para "${item.nombre}". Reduce la cantidad e intenta de nuevo.` });
                }
                db.get('SELECT stock FROM productos WHERE id = ?', [item.producto_id], (e, row) => {
                    productosActualizados.push({ id: item.producto_id, cantidad: cantNum, stockFinal: row ? row.stock : 0 });
                    procesarItem(index + 1);
                });
            }
        );
    };

    procesarItem(0);
});

// ── PEDIDO SIMPLE (con archivo adjunto) ──────────────────────────────────────
app.post('/api/pedidos', verificarToken, upload.fields([{ name: 'archivo', maxCount: 1 }, { name: 'comprobante', maxCount: 1 }]), (req, res) => {
    const { servicio, cantidad, detalles, producto_id, metodo_pago } = req.body;
    const archivoUrl = (req.files && req.files['archivo']) ? '/uploads/' + req.files['archivo'][0].filename : null;
    const comprobanteUrl = (req.files && req.files['comprobante']) ? '/uploads/' + req.files['comprobante'][0].filename : null;
    
    if (['Yape', 'Plin', 'Transferencia'].includes(metodo_pago) && !comprobanteUrl) {
        return res.status(400).json({ error: 'Debes adjuntar el comprobante de pago.' });
    }

    const cantidadNum = Number(cantidad) || 1;

    const buscarProducto = producto_id
        ? (cb) => db.get("SELECT * FROM productos WHERE id = ?", [producto_id], cb)
        : (cb) => db.all("SELECT * FROM productos WHERE nombre = ? OR categoria = ?", [servicio, servicio], (err, filas) => {
            if (err) return cb(err);
            cb(null, (filas && filas.length === 1) ? filas[0] : null);
        });

    buscarProducto((err, producto) => {
        if (err) return res.status(500).json({ error: 'Error al verificar stock.' });

        if (!producto) {
            db.run("INSERT INTO pedidos (usuario_id, servicio, cantidad, detalles, archivo, producto_id, metodo_pago, comprobante) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [req.usuario.id, servicio, cantidadNum, detalles, archivoUrl, null, req.body.metodo_pago, comprobanteUrl], function(err) {
                    if (err) return res.status(500).json({ error: 'Error al guardar pedido.' });
                    res.json({ mensaje: 'Pedido registrado con éxito', id_pedido: this.lastID });
                });
            return;
        }

        db.run(
            "UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?",
            [cantidadNum, producto.id, cantidadNum],
            function(errUpdate) {
                if (errUpdate) return res.status(500).json({ error: 'Error al actualizar el stock.' });
                if (this.changes === 0) {
                    db.get("SELECT stock FROM productos WHERE id = ?", [producto.id], (e, actual) => {
                        const disponible = actual ? actual.stock : 0;
                        res.status(400).json({ error: `Stock insuficiente. Stock disponible: ${disponible} unidades.` });
                    });
                    return;
                }

                db.run("INSERT INTO pedidos (usuario_id, servicio, cantidad, detalles, archivo, producto_id, metodo_pago, comprobante) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [req.usuario.id, servicio || producto.nombre, cantidadNum, detalles, archivoUrl, producto.id],
                    function(errInsert) {
                        if (errInsert) {
                            db.run("UPDATE productos SET stock = stock + ? WHERE id = ?", [cantidadNum, producto.id]);
                            return res.status(500).json({ error: 'Error al guardar pedido.' });
                        }
                        const stockFinal = producto.stock - cantidadNum;
                        registrarMovimientoStock(producto.id, producto.nombre, -cantidadNum, stockFinal, `Descuento por pedido #${this.lastID}`, req.usuario?.correo);
                        res.json({ mensaje: 'Pedido registrado con éxito', id_pedido: this.lastID, stock_actualizado: stockFinal });
                    });
            }
        );
    });
});

app.get('/api/mis-pedidos', verificarToken, (req, res) => {
    db.all("SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY fecha DESC", [req.usuario.id], (err, pedidos) => {
        if (err) return res.status(500).json({ error: 'Error al obtener pedidos.' });
        if (!pedidos.length) return res.json([]);
        const ids = pedidos.map(p => p.id);
        db.all(
            `SELECT * FROM pedido_items WHERE pedido_id IN (${ids.map(() => '?').join(',')})`,
            ids,
            (errItems, items) => {
                if (errItems) return res.json(pedidos);
                const itemsPorPedido = {};
                (items || []).forEach(item => {
                    if (!itemsPorPedido[item.pedido_id]) itemsPorPedido[item.pedido_id] = [];
                    itemsPorPedido[item.pedido_id].push(item);
                });
                res.json(pedidos.map(p => ({ ...p, items: itemsPorPedido[p.id] || [] })));
            }
        );
    });
});

app.put('/api/mis-pedidos/:id/confirmar', verificarToken, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?", [id, req.usuario.id], (err, pedido) => {
        if (err || !pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
        if (pedido.estado !== 'Entregado') return res.status(400).json({ error: 'El pedido aún no fue marcado como entregado.' });
        db.run("UPDATE pedidos SET estado = ? WHERE id = ?", ['Confirmado', id], function(err) {
            if (err) return res.status(500).json({ error: 'Error al confirmar el pedido.' });
            res.json({ mensaje: 'Pedido confirmado como recibido.' });
        });
    });
});

app.get('/api/catalogos/:servicio', (req, res) => {
    const servicio = req.params.servicio;
    const sql = (servicio === 'TODOS') ? "SELECT * FROM catalogos" : "SELECT * FROM catalogos WHERE servicio = ?";
    const params = (servicio === 'TODOS') ? [] : [servicio];
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al consultar catálogos.' });
        res.json(rows);
    });
});

// ── RUTAS ADMIN ──────────────────────────────────────────────────────────────
app.get('/api/admin/pedidos', verificarToken, requiereAdmin, (req, res) => {
    const sql = `SELECT p.id, p.servicio, p.cantidad, p.detalles, p.archivo, p.fecha, p.estado, u.nombre, u.correo, u.telefono
                 FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id ORDER BY p.fecha DESC`;
    db.all(sql, [], (err, pedidos) => {
        if (err) return res.status(500).json({ error: 'Error del servidor.' });
        if (!pedidos.length) return res.json([]);
        const ids = pedidos.map(p => p.id);
        db.all(
            `SELECT * FROM pedido_items WHERE pedido_id IN (${ids.map(() => '?').join(',')})`,
            ids,
            (errItems, items) => {
                const itemsPorPedido = {};
                (items || []).forEach(item => {
                    if (!itemsPorPedido[item.pedido_id]) itemsPorPedido[item.pedido_id] = [];
                    itemsPorPedido[item.pedido_id].push(item);
                });
                res.json(pedidos.map(p => ({ ...p, items: itemsPorPedido[p.id] || [] })));
            }
        );
    });
});

app.put('/api/admin/pedidos/:id/estado', verificarToken, requiereAdmin, (req, res) => {
    const { estado } = req.body;
    db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [estado, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error al actualizar.' });
        res.json({ mensaje: 'Estado actualizado.' });
    });
});

app.delete('/api/admin/pedidos/:id', verificarToken, requiereAdmin, (req, res) => {
    db.get("SELECT * FROM pedidos WHERE id = ?", [req.params.id], (err, pedido) => {
        if (err || !pedido) return res.status(500).json({ error: 'Error al obtener el pedido.' });

        db.all("SELECT * FROM pedido_items WHERE pedido_id = ?", [req.params.id], (errItems, items) => {
            db.run("DELETE FROM pedidos WHERE id = ?", [req.params.id], function(errDel) {
                if (errDel) return res.status(500).json({ error: 'Error al eliminar.' });
                db.run("DELETE FROM pedido_items WHERE pedido_id = ?", [req.params.id]);

                if (items && items.length > 0) {
                    // Pedido multi-producto: restaurar stock de cada ítem
                    items.forEach(item => {
                        if (!item.producto_id) return;
                        db.get('SELECT stock, nombre FROM productos WHERE id = ?', [item.producto_id], (e, prod) => {
                            if (!prod) return;
                            const nuevoStock = prod.stock + item.cantidad;
                            db.run('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, item.producto_id], () => {
                                registrarMovimientoStock(item.producto_id, prod.nombre, item.cantidad, nuevoStock,
                                    `Restauración por eliminación de pedido #${pedido.id}`, req.usuario?.correo);
                            });
                        });
                    });
                    return res.json({ mensaje: 'Pedido eliminado y stock restaurado.' });
                }

                // Pedido simple: restaurar por producto_id o buscar por nombre
                const restaurar = (producto) => {
                    if (!producto) return res.json({ mensaje: 'Pedido eliminado.' });
                    const nuevoStock = producto.stock + pedido.cantidad;
                    db.run("UPDATE productos SET stock = ? WHERE id = ?", [nuevoStock, producto.id], () => {
                        registrarMovimientoStock(producto.id, producto.nombre, pedido.cantidad, nuevoStock,
                            `Restauración por eliminación de pedido #${pedido.id}`, req.usuario?.correo);
                        res.json({ mensaje: 'Pedido eliminado y stock restaurado.' });
                    });
                };

                if (pedido.producto_id) {
                    db.get("SELECT * FROM productos WHERE id = ?", [pedido.producto_id], (e, p) => restaurar(p));
                } else {
                    db.get("SELECT * FROM productos WHERE nombre = ? OR categoria = ?",
                        [pedido.servicio, pedido.servicio], (e, p) => restaurar(p));
                }
            });
        });
    });
});

// ── PRODUCTOS (Admin) ─────────────────────────────────────────────────────────
app.get('/api/admin/productos', verificarToken, requiereAdmin, (req, res) => {
    db.all("SELECT * FROM productos ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener productos.' });
        res.json(rows);
    });
});

app.post('/api/admin/productos', verificarToken, requiereAdmin, (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;
    if (!nombre || precio == null || stock == null)
        return res.status(400).json({ error: 'Nombre, precio y stock son obligatorios.' });
    db.run("INSERT INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)",
        [nombre, categoria || '', Number(precio), Math.max(0, Number(stock))], function(err) {
            if (err) return res.status(500).json({ error: 'Error al guardar el producto.' });
            db.get("SELECT * FROM productos WHERE id = ?", [this.lastID], (e, row) => res.status(201).json(row));
        });
});

app.put('/api/admin/productos/:id/stock', verificarToken, requiereAdmin, (req, res) => {
    const { delta } = req.body;
    db.get("SELECT stock, nombre FROM productos WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Producto no encontrado.' });
        const nuevoStock = row.stock + Number(delta);
        if (nuevoStock < 0) return res.status(400).json({ error: 'No se puede tener stock negativo.' });
        if (nuevoStock > STOCK_MAXIMO) return res.status(400).json({ error: `El stock máximo permitido es ${STOCK_MAXIMO}.` });
        db.run("UPDATE productos SET stock = ? WHERE id = ?", [nuevoStock, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: 'Error al actualizar el stock.' });
            registrarMovimientoStock(req.params.id, row.nombre, Number(delta), nuevoStock, 'Ajuste manual en Panel Admin', req.usuario?.correo);
            db.get("SELECT * FROM productos WHERE id = ?", [req.params.id], (e, prod) => res.json(prod));
        });
    });
});

app.put('/api/admin/productos/:id', verificarToken, requiereAdmin, (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;
    if (!nombre || precio == null) return res.status(400).json({ error: 'Nombre y precio son obligatorios.' });
    const nuevoStock = stock !== undefined ? Math.max(0, Number(stock)) : undefined;
    db.get("SELECT stock FROM productos WHERE id = ?", [req.params.id], (errPrev, prevRow) => {
        const stockAnterior = prevRow ? prevRow.stock : null;
        const terminar = (err) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar el producto.' });
            db.get("SELECT * FROM productos WHERE id = ?", [req.params.id], (e, row) => {
                if (nuevoStock !== undefined && stockAnterior !== null && nuevoStock !== stockAnterior) {
                    registrarMovimientoStock(req.params.id, row?.nombre, nuevoStock - stockAnterior, nuevoStock, 'Edición de producto en Panel Admin', req.usuario?.correo);
                }
                res.json(row);
            });
        };
        if (nuevoStock !== undefined) {
            db.run("UPDATE productos SET nombre = ?, categoria = ?, precio = ?, stock = ? WHERE id = ?",
                [nombre.trim(), categoria || '', Number(precio), nuevoStock, req.params.id], terminar);
        } else {
            db.run("UPDATE productos SET nombre = ?, categoria = ?, precio = ? WHERE id = ?",
                [nombre.trim(), categoria || '', Number(precio), req.params.id], terminar);
        }
    });
});

app.delete('/api/admin/productos/:id', verificarToken, requiereAdmin, (req, res) => {
    db.run("DELETE FROM productos WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error al eliminar el producto.' });
        res.json({ mensaje: 'Producto eliminado.' });
    });
});

app.get('/api/admin/movimientos-stock', verificarToken, requiereAdmin, (req, res) => {
    db.all("SELECT * FROM movimientos_stock ORDER BY fecha DESC, id DESC LIMIT 200", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener el historial.' });
        res.json(rows);
    });
});

app.post('/api/admin/productos/:id/imagen', verificarToken, requiereAdmin, uploadImagenProducto.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen.' });
    const imagenUrl = '/uploads/' + req.file.filename;
    db.run("UPDATE productos SET imagen = ? WHERE id = ?", [imagenUrl, req.params.id], () => {
        db.get("SELECT * FROM productos WHERE id = ?", [req.params.id], (e, row) => res.json(row));
    });
});

// ── CATEGORÍAS (Admin) ────────────────────────────────────────────────────────
app.get('/api/admin/categorias', verificarToken, requiereAdmin, (req, res) => {
    db.all("SELECT id, nombre, imagen, orden FROM categorias ORDER BY orden ASC, nombre ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener categorías.' });
        res.json(rows);
    });
});

app.post('/api/admin/categorias', verificarToken, requiereAdmin, (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    db.run("INSERT INTO categorias (nombre) VALUES (?)", [nombre.trim()], function(err) {
        if (err) return res.status(400).json({ error: 'Ya existe una categoría con ese nombre.' });
        db.get("SELECT id, nombre, imagen, orden FROM categorias WHERE id = ?", [this.lastID], (e, row) => res.status(201).json(row));
    });
});

app.delete('/api/admin/categorias/:id', verificarToken, requiereAdmin, (req, res) => {
    // NUEVO: bloquear el borrado si la categoría todavía tiene productos.
    db.get("SELECT nombre FROM categorias WHERE id = ?", [req.params.id], (errCat, cat) => {
        if (errCat || !cat) return res.status(404).json({ error: 'Categoría no encontrada.' });
        db.get("SELECT COUNT(*) AS total FROM productos WHERE categoria = ?", [cat.nombre], (errCount, row) => {
            if (errCount) return res.status(500).json({ error: 'Error al verificar productos de la categoría.' });
            const total = row ? row.total : 0;
            if (total > 0) {
                return res.status(409).json({
                    error: `Esta categoría tiene ${total} producto${total === 1 ? '' : 's'}. Muévelos a otra categoría o elimínalos primero.`
                });
            }
            db.run("DELETE FROM categorias WHERE id = ?", [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: 'Error al eliminar la categoría.' });
                res.json({ mensaje: 'Categoría eliminada.' });
            });
        });
    });
});

// NUEVO: subir foto de portada para una categoría.
app.post('/api/admin/categorias/:id/imagen', verificarToken, requiereAdmin, uploadImagenProducto.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    const imagenUrl = '/uploads/' + req.file.filename;
    db.run("UPDATE categorias SET imagen = ? WHERE id = ?", [imagenUrl, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error al guardar la imagen de la categoría.' });
        db.get("SELECT id, nombre, imagen, orden FROM categorias WHERE id = ?", [req.params.id], (e, row) => res.json(row));
    });
});

// NUEVO: actualizar el orden manual de una categoría.
app.put('/api/admin/categorias/:id/orden', verificarToken, requiereAdmin, (req, res) => {
    const ordenNum = Math.max(0, Number(req.body.orden) || 0);
    db.run("UPDATE categorias SET orden = ? WHERE id = ?", [ordenNum, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error al actualizar el orden.' });
        res.json({ mensaje: 'Orden actualizado.' });
    });
});

// ── CLIENTES (Admin) ──────────────────────────────────────────────────────────
app.get('/api/admin/clientes', verificarToken, requiereAdmin, (req, res) => {
    db.all(
        "SELECT id, nombre, correo, telefono, fecha_registro FROM usuarios WHERE rol = 'cliente' ORDER BY fecha_registro DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error al obtener los clientes.' });
            res.json(rows);
        }
    );
});

// ── CONFIGURACIÓN (Admin) ─────────────────────────────────────────────────────
app.get('/api/admin/configuracion', verificarToken, requiereAdmin, (req, res) => {
    db.get(
        "SELECT telefono, whatsapp, horario_semana AS horarioSemana, horario_domingo AS horarioDomingo FROM configuracion WHERE id = 1",
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Error al obtener la configuración.' });
            res.json(row || {});
        }
    );
});

app.put('/api/admin/configuracion', verificarToken, requiereAdmin, (req, res) => {
    db.get("SELECT * FROM configuracion WHERE id = 1", [], (err, actual) => {
        if (err || !actual) return res.status(500).json({ error: 'Error al leer la configuración actual.' });
        const nueva = {
            telefono: req.body.telefono ?? actual.telefono,
            whatsapp: req.body.whatsapp ?? actual.whatsapp,
            horario_semana: req.body.horarioSemana ?? actual.horario_semana,
            horario_domingo: req.body.horarioDomingo ?? actual.horario_domingo
        };
        db.run(
            "UPDATE configuracion SET telefono = ?, whatsapp = ?, horario_semana = ?, horario_domingo = ? WHERE id = 1",
            [nueva.telefono, nueva.whatsapp, nueva.horario_semana, nueva.horario_domingo],
            function(err2) {
                if (err2) return res.status(500).json({ error: 'Error al guardar la configuración.' });
                res.json({
                    telefono: nueva.telefono,
                    whatsapp: nueva.whatsapp,
                    horarioSemana: nueva.horario_semana,
                    horarioDomingo: nueva.horario_domingo
                });
            }
        );
    });
});


// ── FASE 3: BUSCADOR INTELIGENTE ─────────────────────────────────────────────
app.get('/api/productos/buscar', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    db.all(
        `SELECT id, nombre, categoria, precio, stock, imagen FROM productos
         WHERE (LOWER(nombre) LIKE ? OR LOWER(categoria) LIKE ?) AND stock > 0
         ORDER BY nombre LIMIT 10`,
        [`%${q}%`, `%${q}%`],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ── FASE 3: QR de pago (Yape / Plin) ─────────────────────────────────────────
app.get('/api/configuracion-publica', (req, res) => {
    db.get(
        `SELECT telefono, whatsapp, horario_semana AS horarioSemana,
                horario_domingo AS horarioDomingo, qr_yape, qr_plin
         FROM configuracion WHERE id = 1`,
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row || {});
        }
    );
});

app.post('/api/admin/configuracion/qr', verificarToken, requiereAdmin,
    uploadImagenProducto.fields([{ name: 'qr_yape' }, { name: 'qr_plin' }]),
    (req, res) => {
        const updates = {};
        if (req.files && req.files['qr_yape'])
            updates.qr_yape = '/uploads/' + req.files['qr_yape'][0].filename;
        if (req.files && req.files['qr_plin'])
            updates.qr_plin = '/uploads/' + req.files['qr_plin'][0].filename;
        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: 'No se recibió ningún QR.' });
        const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        db.run(`UPDATE configuracion SET ${sets} WHERE id = 1`,
            Object.values(updates), function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ mensaje: 'QR actualizado.', ...updates });
            });
    }
);

// ── FASE 4: CUPONES ───────────────────────────────────────────────────────────
app.post('/api/cupones/validar', verificarToken, (req, res) => {
    const { codigo, total_carrito } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Código requerido.' });
    db.get("SELECT * FROM cupones WHERE codigo = ? AND activo = 1",
        [codigo.toUpperCase()], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Cupón inválido o inactivo.' });
            if (row.usos_actuales >= row.usos_max)
                return res.status(400).json({ error: 'El cupón alcanzó su límite de usos.' });
            if (row.fecha_expira && new Date() > new Date(row.fecha_expira))
                return res.status(400).json({ error: 'El cupón ha expirado.' });
            const total = Number(total_carrito) || 0;
            const descuento = row.tipo === 'porcentaje'
                ? Math.round((total * row.valor / 100) * 100) / 100
                : Math.min(row.valor, total);
            res.json({ descuento, cupon_id: row.id, codigo: row.codigo, tipo: row.tipo, valor: row.valor });
        });
});

app.get('/api/admin/cupones', verificarToken, requiereAdmin, (req, res) => {
    db.all("SELECT * FROM cupones ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/cupones', verificarToken, requiereAdmin, (req, res) => {
    const { codigo, tipo, valor, usos_max, fecha_expira } = req.body;
    if (!codigo || !valor) return res.status(400).json({ error: 'Código y valor son requeridos.' });
    db.run(
        "INSERT INTO cupones (codigo, tipo, valor, usos_max, fecha_expira) VALUES (?, ?, ?, ?, ?)",
        [codigo.toUpperCase(), tipo || 'porcentaje', Number(valor), Number(usos_max) || 1, fecha_expira || null],
        function(err) {
            if (err) return res.status(400).json({ error: 'El código ya existe.' });
            res.json({ id: this.lastID, mensaje: 'Cupón creado.' });
        }
    );
});

app.delete('/api/admin/cupones/:id', verificarToken, requiereAdmin, (req, res) => {
    db.run("DELETE FROM cupones WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Cupón eliminado.' });
    });
});

// ── FASE 4: RESEÑAS ───────────────────────────────────────────────────────────
app.get('/api/resenas/:producto_id', (req, res) => {
    db.all(
        `SELECT r.id, r.estrellas, r.comentario, r.fecha, u.nombre AS autor
         FROM resenas r JOIN usuarios u ON u.id = r.usuario_id
         WHERE r.producto_id = ? ORDER BY r.fecha DESC LIMIT 20`,
        [req.params.producto_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.post('/api/resenas', verificarToken, (req, res) => {
    const { producto_id, estrellas, comentario } = req.body;
    if (!producto_id || !estrellas) return res.status(400).json({ error: 'Producto y estrellas son requeridos.' });
    const stars = Math.min(5, Math.max(1, Number(estrellas)));
    // Check if user already reviewed this product
    db.get("SELECT id FROM resenas WHERE producto_id = ? AND usuario_id = ?",
        [producto_id, req.usuario.id], (err, existing) => {
            if (existing) return res.status(400).json({ error: 'Ya dejaste una reseña en este producto.' });
            db.run(
                "INSERT INTO resenas (producto_id, usuario_id, estrellas, comentario) VALUES (?, ?, ?, ?)",
                [producto_id, req.usuario.id, stars, comentario || ''],
                function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ id: this.lastID, mensaje: '¡Gracias por tu reseña!' });
                }
            );
        });
});

app.get('/api/admin/resenas', verificarToken, requiereAdmin, (req, res) => {
    db.all(
        `SELECT r.id, r.estrellas, r.comentario, r.fecha, u.nombre AS autor, p.nombre AS producto
         FROM resenas r
         JOIN usuarios u ON u.id = r.usuario_id
         JOIN productos p ON p.id = r.producto_id
         ORDER BY r.fecha DESC`,
        [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.delete('/api/admin/resenas/:id', verificarToken, requiereAdmin, (req, res) => {
    db.run("DELETE FROM resenas WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Reseña eliminada.' });
    });
});

// ── FASE 4+6: PUNTOS DE LEALTAD ───────────────────────────────────────────────
app.get('/api/puntos', verificarToken, (req, res) => {
    db.get("SELECT puntos, puntos_totales FROM puntos_lealtad WHERE usuario_id = ?",
        [req.usuario.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ puntos: row ? row.puntos : 0, puntos_totales: row ? row.puntos_totales : 0 });
        });
});

app.get('/api/puntos/historial', verificarToken, (req, res) => {
    db.all("SELECT cambio, motivo, fecha FROM historial_puntos WHERE usuario_id = ? ORDER BY fecha DESC LIMIT 20",
        [req.usuario.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

// Helper: otorgar puntos al hacer un pedido
function otorgarPuntos(usuario_id, pedido_id, totalItems) {
    const puntos = Math.max(1, Math.floor(totalItems / 2));
    db.run(
        `INSERT INTO puntos_lealtad (usuario_id, puntos, puntos_totales) VALUES (?, ?, ?)
         ON CONFLICT(usuario_id) DO UPDATE SET
           puntos = puntos + excluded.puntos,
           puntos_totales = puntos_totales + excluded.puntos_totales`,
        [usuario_id, puntos, puntos],
        () => {}
    );
    db.run("INSERT INTO historial_puntos (usuario_id, cambio, motivo) VALUES (?, ?, ?)",
        [usuario_id, puntos, `Pedido #${pedido_id}`], () => {});
}

// ── FASE 5: ESTADÍSTICAS / DASHBOARD ──────────────────────────────────────────
app.get('/api/admin/estadisticas', verificarToken, requiereAdmin, (req, res) => {
    const stats = {};

    db.get("SELECT COUNT(*) AS total, COUNT(CASE WHEN estado='Entregado' THEN 1 END) AS entregados, COUNT(CASE WHEN estado='Pendiente' THEN 1 END) AS pendientes FROM pedidos",
        [], (err, row) => {
            stats.pedidos = row || {};
            db.get("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'cliente'", [], (err2, row2) => {
                stats.clientes = row2 ? row2.total : 0;
                db.all(
                    `SELECT strftime('%Y-%m', fecha) AS mes, COUNT(*) AS total_pedidos
                     FROM pedidos GROUP BY mes ORDER BY mes DESC LIMIT 6`,
                    [], (err3, rows3) => {
                        stats.pedidos_por_mes = rows3 || [];
                        db.all(
                            `SELECT pi.nombre_producto AS nombre, SUM(pi.cantidad) AS total_vendido
                             FROM pedido_items pi GROUP BY pi.nombre_producto ORDER BY total_vendido DESC LIMIT 8`,
                            [], (err4, rows4) => {
                                stats.top_productos = rows4 || [];
                                db.get("SELECT COUNT(*) AS total FROM productos WHERE stock = 0", [], (err5, row5) => {
                                    stats.productos_agotados = row5 ? row5.total : 0;
                                    res.json(stats);
                                });
                            }
                        );
                    }
                );
            });
        }
    );
});

// ── FASE 6: NOTIFICACIONES ────────────────────────────────────────────────────
app.get('/api/notificaciones', verificarToken, (req, res) => {
    db.all(
        "SELECT id, mensaje, tipo, leida, fecha FROM notificaciones WHERE usuario_id = ? ORDER BY fecha DESC LIMIT 20",
        [req.usuario.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.put('/api/notificaciones/:id/leer', verificarToken, (req, res) => {
    db.run("UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?",
        [req.params.id, req.usuario.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true });
        });
});

app.put('/api/notificaciones/leer-todas', verificarToken, (req, res) => {
    db.run("UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?",
        [req.usuario.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true });
        });
});

function crearNotificacion(usuario_id, mensaje, tipo = 'info') {
    db.run("INSERT INTO notificaciones (usuario_id, mensaje, tipo) VALUES (?, ?, ?)",
        [usuario_id, mensaje, tipo], () => {});
}

// ── MANEJO DE ERRORES ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err) {
        console.error('Error no manejado:', err.message);
        return res.status(400).json({ error: err.message || 'Ocurrió un error al procesar la solicitud.' });
    }
    next();
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
