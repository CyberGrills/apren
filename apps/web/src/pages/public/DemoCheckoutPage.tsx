import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, WalletCards } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from './PublicShell.tsx';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../lib/api.ts';

type Item = { id: string; kind: 'STAY'|'DINING'|'EXPERIENCE'; title: string; city: string; state: string; unitPriceMinor: string; unitLabel: string };
type Wallet = { balanceMinor: string };
type Booking = { id: string; reference: string; title: string; totalMinor: string; status: string };
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
const money = (v:string|number) => new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(Number(v)/100);

export function DemoCheckoutPage() {
 const {user}=useSession();
 const navigate=useNavigate();
 const [params]=useSearchParams();
 const itemId=params.get('itemId')??'';
 const startDate=params.get('startDate')??'';
 const endDate=params.get('endDate')??'';
 const quantity=Math.max(1,Math.min(20,Number(params.get('quantity')??1)||1));
 const [items,setItems]=useState<Item[]>([]);
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [booking,setBooking]=useState<Booking|null>(null);
 useEffect(()=>{void api<Item[]>('/demo/catalog').then(setItems).catch(e=>setError(e.message));},[]);
 useEffect(()=>{if(user)void api<Wallet>('/demo/wallet').then(setWallet).catch(e=>setError(e.message));},[user?.id]);
 const item=useMemo(()=>items.find(x=>x.id===itemId),[items,itemId]);
 const nights=item?.kind==='STAY'&&startDate&&endDate?Math.max(0,Math.round((new Date(endDate+'T00:00:00Z').getTime()-new Date(startDate+'T00:00:00Z').getTime())/86400000)):1;
 const totalMinor=item?Number(item.unitPriceMinor)*quantity*(item.kind==='STAY'?nights:1):0;
 const valid=!!item&&!!user&&!!startDate&&startDate>=today()&&(item.kind!=='STAY'||!!endDate&&nights>0&&nights<=30);
 async function confirm(e:FormEvent){e.preventDefault();if(!valid||!item)return;setBusy(true);setError('');try{const result=await api<Booking>('/demo/bookings',{method:'POST',body:{itemId:item.id,startDate,...(item.kind==='STAY'?{endDate}:{}),quantity},idempotencyKey:crypto.randomUUID()});setBooking(result);const next=await api<Wallet>('/demo/wallet');setWallet(next);}catch(cause){setError(cause instanceof Error?cause.message:'Could not complete the simulated transaction.');}finally{setBusy(false);}}
 return <div className="public-page"><PublicHeader/><main className="public-container demo-marketplace" id="main-content">
  <div className="demo-catalog-top"><Link to="/demo/marketplace" className="public-text-link"><ArrowLeft size={15}/> Back to marketplace</Link><span className="demo-only-pill">SECURE DEMO CHECKOUT</span></div>
  <header className="demo-catalog-heading"><span className="public-eyebrow">7EVEN · TEST TRANSACTION</span><h1>{booking?'Booking <em>confirmed.</em>':'Review your <em>booking.</em>'}</h1><p>{booking?'Your simulated booking has been recorded. No real reservation or payment was made.':'Check your selection and confirm using non-cash demo credits.'}</p></header>
  {booking?<section className="demo-receipt" aria-live="polite"><CheckCircle2/><div><strong>Demo booking confirmed</strong><p>{booking.title} · {booking.reference}</p><small>SIMULATED TRANSACTION — NO MONEY COLLECTED</small></div></section>:!user?<section className="demo-wallet-panel"><div><h2>Sign in to continue</h2><p>Your demo wallet is linked to your 7EVEN builder account.</p></div><Link className="btn btn-primary" to={'/login?returnTo='+encodeURIComponent('/demo/checkout?'+params.toString())}>Sign in</Link></section>:!item?<p className="demo-market-error" role="alert">{error||'This demo option could not be found. Return to the marketplace and select it again.'}</p>:<div className="demo-checkout-layout">
   <section className="demo-wallet-panel"><div><span className="public-eyebrow">YOUR DEMO WALLET</span><h2>{wallet?money(wallet.balanceMinor):'Loading wallet…'}</h2><p>Test credits only · no cash value · non-transferable · non-withdrawable</p></div><WalletCards size={24}/></section>
   <form className="demo-checkout-summary" onSubmit={confirm}><span className="public-eyebrow">ORDER SUMMARY</span><h2>{item.title}</h2><p>{item.city}, {item.state} · {item.kind}</p><dl><div><dt>{item.kind==='STAY'?'Check-in':'Service date'}</dt><dd>{startDate||'Not selected'}</dd></div>{item.kind==='STAY'&&<div><dt>Check-out</dt><dd>{endDate||'Not selected'} ({nights} nights)</dd></div>}<div><dt>{item.kind==='STAY'?'Rooms':'Guests'}</dt><dd>{quantity}</dd></div><div><dt>Price per {item.unitLabel}</dt><dd>{money(item.unitPriceMinor)}</dd></div><div className="demo-checkout-total"><dt>Total</dt><dd>{money(totalMinor)}</dd></div></dl>
    <p className="demo-catalog-footnote"><ShieldCheck size={15}/> Demo-only checkout. This does not contact a hotel, restaurant, supplier or payment provider.</p>
    {error&&<p className="demo-market-error" role="alert">{error}</p>}<button className="btn btn-primary" type="submit" disabled={!valid||busy||!wallet}>{busy?'Processing demo transaction…':'Confirm booking with demo credits'}</button><button className="btn btn-secondary" type="button" onClick={()=>navigate('/demo/marketplace')}>Change selection</button>
   </form>
  </div>}
  {booking&&<section className="demo-wallet-panel"><div><span className="public-eyebrow">REMAINING DEMO BALANCE</span><h2>{wallet?money(wallet.balanceMinor):'Refreshing…'}</h2><p>Updated after this simulated transaction.</p></div><Link className="btn btn-primary" to="/demo/marketplace">Continue exploring</Link></section>}
 </main><PublicFooter/></div>;
}
