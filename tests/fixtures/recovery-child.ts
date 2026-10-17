import type { Pool, PoolClient, QueryResult } from 'pg';
import { createPool, one } from '../../services/platform/src/db.ts';
import { MockProvider } from '../../services/platform/src/provider.ts';
import type { PaymentProvider, ProviderReceipt } from '../../services/platform/src/provider.ts';
import { processInbox } from '../../services/platform/src/worker.ts';
import { checkout, reconcile } from '../../services/platform/src/payments.ts';
import { userProjection } from '../../services/platform/src/store.ts';

export type CrashConfiguration =
  | {mode:'pause-before-commit'|'database-error-before-commit'|'run-inbox';receipt:ProviderReceipt}
  | {mode:'checkout-timeout';reservationId:string;actorId:string;transactionId:string}
  | {mode:'reconcile';receipt:ProviderReceipt;providerMode:'mock'|'flutterwave'};

if(!process.send || !process.env.TEST_DATABASE_URL) throw new Error('This isolated fixture must run as an IPC child with a test database.');
const configurationPromise=new Promise<CrashConfiguration>(resolve=>process.once('message',value=>resolve(value as CrashConfiguration)));
process.send({type:'ready'});
const configuration=await configurationPromise;
const pool=createPool(process.env.TEST_DATABASE_URL);
let checkoutCalls=0;let verifyCalls=0;let databaseFaults=0;

/** Intercept only explicit transaction clients; pg.Pool.query keeps its callback API. */
function faultPool(original:Pool):Pool{
  return new Proxy(original,{
    get(target,property){
      if(property!=='connect') {const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;}
      return (...args:unknown[])=>{
        if(args.length) return Reflect.apply(target.connect,target,args);
        return target.connect().then((client:PoolClient)=>{
          const nativeQuery=client.query;const release=client.release;let wroteJournal=false;
          const execute=(sql:string):Promise<QueryResult>=>Reflect.apply(nativeQuery,client,[sql]) as Promise<QueryResult>;
          client.query=((...queryArgs:unknown[])=>{
            const sql=typeof queryArgs[0]==='string'?queryArgs[0]:'';
            return (async()=>{
              if(sql==='COMMIT'&&wroteJournal){
                if(configuration.mode==='pause-before-commit'){
                  const pid=await execute('SELECT pg_backend_pid() AS pid');
                  const postings=await execute('SELECT count(*) AS count FROM seven.money_postings');
                  process.send!({type:'paused',backendPid:pid.rows[0].pid,postingCount:Number(postings.rows[0].count)});
                  await new Promise<never>(()=>{}); // Parent kills this real process before COMMIT.
                }
                if(configuration.mode==='database-error-before-commit'){
                  try{await execute("DO $$ BEGIN RAISE EXCEPTION 'Synthetic recovery transaction fault'; END $$");}
                  catch(error){if((error as {code?:string}).code==='P0001')databaseFaults++;throw error;}
                  throw new Error('The PostgreSQL fault did not fire.');
                }
              }
              const result=await Reflect.apply(nativeQuery,client,queryArgs) as QueryResult;
              if(sql.startsWith('INSERT INTO seven.money_journals'))wroteJournal=true;
              return result;
            })();
          }) as PoolClient['query'];
          client.release=((...releaseArgs:unknown[])=>{client.query=nativeQuery;client.release=release;Reflect.apply(release,client,releaseArgs);}) as PoolClient['release'];
          return client;
        });
      };
    },
  });
}

try{
  const database=await one(pool,'SELECT current_database() AS db');
  if(!/_test_db$/.test(String(database?.db)))throw new Error('Fault injection is restricted to the isolated test database.');
  const mock=new MockProvider();const provider:PaymentProvider=mock;
  if('providerMode' in configuration)provider.mode=configuration.providerMode;
  if('receipt' in configuration)mock.receipts.set(configuration.receipt.reference,configuration.receipt);
  const verify=mock.verify.bind(mock);provider.verify=async(reference:string)=>{verifyCalls++;return verify(reference);};
  const initialize=mock.checkout.bind(mock);provider.checkout=async input=>{checkoutCalls++;return initialize(input);};
  let result:Record<string,unknown>;
  if(configuration.mode==='checkout-timeout'){
    provider.mode='flutterwave';let receipt:ProviderReceipt|undefined;
    provider.checkout=async input=>{
      checkoutCalls++;
      // Represents durable evidence held by an external provider. No network/charge occurs.
      receipt={id:configuration.transactionId,reference:input.reference,status:'successful',currency:input.currency,amountMinor:input.amountMinor,feeMinor:0};
      throw new Error('Synthetic timeout after the provider may have accepted a charge.');
    };
    let errorCode:string|undefined;
    try{await checkout(pool,provider,(await userProjection(pool,configuration.actorId))!,configuration.reservationId,'http://localhost:5177');}
    catch(error){errorCode=(error as {code?:string}).code;}
    result={errorCode,receipt};
  }else if(configuration.mode==='reconcile'){
    result=await reconcile(pool,provider);
  }else{
    result={processed:await processInbox(configuration.mode==='run-inbox'?pool:faultPool(pool),provider)};
  }
  process.send({type:'done',result:{...result,checkoutCalls,verifyCalls,databaseFaults}});
}catch(error){
  process.send({type:'error',message:error instanceof Error?error.message:'Child fixture failed.'});process.exitCode=1;
}finally{await pool.end();process.disconnect();}
