-- Replace source-hosts that failed image checks with working photos from matching property sources.
UPDATE seven.discovery_listings
SET image_url='https://images.timbu.com/hotels-ng/supplier_transcorp_hilton_abuja_115051_9_900x550.jpg',
    image_source_url='https://hotels.ng/hotel/72523-transcorp-hilton-abuja-abuja',
    source_name='Transcorp Hilton Abuja',
    source_url='https://www.hilton.com/en/hotels/abuhitw-transcorp-hilton-abuja/',
    source_checked_at=now(), updated_at=now()
WHERE kind='STAY' AND display_name='Transcorp Hilton Abuja';

UPDATE seven.discovery_listings
SET image_url='https://blog.vectatravels.com/wp-content/uploads/2021/01/Transcorp-Hotel-calabar-1024x683.jpg',
    image_source_url='https://blog.vectatravels.com/resorts-hotels-calabar/',
    source_name='Vecta Travels',
    source_url='https://www.transcorphotels.com/',
    source_checked_at=now(), updated_at=now()
WHERE kind='STAY' AND display_name='Transcorp Hotels Calabar';

UPDATE seven.discovery_listings
SET image_url='https://m.timbu.com/poi/3085/calabar-3085-58a183bde7fea.jpg',
    image_source_url='https://hotels.ng/places/restaurant/3085-calabar-kitchen-ikeja',
    source_name='Calabar Kitchen',
    source_url='https://www.calabar-kitchen.com/',
    source_checked_at=now(), updated_at=now()
WHERE kind='DINING' AND display_name='Calabar Kitchen';

UPDATE seven.discovery_listings
SET image_url='https://pub-5bcc3edf34304d04b59dc91e1ad9d2fd.r2.dev/nigeria.tortoisepath.com/uploads/2024/01/13070208/Wakkis-Food-Abuja-Abuja-Nigeria-TortoisePathcom-8-jpeg.webp',
    image_source_url='https://nigeria.tortoisepath.com/place/wakkis-food-abuja/',
    source_name='TortoisePath',
    source_url='https://nigeria.tortoisepath.com/place/wakkis-food-abuja/',
    source_checked_at=now(), updated_at=now()
WHERE kind='DINING' AND display_name='Wakkis';
