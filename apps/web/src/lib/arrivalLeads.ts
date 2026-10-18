export type ArrivalDiscoveryLead = {
  name: string;
  address: string;
  phone: string | null;
  sourceUrl: string;
  sourceType: string;
  status: 'unverified_lead';
  notes: string;
};

// Imported from PR #2's directory research. These are discovery leads, not vetted partners or bookable inventory.
export const arrivalDiscoveryLeads: ArrivalDiscoveryLead[] = [
  {
    "name": "Monty Suites Uyo",
    "address": "37 General Edet Akpan Avenue, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 703 809 1700",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/CgsIspTP-cGbgK6WARAB?gsas=1",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Prismar International Hotels",
    "address": "5 Effanga Usanga Street, Afaha Offot, off Abak Road, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 813 160 6660",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/CgsI3MWD4-2s_e-aARAB",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "EEMJM Hotels",
    "address": "47 Dominic Utuk Avenue, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 818 222 2444",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/ChgI8_yppOWpxd1xGgwvZy8xeWRwdjluejQQAQ",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Edinan Hotels & Suites",
    "address": "Block V, Akwa Ima Estate, Plot 91, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 704 046 9982",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/ChoIyqnP1NL_4p-UARoNL2cvMTFkXzd0cnJrcBAB",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Francinesplace Hotel",
    "address": "26 Ewet Street, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 704 841 9450",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/ChkIjo-n-J-Bi8stGg0vZy8xMXN3d3I5N2Z3EAE",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Calawazobia Hotels Uyo",
    "address": "2B Mbaba Afia, off Aka-Itiam Road, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 706 419 1176",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/CgoI3qeEj6y6zu1FEAE?gsas=1",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Pleasure Rest Hotel and Suites",
    "address": "7 Udo Inyang Street, Itam Road, Uyo, Akwa Ibom, Nigeria",
    "phone": "+234 813 372 6676",
    "sourceUrl": "https://www.google.com/travel/hotels/entity/CgoI47n477TP-cB3EAE",
    "sourceType": "public hotel directory",
    "status": "unverified_lead",
    "notes": "Public listing; confirm direct contact, current operations, address, rates and inventory."
  },
  {
    "name": "Joemoon Garden Motel",
    "address": "34 Udo Ikpe Street, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Emadora Hotel",
    "address": "Idoro Road, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Andy Jack Hotel And Suites",
    "address": "No. 9 Aka Road, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Buddies Hotels",
    "address": "No. 4 Inim Udo Ekong Street, off Nelson Mandela Street, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/10",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Villa View Garden",
    "address": "No. 4 Udoinyang Street, Ham Junction, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/10",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Sammies Luxury Hotel",
    "address": "17 Iwok Close, Ekit Itam II, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/10",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "Hotel Elite",
    "address": "47 Chima Street, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/10",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; do not use the directory's generic booking phone as the hotel's direct number."
  },
  {
    "name": "NPJ Luxury Serviced Apartment",
    "address": "No. 3 Ubong Jumbo Avenue, Ring Road 3, Nwaniba, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/23",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Serviced apartment, not necessarily a hotel; classify property type during review."
  },
  {
    "name": "Rosmohr Hotels (Vintage)",
    "address": "Plot 126 Unit A, Lagos Street, Ewet Housing Estate, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/23",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; confirm exact property identity and current operation."
  },
  {
    "name": "Rosmohr Gold",
    "address": "Plot C4549, Ewet Housing Estate, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/23",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; confirm exact property identity and current operation."
  },
  {
    "name": "Greenview Hotel and Apartment",
    "address": "Plot 221, Ewet Housing Extension Estate, Mbak Road, off New Ring Road 3, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/23",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Hotel/apartment classification and current details require confirmation."
  },
  {
    "name": "Remalex Hotel and Suites",
    "address": "Ring Road 3, Idongesit Nkanga Way, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/23",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Public directory listing; confirm current operation and full address."
  },
  {
    "name": "Munta Guest House",
    "address": "74 Ukana Offot Street, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/13",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Guest house; classify property type and confirm current operation."
  },
  {
    "name": "Kings Guest House",
    "address": "32 C-Line, Ewet Housing Estate, Uyo, Akwa Ibom, Nigeria",
    "phone": null,
    "sourceUrl": "https://hotels.ng/hotels-in-akwaibom/uyo/21",
    "sourceType": "Hotels.ng directory",
    "status": "unverified_lead",
    "notes": "Guest house; classify property type and confirm current operation."
  }
];
