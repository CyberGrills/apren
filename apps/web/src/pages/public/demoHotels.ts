/**
 * Fictional catalogue used only for the 7EVEN product demonstration.
 * Never publish these records as real businesses, inventory or bookable offers.
 * Images are illustrative editorial photography and are not photos of the named fictional properties.
 */
export type DemoProperty = {
  id: string; name: string; city: string; state: string; kind: 'HOTEL' | 'APARTMENT';
  pricePerNight: number; rooms: number; guests: number; amenities: string[]; images: string[];
};
export const demoProperties: DemoProperty[] = [
  {
    "id": "demo-001",
    "name": "Amber Court 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "APARTMENT",
    "pricePerNight": 45000,
    "rooms": 8,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-002",
    "name": "Palm Gardens 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 9,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-003",
    "name": "Cedar Lodge 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 10,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-004",
    "name": "Ivory Place 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "APARTMENT",
    "pricePerNight": 82500,
    "rooms": 11,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-005",
    "name": "Lagoon Suites 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 12,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-006",
    "name": "Crown Terrace 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 13,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-007",
    "name": "Olive Retreat 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "APARTMENT",
    "pricePerNight": 120000,
    "rooms": 14,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-008",
    "name": "Harbour Residences 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 15,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-009",
    "name": "Sapphire House 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 16,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-010",
    "name": "Maple Apartments 01",
    "city": "Uyo",
    "state": "Akwa Ibom",
    "kind": "APARTMENT",
    "pricePerNight": 57500,
    "rooms": 17,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-011",
    "name": "Amber Residences 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 18,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-012",
    "name": "Palm House 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 19,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-013",
    "name": "Cedar Apartments 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "APARTMENT",
    "pricePerNight": 95000,
    "rooms": 20,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-014",
    "name": "Ivory Court 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 21,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-015",
    "name": "Lagoon Gardens 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 22,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-016",
    "name": "Crown Lodge 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "APARTMENT",
    "pricePerNight": 132500,
    "rooms": 23,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-017",
    "name": "Olive Place 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 24,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-018",
    "name": "Harbour Suites 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 8,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-019",
    "name": "Sapphire Terrace 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "APARTMENT",
    "pricePerNight": 70000,
    "rooms": 9,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-020",
    "name": "Maple Retreat 02",
    "city": "Lagos",
    "state": "Lagos",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 10,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-021",
    "name": "Amber Suites 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 11,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-022",
    "name": "Palm Terrace 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "APARTMENT",
    "pricePerNight": 107500,
    "rooms": 12,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-023",
    "name": "Cedar Retreat 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 13,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-024",
    "name": "Ivory Residences 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 14,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-025",
    "name": "Lagoon House 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "APARTMENT",
    "pricePerNight": 45000,
    "rooms": 15,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-026",
    "name": "Crown Apartments 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 16,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-027",
    "name": "Olive Court 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 17,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-028",
    "name": "Harbour Gardens 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "APARTMENT",
    "pricePerNight": 82500,
    "rooms": 18,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-029",
    "name": "Sapphire Lodge 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 19,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-030",
    "name": "Maple Place 03",
    "city": "Abuja",
    "state": "FCT",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 20,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-031",
    "name": "Amber Gardens 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "APARTMENT",
    "pricePerNight": 120000,
    "rooms": 21,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-032",
    "name": "Palm Lodge 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 22,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-033",
    "name": "Cedar Place 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 23,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-034",
    "name": "Ivory Suites 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "APARTMENT",
    "pricePerNight": 57500,
    "rooms": 24,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-035",
    "name": "Lagoon Terrace 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 8,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-036",
    "name": "Crown Retreat 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 9,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-037",
    "name": "Olive Residences 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "APARTMENT",
    "pricePerNight": 95000,
    "rooms": 10,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-038",
    "name": "Harbour House 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 11,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-039",
    "name": "Sapphire Apartments 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 12,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-040",
    "name": "Maple Court 04",
    "city": "Port Harcourt",
    "state": "Rivers",
    "kind": "APARTMENT",
    "pricePerNight": 132500,
    "rooms": 13,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-041",
    "name": "Amber House 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 14,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-042",
    "name": "Palm Apartments 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 15,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-043",
    "name": "Cedar Court 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "APARTMENT",
    "pricePerNight": 70000,
    "rooms": 16,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-044",
    "name": "Ivory Gardens 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 17,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-045",
    "name": "Lagoon Lodge 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 18,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-046",
    "name": "Crown Place 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "APARTMENT",
    "pricePerNight": 107500,
    "rooms": 19,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-047",
    "name": "Olive Suites 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 20,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-048",
    "name": "Harbour Terrace 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 21,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-049",
    "name": "Sapphire Retreat 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "APARTMENT",
    "pricePerNight": 45000,
    "rooms": 22,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-050",
    "name": "Maple Residences 05",
    "city": "Calabar",
    "state": "Cross River",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 23,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-051",
    "name": "Amber Terrace 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 24,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-052",
    "name": "Palm Retreat 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "APARTMENT",
    "pricePerNight": 82500,
    "rooms": 8,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-053",
    "name": "Cedar Residences 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 9,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-054",
    "name": "Ivory House 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 10,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-055",
    "name": "Lagoon Apartments 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "APARTMENT",
    "pricePerNight": 120000,
    "rooms": 11,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-056",
    "name": "Crown Court 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 12,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-057",
    "name": "Olive Gardens 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 13,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-058",
    "name": "Harbour Lodge 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "APARTMENT",
    "pricePerNight": 57500,
    "rooms": 14,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-059",
    "name": "Sapphire Place 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 15,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-060",
    "name": "Maple Suites 06",
    "city": "Enugu",
    "state": "Enugu",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 16,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-061",
    "name": "Amber Lodge 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "APARTMENT",
    "pricePerNight": 95000,
    "rooms": 17,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-062",
    "name": "Palm Place 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 18,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-063",
    "name": "Cedar Suites 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 19,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-064",
    "name": "Ivory Terrace 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "APARTMENT",
    "pricePerNight": 132500,
    "rooms": 20,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-065",
    "name": "Lagoon Retreat 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 21,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-066",
    "name": "Crown Residences 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 22,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-067",
    "name": "Olive House 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "APARTMENT",
    "pricePerNight": 70000,
    "rooms": 23,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-068",
    "name": "Harbour Apartments 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 24,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-069",
    "name": "Sapphire Court 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 8,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-070",
    "name": "Maple Gardens 07",
    "city": "Owerri",
    "state": "Imo",
    "kind": "APARTMENT",
    "pricePerNight": 107500,
    "rooms": 9,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-071",
    "name": "Amber Apartments 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 10,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-072",
    "name": "Palm Court 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 11,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-073",
    "name": "Cedar Gardens 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "APARTMENT",
    "pricePerNight": 45000,
    "rooms": 12,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-074",
    "name": "Ivory Lodge 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 13,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-075",
    "name": "Lagoon Place 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 14,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-076",
    "name": "Crown Suites 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "APARTMENT",
    "pricePerNight": 82500,
    "rooms": 15,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-077",
    "name": "Olive Terrace 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 16,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-078",
    "name": "Harbour Retreat 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 17,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-079",
    "name": "Sapphire Residences 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "APARTMENT",
    "pricePerNight": 120000,
    "rooms": 18,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-080",
    "name": "Maple House 08",
    "city": "Benin City",
    "state": "Edo",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 19,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-081",
    "name": "Amber Retreat 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 20,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-082",
    "name": "Palm Residences 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "APARTMENT",
    "pricePerNight": 57500,
    "rooms": 21,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-083",
    "name": "Cedar House 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 22,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-084",
    "name": "Ivory Apartments 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 23,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-085",
    "name": "Lagoon Court 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "APARTMENT",
    "pricePerNight": 95000,
    "rooms": 24,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-086",
    "name": "Crown Gardens 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 107500,
    "rooms": 8,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-087",
    "name": "Olive Lodge 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 9,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-088",
    "name": "Harbour Place 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "APARTMENT",
    "pricePerNight": 132500,
    "rooms": 10,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-089",
    "name": "Sapphire Suites 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 45000,
    "rooms": 11,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-090",
    "name": "Maple Terrace 09",
    "city": "Ibadan",
    "state": "Oyo",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 12,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-091",
    "name": "Amber Place 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "APARTMENT",
    "pricePerNight": 70000,
    "rooms": 13,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-092",
    "name": "Palm Suites 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 82500,
    "rooms": 14,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-093",
    "name": "Cedar Terrace 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 95000,
    "rooms": 15,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  },
  {
    "id": "demo-094",
    "name": "Ivory Retreat 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "APARTMENT",
    "pricePerNight": 107500,
    "rooms": 16,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.2"
    ]
  },
  {
    "id": "demo-095",
    "name": "Lagoon Residences 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 120000,
    "rooms": 17,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.3"
    ]
  },
  {
    "id": "demo-096",
    "name": "Crown House 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 132500,
    "rooms": 18,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.4"
    ]
  },
  {
    "id": "demo-097",
    "name": "Olive Apartments 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "APARTMENT",
    "pricePerNight": 45000,
    "rooms": 19,
    "guests": 2,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.5"
    ]
  },
  {
    "id": "demo-098",
    "name": "Harbour Court 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 57500,
    "rooms": 20,
    "guests": 3,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.6"
    ]
  },
  {
    "id": "demo-099",
    "name": "Sapphire Gardens 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "HOTEL",
    "pricePerNight": 70000,
    "rooms": 21,
    "guests": 4,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Kitchenette"
    ],
    "images": [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.0"
    ]
  },
  {
    "id": "demo-100",
    "name": "Maple Lodge 10",
    "city": "Warri",
    "state": "Delta",
    "kind": "APARTMENT",
    "pricePerNight": 82500,
    "rooms": 22,
    "guests": 5,
    "amenities": [
      "Wi-Fi",
      "Air conditioning",
      "24-hour support",
      "Breakfast lounge"
    ],
    "images": [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=82&ixlib=rb-4.1.1"
    ]
  }
];
