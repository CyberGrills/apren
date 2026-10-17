import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { createPool, transaction, one } from './db.ts';
import { hashPassword } from './auth.ts';
import { sid, pointsJournal } from './store.ts';

export async function seed(
  pool: Pool,
  password = process.env.SEED_PASSWORD ?? randomBytes(18).toString('base64url'),
): Promise<{ password: string; emails: string[] }> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development seed is forbidden in production.');
  const emails = [
    'guest@seven.test',
    'friend@seven.test',
    'host@seven.test',
    'reception@seven.test',
    'admin@seven.test',
  ];
  const hash = await hashPassword(password);
  await transaction(pool, async (db) => {
    const accounts = [
      ['guest@seven.test', 'Ada', 'CUSTOMER'],
      ['friend@seven.test', 'Tomi', 'CUSTOMER'],
      ['host@seven.test', 'Dara', 'BUSINESS_OWNER'],
      ['reception@seven.test', 'Iman', 'RECEPTION'],
      ['admin@seven.test', '7even team', 'ADMIN'],
    ];
    for (const [email, displayName, role] of accounts)
      await db.query(
        'INSERT INTO seven.users(user_id,email,display_name,password_hash,role_id) VALUES($1,$2,$3,$4,(SELECT role_id FROM seven.roles WHERE role_code=$5)) ON CONFLICT(email) DO NOTHING',
        [randomUUID(), email, displayName, hash, role],
      );
    const host = (await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [
      'host@seven.test',
    ]))!;
    const reception = (await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [
      'reception@seven.test',
    ]))!;
    const sample = [
      {
        slug: 'the-haven-lagos',
        name: 'The Haven Lagos',
        city: 'Lagos',
        sector: 'STAY',
        title: 'A quiet room above the city',
        price: '8500000',
        address: 'Victoria Island, Lagos',
        description:
          'Light-filled rooms, a courtyard pool and breakfast at your own pace. A sample stay created to explore 7even.',
        image:
          'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=85',
        capacity: 8,
        amenities: ['Pool', 'Breakfast', 'Wi-Fi', 'Free parking'],
      },
      {
        slug: 'ora-lagos',
        name: 'Ora Kitchen',
        city: 'Lagos',
        sector: 'DINING',
        title: 'A table worth taking your time at',
        price: '2200000',
        address: 'Ikoyi, Lagos',
        description:
          'Seasonal Nigerian cooking, a considered wine list and a table with room for everyone. A sample dining venue.',
        image:
          'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85',
        capacity: 24,
        amenities: ['Vegetarian options', 'Outdoor seating', 'Parking'],
      },
      {
        slug: 'terra-abuja',
        name: 'Terra Abuja',
        city: 'Abuja',
        sector: 'EXPERIENCE',
        title: 'Clay, conversation and something to keep',
        price: '1800000',
        address: 'Wuse 2, Abuja',
        description:
          'A small pottery session with local makers. Shape a piece, learn the process and leave with a story. Sample experience.',
        image:
          'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1400&q=85',
        capacity: 12,
        amenities: ['Materials included', 'Small group', 'Beginner friendly'],
      },
    ];
    for (const place of sample) {
      const business = await one(db, 'SELECT business_id FROM seven.businesses WHERE slug=$1', [
        place.slug,
      ]);
      if (business) continue;
      const businessId = randomUUID();
      const venueId = randomUUID();
      const offeringId = randomUUID();
      await db.query(
        `INSERT INTO seven.businesses(business_id,business_name,slug,city,description,workflow_state_id,subaccount_id,bank_revision,details) VALUES($1,$2,$3,$4,$5,${sid('APPROVED')},$6,1,$7)`,
        [
          businessId,
          place.name,
          place.slug,
          place.city,
          place.description,
          `RS_LOCAL_${businessId.replaceAll('-', '')}`,
          {
            address: place.address,
            sector: place.sector,
            phone: '+234 000 000 0000',
            isSample: true,
            accountLabel: 'Local test subaccount. No bank settlement.',
            subaccountMode: 'mock',
          },
        ],
      );
      await db.query(
        'INSERT INTO seven.venues(venue_id,business_id,venue_name,address_line,city) VALUES($1,$2,$3,$4,$5)',
        [venueId, businessId, place.name, place.address, place.city],
      );
      await db.query(
        'INSERT INTO seven.offerings(offering_id,business_id,venue_id,sector_id,title,description,city,price_minor,tax_bps,is_published,details) VALUES($1,$2,$3,(SELECT sector_id FROM seven.sectors WHERE sector_code=$4),$5,$6,$7,$8,750,true,$9)',
        [
          offeringId,
          businessId,
          venueId,
          place.sector,
          place.title,
          place.description,
          place.city,
          place.price,
          {
            address: place.address,
            capacity: place.capacity,
            images: [place.image],
            amenities: place.amenities,
            cancellationHours: 24,
            discountBps: 0,
          },
        ],
      );
      for (let day = 0; day < 45; day++) {
        const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
        const start = `${date}T${place.sector === 'STAY' ? '00' : place.sector === 'DINING' ? '18' : '10'}:00:00+01:00`;
        const end = new Date(
          Date.parse(start) + (place.sector === 'STAY' ? 86400000 : 7200000),
        ).toISOString();
        await db.query(
          'INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), offeringId, start, end, place.capacity],
        );
      }
      await db.query(
        "INSERT INTO seven.rewards(reward_id,business_id,title,description,points_cost,remaining_count,initial_capacity,expires_at,is_transferable,is_published) VALUES($1,$2,$3,$4,100,50,50,now()+interval '90 days',true,true)",
        [
          randomUUID(),
          businessId,
          place.sector === 'STAY'
            ? 'Breakfast for two'
            : place.sector === 'DINING'
              ? 'A little extra at your table'
              : 'Bring a friend',
          'A sample business-funded benefit for this local development build.',
        ],
      );
      if (place.sector === 'STAY') {
        for (const [userId, role] of [
          [host.user_id, 'BUSINESS_OWNER'],
          [reception.user_id, 'RECEPTION'],
        ]) {
          await db.query(
            'INSERT INTO seven.memberships(membership_id,user_id,business_id,role_id) VALUES($1,$2,$3,(SELECT role_id FROM seven.roles WHERE role_code=$4)) ON CONFLICT(user_id,business_id) DO NOTHING',
            [randomUUID(), userId, businessId, role],
          );
          await db.query(
            'INSERT INTO seven.sources(source_id,business_id,user_id) VALUES($1,$2,$3) ON CONFLICT(business_id,user_id) DO NOTHING',
            [randomUUID(), businessId, userId],
          );
        }
      }
    }
    for (const email of ['guest@seven.test', 'friend@seven.test']) {
      const user = (await one(db, 'SELECT user_id FROM seven.users WHERE email=$1', [email]))!;
      await pointsJournal(
        db,
        `seed:${user.user_id}`,
        'Development sample points. Not earned through a real payment.',
        [
          { account: `customer:${user.user_id}`, amount: 1000 },
          { account: 'issuer', amount: -1000 },
        ],
      );
    }
  });
  return { password, emails };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool();
  try {
    const result = await seed(pool);
    console.log('Explicit sample data created. These are local development accounts only.');
    console.log(`Accounts: ${result.emails.join(', ')}`);
    console.log(
      process.env.SEED_PASSWORD
        ? 'Password: supplied by SEED_PASSWORD.'
        : `Generated development password: ${result.password}`,
    );
  } finally {
    await pool.end();
  }
}
