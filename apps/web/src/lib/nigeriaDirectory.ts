export type DirectoryKind = 'STAY' | 'DINING' | 'EXPERIENCE';
export type DirectoryFilter = DirectoryKind | 'ALL';

export interface NigeriaStateDirectory {
  stateName: string;
  capital: string;
  region: string;
  hotelDirectoryUrl: string;
}

export interface DirectoryListing {
  id: string;
  kind: DirectoryKind;
  name: string;
  state: string;
  city: string;
  area: string;
  address: string;
  description: string;
  imageUrl: string;
  imageSourceName: string;
  imageSourceUrl: string;
  sourceName: string;
  sourceUrl: string;
  status: 'DIRECTORY_ONLY';
  bookable: false;
}

const hotelDirectory = (slug: string) => `https://hotels.ng/hotels-in-${slug}`;

export const nigeriaStateDirectories: NigeriaStateDirectory[] = [
  {
    stateName: 'Abia',
    capital: 'Umuahia',
    region: 'South East',
    hotelDirectoryUrl: hotelDirectory('abia'),
  },
  {
    stateName: 'Adamawa',
    capital: 'Yola',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('adamawa'),
  },
  {
    stateName: 'Akwa Ibom',
    capital: 'Uyo',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('akwa-ibom'),
  },
  {
    stateName: 'Anambra',
    capital: 'Awka',
    region: 'South East',
    hotelDirectoryUrl: hotelDirectory('anambra'),
  },
  {
    stateName: 'Bauchi',
    capital: 'Bauchi',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('bauchi'),
  },
  {
    stateName: 'Bayelsa',
    capital: 'Yenagoa',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('bayelsa'),
  },
  {
    stateName: 'Benue',
    capital: 'Makurdi',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('benue'),
  },
  {
    stateName: 'Borno',
    capital: 'Maiduguri',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('borno'),
  },
  {
    stateName: 'Cross River',
    capital: 'Calabar',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('cross-river'),
  },
  {
    stateName: 'Delta',
    capital: 'Asaba',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('delta'),
  },
  {
    stateName: 'Ebonyi',
    capital: 'Abakaliki',
    region: 'South East',
    hotelDirectoryUrl: hotelDirectory('ebonyi'),
  },
  {
    stateName: 'Edo',
    capital: 'Benin City',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('edo'),
  },
  {
    stateName: 'Ekiti',
    capital: 'Ado-Ekiti',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('ekiti'),
  },
  {
    stateName: 'Enugu',
    capital: 'Enugu',
    region: 'South East',
    hotelDirectoryUrl: hotelDirectory('enugu'),
  },
  {
    stateName: 'Federal Capital Territory (Abuja)',
    capital: 'Abuja',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('abuja'),
  },
  {
    stateName: 'Gombe',
    capital: 'Gombe',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('gombe'),
  },
  {
    stateName: 'Imo',
    capital: 'Owerri',
    region: 'South East',
    hotelDirectoryUrl: hotelDirectory('imo'),
  },
  {
    stateName: 'Jigawa',
    capital: 'Dutse',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('jigawa'),
  },
  {
    stateName: 'Kaduna',
    capital: 'Kaduna',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('kaduna'),
  },
  {
    stateName: 'Kano',
    capital: 'Kano',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('kano'),
  },
  {
    stateName: 'Katsina',
    capital: 'Katsina',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('katsina'),
  },
  {
    stateName: 'Kebbi',
    capital: 'Birnin Kebbi',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('kebbi'),
  },
  {
    stateName: 'Kogi',
    capital: 'Lokoja',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('kogi'),
  },
  {
    stateName: 'Kwara',
    capital: 'Ilorin',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('kwara'),
  },
  {
    stateName: 'Lagos',
    capital: 'Ikeja',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('lagos'),
  },
  {
    stateName: 'Nasarawa',
    capital: 'Lafia',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('nasarawa'),
  },
  {
    stateName: 'Niger',
    capital: 'Minna',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('niger'),
  },
  {
    stateName: 'Ogun',
    capital: 'Abeokuta',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('ogun'),
  },
  {
    stateName: 'Ondo',
    capital: 'Akure',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('ondo'),
  },
  {
    stateName: 'Osun',
    capital: 'Osogbo',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('osun'),
  },
  {
    stateName: 'Oyo',
    capital: 'Ibadan',
    region: 'South West',
    hotelDirectoryUrl: hotelDirectory('oyo'),
  },
  {
    stateName: 'Plateau',
    capital: 'Jos',
    region: 'North Central',
    hotelDirectoryUrl: hotelDirectory('plateau'),
  },
  {
    stateName: 'Rivers',
    capital: 'Port Harcourt',
    region: 'South South',
    hotelDirectoryUrl: hotelDirectory('rivers'),
  },
  {
    stateName: 'Sokoto',
    capital: 'Sokoto',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('sokoto'),
  },
  {
    stateName: 'Taraba',
    capital: 'Jalingo',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('taraba'),
  },
  {
    stateName: 'Yobe',
    capital: 'Damaturu',
    region: 'North East',
    hotelDirectoryUrl: hotelDirectory('yobe'),
  },
  {
    stateName: 'Zamfara',
    capital: 'Gusau',
    region: 'North West',
    hotelDirectoryUrl: hotelDirectory('zamfara'),
  },
].sort((a, b) => a.stateName.localeCompare(b.stateName, 'en-NG'));

export const sourcedDirectoryListings: DirectoryListing[] = [
  {
    id: 'stay-eko-hotel-lagos',
    kind: 'STAY',
    name: 'Eko Hotel & Suites',
    state: 'Lagos',
    city: 'Lagos',
    area: 'Victoria Island',
    address: 'Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos',
    description:
      'Hotel rooms and suites, dining, pool and event facilities. Directory lead only; current rooms and rates are not verified by 7even.',
    imageUrl: 'https://cimages.timbu.com/guides/2017/04/eko-hotel-suites-lagos-000.jpg',
    imageSourceName: 'Hotels.ng destination guide',
    imageSourceUrl:
      'https://hotels.ng/guides/destinations/eko-hotel-and-suites-the-home-of-events-fine-cuisine-and-hospitality-in-nigeria/',
    sourceName: 'Eko Hotel & Suites',
    sourceUrl: 'https://www.ekohotels.com/our-hotels.php',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-transcorp-hilton-abuja',
    kind: 'STAY',
    name: 'Transcorp Hilton Abuja',
    state: 'Federal Capital Territory (Abuja)',
    city: 'Abuja',
    area: 'Maitama',
    address: '1 Aguiyi Ironsi Street, Maitama, Abuja',
    description:
      'Hotel directory lead. Confirm current room inventory, rates and booking terms with the operator.',
    imageUrl:
      'https://images.timbu.com/hotels-ng/supplier_transcorp_hilton_abuja_115051_9_900x550.jpg',
    imageSourceName: 'Hotels.ng / Timbu',
    imageSourceUrl: 'https://hotels.ng/hotel/72523-transcorp-hilton-abuja-abuja',
    sourceName: 'Transcorp Hilton Abuja',
    sourceUrl: 'https://www.hilton.com/en/hotels/abuhitw-transcorp-hilton-abuja/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-novotel-port-harcourt',
    kind: 'STAY',
    name: 'Novotel Port Harcourt',
    state: 'Rivers',
    city: 'Port Harcourt',
    area: 'Old GRA',
    address: '3 Stadium Road, Port Harcourt',
    description:
      'Hotel directory lead. Location, current operation and availability must be confirmed before booking.',
    imageUrl: 'https://z.cdrst.com/foto/hotel-sf/10c3c27e/granderesp/foto-hotel-10c3b7d4.jpg',
    imageSourceName: 'Reserving hotel directory',
    imageSourceUrl:
      'https://reserving.com/hotels/africa/nigeria/rivers/port-harcourt/novotel-port-harcourt',
    sourceName: 'Reserving',
    sourceUrl:
      'https://reserving.com/hotels/africa/nigeria/rivers/port-harcourt/novotel-port-harcourt',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-swiss-international-mabisel',
    kind: 'STAY',
    name: 'Swiss International Mabisel',
    state: 'Rivers',
    city: 'Port Harcourt',
    area: 'Mabisel',
    address: '9 Mabisel Road, Port Harcourt',
    description:
      'Hotel directory lead. Confirm property details, present operating status and room stock with the operator.',
    imageUrl:
      'https://swissinternationalhotels.com/wp-content/uploads/2022/02/New-Exterior-Image3-1-scaled.jpg',
    imageSourceName: 'Swiss International Hotels',
    imageSourceUrl: 'https://swissinternationalhotels.com/',
    sourceName: 'Swiss International Hotels',
    sourceUrl: 'https://swissinternationalhotels.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-transcorp-calabar',
    kind: 'STAY',
    name: 'Transcorp Hotels Calabar',
    state: 'Cross River',
    city: 'Calabar',
    area: 'Calabar',
    address: 'Calabar, Cross River State',
    description:
      'Hotel directory lead. Confirm the current property name, operator and availability before making plans.',
    imageUrl:
      'https://blog.vectatravels.com/wp-content/uploads/2021/01/Transcorp-Hotel-calabar-1024x683.jpg',
    imageSourceName: 'Vecta Travels',
    imageSourceUrl: 'https://blog.vectatravels.com/resorts-hotels-calabar/',
    sourceName: 'Vecta Travels',
    sourceUrl: 'https://www.transcorphotels.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-delve-calabar',
    kind: 'STAY',
    name: 'Delve Hotel & Suites',
    state: 'Cross River',
    city: 'Calabar',
    area: 'Calabar',
    address: 'Calabar, Cross River State',
    description: 'Hotel directory lead; current inventory has not been verified through 7even.',
    imageUrl: 'https://images.timbu.com/hotels-ng/supplier_delve_hotel_suites_283484_1.jpeg',
    imageSourceName: 'Timbu hotel listing',
    imageSourceUrl: 'https://www.timbu.com/',
    sourceName: 'Timbu',
    sourceUrl: 'https://www.timbu.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'stay-obudu-mountain-resort',
    kind: 'STAY',
    name: 'Obudu Mountain Resort',
    state: 'Cross River',
    city: 'Obudu',
    area: 'Obudu Plateau',
    address: 'Obudu, Cross River State',
    description:
      'Mountain resort and nature destination. Confirm current accommodation operations and dates directly.',
    imageUrl: 'https://www.obudumountainresort.com/siteadmin/files/gallery/89363809.jpg',
    imageSourceName: 'Obudu Mountain Resort official gallery',
    imageSourceUrl: 'https://www.obudumountainresort.com/index_php',
    sourceName: 'Obudu Mountain Resort',
    sourceUrl: 'https://www.obudumountainresort.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'dining-calabar-kitchen',
    kind: 'DINING',
    name: 'Calabar Kitchen',
    state: 'Lagos',
    city: 'Ikeja',
    area: 'Off Allen Avenue',
    address: '27 Oluwaleyimu Street, off Allen Avenue, Ikeja, Lagos',
    description:
      'African and continental restaurant with eat-in and catering services. Check current service details with the venue.',
    imageUrl: 'https://m.timbu.com/poi/3085/calabar-3085-58a183bde7fea.jpg',
    imageSourceName: 'Hotels.ng restaurant photo',
    imageSourceUrl: 'https://hotels.ng/places/restaurant/3085-calabar-kitchen-ikeja',
    sourceName: 'Calabar Kitchen',
    sourceUrl: 'https://www.calabar-kitchen.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'dining-lagoon-breeze',
    kind: 'DINING',
    name: 'Lagoon Breeze Restaurant',
    state: 'Lagos',
    city: 'Lagos',
    area: 'Victoria Island',
    address: 'Eko Hotel & Suites, Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos',
    description:
      'Poolside grill at Eko Hotel. Verify current opening hours and table availability with the venue.',
    imageUrl:
      'https://coinventmediastorage.blob.core.windows.net/media-storage-container/gphoto_ChIJ53yw6EWNOxAR0iYenZvXaCk_0.jpg',
    imageSourceName: 'Sky Restaurant photo directory',
    imageSourceUrl:
      'https://airial.travel/attractions/nigeria/lagos/sky-restaurant-lounge-eko-hotel-lagos-0UivSsPv',
    sourceName: 'Eko Hotel & Suites',
    sourceUrl: 'https://www.ekohotels.com/lagoon-breeze.php',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'dining-terra-kulture',
    kind: 'DINING',
    name: 'Terra Kulture Restaurant',
    state: 'Lagos',
    city: 'Lagos',
    area: 'Victoria Island',
    address: 'Plot 1376 Tiamiyu Savage Street, off Ahmadu Bello Way, Victoria Island, Lagos',
    description:
      'Nigerian dining in a cultural venue, with a published menu and table reservations on the official site.',
    imageUrl: 'https://www.idoff.net/storage/places/gallery/69fc67c3d76d3.jpg',
    imageSourceName: 'iDOFF Places',
    imageSourceUrl: 'https://www.idoff.net/places/terra-kulture-restaurant',
    sourceName: 'Terra Kulture Restaurant',
    sourceUrl: 'https://restaurant.terrakulture.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'dining-wakkis-abuja',
    kind: 'DINING',
    name: 'Wakkis',
    state: 'Federal Capital Territory (Abuja)',
    city: 'Abuja',
    area: 'Abuja',
    address: 'Abuja, Federal Capital Territory',
    description:
      'Restaurant directory lead. Confirm the venue address, opening hours and current table arrangements before travelling.',
    imageUrl:
      'https://pub-5bcc3edf34304d04b59dc91e1ad9d2fd.r2.dev/nigeria.tortoisepath.com/uploads/2024/01/13070208/Wakkis-Food-Abuja-Abuja-Nigeria-TortoisePathcom-8-jpeg.webp',
    imageSourceName: 'TortoisePath restaurant photo',
    imageSourceUrl: 'https://nigeria.tortoisepath.com/place/wakkis-food-abuja/',
    sourceName: 'TortoisePath',
    sourceUrl: 'https://nigeria.tortoisepath.com/place/wakkis-food-abuja/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-erin-ijesha',
    kind: 'EXPERIENCE',
    name: 'Erin-Ijesha Waterfall',
    state: 'Osun',
    city: 'Erin-Ijesha',
    area: 'Oriade',
    address: 'Erin-Ijesha, Osun State',
    description:
      'Waterfall destination identified by Nigeria’s government travel guide. Check local opening and access conditions first.',
    imageUrl: 'https://services.gov.ng/images/l/erin-ijesha.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-gashaka-gumti',
    kind: 'EXPERIENCE',
    name: 'Gashaka Gumti National Park',
    state: 'Taraba',
    city: 'Serti',
    area: 'Gashaka-Gumti',
    address: 'Taraba State',
    description:
      'National park destination identified by Nigeria’s government travel guide. Confirm access and local conditions.',
    imageUrl: 'https://services.gov.ng/images/l/gashaka.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-ikogosi',
    kind: 'EXPERIENCE',
    name: 'Ikogosi Warm Spring',
    state: 'Ekiti',
    city: 'Ikogosi-Ekiti',
    area: 'Ikogosi',
    address: 'Ikogosi-Ekiti, Ekiti State',
    description: 'Warm and cold spring destination listed by Nigeria’s government travel guide.',
    imageUrl: 'https://services.gov.ng/images/l/ikogosi.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-la-campagne',
    kind: 'EXPERIENCE',
    name: 'La Campagne Tropicana Beach',
    state: 'Lagos',
    city: 'Ikegun',
    area: 'Lekki-Epe corridor',
    address: 'Lagos State',
    description:
      'Beach resort destination listed by Nigeria’s government travel guide. Confirm access, ticketing and current operating conditions.',
    imageUrl: 'https://services.gov.ng/images/l/lacampagne.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-nike-art-gallery',
    kind: 'EXPERIENCE',
    name: 'Nike Art Gallery',
    state: 'Lagos',
    city: 'Lekki',
    area: 'Lekki',
    address: 'Lekki, Lagos State',
    description:
      'Art gallery and cultural destination listed by Nigeria’s government travel guide.',
    imageUrl: 'https://services.gov.ng/images/l/nike-art.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://www.nikeartgallery.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-obudu-canopy',
    kind: 'EXPERIENCE',
    name: 'Obudu Mountain Resort Canopy Walk',
    state: 'Cross River',
    city: 'Obudu',
    area: 'Obudu Plateau',
    address: 'Obudu Mountain Resort, Cross River State',
    description:
      'Canopy walkway shown in the resort’s official gallery. Confirm current access and operating conditions.',
    imageUrl: 'https://www.obudumountainresort.com/siteadmin/files/gallery/89363809.jpg',
    imageSourceName: 'Obudu Mountain Resort official gallery',
    imageSourceUrl: 'https://www.obudumountainresort.com/index_php',
    sourceName: 'Obudu Mountain Resort',
    sourceUrl: 'https://www.obudumountainresort.com/',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-osun-osogbo',
    kind: 'EXPERIENCE',
    name: 'Osun-Osogbo Sacred Grove',
    state: 'Osun',
    city: 'Osogbo',
    area: 'Osogbo',
    address: 'Osogbo, Osun State',
    description:
      'Sacred grove and heritage destination identified by Nigeria’s government travel guide.',
    imageUrl: 'https://services.gov.ng/images/l/osun.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
  {
    id: 'experience-yankari',
    kind: 'EXPERIENCE',
    name: 'Yankari National Park',
    state: 'Bauchi',
    city: 'Bauchi',
    area: 'Alkaleri area',
    address: 'Bauchi State',
    description:
      'Wildlife and warm-spring destination identified by Nigeria’s government travel guide. Check current entry and access rules.',
    imageUrl: 'https://services.gov.ng/images/l/yankari.jpg',
    imageSourceName: 'Visit Nigeria government travel guide',
    imageSourceUrl: 'https://services.gov.ng/visit-nigeria',
    sourceName: 'Visit Nigeria — services.gov.ng',
    sourceUrl: 'https://services.gov.ng/visit-nigeria',
    status: 'DIRECTORY_ONLY',
    bookable: false,
  },
];

export function listingsForKind(kind: DirectoryFilter): DirectoryListing[] {
  const items =
    kind === 'ALL'
      ? sourcedDirectoryListings
      : sourcedDirectoryListings.filter((listing) => listing.kind === kind);
  return [...items].sort(
    (a, b) =>
      a.state.localeCompare(b.state, 'en-NG') ||
      a.city.localeCompare(b.city, 'en-NG') ||
      a.name.localeCompare(b.name, 'en-NG'),
  );
}

export const directoryKindLabels: Record<DirectoryKind, string> = {
  STAY: 'Stays',
  DINING: 'Dining',
  EXPERIENCE: 'Experiences',
};
