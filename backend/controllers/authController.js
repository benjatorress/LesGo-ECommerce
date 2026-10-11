import { EMPLEADOS, CLIENTES } from '../data/usuariosData.js';

/**
 * Controlador de Inicio de Sesión
 * Valida credenciales contra tablas 'empleados' y 'clientes'
 * Retorna códigos HTTP:
 * - 400: Campos faltantes (correo o contraseña)
 * - 401: Credenciales incorrectas o usuario inactivo
 * - 200: Autenticación exitosa con Token y datos de usuario
 */
export const login = (req, res) => {
  const { email, password } = req.body || {};

  // Control 1: Validación de campos obligatorios
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Debe ingresar su correo electrónico y contraseña.',
      reason: 'missing_fields'
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  // Búsqueda en empleados (prioridad para personal ERP)
  const empleado = EMPLEADOS.find(
    (emp) => emp.email.toLowerCase() === cleanEmail
  );

  if (empleado) {
    // Control 2: Validación de contraseña
    if (empleado.password !== cleanPassword) {
      return res.status(401).json({
        success: false,
        message: 'Correo o contraseña incorrectos.',
        reason: 'invalid_credentials'
      });
    }

    // Control 3: Validación de estado del usuario
    if (empleado.estado !== 'activo') {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta de empleado se encuentra inactiva. Contacta al administrador del ERP o RRHH.',
        reason: 'user_inactive'
      });
    }

    // Generar token de sesión simulado
    const token = `lesgo_token_emp_${empleado.id_empleado}_${Date.now()}`;

    // Respuesta exitosa (Empleado con acceso al Módulo de Ventas)
    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso como Empleado.',
      token,
      usuario: {
        tipo: 'empleado',
        id_empleado: empleado.id_empleado,
        id_cargo: empleado.id_cargo,
        id_departamento: empleado.id_departamento,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        nombre_completo: `${empleado.nombre} ${empleado.apellido}`,
        rut: empleado.rut,
        email: empleado.email,
        telefono: empleado.telefono,
        direccion: empleado.direccion,
        fecha_ingreso: empleado.fecha_ingreso,
        estado: empleado.estado,
        acceso_modulo_ventas: true
      }
    });
  }

  // Búsqueda en clientes (E-Commerce)
  const cliente = CLIENTES.find(
    (cli) => cli.email.toLowerCase() === cleanEmail
  );

  if (cliente) {
    // Control 2: Validación de contraseña
    if (cliente.password !== cleanPassword) {
      return res.status(401).json({
        success: false,
        message: 'Correo o contraseña incorrectos.',
        reason: 'invalid_credentials'
      });
    }

    // Control 3: Validación de estado del cliente
    if (cliente.estado !== 'activo') {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta de cliente se encuentra suspendida o inactiva.',
        reason: 'user_inactive'
      });
    }

    const token = `lesgo_token_cli_${cliente.id_cliente}_${Date.now()}`;

    // Respuesta exitosa (Cliente sin acceso al Módulo de Ventas del ERP)
    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso como Cliente.',
      token,
      usuario: {
        tipo: 'cliente',
        id_cliente: cliente.id_cliente,
        nombre: cliente.nombre,
        nombre_completo: cliente.nombre,
        rut: cliente.rut,
        email: cliente.email,
        direccion: cliente.direccion,
        estado: cliente.estado,
        acceso_modulo_ventas: false
      }
    });
  }

  // Si no se encuentra en empleados ni en clientes
  return res.status(401).json({
    success: false,
    message: 'Correo o contraseña incorrectos.',
    reason: 'invalid_credentials'
  });
};

/**
 * Simulación de recuperación / cambio de contraseña
 */
export const solicitarCambioPassword = (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Por favor ingresa un correo electrónico válido.'
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existe =
    EMPLEADOS.some((e) => e.email.toLowerCase() === cleanEmail) ||
    CLIENTES.some((c) => c.email.toLowerCase() === cleanEmail);

  if (!existe) {
    return res.status(404).json({
      success: false,
      message: 'No existe ninguna cuenta registrada con este correo electrónico.'
    });
  }

  return res.status(200).json({
    success: true,
    message: `Se han enviado las instrucciones de restablecimiento de contraseña a ${cleanEmail}.`
  });
};
