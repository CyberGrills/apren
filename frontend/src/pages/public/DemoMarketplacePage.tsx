import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, WalletCards } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';
import { demoProperties } from './demoHotels.ts';

type Item = { id: string; kind: 'STAY'|'DINING'|'EXPERIENCE'; title: string; city: string; state: string; unitPriceMinor: string; unitLabel: string };
type Entry = { id: string; type: string; amountMinor: string; reference: string; description: string; createdAt: string };
type Wallet = { balanceMinor: string; entries: Entry[] };
type Booking = { id: string; reference: string; itemId: string; kind: string; title: string; city: string; startDate: string; endDate: string|null; quantity: number; totalMinor: string; status: string };
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
const tomorrow = () => { const d=new Date(today()+'T12:00:00'); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-CA'); };
const money = (v:string|number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(Number(v)/100);
const names = { STAY:'Hotels & apartments', DINING:'Dining', EXPERIENCE:'Things to do' };

export function DemoMarketplacePage() {
 const {user}=useSession();
 const navigate=useNavigate();
 const [items,setItems]=useState<Item[]>([]);
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [kind,setKind]=useState<'ALL'|Item['kind']>('ALL');
 const [query,setQuery]=useState('');
 const [start,setStart]=useState(today());
 const [end,setEnd]=useState(tomorrow());
 const [quantity,setQuantity]=useState(1);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState<Booking|null>(null);
 const refresh=async()=>{if(!user)return;const [w,b]=await Promise.all([api<Wallet>('/demo/wallet'),api<Booking[]>('/demo/bookings')]);setWallet(w);setBookings(b);};
 useEffect(()=>{void api<Item[]>('/demo/catalog').then(setItems).catch(e=>setError(e.message));},[]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[user?.id]);
 const visible=useMemo(()=>items.filter(i=>(kind==='ALL'||i.kind===kind)&&(i.title+i.city+i.state).toLowerCase().includes(query.toLowerCase())),[items,kind,query]);
 function book(e:FormEvent,item:Item){e.preventDefault();if(!user)return;const params=new URLSearchParams({itemId:item.id,startDate:start,quantity:String(quantity)});if(item.kind==='STAY')params.set('endDate',end);navigate('/demo/checkout?'+params.toString());}
 async function cancel(b:Booking){setBusy(b.id);setError('');try{await api('/demo/bookings/'+b.id+'/cancel',{method:'POST',body:{},idempotencyKey:crypto.randomUUID()});setNotice('Demo booking cancelled. Test credits returned.');await refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Could not cancel demo booking.');}finally{setBusy('');}}
 const sampleImage=demoProperties[0]?.images[0]??'';
 return <div className="public-page"><PublicHeader/><main className="public-container demo-marketplace" id="main-content">
  <div className="demo-catalog-top"><Link to="/demo/hotels" className="public-text-link">100-property catalogue</Link><span className="demo-only-pill">INVESTOR DEMO · SIMULATED</span></div>
  <header className="demo-catalog-heading"><span className="public-eyebrow">7EVEN · INTERACTIVE MARKETPLACE</span><h1>Explore. Book. <em>Experience.</em></h1><p>Test the customer journey across stays, dining and experiences. All listings and transactions here are fictional demonstration data.</p></header>
  <section className="demo-wallet-panel"><div><span className="public-eyebrow">YOUR DEMO WALLET</span><h2>{wallet?money(wallet.balanceMinor):'₦500,000,000'}</h2><p>Test credits only · no cash value · non-transferable · non-withdrawable</p></div><div className="demo-wallet-status"><WalletCards size={22}/><strong>{user?'Personal test wallet':'Sign in to activate your wallet'}</strong>{!user&&<Link className="btn btn-primary" to="/login?returnTo=%2Fdemo%2Fmarketplace">Sign in to test <ArrowUpRight size={16}/></Link>}</div></section>
  {receipt&&<section className="demo-receipt" aria-live="polite"><CheckCircle2/><div><strong>Demo booking confirmed</strong><p>{receipt.title} · {receipt.reference}</p><small>SIMULATED TRANSACTION — NO MONEY COLLECTED</small></div><button className="btn btn-secondary" onClick={()=>setReceipt(null)} type="button">Close</button></section>}
  {notice&&<p className="demo-market-message" role="status">{notice}</p>}{error&&<p className="demo-market-error" role="alert">{error}</p>}
  <section className="demo-market-tools"><div className="demo-market-tabs">{(['ALL','STAY','DINING','EXPERIENCE'] as const).map(k=><button type="button" className={kind===k?'active':''} onClick={()=>setKind(k)} key={k}>{k==='ALL'?'Everything':names[k]}</button>)}</div><input aria-label="Search demo marketplace" placeholder="Search name or destination" value={query} onChange={e=>setQuery(e.target.value)}/><span>{visible.length} demo options</span></section>
  <section className="demo-market-grid">{visible.map(item=>{const property=demoProperties.find(p=>p.id===item.id);return <article className="demo-market-card" key={item.id}><div className="demo-market-image"><img src={property?.images[0]??sampleImage} alt={property?'Illustrative image; not a photograph of '+item.title:'Illustrative hospitality image'} loading="lazy"/><span className="demo-only-pill">DEMO ONLY</span></div><div className="demo-market-copy"><span className="public-eyebrow">{names[item.kind]} · {item.city}</span><h2>{item.title}</h2><p>{item.city}, {item.state}</p><strong>{money(item.unitPriceMinor)} <small>/ {item.unitLabel}</small></strong><form onSubmit={e=>void book(e,item)}><label><CalendarDays size={14}/>{item.kind==='STAY'?'Check-in':'Date'}<input type="date" min={today()} value={start} required onChange={e=>setStart(e.target.value)}/></label>{item.kind==='STAY'&&<label>Check-out<input type="date" min={start} value={end} required onChange={e=>setEnd(e.target.value)}/></label>}<label>{item.kind==='STAY'?'Rooms':'Guests'}<input type="number" min="1" max="20" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label><button className="btn btn-primary" type="submit" disabled={!user||!!busy}>{busy===item.id?'Processing…':'Book with demo credits'}</button></form></div></article>;})}</section>
  <section className="demo-wallet-history"><span className="public-eyebrow">YOUR ACTIVITY</span><h2>Bookings & wallet history</h2>{!user?<p>Sign in to see your private test bookings, receipts and wallet activity.</p>:<><h3>Bookings</h3>{bookings.length===0?<p>No demo bookings yet.</p>:bookings.map(b=><article className="demo-history-row" key={b.id}><div><strong>{b.title}</strong><span>{b.reference} · {b.startDate} · {b.status}</span></div><strong>{money(b.totalMinor)}</strong>{b.status==='CONFIRMED'&&<button className="btn btn-secondary" type="button" disabled={!!busy} onClick={()=>void cancel(b)}>Cancel & refund</button>}</article>)}<h3>Ledger</h3>{wallet?.entries.map(entry=><article className="demo-history-row" key={entry.id}><div><strong>{entry.description}</strong><span>{entry.reference} · {new Date(entry.createdAt).toLocaleString('en-NG')}</span></div><strong>{entry.type==='DEBIT'?'−':'+'}{money(entry.amountMinor)}</strong></article>)}</>}</section>
  <p className="demo-catalog-footnote">All names, prices, reservations, confirmations, refunds and wallet credits are simulated. No supplier is contacted, no live inventory is held and no real money is collected.</p>
 </main><PublicFooter/></div>;
}
