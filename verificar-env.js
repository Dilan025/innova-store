require('dotenv').config();

console.log('--- Verificación de tu .env ---');
console.log('EMAIL_USER:', JSON.stringify(process.env.EMAIL_USER || '(vacío)'));

const pass = process.env.EMAIL_PASS || '';
console.log('EMAIL_PASS tiene', pass.length, 'caracteres.');
console.log('¿Tiene espacios?', pass.includes(' ') ? 'SÍ (esto es un problema, quítalos)' : 'No');
console.log('¿Tiene comillas?', (pass.includes('"') || pass.includes("'")) ? 'SÍ (esto es un problema, quítalas)' : 'No');
console.log('-------------------------------');
console.log('Una contraseña de aplicación de Google debería tener 16 caracteres, sin espacios ni comillas.');
