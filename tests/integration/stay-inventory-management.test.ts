import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../../backend/platform/src/app.ts';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { MockProvider } from '../../backend/platform/src/provider.ts';

const origin='http://127.0.0.1:5177';
const password='Stay-Inventory-Integration-Test-Passphrase-42!';

test('owner room, rate and room-night APIs are tenant scoped and preserve manual inventory authority',{
  skip:!process.env.TEST_DATABASE_URL,
  timeout:120000,
},async()=>{
  const ownerUrl=process.env.TEST_DATABASE_URL!;
  const runtimeUrl=process.env.TEST_RUNTIME_DATABASE_URL ?? ownerUrl;
  const targets=[ownerUrl,runtimeUrl].map(value=>{
    const url=new URL(value);
    assert.doesNotMatch(url.hostname,/(?:^|\.)supabase\.co$|(?:^|\.)pooler\.supabase\.com$/i);
    assert.match(decodeURIComponent(url.pathname.slice(1)),/_test_db$/);
    return [url.hostname,url.port || '5432',url.pathname];
  });
  assert.deepEqual(targets[0],targets[1]);
  const pool=createPool(ownerUrl);
  const appPool=createPool(runtimeUrl);
  const users:string[]=[];
  const businesses:string[]=[];
  const offerings:string[]=[];
  let server:Server|undefined;
  try{
    const identity=await one(pool,'SELECT current_database() AS name,inet_server_port() AS port');
    assert.match(String(identity?.name),/_test_db$/);
    assert.deepEqual(await one(appPool,'SELECT current_database() AS name,inet_server_port() AS port'),identity);
    await migrate(pool);
    const runtime=createApp({pool:appPool,provider:new MockProvider(),environment:'preview',publicOrigin:origin});
    server=await new Promise<Server>(resolve=>{
      const listener=runtime.app.listen(0,'127.0.0.1',()=>resolve(listener));
    });
    const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    class Client{
      cookie='';csrf='';email=`stay-inventory-${randomUUID()}@seven.test`;
      async request<T>(path:string,method='GET',body?:unknown,expected=200):Promise<T>{
        const response=await fetch(`${base}/api${path}`,{
          method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,
            'X-CSRF-Token':this.csrf,'Idempotency-Key':randomUUID()},
          ...(body===undefined?{}:{body:JSON.stringify(body)}),
        });
        const cookie=response.headers.get('set-cookie');
        if(cookie)this.cookie=cookie.split(';')[0] ?? '';
        const result=await response.json() as {data:T;error?:unknown};
        assert.equal(response.status,expected,JSON.stringify(result));
        return result.data;
      }
      async register(){
        const session=await this.request<{user:{id:string};csrfToken:string}>('/auth/register','POST',{
          email:this.email,password,displayName:'Stay inventory test',
        });
        users.push(session.user.id);this.csrf=session.csrfToken;return session.user.id;
      }
      async login(){
        const session=await this.request<{csrfToken:string}>('/auth/login','POST',{email:this.email,password});
        this.csrf=session.csrfToken;
      }
      async apply(name:string){
        const business=await this.request<{id:string}>('/business/applications','POST',{
          businessName:name,city:'Uyo',state:'Akwa Ibom',address:'1 Inventory Test Lane, Uyo',
          phone:'+2348012345678',sector:'STAY',
          description:'Disposable integration fixture; never a real or public hotel.',
        });
        businesses.push(business.id);await this.login();return business;
      }
    }
    const owner=new Client();await owner.register();
    const business=await owner.apply('Stay inventory fixture hotel');
    const admin=new Client();const adminId=await admin.register();
    await pool.query("UPDATE seven.users SET role_id=(SELECT role_id FROM seven.roles WHERE role_code='ADMIN') WHERE user_id=$1",[adminId]);
    await admin.login();
    const evidence={confirmed:true,evidenceReference:'isolated-test:verified'};
    await admin.request(`/admin/businesses/${business.id}/status`,'POST',{
      status:'APPROVED',reason:'Isolated stay inventory test approval',
      verification:{propertyExists:evidence,partnerAuthority:evidence,directContact:evidence,
        fullAddress:evidence,coordinates:evidence,currentRates:evidence,
        roomInventoryAndPolicies:evidence,inventoryFreshnessHours:24},
    });
    const offer=await owner.request<{id:string}>('/business/offerings','POST',{
      title:'Inventory test room',description:'Disposable hotel room for inventory API tests.',
      kind:'STAY',city:'Uyo',state:'Akwa Ibom',address:'1 Inventory Test Lane, Uyo',
      priceMinor:'4500000',capacity:2,published:true,
    });
    offerings.push(offer.id);
    const startDate=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    const endDate=new Date(Date.parse(startDate+'T12:00:00Z')+2*86400000).toISOString().slice(0,10);
    await owner.request(`/business/offerings/${offer.id}/availability`,'POST',{
      startDate,endDate,capacity:5,
    },409);
    const legacyWindowStart=new Date(`${startDate}T00:00:00+01:00`).toISOString();
    await pool.query(
      "INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity,inventory_confirmed_at,inventory_source) VALUES($1,$2,$3,$4,5,now(),'MANUAL')",
      [randomUUID(),offer.id,legacyWindowStart,new Date(Date.parse(legacyWindowStart)+86400000).toISOString()],
    );
    const room=await owner.request<{room_type_id:string}>('/business/stay/rooms','POST',{
      offeringId:offer.id,name:'King Room',maxOccupancy:2,bedConfiguration:'1 king bed',totalRooms:8,
    });
    const adoptedLegacyWindow=await one<{room_type_id:string}>(pool,
      'SELECT room_type_id FROM seven.inventory_windows WHERE offering_id=$1 AND starts_at=$2',[offer.id,legacyWindowStart]);
    assert.equal(adoptedLegacyWindow?.room_type_id,room.room_type_id);
    const plan=await owner.request<{rate_plan_id:string}>('/business/stay/rate-plans','POST',{
      roomTypeId:room.room_type_id,code:'FLEX',name:'Flexible room only',
      currencyCode:'NGN',mealPlan:'ROOM_ONLY',refundable:true,cancellationPolicy:'Free cancellation before arrival.',
    });
    await owner.request(`/business/stay/rate-plans/${plan.rate_plan_id}`,'PATCH',{
      code:'FLEX',name:'Flexible room only updated',currencyCode:'NGN',mealPlan:'ROOM_ONLY',
      refundable:true,cancellationPolicy:'Free cancellation before arrival.',expectedRevision:1,
    });
    await owner.request('/business/stay/rate-plans/'+plan.rate_plan_id,'PATCH',{
      code:'FLEX',name:'Stale revision must fail',currencyCode:'NGN',mealPlan:'ROOM_ONLY',
      refundable:true,cancellationPolicy:'Stale edit.',expectedRevision:1,
    },409);
    await owner.request('/business/stay/nightly-rates','PUT',{
      ratePlanId:plan.rate_plan_id,expectedRevision:1,startDate,endDate,amountMinor:'10000000',
      closedToArrival:false,closedToDeparture:false,minStayNights:1,maxStayNights:7,
    },409);
    await owner.request('/business/stay/nightly-rates','PUT',{
      ratePlanId:plan.rate_plan_id,expectedRevision:2,startDate,endDate,amountMinor:'10000000',
      closedToArrival:false,closedToDeparture:false,minStayNights:1,maxStayNights:7,
    });
    const secondNight=new Date(Date.parse(startDate+'T12:00:00Z')+86400000).toISOString().slice(0,10);
    await owner.request('/business/stay/nightly-rates','PUT',{
      ratePlanId:plan.rate_plan_id,expectedRevision:3,startDate:secondNight,endDate:secondNight,amountMinor:'15000000',
      closedToArrival:false,closedToDeparture:false,minStayNights:1,maxStayNights:7,
    });
    await owner.request(`/business/stay/rooms/${room.room_type_id}/availability`,'POST',{
      startDate,endDate,capacity:5,
    });
    const secondRoom=await owner.request<{room_type_id:string}>('/business/stay/rooms','POST',{
      offeringId:offer.id,name:'Twin Room',maxOccupancy:2,bedConfiguration:'2 twin beds',totalRooms:3,
    });
    const secondPlan=await owner.request<{rate_plan_id:string}>('/business/stay/rate-plans','POST',{
      roomTypeId:secondRoom.room_type_id,code:'TWIN',name:'Twin room only',
      currencyCode:'NGN',mealPlan:'ROOM_ONLY',refundable:true,cancellationPolicy:'Free cancellation before arrival.',
    });
    await owner.request('/business/stay/nightly-rates','PUT',{
      ratePlanId:secondPlan.rate_plan_id,expectedRevision:1,startDate,endDate,amountMinor:'20000000',
      closedToArrival:false,closedToDeparture:false,minStayNights:1,maxStayNights:7,
    });
    await owner.request(`/business/stay/rooms/${secondRoom.room_type_id}/availability`,'POST',{
      startDate,endDate,capacity:1,
    });
    const calendar=await owner.request<{rooms:Array<{room_type_id:string;room_name:string;service_date:string;amount_minor:string;capacity:number;allocated_count:number;inventory_source:string}>}>(
      `/business/stay/calendar?offeringId=${offer.id}&startDate=${startDate}&endDate=${endDate}`);
    assert.equal(calendar.rooms.length,6);
    const firstCategoryRows=calendar.rooms.filter(night=>night.room_type_id===room.room_type_id);
    const secondCategoryRows=calendar.rooms.filter(night=>night.room_type_id===secondRoom.room_type_id);
    assert.equal(firstCategoryRows.length,3);
    assert.equal(secondCategoryRows.length,3);
    assert.ok(firstCategoryRows.every(night=>night.room_name==='King Room'));
    assert.ok(secondCategoryRows.every(night=>night.room_name==='Twin Room'));
    assert.deepEqual(firstCategoryRows.map(night=>night.amount_minor).sort(),['10000000','10000000','15000000']);
    assert.ok(firstCategoryRows.every(night=>night.capacity===5 && night.allocated_count===0 && night.inventory_source==='MANUAL'));
    assert.ok(secondCategoryRows.every(night=>night.amount_minor==='20000000' && night.capacity===1 && night.allocated_count===0 && night.inventory_source==='MANUAL'));

    const customerA=new Client();await customerA.register();
    // Malformed quote input must reach Express's validation handler, not become an unhandled rejection.
    await customerA.request('/stay-quotes','POST',{},422);
    const customerB=new Client();await customerB.register();
    const plans=await customerA.request<{plans:Array<{roomType:{id:string;name:string};ratePlan:{id:string};available:boolean}>}>(
      `/offerings/${offer.id}/stay-rate-plans?checkInDate=${startDate}&checkOutDate=${endDate}&rooms=1`);
    assert.equal(plans.plans.length,2);
    assert.equal(plans.plans.filter(plan=>plan.available).length,2);
    assert.ok(plans.plans.some(plan=>plan.roomType.id===room.room_type_id && plan.roomType.name==='King Room'));
    assert.ok(plans.plans.some(plan=>plan.roomType.id===secondRoom.room_type_id && plan.roomType.name==='Twin Room'));
    const largerRequest=await customerA.request<{plans:Array<{roomType:{id:string;name:string};available:boolean}>}>(
      `/offerings/${offer.id}/stay-rate-plans?checkInDate=${startDate}&checkOutDate=${endDate}&rooms=2`);
    assert.equal(largerRequest.plans.find(item=>item.roomType.id===room.room_type_id)?.available,true);
    assert.equal(largerRequest.plans.find(item=>item.roomType.id===secondRoom.room_type_id)?.available,false);
    const quoteBody={
      offeringId:offer.id,roomTypeId:room.room_type_id,ratePlanId:plan.rate_plan_id,
      checkInDate:startDate,checkOutDate:endDate,rooms:5,
    };
    const firstRate=await one<{room_type_id:string;amount_minor:string;closed_to_arrival:boolean;closed_to_departure:boolean;min_stay_nights:number;max_stay_nights:number}>(
      pool,'SELECT room_type_id,amount_minor::text,closed_to_arrival,closed_to_departure,min_stay_nights,max_stay_nights FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await pool.query('DELETE FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query(
      'INSERT INTO seven.stay_nightly_rates(rate_plan_id,room_type_id,service_date,amount_minor,closed_to_arrival,closed_to_departure,min_stay_nights,max_stay_nights) VALUES($1,$2,$3::date,$4,$5,$6,$7,$8)',
      [plan.rate_plan_id,firstRate!.room_type_id,startDate,firstRate!.amount_minor,firstRate!.closed_to_arrival,firstRate!.closed_to_departure,firstRate!.min_stay_nights,firstRate!.max_stay_nights],
    );
    await pool.query('UPDATE seven.stay_nightly_rates SET closed_to_arrival=true WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query('UPDATE seven.stay_nightly_rates SET closed_to_arrival=false,min_stay_nights=3 WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query('UPDATE seven.stay_nightly_rates SET min_stay_nights=1,max_stay_nights=1 WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query('UPDATE seven.stay_nightly_rates SET max_stay_nights=7 WHERE rate_plan_id=$1 AND service_date=$2::date',[plan.rate_plan_id,startDate]);
    await pool.query(
      'UPDATE seven.stay_nightly_rates SET closed_to_departure=true WHERE rate_plan_id=$1 AND service_date=$2::date',
      [plan.rate_plan_id,endDate],
    );
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query(
      'UPDATE seven.stay_nightly_rates SET closed_to_departure=false WHERE rate_plan_id=$1 AND service_date=$2::date',
      [plan.rate_plan_id,endDate],
    );
    await pool.query(
      "UPDATE seven.inventory_windows SET inventory_confirmed_at=now()-interval '25 hours' WHERE offering_id=$1 AND (starts_at AT TIME ZONE 'Africa/Lagos')::date=$2::date",
      [offer.id,startDate],
    );
    await customerA.request('/stay-quotes','POST',quoteBody,409);
    await pool.query(
      "UPDATE seven.inventory_windows SET inventory_confirmed_at=now() WHERE offering_id=$1 AND (starts_at AT TIME ZONE 'Africa/Lagos')::date=$2::date",
      [offer.id,startDate],
    );
    const quoteRateRows=await pool.query<{service_date:string}>(
      'SELECT service_date::text FROM seven.stay_nightly_rates WHERE rate_plan_id=$1 AND service_date=ANY($2::date[]) ORDER BY service_date',
      [plan.rate_plan_id,[startDate,secondNight]],
    );
    assert.deepEqual(quoteRateRows.rows.map(row=>row.service_date),[startDate,secondNight]);
    const quoteA=await customerA.request<{quote:{id:string;price:{subtotalMinor:string;totalMinor:string};units:number};nightlyBreakdown:Array<{lineTotalMinor:string}>}>(
      '/stay-quotes','POST',quoteBody);
    assert.equal(quoteA.quote.units,2);
    assert.equal(quoteA.quote.price.subtotalMinor,'125000000');
    assert.equal(quoteA.quote.price.totalMinor,'125000000');
    assert.deepEqual(quoteA.nightlyBreakdown.map(night=>night.lineTotalMinor),['50000000','75000000']);
    const quoteB=await customerB.request<{quote:{id:string}}>('/stay-quotes','POST',quoteBody);
    const expiredQuote=await customerA.request<{quote:{id:string}}>('/stay-quotes','POST',quoteBody);
    await pool.query("UPDATE seven.quotes SET expires_at=now()-interval '1 minute' WHERE quote_id=$1",[expiredQuote.quote.id]);
    await customerA.request('/reservations','POST',{quoteId:expiredQuote.quote.id},409);
    const storedSnapshot=await one<{terms_snapshot:{ratePlan:{id:string;refundable:boolean;cancellationPolicy:string};nightlyBreakdown:Array<{date:string;amountMinor:string}>};amounts:{totalMinor:string}}>(
      pool,'SELECT terms_snapshot,amounts FROM seven.quotes WHERE quote_id=$1',[quoteA.quote.id]);
    assert.equal(storedSnapshot?.terms_snapshot.ratePlan.id,plan.rate_plan_id);
    assert.equal(storedSnapshot?.terms_snapshot.ratePlan.refundable,true);
    assert.equal(storedSnapshot?.terms_snapshot.ratePlan.cancellationPolicy,'Free cancellation before arrival.');
    assert.equal(storedSnapshot?.terms_snapshot.nightlyBreakdown.length,2);
    assert.deepEqual(storedSnapshot?.terms_snapshot.nightlyBreakdown.map(night=>night.amountMinor),['10000000','15000000']);
    assert.equal(storedSnapshot?.amounts.totalMinor,'125000000');
    await owner.request('/business/stay/rate-plans/'+plan.rate_plan_id,'PATCH',{
      code:'FLEX',name:'Flexible room only revised for future bookings',currencyCode:'NGN',mealPlan:'ROOM_ONLY',
      refundable:false,cancellationPolicy:'Updated policy for future quotes.',expectedRevision:4,
    });
    await owner.request(`/business/stay/rooms/${room.room_type_id}`,'PATCH',{
      name:'King Room renamed after quote',maxOccupancy:2,bedConfiguration:'1 king bed',
      totalRooms:8,expectedRevision:1,
    });
    await owner.request('/business/stay/nightly-rates','PUT',{
      ratePlanId:plan.rate_plan_id,expectedRevision:5,startDate,endDate:startDate,amountMinor:'30000000',
      closedToArrival:false,closedToDeparture:false,minStayNights:1,maxStayNights:7,
    });
    await customerA.request('/quotes','POST',{
      offeringId:offer.id,startDate,endDate,quantity:1,
    },409);
    await pool.query(
      "UPDATE seven.inventory_windows SET inventory_confirmed_at=now()-interval '25 hours' WHERE offering_id=$1 AND (starts_at AT TIME ZONE 'Africa/Lagos')::date=$2::date",
      [offer.id,startDate],
    );
    await customerA.request('/reservations','POST',{quoteId:quoteA.quote.id},409);
    await pool.query(
      "UPDATE seven.inventory_windows SET inventory_confirmed_at=now() WHERE offering_id=$1 AND (starts_at AT TIME ZONE 'Africa/Lagos')::date=$2::date",
      [offer.id,startDate],
    );
    const outcomes=await Promise.allSettled([
      customerA.request<{id:string;stayTerms:{ratePlan:{name:string;refundable:boolean;cancellationPolicy:string};nightlyBreakdown:Array<{amountMinor:string}>}}>('/reservations','POST',{quoteId:quoteA.quote.id}),
      customerB.request<{id:string}>('/reservations','POST',{quoteId:quoteB.quote.id}),
    ]);
    assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);
    const winner=outcomes.find((outcome):outcome is PromiseFulfilledResult<{id:string;stayTerms:{roomType:{id:string;name:string};ratePlan:{name:string;refundable:boolean;cancellationPolicy:string};nightlyBreakdown:Array<{amountMinor:string}>}}>=>outcome.status==='fulfilled')!;
    assert.equal(winner.value.stayTerms.roomType.id,room.room_type_id);
    assert.equal(winner.value.stayTerms.roomType.name,'King Room');
    assert.equal(winner.value.stayTerms.ratePlan.name,'Flexible room only updated');
    assert.equal(winner.value.stayTerms.ratePlan.refundable,true);
    assert.equal(winner.value.stayTerms.ratePlan.cancellationPolicy,'Free cancellation before arrival.');
    assert.deepEqual(winner.value.stayTerms.nightlyBreakdown.map(night=>night.amountMinor),['10000000','15000000']);
    assert.equal(outcomes.filter(outcome=>outcome.status==='rejected').length,1);
    const allocated=await one<{allocated_count:number}>(
      pool,'SELECT max(allocated_count)::int AS allocated_count FROM seven.inventory_windows WHERE offering_id=$1 AND room_type_id=$2',[offer.id,room.room_type_id]);
    assert.equal(allocated?.allocated_count,5);
    const otherCategoryAllocation=await one<{allocated_count:number}>(
      pool,'SELECT max(allocated_count)::int AS allocated_count FROM seven.inventory_windows WHERE offering_id=$1 AND room_type_id=$2',[offer.id,secondRoom.room_type_id]);
    assert.equal(otherCategoryAllocation?.allocated_count,0);

    const other=new Client();await other.register();await other.apply('Other inventory fixture');
    const isolated=await other.request<{rooms:unknown[]}>(`/business/stay/calendar?offeringId=${offer.id}&startDate=${startDate}&endDate=${endDate}`);
    assert.deepEqual(isolated.rooms,[]);
    await other.request('/business/stay/rate-plans','POST',{
      roomTypeId:room.room_type_id,code:'OTHER',name:'Cross tenant attempt',
      currencyCode:'NGN',mealPlan:'ROOM_ONLY',
    },404);
    const unnamedRoom=await owner.request<{room_type_id:string;name:string}>('/business/stay/rooms','POST',{
      offeringId:offer.id,maxOccupancy:2,bedConfiguration:'1 king bed',totalRooms:8,
    });
    assert.notEqual(unnamedRoom.room_type_id,room.room_type_id);
    assert.equal(unnamedRoom.name,'1 king bed');
  }finally{
    if(server)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));
    if(offerings.length){
      await pool.query('DELETE FROM seven.allocations WHERE reservation_id IN (SELECT reservation_id FROM seven.reservations WHERE offering_id=ANY($1::uuid[]))',[offerings]);
      await pool.query('DELETE FROM seven.reservations WHERE offering_id=ANY($1::uuid[])',[offerings]);
      await pool.query('DELETE FROM seven.quotes WHERE offering_id=ANY($1::uuid[])',[offerings]);
    }
    if(offerings.length)await pool.query('DELETE FROM seven.inventory_windows WHERE offering_id=ANY($1::uuid[])',[offerings]);
    if(offerings.length)await pool.query(
      'DELETE FROM seven.stay_nightly_rates WHERE rate_plan_id IN (SELECT rate_plan_id FROM seven.stay_rate_plans WHERE offering_id=ANY($1::uuid[]))',
      [offerings],
    );
    if(offerings.length)await pool.query('DELETE FROM seven.stay_rate_plans WHERE offering_id=ANY($1::uuid[])',[offerings]);
    if(offerings.length)await pool.query('DELETE FROM seven.stay_room_types WHERE offering_id=ANY($1::uuid[])',[offerings]);
    if(offerings.length)await pool.query('DELETE FROM seven.observations WHERE offering_id=ANY($1::uuid[])',[offerings]);
    if(businesses.length)await pool.query('DELETE FROM seven.observations WHERE business_id=ANY($1::uuid[])',[businesses]);
    if(offerings.length)await pool.query('DELETE FROM seven.offerings WHERE offering_id=ANY($1::uuid[])',[offerings]);
    if(businesses.length){
      await pool.query('DELETE FROM seven.outbox_events WHERE business_id=ANY($1::uuid[])',[businesses]);
      await pool.query('DELETE FROM seven.audit_events WHERE business_id=ANY($1::uuid[])',[businesses]);
      await pool.query('DELETE FROM seven.sources WHERE business_id=ANY($1::uuid[])',[businesses]);
      await pool.query('DELETE FROM seven.memberships WHERE business_id=ANY($1::uuid[])',[businesses]);
      await pool.query('DELETE FROM seven.venues WHERE business_id=ANY($1::uuid[])',[businesses]);
      await pool.query('DELETE FROM seven.businesses WHERE business_id=ANY($1::uuid[])',[businesses]);
    }
    if(users.length){
      await pool.query('DELETE FROM seven.notifications WHERE user_id=ANY($1::uuid[])',[users]);
      await pool.query('DELETE FROM seven.idempotencies WHERE user_id=ANY($1::uuid[])',[users]);
      await pool.query('DELETE FROM seven.sessions WHERE user_id=ANY($1::uuid[])',[users]);
      await pool.query('DELETE FROM seven.users WHERE user_id=ANY($1::uuid[])',[users]);
    }
    await appPool.end();await pool.end();
  }
});
