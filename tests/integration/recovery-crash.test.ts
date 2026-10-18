import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPool, one, rows, transaction } from '../../services/platform/src/db.ts';
import { migrate } from '../../services/platform/src/migrate.ts';
import { seed } from '../../services/platform/src/seed.ts';
import { createQuote, createReservation } from '../../services/platform/src/reservations.ts';
import { checkout } from '../../services/platform/src/payments.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import { providerIds } from '../../services/platform/src/providerRegistry.ts';
import { userProjection, reservationProjection, paymentProjection } from '../../services/platform/src/store.ts';
import type { ProviderReceipt } from '../../services/platform/src/provider.ts';
import type { CrashConfiguration } from '../fixtures/recovery-child.ts';

interface Message { type: string; backendPid?: number; postingCount?: number; result?: { processed?: number; checkoutCalls: number; verifyCalls: number; databaseFaults?: number; errorCode?: string; receipt?: ProviderReceipt }; message?: string }
interface ChildRun { process: ChildProcess; wait(type: string): Promise<Message>; exited: Promise<{code:number|null;signal:NodeJS.Signals|null}> }

test('financial recovery survives actual process death and PostgreSQL rollback', {skip:!process.env.TEST_DATABASE_URL,timeout:90000}, async t => {
  const pool=createPool(process.env.TEST_DATABASE_URL); const children=new Set<ChildProcess>();
  assert.match((await one(pool,'SELECT current_database() AS db'))?.db,/_test_db$/,'Destructive fixture reset is restricted to the isolated test database.');
  await pool.query('DROP SCHEMA IF EXISTS seven CASCADE'); await migrate(pool); await seed(pool,'Crash-fixture-only-passphrase-42!');
  const guestRow=(await one(pool,'SELECT user_id FROM seven.users WHERE email=$1',['guest@seven.test']))!;
  const actor=(await userProjection(pool,guestRow.user_id))!;
  const base=(await one(pool,"SELECT b.business_id,v.venue_id FROM seven.businesses b JOIN seven.venues v USING(business_id) WHERE b.slug='the-haven-lagos'"))!;

  async function start(configuration:CrashConfiguration):Promise<ChildRun>{
    const child=fork(fileURLToPath(new URL('../fixtures/recovery-child.ts',import.meta.url)),[],{execArgv:[],env:{PATH:process.env.PATH,TEST_DATABASE_URL:process.env.TEST_DATABASE_URL},stdio:['ignore','pipe','pipe','ipc']});
    const watchdog=setTimeout(()=>child.kill('SIGKILL'),20000);watchdog.unref();child.once('exit',()=>clearTimeout(watchdog));
    children.add(child); let stderr=''; child.stderr?.on('data',(chunk:Buffer)=>{stderr=(stderr+chunk.toString()).slice(-4000);});
    const messages:Message[]=[]; child.on('message',value=>messages.push(value as Message));
    const exited=new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{children.delete(child);resolve({code,signal});});});
    const wait=(type:string):Promise<Message>=>{
      const known=messages.find(message=>message.type===type);if(known)return Promise.resolve(known);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{cleanup();reject(new Error(`Child did not reach ${type}: ${stderr}`));},15000);
        const message=(value:unknown):void=>{const event=value as Message;if(event.type===type){cleanup();resolve(event);}else if(event.type==='error'){cleanup();reject(new Error(`Child failure: ${event.message}`));}};
        const exit=():void=>{cleanup();reject(new Error(`Child exited before ${type}: ${stderr}`));};
        const cleanup=():void=>{clearTimeout(timer);child.off('message',message);child.off('exit',exit);};
        child.on('message',message);child.once('exit',exit);
      });
    };
    const run={process:child,wait,exited};await wait('ready');child.send(configuration);return run;
  }
  async function finish(configuration:CrashConfiguration):Promise<Message>{
    const run=await start(configuration);const done=await run.wait('done');const exit=await run.exited;assert.equal(exit.code,0);assert.equal(exit.signal,null);return done;
  }
  async function held(label:string,initialize=true,amountMinor=10000){
    const offeringId=randomUUID();const windowId=randomUUID();const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);const endDate=new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);
    await pool.query("INSERT INTO seven.offerings(offering_id,business_id,venue_id,sector_id,title,description,city,price_minor,is_published,details) VALUES($1,$2,$3,(SELECT sector_id FROM seven.sectors WHERE sector_code='STAY'),$4,'Synthetic crash recovery fixture','Lagos',$5,true,$6)",[offeringId,base.business_id,base.venue_id,label,amountMinor,{capacity:1,cancellationHours:24}]);
    await pool.query('INSERT INTO seven.inventory_windows(inventory_window_id,offering_id,starts_at,ends_at,capacity) VALUES($1,$2,$3,$4,1)',[windowId,offeringId,`${date}T00:00:00+01:00`,`${endDate}T00:00:00+01:00`]);
    const reservation=await transaction(pool,async db=>{const quote=await createQuote(db,actor,{offeringId,startDate:date,endDate,quantity:1});return createReservation(db,actor,quote.id);});
    if(!initialize)return {reservation,windowId};
    const payment=await checkout(pool,new MockProvider(),actor,reservation.id,'http://localhost:5177');
    assert.ok(payment.provider);
    const receipt:ProviderReceipt={id:`fixture-${randomUUID()}`,reference:payment.reference,status:'successful',currency:'NGN',amountMinor,feeMinor:0};
    const eventId=randomUUID();await pool.query('INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5)',[eventId,`charge.completed:${receipt.id}`,'charge.completed',{id:receipt.id,reference:receipt.reference},providerIds[payment.provider]]);
    return {reservation,windowId,payment,receipt,eventId};
  }
  async function assertUncommitted(fixture:Awaited<ReturnType<typeof held>>):Promise<void>{
    assert.equal((await reservationProjection(pool,fixture.reservation.id))?.status,'HELD');
    assert.equal((await paymentProjection(pool,fixture.payment!.paymentId))?.status,'PENDING');
    assert.equal((await one(pool,'SELECT funding_payment_attempt_id FROM seven.reservations WHERE reservation_id=$1',[fixture.reservation.id]))?.funding_payment_attempt_id,null);
    assert.equal((await rows(pool,'SELECT money_journal_id FROM seven.money_journals WHERE source_reference=$1',[`receipt:${fixture.payment!.provider}:${fixture.receipt!.id}`])).length,0);
    assert.equal((await one(pool,'SELECT allocated_count FROM seven.inventory_windows WHERE inventory_window_id=$1',[fixture.windowId]))?.allocated_count,1);
    assert.equal((await one(pool,'SELECT processed_at FROM seven.provider_events WHERE provider_event_id=$1',[fixture.eventId]))?.processed_at,null);
  }
  async function assertPaidOnce(reservationId:string,paymentId:string,windowId:string,receipt:ProviderReceipt):Promise<void>{
    const reservation=(await reservationProjection(pool,reservationId))!;assert.equal(reservation.status,'CONFIRMED');assert.equal(reservation.paymentId,paymentId);
    const payment=(await paymentProjection(pool,paymentId))!;assert.equal(payment.status,'PAID');assert.equal(payment.providerTransactionId,receipt.id);assert.ok(['UNSETTLED','PENDING'].includes(payment.settlementStatus),'Provider receipt alone never proves bank settlement');
    assert.equal((await rows(pool,"SELECT money_journal_id FROM seven.money_journals WHERE source_reference LIKE $1",[`settlement:%:${paymentId}`])).length,0);
    const journal=(await rows(pool,'SELECT money_journal_id FROM seven.money_journals WHERE source_reference=$1',[`receipt:${payment.provider}:${receipt.id}`]));assert.equal(journal.length,1);
    const postings=await rows(pool,'SELECT account_code,amount_minor FROM seven.money_postings WHERE money_journal_id=$1',[journal[0]!.money_journal_id]);assert.equal(postings.length,3);assert.equal(postings.reduce((sum,posting)=>sum+BigInt(posting.amount_minor),0n),0n);
    assert.deepEqual(postings.map(posting=>[posting.account_code,posting.amount_minor]).sort(),[['provider-clearing',String(receipt.amountMinor)],[`business:${base.business_id}`,String(-BigInt(receipt.amountMinor)+BigInt(receipt.amountMinor)/10n)],['platform-commission',String(-BigInt(receipt.amountMinor)/10n)]].sort());
    assert.equal((await one(pool,'SELECT allocated_count FROM seven.inventory_windows WHERE inventory_window_id=$1',[windowId]))?.allocated_count,1);
    assert.equal((await rows(pool,'SELECT allocation_id FROM seven.allocations WHERE reservation_id=$1 AND is_active',[reservationId])).length,1);
    assert.equal((await rows(pool,'SELECT payment_attempt_id FROM seven.payment_attempts WHERE reservation_id=$1',[reservationId])).length,1);
  }
  try{
    await t.test('SIGKILL after financial writes rolls back and a new worker claims the expired lease',async()=>{
      const fixture=await held('Process kill before commit');const child=await start({mode:'pause-before-commit',receipt:fixture.receipt!});
      const paused=await child.wait('paused');assert.ok(paused.backendPid);assert.equal(paused.postingCount,3);assert.equal(child.process.kill('SIGKILL'),true);const exit=await child.exited;assert.equal(exit.signal,'SIGKILL');
      for(let attempt=0;attempt<50;attempt++){if(!(await one(pool,'SELECT 1 FROM pg_stat_activity WHERE pid=$1',[paused.backendPid])))break;await new Promise(resolve=>setTimeout(resolve,20));}
      assert.equal(await one(pool,'SELECT 1 FROM pg_stat_activity WHERE pid=$1',[paused.backendPid]),undefined,'Killed worker database connection has ended, rolling back the open transaction');
      await assertUncommitted(fixture);
      const inbox=await one(pool,'SELECT * FROM seven.provider_events WHERE provider_event_id=$1',[fixture.eventId]);assert.ok(inbox?.lease_id);assert.equal(inbox?.attempts,1);
      // Explicit test-time advance only; production waits for the real two-minute lease.
      await pool.query("UPDATE seven.provider_events SET lease_expires_at=now()-interval '1 second',next_attempt_at=now() WHERE provider_event_id=$1",[fixture.eventId]);
      assert.equal((await finish({mode:'run-inbox',receipt:fixture.receipt!})).result?.processed,1);
      await assertPaidOnce(fixture.reservation.id,fixture.payment!.paymentId,fixture.windowId,fixture.receipt!);
      const processed=await one(pool,'SELECT * FROM seven.provider_events WHERE provider_event_id=$1',[fixture.eventId]);assert.ok(processed?.processed_at);assert.equal(processed?.lease_id,null);assert.equal(processed?.attempts,2);
      const duplicate=await pool.query('INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(payment_provider_id,event_reference) DO NOTHING',[randomUUID(),`charge.completed:${fixture.receipt!.id}`,'charge.completed',{id:fixture.receipt!.id,reference:fixture.receipt!.reference},providerIds[fixture.payment!.provider!]]);assert.equal(duplicate.rowCount,0);
      assert.equal((await finish({mode:'run-inbox',receipt:fixture.receipt!})).result?.processed,0);
      // Even an independently identified redelivery of the same receipt cannot repost it.
      await pool.query('INSERT INTO seven.provider_events(provider_event_id,event_reference,event_code,details,payment_provider_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),`redelivery:${fixture.receipt!.id}`,'charge.completed',{id:fixture.receipt!.id,reference:fixture.receipt!.reference},providerIds[fixture.payment!.provider!]]);
      assert.equal((await finish({mode:'run-inbox',receipt:fixture.receipt!})).result?.processed,1);
      await assertPaidOnce(fixture.reservation.id,fixture.payment!.paymentId,fixture.windowId,fixture.receipt!);
    });
    await t.test('a PostgreSQL exception after ledger writes leaves no partial payment then provider lookup recovers once',async()=>{
      const fixture=await held('Database failure before commit');const failure=await finish({mode:'database-error-before-commit',receipt:fixture.receipt!});assert.equal(failure.result?.processed,0);assert.equal(failure.result?.verifyCalls,1);assert.equal(failure.result?.databaseFaults,1);
      await assertUncommitted(fixture);
      const inbox=await one(pool,'SELECT * FROM seven.provider_events WHERE provider_event_id=$1',[fixture.eventId]);assert.equal(inbox?.lease_id,null);assert.equal(inbox?.attempts,1);assert.ok(inbox?.last_error);
      await pool.query('UPDATE seven.provider_events SET next_attempt_at=now() WHERE provider_event_id=$1',[fixture.eventId]);
      const restarted=await finish({mode:'run-inbox',receipt:fixture.receipt!});assert.equal(restarted.result?.processed,1);assert.equal(restarted.result?.checkoutCalls,0);assert.equal(restarted.result?.verifyCalls,1);
      await assertPaidOnce(fixture.reservation.id,fixture.payment!.paymentId,fixture.windowId,fixture.receipt!);
    });
    await t.test('initialization timeout with a possible charge survives restart without repeating checkout',async()=>{
      const fixture=await held('Checkout timeout recovery',false,10000000);
      const account=(await one(pool,'SELECT execution_mode_id FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2',[base.business_id,providerIds.flutterwave]))!;
      await pool.query("UPDATE seven.business_payment_accounts SET execution_mode_id=(SELECT execution_mode_id FROM seven.execution_modes WHERE execution_mode_code='flutterwave') WHERE business_id=$1 AND payment_provider_id=$2",[base.business_id,providerIds.flutterwave]);
      try{
        const timeout=await finish({mode:'checkout-timeout',reservationId:fixture.reservation.id,actorId:actor.id,transactionId:`timeout-${randomUUID()}`});
        assert.equal(timeout.result?.errorCode,'PAYMENT_UNKNOWN');assert.equal(timeout.result?.checkoutCalls,1);const receipt=timeout.result!.receipt!;assert.ok(receipt);
        const pending=await one(pool,"SELECT p.payment_attempt_id,s.workflow_state_code FROM seven.payment_attempts p JOIN seven.workflow_states s USING(workflow_state_id) WHERE reservation_id=$1",[fixture.reservation.id]);assert.equal(pending?.workflow_state_code,'UNKNOWN');
        assert.equal((await rows(pool,'SELECT money_journal_id FROM seven.money_journals WHERE source_reference=$1',[`receipt:flutterwave:${receipt.id}`])).length,0);
        const restarted=await finish({mode:'reconcile',receipt,providerMode:'flutterwave'});assert.equal(restarted.result?.processed,1);assert.equal(restarted.result?.verifyCalls,1);assert.equal(restarted.result?.checkoutCalls,0);
        await assertPaidOnce(fixture.reservation.id,pending!.payment_attempt_id,fixture.windowId,receipt);
        const replay=await finish({mode:'reconcile',receipt,providerMode:'flutterwave'});assert.equal(replay.result?.checkoutCalls,0);assert.equal(replay.result?.verifyCalls,0);
        await assertPaidOnce(fixture.reservation.id,pending!.payment_attempt_id,fixture.windowId,receipt);
      }finally{await pool.query('UPDATE seven.business_payment_accounts SET execution_mode_id=$3 WHERE business_id=$1 AND payment_provider_id=$2',[base.business_id,providerIds.flutterwave,account.execution_mode_id]);}
    });
  }finally{for(const child of children)child.kill('SIGKILL');await pool.end();}
});

// Fault boundary: these are real local child processes and PostgreSQL transactions,
// with synthetic provider lookups. They prove local rollback/idempotent recovery,
// not real gateway behavior, bank agreement, or distributed exactly-once delivery.
