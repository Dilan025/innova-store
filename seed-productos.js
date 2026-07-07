// Script de una sola vez: revisa cada categoría real de tu base de datos y
// agrega los productos básicos que le falten (por nombre exacto), sin
// duplicar los que ya tengas cargados (tuyos o de una corrida anterior de
// este mismo script).
//
// Cómo usarlo:
//   1. Copia este archivo a la misma carpeta que tu server.js e innova.db
//   2. Ejecuta: node seed-productos.js
//   3. Puedes correrlo las veces que quieras — nunca duplica un producto
//      que ya exista con el mismo nombre en su categoría.

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./innova.db');

// Catálogo básico sugerido por categoría — solo se agregan los que falten.
const PRODUCTOS_SUGERIDOS = {
  'Banners y Viniles': [
    { nombre: 'Banner Publicitario 1x1m', precio: 45, stock: 40 },
    { nombre: 'Banner Publicitario 2x1m', precio: 80, stock: 25 },
    { nombre: 'Vinil Adhesivo (por metro)', precio: 18, stock: 100 },
    { nombre: 'Vinil Microperforado (por metro)', precio: 22, stock: 60 },
    { nombre: 'Gigantografía (por m²)', precio: 25, stock: 50 },
    { nombre: 'Vinil de Corte (por metro)', precio: 15, stock: 80 }
  ],
  'DTF Textil': [
    { nombre: 'Estampado DTF Camiseta', precio: 12, stock: 200 },
    { nombre: 'Estampado DTF Polo', precio: 15, stock: 150 },
    { nombre: 'Estampado DTF Gorra', precio: 10, stock: 180 },
    { nombre: 'Estampado DTF Chompa', precio: 18, stock: 100 },
    { nombre: 'Plancha DTF A4', precio: 8, stock: 250 },
    { nombre: 'Plancha DTF A3', precio: 14, stock: 150 },
    { nombre: 'Polo Algodón 100%', precio: 25, stock: 150 },
    { nombre: 'Polo Dry Fit', precio: 30, stock: 120 },
    { nombre: 'Polo Cuello V', precio: 27, stock: 100 },
    { nombre: 'Camisa Tipo Polo', precio: 32, stock: 80 }
  ],
  'Diseño Gráfico': [
    { nombre: 'Diseño de Logo', precio: 80, stock: 50 },
    { nombre: 'Diseño de Volante Publicitario', precio: 30, stock: 80 },
    { nombre: 'Diseño de Tarjeta de Presentación', precio: 25, stock: 100 },
    { nombre: 'Diseño de Banner', precio: 35, stock: 60 },
    { nombre: 'Diseño de Menú / Carta', precio: 40, stock: 40 },
    { nombre: 'Retoque Fotográfico', precio: 20, stock: 70 },
    { nombre: 'Fotocheck con Cordón', precio: 8, stock: 300 },
    { nombre: 'Fotocheck para Eventos', precio: 10, stock: 200 },
    { nombre: 'Tarjetas de Presentación (millar, mate)', precio: 30, stock: 500 }
  ],
  'Equipos Tecnológicos': [
    { nombre: 'Laptop Reacondicionada', precio: 1200, stock: 5 },
    { nombre: 'Impresora Multifuncional', precio: 650, stock: 8 },
    { nombre: 'Mouse Inalámbrico', precio: 35, stock: 40 },
    { nombre: 'Teclado Mecánico', precio: 90, stock: 25 },
    { nombre: 'Memoria USB 32GB', precio: 25, stock: 60 },
    { nombre: 'Disco Duro Externo 1TB', precio: 180, stock: 15 }
  ],
  'Lámparas': [
    { nombre: 'Lámpara LED Personalizada', precio: 35, stock: 40 },
    { nombre: 'Lámpara de Escritorio', precio: 28, stock: 30 },
    { nombre: 'Lámpara de Noche RGB', precio: 45, stock: 25 },
    { nombre: 'Lámpara Colgante', precio: 60, stock: 15 },
    { nombre: 'Tira LED 5m', precio: 20, stock: 50 },
    { nombre: 'Lámpara de Piso', precio: 85, stock: 12 },
    { nombre: 'Lámpara Solar para Exterior', precio: 30, stock: 35 },
    { nombre: 'Lámpara con Foto Impresa', precio: 40, stock: 30 },
    { nombre: 'Vela LED Decorativa', precio: 10, stock: 60 }
  ],
  'Sublimación': [
    { nombre: 'Taza Sublimada Blanca', precio: 15, stock: 150 },
    { nombre: 'Taza Sublimada de Color', precio: 18, stock: 120 },
    { nombre: 'Polo Sublimado', precio: 28, stock: 100 },
    { nombre: 'Mousepad Sublimado', precio: 12, stock: 90 },
    { nombre: 'Llavero Sublimado', precio: 6, stock: 200 },
    { nombre: 'Cojín Sublimado', precio: 22, stock: 60 },
    { nombre: 'Taza Mágica (cambia de color)', precio: 20, stock: 80 },
    { nombre: 'Taza Térmica', precio: 25, stock: 60 },
    { nombre: 'Set de Tazas Pareja', precio: 32, stock: 40 }
  ],
  'UV DTF': [
    { nombre: 'Sticker UV DTF', precio: 5, stock: 300 },
    { nombre: 'Acrílico UV DTF Pequeño (10x15cm)', precio: 25, stock: 60 },
    { nombre: 'Acrílico UV DTF Mediano (15x20cm)', precio: 35, stock: 40 },
    { nombre: 'Vinil UV DTF para Vidrio', precio: 18, stock: 70 },
    { nombre: 'Etiqueta UV DTF Resistente al Agua', precio: 8, stock: 150 },
    { nombre: 'Cuadro Acrílico con Base', precio: 30, stock: 50 },
    { nombre: 'Acrílico con Luz LED', precio: 45, stock: 25 }
  ],
  'Juegos': [
    { nombre: 'Control Inalámbrico', precio: 85, stock: 20 },
    { nombre: 'Audífonos Gamer', precio: 65, stock: 25 },
    { nombre: 'Mouse Gamer', precio: 55, stock: 30 },
    { nombre: 'Silla Gamer', precio: 450, stock: 8 },
    { nombre: 'Consola PlayStation 5', precio: 2200, stock: 3 },
    { nombre: 'Memoria para Consola 1TB', precio: 220, stock: 10 },
    { nombre: 'Volante para Consola', precio: 180, stock: 6 },
    { nombre: 'Teclado Gamer', precio: 95, stock: 20 },
    { nombre: 'Base Enfriadora para Consola', precio: 45, stock: 15 },
    { nombre: 'Cámara Web para Streaming', precio: 75, stock: 18 }
  ]
};

db.serialize(() => {
  db.all('SELECT * FROM categorias', [], (err, categorias) => {
    if (err) {
      console.error('Error leyendo categorías:', err.message);
      db.close();
      return;
    }

    if (categorias.length === 0) {
      console.log('No hay categorías registradas todavía. Crea alguna en Panel Admin primero.');
      db.close();
      return;
    }

    let categoriasPendientes = categorias.length;
    const terminarCategoria = () => {
      categoriasPendientes--;
      if (categoriasPendientes === 0) db.close();
    };

    categorias.forEach((cat) => {
      const sugeridos = PRODUCTOS_SUGERIDOS[cat.nombre];
      if (!sugeridos) {
        console.log(`⚠ "${cat.nombre}" no tiene un catálogo básico definido en este script (nombre no reconocido). Agrégalo a mano, o dime el nombre exacto para incluirlo aquí.`);
        terminarCategoria();
        return;
      }

      let productosPendientes = sugeridos.length;
      let agregados = 0;

      sugeridos.forEach((p) => {
        // Revisamos si YA existe un producto con ese nombre exacto en esa
        // categoría (tuyo o de una corrida anterior), para no duplicar.
        db.get(
          'SELECT id FROM productos WHERE nombre = ? AND categoria = ?',
          [p.nombre, cat.nombre],
          (errCheck, existente) => {
            if (errCheck) {
              console.error(`  Error revisando "${p.nombre}":`, errCheck.message);
              productosPendientes--;
              if (productosPendientes === 0) finalizarCategoria();
              return;
            }

            if (existente) {
              // Ya existe, no se toca.
              productosPendientes--;
              if (productosPendientes === 0) finalizarCategoria();
              return;
            }

            db.run(
              'INSERT INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)',
              [p.nombre, cat.nombre, p.precio, p.stock],
              (errInsert) => {
                if (errInsert) {
                  console.error(`  Error agregando "${p.nombre}":`, errInsert.message);
                } else {
                  agregados++;
                }
                productosPendientes--;
                if (productosPendientes === 0) finalizarCategoria();
              }
            );
          }
        );
      });

      function finalizarCategoria() {
        if (agregados > 0) {
          console.log(`➕ "${cat.nombre}": se agregaron ${agregados} producto(s) nuevo(s).`);
        } else {
          console.log(`✔ "${cat.nombre}": ya tenía todo el catálogo básico, no se agregó nada.`);
        }
        terminarCategoria();
      }
    });
  });
});

