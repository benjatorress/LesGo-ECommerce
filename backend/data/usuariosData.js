/**
 * Datos mock simulados que replican el esquema relacional de la Base de Datos
 * Tablas: 'empleados' y 'clientes'
 */

export const EMPLEADOS = [
  {
    id_empleado: 1,
    id_cargo: 2, // p.ej. Vendedor / Ejecutivo Comercial
    id_departamento: 3, // Ventas ERP
    nombre: 'Carlos',
    apellido: 'Santana',
    rut: '18.452.981-4',
    email: 'vendedor@lesgo.cl',
    telefono: '+56 9 8765 4321',
    direccion: 'Av. Angamos 0610, Antofagasta',
    fecha_ingreso: '2023-03-15',
    estado: 'activo',
    password: 'password123'
  },
  {
    id_empleado: 2,
    id_cargo: 1, // Gerente de Ventas
    id_departamento: 3, // Ventas ERP
    nombre: 'Andrea',
    apellido: 'Morales',
    rut: '16.782.341-K',
    email: 'gerencia@lesgo.cl',
    telefono: '+56 9 7654 3210',
    direccion: 'Calle Prat 450, Antofagasta',
    fecha_ingreso: '2022-01-10',
    estado: 'activo',
    password: 'password123'
  },
  {
    id_empleado: 3,
    id_cargo: 2, // Vendedor Suspendido / Inactivo
    id_departamento: 3,
    nombre: 'Rodrigo',
    apellido: 'Tapia',
    rut: '19.123.456-7',
    email: 'inactivo@lesgo.cl',
    telefono: '+56 9 6543 2109',
    direccion: 'Av. Brasil 1230, Antofagasta',
    fecha_ingreso: '2023-08-01',
    estado: 'inactivo', // Prueba de cuenta inactiva
    password: 'password123'
  }
];

export const CLIENTES = [
  {
    id_cliente: 1,
    nombre: 'Valentina Soto',
    rut: '20.345.678-9',
    email: 'cliente@lesgo.cl',
    direccion: 'Pasaje Los Naranjos 432, Antofagasta',
    estado: 'activo',
    password: 'password123'
  },
  {
    id_cliente: 2,
    nombre: 'Felipe Gómez',
    rut: '17.890.123-5',
    email: 'felipe@lesgo.cl',
    direccion: 'Av. Croacia 320, Depto 402, Antofagasta',
    estado: 'activo',
    password: 'password123'
  },
  {
    id_cliente: 3,
    nombre: 'Cliente Suspendido',
    rut: '15.654.321-1',
    email: 'bloqueado@lesgo.cl',
    direccion: 'Calle Baquedano 780, Antofagasta',
    estado: 'inactivo',
    password: 'password123'
  }
];
