-- Source-backed Nigeria hospitality discovery directory.
-- These are directory references only and MUST NOT be published as bookable 7even offerings.
-- Booking eligibility continues to require business approval, stay verification, and fresh partner-confirmed inventory.

CREATE TABLE IF NOT EXISTS seven.state_directories (
  state_directory_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  state_name varchar(100) NOT NULL UNIQUE,
  capital varchar(100) NOT NULL,
  region varchar(40) NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'NG',
  hotel_directory_url text NOT NULL,
  source_name varchar(100) NOT NULL DEFAULT 'Hotels.ng',
  source_checked_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT state_directory_country_ck CHECK (country_code = 'NG'),
  CONSTRAINT state_directory_url_ck CHECK (hotel_directory_url LIKE 'https://%')
);
ALTER TABLE seven.state_directories OWNER TO seven_owner;
ALTER TABLE seven.state_directories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON seven.state_directories TO seven_app, seven_readonly;
DROP POLICY IF EXISTS state_directories_server_read ON seven.state_directories;
CREATE POLICY state_directories_server_read ON seven.state_directories
  FOR SELECT TO seven_app, seven_readonly USING (is_active);
COMMENT ON TABLE seven.state_directories IS
  'Alphabetical pointers to external hotel directories in all 36 states and the FCT; these are not verified 7even inventory.';

CREATE TABLE IF NOT EXISTS seven.discovery_listings (
  discovery_listing_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind varchar(20) NOT NULL,
  display_name varchar(180) NOT NULL,
  state_name varchar(100) NOT NULL,
  city varchar(120) NOT NULL,
  area varchar(180) NOT NULL DEFAULT '',
  address_text varchar(500) NOT NULL DEFAULT '',
  description varchar(1200) NOT NULL DEFAULT '',
  image_url text NOT NULL,
  image_source_url text NOT NULL,
  source_name varchar(100) NOT NULL,
  source_url text NOT NULL,
  listing_status varchar(30) NOT NULL DEFAULT 'DIRECTORY_ONLY',
  is_bookable boolean NOT NULL DEFAULT false,
  source_checked_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_listing_kind_ck CHECK (kind IN ('STAY','DINING','EXPERIENCE')),
  CONSTRAINT discovery_listing_state_ck CHECK (state_name <> ''),
  CONSTRAINT discovery_listing_status_ck CHECK (listing_status IN ('DIRECTORY_ONLY','HIDDEN')),
  CONSTRAINT discovery_listing_not_bookable_ck CHECK (is_bookable = false),
  CONSTRAINT discovery_listing_source_url_ck CHECK (source_url LIKE 'https://%'),
  CONSTRAINT discovery_listing_image_url_ck CHECK (image_url LIKE 'https://%'),
  CONSTRAINT discovery_listing_image_source_url_ck CHECK (image_source_url LIKE 'https://%'),
  CONSTRAINT discovery_listing_unique UNIQUE (kind, display_name, state_name, city)
);
ALTER TABLE seven.discovery_listings OWNER TO seven_owner;
ALTER TABLE seven.discovery_listings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON seven.discovery_listings TO seven_app, seven_readonly;
DROP POLICY IF EXISTS discovery_listings_server_read ON seven.discovery_listings;
CREATE POLICY discovery_listings_server_read ON seven.discovery_listings
  FOR SELECT TO seven_app, seven_readonly
  USING (listing_status = 'DIRECTORY_ONLY' AND is_bookable = false);
CREATE INDEX IF NOT EXISTS discovery_listings_sort_idx
  ON seven.discovery_listings (kind, state_name, city, display_name)
  WHERE listing_status = 'DIRECTORY_ONLY';
COMMENT ON TABLE seven.discovery_listings IS
  'Source-backed directory leads only. Never used for 7even price quotes, availability, inventory allocation, or checkout.';

INSERT INTO seven.state_directories (state_name, capital, region, hotel_directory_url) VALUES
('Abia','Umuahia','South East','https://hotels.ng/hotels-in-abia'),
('Adamawa','Yola','North East','https://hotels.ng/hotels-in-adamawa'),
('Akwa Ibom','Uyo','South South','https://hotels.ng/hotels-in-akwa-ibom'),
('Anambra','Awka','South East','https://hotels.ng/hotels-in-anambra'),
('Bauchi','Bauchi','North East','https://hotels.ng/hotels-in-bauchi'),
('Bayelsa','Yenagoa','South South','https://hotels.ng/hotels-in-bayelsa'),
('Benue','Makurdi','North Central','https://hotels.ng/hotels-in-benue'),
('Borno','Maiduguri','North East','https://hotels.ng/hotels-in-borno'),
('Cross River','Calabar','South South','https://hotels.ng/hotels-in-cross-river'),
('Delta','Asaba','South South','https://hotels.ng/hotels-in-delta'),
('Ebonyi','Abakaliki','South East','https://hotels.ng/hotels-in-ebonyi'),
('Edo','Benin City','South South','https://hotels.ng/hotels-in-edo'),
('Ekiti','Ado-Ekiti','South West','https://hotels.ng/hotels-in-ekiti'),
('Enugu','Enugu','South East','https://hotels.ng/hotels-in-enugu'),
('Federal Capital Territory (Abuja)','Abuja','North Central','https://hotels.ng/hotels-in-abuja'),
('Gombe','Gombe','North East','https://hotels.ng/hotels-in-gombe'),
('Imo','Owerri','South East','https://hotels.ng/hotels-in-imo'),
('Jigawa','Dutse','North West','https://hotels.ng/hotels-in-jigawa'),
('Kaduna','Kaduna','North West','https://hotels.ng/hotels-in-kaduna'),
('Kano','Kano','North West','https://hotels.ng/hotels-in-kano'),
('Katsina','Katsina','North West','https://hotels.ng/hotels-in-katsina'),
('Kebbi','Birnin Kebbi','North West','https://hotels.ng/hotels-in-kebbi'),
('Kogi','Lokoja','North Central','https://hotels.ng/hotels-in-kogi'),
('Kwara','Ilorin','North Central','https://hotels.ng/hotels-in-kwara'),
('Lagos','Ikeja','South West','https://hotels.ng/hotels-in-lagos'),
('Nasarawa','Lafia','North Central','https://hotels.ng/hotels-in-nasarawa'),
('Niger','Minna','North Central','https://hotels.ng/hotels-in-niger'),
('Ogun','Abeokuta','South West','https://hotels.ng/hotels-in-ogun'),
('Ondo','Akure','South West','https://hotels.ng/hotels-in-ondo'),
('Osun','Osogbo','South West','https://hotels.ng/hotels-in-osun'),
('Oyo','Ibadan','South West','https://hotels.ng/hotels-in-oyo'),
('Plateau','Jos','North Central','https://hotels.ng/hotels-in-plateau'),
('Rivers','Port Harcourt','South South','https://hotels.ng/hotels-in-rivers'),
('Sokoto','Sokoto','North West','https://hotels.ng/hotels-in-sokoto'),
('Taraba','Jalingo','North East','https://hotels.ng/hotels-in-taraba'),
('Yobe','Damaturu','North East','https://hotels.ng/hotels-in-yobe'),
('Zamfara','Gusau','North West','https://hotels.ng/hotels-in-zamfara')
ON CONFLICT (state_name) DO UPDATE SET
  capital=EXCLUDED.capital,
  region=EXCLUDED.region,
  hotel_directory_url=EXCLUDED.hotel_directory_url,
  source_name='Hotels.ng',
  source_checked_at=now(),
  is_active=true,
  updated_at=now();

INSERT INTO seven.discovery_listings
(kind,display_name,state_name,city,area,address_text,description,image_url,image_source_url,source_name,source_url)
VALUES
('STAY','Eko Hotel & Suites','Lagos','Lagos','Victoria Island','Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos','Hotel rooms and suites, dining, pool and event facilities; directory lead only.','https://cimages.timbu.com/guides/2017/04/eko-hotel-suites-lagos-000.jpg','https://hotels.ng/guides/destinations/eko-hotel-and-suites-the-home-of-events-fine-cuisine-and-hospitality-in-nigeria/','Hotels.ng / Eko Hotel','https://www.ekohotels.com/our-hotels.php'),
('STAY','Transcorp Hilton Abuja','Federal Capital Territory (Abuja)','Abuja','Maitama','1 Aguiyi Ironsi Street, Maitama, Abuja','Hotel directory lead; contact the property to verify current room stock and rates.','https://media-exp1.licdn.com/dms/image/C4D1BAQFqOMRnVNbdnQ/company-background_10000/0/1558979936817?e=2159024400&t=dddRz2URVUo31Mr6nWe9PGNdzDaN_gAgi34GTw1bowM&v=beta','https://www.linkedin.com/company/transcorp-hilton-abuja','Transcorp Hilton Abuja','https://www.hilton.com/en/hotels/abuhitw-transcorp-hilton-abuja/'),
('STAY','Novotel Port Harcourt','Rivers','Port Harcourt','Old GRA','3 Stadium Road, Port Harcourt','Hotel directory lead; location and availability require confirmation before booking.','https://z.cdrst.com/foto/hotel-sf/10c3c27e/granderesp/foto-hotel-10c3b7d4.jpg','https://reserving.com/hotels/africa/nigeria/rivers/port-harcourt/novotel-port-harcourt','Reserving','https://reserving.com/hotels/africa/nigeria/rivers/port-harcourt/novotel-port-harcourt'),
('STAY','Swiss International Mabisel','Rivers','Port Harcourt','Mabisel','9 Mabisel Road, Port Harcourt','Hotel directory lead; independently confirm current status, room stock and terms.','https://swissinternationalhotels.com/wp-content/uploads/2022/02/New-Exterior-Image3-1-scaled.jpg','https://swissinternationalhotels.com/','Swiss International Hotels','https://swissinternationalhotels.com/'),
('STAY','Transcorp Hotels Calabar','Cross River','Calabar','Calabar','Calabar, Cross River State','Hotel directory lead; current property identity and inventory must be confirmed by the operator.','https://assets.sunnewsonline.com/2023/02/gcUKbaNi-Transcorp-Hilton-header_Calabar2-1.jpg','https://sunnewsonline.com/','Sun News Online','https://www.transcorphotels.com/'),
('STAY','Delve Hotel & Suites','Cross River','Calabar','Calabar','Calabar, Cross River State','Hotel directory lead; current room availability has not been confirmed on 7even.','https://images.timbu.com/hotels-ng/supplier_delve_hotel_suites_283484_1.jpeg','https://images.timbu.com/hotels-ng/supplier_delve_hotel_suites_283484_1.jpeg','Timbu','https://www.timbu.com/'),
('STAY','Hotel Ibis Lagos Ikeja','Lagos','Ikeja','Ikeja','Lagos State','Hotel directory lead sourced from a third-party booking directory; rates and inventory are not imported.','https://images.trvl-media.com/lodging/5000000/4270000/4269500/4269451/eb9cc2c5.jpg?impolicy=resizecrop&ra=fill&rh=575&rw=575','https://hotels.ng/hotel/52497-hotel-ibis-lagos-ikeja-lagos','Hotels.ng / Expedia image','https://hotels.ng/hotel/52497-hotel-ibis-lagos-ikeja-lagos'),
('STAY','Obudu Mountain Resort','Cross River','Obudu','Obudu Plateau','Obudu, Cross River State','Resort and mountain destination; confirm accommodation operations and dates directly.','https://www.obudumountainresort.com/siteadmin/files/gallery/89363809.jpg','https://www.obudumountainresort.com/index_php','Obudu Mountain Resort','https://www.obudumountainresort.com/'),
('DINING','Calabar Kitchen','Lagos','Ikeja','Off Allen Avenue','27 Oluwaleyimu Street, off Allen Avenue, Ikeja, Lagos','African and continental dining; venue listing sourced from the restaurant website.','https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0d/0a/1c/6a/calabar-kitchen.jpg?h=-1&s=1&w=1600','https://www.tripadvisor.com/Restaurant_Review-g304026-d4161685-Reviews-Calabar_Kitchen-Lagos_Lagos_State.html','Tripadvisor / Calabar Kitchen','https://www.calabar-kitchen.com/'),
('DINING','Lagoon Breeze Restaurant','Lagos','Lagos','Victoria Island','Eko Hotel & Suites, Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos','Poolside grill at Eko Hotel; opening hours should be confirmed with venue before visiting.','https://coinventmediastorage.blob.core.windows.net/media-storage-container/gphoto_ChIJ53yw6EWNOxAR0iYenZvXaCk_0.jpg','https://www.ekohotels.com/lagoon-breeze.php','Eko Hotel & Suites / Google photo','https://www.ekohotels.com/lagoon-breeze.php'),
('DINING','Terra Kulture Restaurant','Lagos','Lagos','Victoria Island','Plot 1376 Tiamiyu Savage Street, off Ahmadu Bello Way, Victoria Island, Lagos','Nigerian dining within a cultural venue; official site offers menus and table reservations.','https://www.idoff.net/storage/places/gallery/69fc67c3d76d3.jpg','https://www.idoff.net/places/terra-kulture-restaurant','iDOFF Places / Terra Kulture','https://restaurant.terrakulture.com/'),
('DINING','Wakkis','Federal Capital Territory (Abuja)','Abuja','Abuja','Abuja, Federal Capital Territory','Restaurant listing lead; check the source for current location, hours and reservation details.','https://dynamic-media-cdn.tripadvisor.com/media/photo-o/04/0e/de/ef/wakkis.jpg?h=-1&s=1&w=1100','https://www.tripadvisor.com/Restaurant_Review-g293825-d2368906-Reviews-Wakkis-Abuja_Federal_Capital_Territory.html','Tripadvisor','https://www.tripadvisor.com/Restaurant_Review-g293825-d2368906-Reviews-Wakkis-Abuja_Federal_Capital_Territory.html'),
('EXPERIENCE','Erin-Ijesha Waterfall','Osun','Erin-Ijesha','Oriade','Erin-Ijesha, Osun State','Waterfall destination identified by Nigeria’s government travel guide; opening conditions and access should be checked locally.','https://services.gov.ng/images/l/erin-ijesha.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://services.gov.ng/visit-nigeria'),
('EXPERIENCE','Gashaka Gumti National Park','Taraba','Serti','Gashaka-Gumti','Taraba State','National park destination identified by Nigeria’s government travel guide; use the source for destination context.','https://services.gov.ng/images/l/gashaka.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://services.gov.ng/visit-nigeria'),
('EXPERIENCE','Ikogosi Warm Spring','Ekiti','Ikogosi-Ekiti','Ikogosi','Ikogosi-Ekiti, Ekiti State','Warm and cold spring destination listed by Nigeria’s government travel guide.','https://services.gov.ng/images/l/ikogosi.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://services.gov.ng/visit-nigeria'),
('EXPERIENCE','La Campagne Tropicana Beach','Lagos','Ikegun','Lekki-Epe corridor','Lagos State','Beach resort destination listed by Nigeria’s government travel guide; confirm access, ticketing and conditions with operator.','https://services.gov.ng/images/l/lacampagne.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://lacampagnetropicana.com/'),
('EXPERIENCE','Nike Art Gallery','Lagos','Lekki','Lekki','Lagos State','Art gallery and culture destination listed by Nigeria’s government travel guide.','https://services.gov.ng/images/l/nike-art.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://www.nikeartgallery.com/'),
('EXPERIENCE','Obudu Mountain Resort Canopy Walk','Cross River','Obudu','Obudu Plateau','Obudu Mountain Resort, Cross River State','Canopy walkway experience shown in the resort’s official gallery; confirm current access and operating conditions.','https://www.obudumountainresort.com/siteadmin/files/gallery/89363809.jpg','https://www.obudumountainresort.com/index_php','Obudu Mountain Resort','https://www.obudumountainresort.com/'),
('EXPERIENCE','Osun-Osogbo Sacred Grove','Osun','Osogbo','Osogbo','Osogbo, Osun State','Sacred grove and heritage destination identified by Nigeria’s government travel guide.','https://services.gov.ng/images/l/osun.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://services.gov.ng/visit-nigeria'),
('EXPERIENCE','Yankari National Park','Bauchi','Bauchi','Alkaleri area','Bauchi State','Wildlife and warm-spring destination identified by Nigeria’s government travel guide; check current entry and access rules.','https://services.gov.ng/images/l/yankari.jpg','https://services.gov.ng/visit-nigeria','Visit Nigeria — services.gov.ng','https://services.gov.ng/visit-nigeria')
ON CONFLICT (kind, display_name, state_name, city) DO UPDATE SET
  area=EXCLUDED.area,
  address_text=EXCLUDED.address_text,
  description=EXCLUDED.description,
  image_url=EXCLUDED.image_url,
  image_source_url=EXCLUDED.image_source_url,
  source_name=EXCLUDED.source_name,
  source_url=EXCLUDED.source_url,
  listing_status='DIRECTORY_ONLY',
  is_bookable=false,
  source_checked_at=now(),
  updated_at=now();

CREATE OR REPLACE VIEW seven.public_discovery_directory
WITH (security_invoker=true)
AS
SELECT discovery_listing_id, kind, display_name, state_name, city, area, address_text,
       description, image_url, image_source_url, source_name, source_url, source_checked_at
FROM seven.discovery_listings
WHERE listing_status='DIRECTORY_ONLY' AND is_bookable=false;
ALTER VIEW seven.public_discovery_directory OWNER TO seven_owner;
REVOKE ALL ON seven.public_discovery_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON seven.public_discovery_directory TO seven_app, seven_readonly;
REVOKE ALL ON seven.state_directories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON seven.discovery_listings FROM PUBLIC, anon, authenticated;
