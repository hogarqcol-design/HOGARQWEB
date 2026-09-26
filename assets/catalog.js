/* Single catalog used by the browser and the server. Prices in COP. */
(function(root){
'use strict';
var catalog = {
  "products": [
    {
      "id": 1,
      "icon": "🪔",
      "name": "Capas",
      "sub": "Filamento PLA",
      "price": 100000,
      "specs": {
        "Material": "Filamento PLA",
        "Dimensiones": "24 cm de alto × 14 cm de ancho",
        "Peso": "1.2 kg",
        "Bombilla": "LED E27",
        "Temperatura": "2700 K cálida",
        "Envío": "Bogotá: 2–4 días hábiles. Colombia: 4–7 días hábiles, desde el pago aprobado."
      }
    },
    {
      "id": 2,
      "icon": "💡",
      "name": "Órbita",
      "sub": "Filamento PLA",
      "price": 100000,
      "specs": {
        "Material": "Filamento PLA",
        "Dimensiones": "26,5 cm de alto × 12,8 cm de ancho",
        "Peso": "1.2 kg",
        "Bombilla": "LED E27",
        "Temperatura": "2700 K cálida",
        "Envío": "Bogotá: 2–4 días hábiles. Colombia: 4–7 días hábiles, desde el pago aprobado."
      }
    },
    {
      "id": 3,
      "icon": "✨",
      "name": "Pétalo",
      "sub": "Filamento PLA",
      "price": 90000,
      "specs": {
        "Material": "Filamento PLA",
        "Dimensiones": "20 cm de alto × 13 cm de ancho",
        "Peso": "1.2 kg",
        "Bombilla": "LED E27",
        "Temperatura": "2700 K cálida",
        "Envío": "Bogotá: 2–4 días hábiles. Colombia: 4–7 días hábiles, desde el pago aprobado."
      }
    },
    {
      "id": 4,
      "icon": "🌙",
      "name": "Onda",
      "sub": "Filamento PLA",
      "price": 100000,
      "specs": {
        "Material": "Filamento PLA",
        "Dimensiones": "24 cm de alto × 22 cm de ancho",
        "Peso": "1.2 kg",
        "Bombilla": "LED E27",
        "Temperatura": "2700 K cálida",
        "Envío": "Bogotá: 2–4 días hábiles. Colombia: 4–7 días hábiles, desde el pago aprobado."
      }
    },
    {
      "id": 5,
      "icon": "🕯️",
      "name": "Nube",
      "sub": "Filamento PLA",
      "price": 100000,
      "specs": {
        "Material": "Filamento PLA",
        "Dimensiones": "20 cm de alto × 24 cm de ancho",
        "Peso": "1.2 kg",
        "Bombilla": "LED E27",
        "Temperatura": "2700 K cálida",
        "Envío": "Bogotá: 2–4 días hábiles. Colombia: 4–7 días hábiles, desde el pago aprobado."
      }
    }
  ],
  "colors": [
    "blanco",
    "azul",
    "amarillo",
    "rosado",
    "rojo"
  ],
  "images": {
    "1": {
      "blanco": "CAPAS FOTO BLANCA.png",
      "azul": "CAPAS FOTO AZUL.png",
      "amarillo": "CAPAS FOTO AMARILLA.png",
      "rosado": "CAPAS FOTO ROSADA.png",
      "rojo": "CAPAS FOTO ROJA.png"
    },
    "2": {
      "blanco": "ÓRBITA FOTO BLANCA.png",
      "azul": "ÓRBITA FOTO AZUL.png",
      "amarillo": "ÓRBITA FOTO AMARILLA.png",
      "rosado": "ÓRBITA FOTO ROSADA.png",
      "rojo": "ÓRBITA FOTO ROJA.png"
    },
    "3": {
      "blanco": "PETALO FOTO BLANCA.png",
      "azul": "PETALO FOTO AZUL.png",
      "amarillo": "PETALO FOTO AMARILLA.png",
      "rosado": "PETALO FOTO ROSADA.png",
      "rojo": "PETALO FOTO ROJA.png"
    },
    "4": {
      "blanco": "ONDA FOTO BLANCA.png",
      "azul": "ONDA FOTO AZUL.png",
      "amarillo": "ONDA FOTO AMARILLA.png",
      "rosado": "ONDA FOTO ROSADA.png",
      "rojo": "ONDA FOTO ROJA.png"
    },
    "5": {
      "blanco": "NUBE FOTO BLANCA.png",
      "azul": "NUBE FOTO AZUL.png",
      "amarillo": "NUBE FOTO AMARILLA.png",
      "rosado": "NUBE FOTO ROSADA.png",
      "rojo": "NUBE FOTO ROJA.png"
    }
  },
  "covers": {
    "1": "rosado",
    "2": "rojo",
    "3": "amarillo",
    "4": "azul",
    "5": "blanco"
  },
  "departments": [
    "Bogotá D.C.",
    "Amazonas",
    "Antioquia",
    "Arauca",
    "Atlántico",
    "Bolívar",
    "Boyacá",
    "Caldas",
    "Caquetá",
    "Casanare",
    "Cauca",
    "Cesar",
    "Chocó",
    "Córdoba",
    "Cundinamarca",
    "Guainía",
    "Guaviare",
    "Huila",
    "La Guajira",
    "Magdalena",
    "Meta",
    "Nariño",
    "Norte de Santander",
    "Putumayo",
    "Quindío",
    "Risaralda",
    "San Andrés, Providencia y Santa Catalina",
    "Santander",
    "Sucre",
    "Tolima",
    "Valle del Cauca",
    "Vaupés",
    "Vichada"
  ]
};
catalog.shipping = function(quantity, bogota) {
  if(!Number.isInteger(quantity) || quantity < 1) return 0;
  return bogota ? 20000 : quantity === 1 ? 30000 : quantity === 2 ? 50000 : quantity * 20000;
};
if(typeof module !== 'undefined' && module.exports) module.exports = catalog;
else root.HogarqCatalog = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
