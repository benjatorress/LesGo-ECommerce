export interface Product {
  id: string;
  name: string;
  category: string;
  theme: string;
  price: number;
  formattedPrice: string;
  pieces: number;
  age: string;
  code: string;
  image: string;
  images?: string[];
  specifications?: Record<string, string | number>;
  inventorySource?: 'mock' | 'http';
  description?: string;
  minifigures?: number;
  highlights?: string[];
  stock: number;
}

export const PRODUCTS: Product[] = [
  {
    id: 'lego-city-station',
    name: 'Lego City - Isla de Prisión Costera',
    category: 'City',
    theme: 'City',
    price: 89990,
    formattedPrice: '$89.990',
    pieces: 754,
    age: '7-12',
    code: '60130',
    image: '/products/item1_city.jpg',
    description: 'Ayuda a la policía a vigilar a los malhechores en la prisión costera de Lego City. Cuenta con estructura de dos plantas con celdas, torre de vigilancia, helipuerto y muelle para lanchas de escape.',
    minifigures: 8,
    highlights: ['Estructura modular de 2 niveles', 'Helicóptero de rescate incluido', 'Lancha de escape de los bandidos'],
    stock: 5
  },
  {
    id: 'lego-star-wars-atat',
    name: 'Lego Star Wars - AT-AT Walker Imperial',
    category: 'Star Wars',
    theme: 'Star Wars',
    price: 169990,
    formattedPrice: '$169.990',
    pieces: 1267,
    age: '10+',
    code: '75288',
    image: '/products/item2_starwars.jpg',
    description: 'Revive la legendaria Batalla de Hoth con el colosal caminante blindado AT-AT. Incluye cabina abatible para 3 minifiguras, cañones con resorte y paneles laterales desplegables para jugar en su interior.',
    minifigures: 6,
    highlights: ['Cañones láser funcionales', 'Interior espacioso con cabina para 3 figuras', 'Moto speeder incluida'],
    stock: 3
  },
  {
    id: 'lego-ninjago-dragon',
    name: 'Lego Ninjago - Dragón & Moto Ninja Dragón',
    category: 'Ninjago',
    theme: 'Ninjago',
    price: 54990,
    formattedPrice: '$54.990',
    pieces: 384,
    age: '7+',
    code: '71792',
    image: '/products/item3_ninjago.jpg',
    description: 'Convierte un vehículo de carreras todoterreno en un feroz dragón articulado para vencer a los guerreros del Imperio. Diseño 2 en 1 ultra dinámico con alas doradas.',
    minifigures: 3,
    highlights: ['Transformación 2 en 1 sin desmontar', 'Armas doradas coleccionables', 'Minifiguras de Sora, Arin y Baby Riyu'],
    stock: 10
  },
  {
    id: 'lego-batmobile-tumbler',
    name: 'Lego DC Super Heroes - Batmobile Tumbler',
    category: 'Marvel & DC',
    theme: 'Super Heroes',
    price: 229990,
    formattedPrice: '$229.990',
    pieces: 1869,
    age: '16+',
    code: '76023',
    image: '/products/item4_batmobile.jpg',
    description: 'La máquina de combate acorazada definitiva de The Dark Knight. Edición especial de coleccionista con neumáticos gigantes personalizados, alerones ajustables e interior detallado.',
    minifigures: 2,
    highlights: ['Neumáticos frontales de diseño exclusivo', 'Placa de exposición con especificaciones', 'Incluye a Batman y The Joker versión Heath Ledger'],
    stock: 2
  },
  {
    id: 'lego-movie-ultrakatty',
    name: 'The Lego Movie 2 - Ultrakatty y Lucy Guerrera',
    category: 'Especiales',
    theme: 'The LEGO Movie',
    price: 34990,
    formattedPrice: '$34.990',
    pieces: 348,
    age: '8+',
    code: '70827',
    image: '/products/item5_legomovie.jpg',
    description: 'Únete a Lucy y a la fiera Ultrakatty para rescatar a Emmet del invasor alienígena. Incluye 3 expresiones faciales intercambiables para Ultrakatty y cola articulada.',
    minifigures: 3,
    highlights: ['3 expresiones faciales intercambiables', 'Ballesta de combate de Lucy', 'Invasor extraterrestre de bloques'],
    stock: 7
  },
  {
    id: 'lego-city-jungle',
    name: 'Lego City - Jungle Starter Set Selva Tropical',
    category: 'City',
    theme: 'City',
    price: 24990,
    formattedPrice: '$24.990',
    pieces: 88,
    age: '5-12',
    code: '60157',
    image: '/products/item6_cityjungle.jpg',
    description: 'Empieza tu expedición por la selva con lancha de motor, cocodrilo con mandíbula articulada, árbol con tesoro oculto y equipo de exploración científica.',
    minifigures: 3,
    highlights: ['Cocodrilo con mandíbulas móviles', 'Bote motorizado de exploración', 'Accesorios de lupa, machete y cofre'],
    stock: 15
  }
];

export interface CartItem {
  product: Product;
  quantity: number;
}

export const INITIAL_CART: CartItem[] = [
  {
    product: PRODUCTS[5], // Lego City Jungle Starter Set
    quantity: 1
  },
  {
    product: PRODUCTS[3], // Lego DC Super Heroes Batmobile Tumbler
    quantity: 1
  }
];
