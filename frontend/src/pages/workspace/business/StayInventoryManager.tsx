import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api.ts';

interface CalendarRow {
  room_type_id: string;
  offering_id: string;
  max_occupancy: number;
  bed_configuration: string;
  total_rooms: number | null;
  room_active: boolean;
  room_revision: number;
  title: string;
  rate_plan_id: string | null;
  rate_plan_code: string | null;
  rate_plan_name: string | null;
  currency_code: string | null;
  service_date: string | null;
  amount_minor: string | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
  min_stay_nights: number | null;
  max_stay_nights: number | null;
  rate_revision: number | null;
  capacity: number | null;
  allocated_count: number | null;
  inventory_revision: number | null;
  inventory_confirmed_at: string | null;
  inventory_source: string | null;
}
interface CalendarResponse { dates: string[]; rooms: CalendarRow[]; }
function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function toMinorUnits(value: string): string {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid price with up to two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole ?? '0') * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}
function money(minor: string | null, currency: string | null) {
  if (minor === null) return 'No rate';
  return new Intl.NumberFormat('en-NG',{style:'currency',currency:currency || 'NGN',maximumFractionDigits:2}).format(Number(minor)/100);
}
export function StayInventoryManager({ offeringId, title }: { offeringId: string; title: string }) {
  const [startDate,setStartDate]=useState(localDate());
  const [endDate,setEndDate]=useState(localDate(13));
  const [data,setData]=useState<CalendarResponse | null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string | null>(null);
  const [notice,setNotice]=useState<string | null>(null);
  const [ratePlanId,setRatePlanId]=useState('');
  const [showRoomForm,setShowRoomForm]=useState(false);
  const [showRateForm,setShowRateForm]=useState(false);
  const [showPriceForm,setShowPriceForm]=useState(false);
  const [showCapacityForm,setShowCapacityForm]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try {
      const query=new URLSearchParams({offeringId,startDate,endDate});
      const result=await api<CalendarResponse>(`/business/stay/calendar?${query.toString()}`);
      setData(result);
      const first=result.rooms.find(row=>row.rate_plan_id)?.rate_plan_id;
      if(first && !result.rooms.some(row=>row.rate_plan_id===ratePlanId)) setRatePlanId(first);
    } catch(cause) { setError(cause instanceof Error?cause.message:'Could not load room calendar.'); }
    finally { setLoading(false); }
  },[offeringId,startDate,endDate,ratePlanId]);
  useEffect(()=>{void load();},[load]);
  const room=useMemo(()=>data?.rooms[0] ?? null,[data]);
  const plans=useMemo(()=>{
    const unique=new Map<string,{id:string;name:string;code:string;currency:string}>();
    for(const row of data?.rooms ?? []) if(row.rate_plan_id) unique.set(row.rate_plan_id,{id:row.rate_plan_id,name:row.rate_plan_name || row.rate_plan_code || 'Rate plan',code:row.rate_plan_code || '',currency:row.currency_code || 'NGN'});
    return [...unique.values()];
  },[data]);
  const selectedPlan=plans.find(plan=>plan.id===ratePlanId) ?? plans[0];
  const nights=useMemo(()=>{
    const map=new Map<string,CalendarRow>();
    for(const row of data?.rooms ?? []) if(row.service_date && row.rate_plan_id===selectedPlan?.id) map.set(row.service_date,row);
    return [...map.values()].sort((a,b)=>(a.service_date || '').localeCompare(b.service_date || ''));
  },[data,selectedPlan?.id]);
  async function submit(event:React.FormEvent<HTMLFormElement>,kind:'room'|'rate'|'price'|'capacity') {
    event.preventDefault(); const form=event.currentTarget; const values=new FormData(form);
    const get=(name:string)=>String(values.get(name) ?? '').trim();
    setBusy(true);setError(null);setNotice(null);
    try {
      if(kind==='room') {
        await api('/business/stay/rooms',{method:'POST',idempotencyKey:crypto.randomUUID(),body:{offeringId,maxOccupancy:Number(get('maxOccupancy')),bedConfiguration:get('bedConfiguration'),totalRooms:get('totalRooms')?Number(get('totalRooms')):null}});
        setShowRoomForm(false);setNotice('Room category saved.');
      } else if(kind==='rate') {
        if(!room) throw new Error('Create the room category first.');
        await api('/business/stay/rate-plans',{method:'POST',idempotencyKey:crypto.randomUUID(),body:{roomTypeId:room.room_type_id,code:get('code').toUpperCase(),name:get('name'),currencyCode:get('currencyCode'),mealPlan:get('mealPlan'),refundable:get('refundable')==='unknown'?null:get('refundable')==='yes',cancellationPolicy:get('cancellationPolicy')}});
        setShowRateForm(false);setNotice('Rate plan saved.');
      } else if(kind==='price') {
        if(!selectedPlan) throw new Error('Create a rate plan first.');
        await api('/business/stay/nightly-rates',{method:'PUT',idempotencyKey:crypto.randomUUID(),body:{ratePlanId:selectedPlan.id,startDate:get('startDate'),endDate:get('endDate'),amountMinor:toMinorUnits(get('price')),closedToArrival:values.has('closedToArrival'),closedToDeparture:values.has('closedToDeparture'),minStayNights:get('minStayNights')?Number(get('minStayNights')):null,maxStayNights:get('maxStayNights')?Number(get('maxStayNights')):null}});
        setShowPriceForm(false);setNotice('Nightly prices and restrictions saved.');
      } else {
        if(!room) throw new Error('Create the room category first.');
        await api(`/business/stay/rooms/${room.room_type_id}/availability`,{method:'POST',idempotencyKey:crypto.randomUUID(),body:{startDate:get('startDate'),endDate:get('endDate'),capacity:Number(get('capacity'))}});
        setShowCapacityForm(false);setNotice('Availability confirmed for the selected nights.');
      }
      await load();
    } catch(cause) { setError(cause instanceof Error?cause.message:'Could not save this change.'); }
    finally { setBusy(false); }
  }
  return <section className="stay-inventory-manager" aria-label={`Room and rate management for ${title}`}>
    <div className="stay-inventory-heading">
      <div><p className="eyebrow">ROOMS & LIVE INVENTORY</p><h3>Manage your rooms</h3><p className="small-copy">Update room details, nightly prices and sellable rooms from this device.</p></div>
      <button type="button" className="btn btn-secondary btn-small" onClick={()=>void load()} disabled={loading}>Refresh</button>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {notice && <p className="stay-inventory-success" role="status">{notice}</p>}
    {loading ? <p className="small-copy">Loading room calendar…</p> : <>
      {!room ? <div className="stay-inventory-empty"><p>No room category has been configured for this stay listing.</p><button type="button" className="btn btn-primary btn-small" onClick={()=>setShowRoomForm(true)}>Configure room category</button></div> :
      <>
        <div className="stay-inventory-summary">
          <div><span>Room category</span><strong>{room.max_occupancy} guests maximum</strong><small>{room.bed_configuration || 'Bed configuration not supplied'} · {room.total_rooms ?? 'Room count not recorded'}</small></div>
          <div><span>Rate plans</span><strong>{plans.length}</strong><small>{plans.length?'Configured':'Add a rate plan'}</small></div>
        </div>
        <div className="stay-inventory-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={()=>setShowRateForm(true)}>Add rate plan</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={()=>setShowPriceForm(true)} disabled={!plans.length}>Set nightly prices</button>
          <button type="button" className="btn btn-primary btn-small" onClick={()=>setShowCapacityForm(true)}>Update availability</button>
        </div>
        {plans.length>0 && <label className="stay-inventory-plan">Rate plan<select value={selectedPlan?.id || ''} onChange={event=>setRatePlanId(event.target.value)}>{plans.map(plan=><option key={plan.id} value={plan.id}>{plan.name} · {plan.currency}</option>)}</select></label>}
        <div className="stay-inventory-range"><label>From<input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)} /></label><label>Through<input type="date" value={endDate} onChange={event=>setEndDate(event.target.value)} /></label></div>
        {plans.length===0 ? <p className="small-copy">Add a rate plan before entering nightly prices.</p> : <div className="stay-inventory-grid">
          {nights.length===0 ? <p className="small-copy">No nightly rates are configured in this date range. Add explicit prices to make these nights eligible for booking.</p> : nights.map(night=><article className="stay-inventory-night" key={night.service_date}>
            <span>{new Date(night.service_date+'T12:00:00').toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'short'})}</span>
            <strong>{money(night.amount_minor,night.currency_code)}</strong>
            <small>{night.capacity===null?'Inventory not confirmed':`${Math.max(0,night.capacity-(night.allocated_count ?? 0))} / ${night.capacity} rooms remaining`}</small>
            <small>{night.inventory_source==='MANUAL' && night.inventory_confirmed_at?'Owner confirmed':'Availability needs confirmation'}</small>
            {(night.closed_to_arrival || night.closed_to_departure) && <small>Arrival/departure restriction</small>}
          </article>)}
        </div>}
      </>}
      {showRoomForm && <form className="stay-inventory-form" onSubmit={event=>void submit(event,'room')}>
        <h4>Room category details</h4><label>Maximum guests<input name="maxOccupancy" type="number" min="1" max="30" defaultValue="2" required /></label><label>Bed configuration<input name="bedConfiguration" maxLength={180} placeholder="1 king bed" /></label><label>Total physical rooms, if verified<input name="totalRooms" type="number" min="1" max="10000" /></label><button className="btn btn-primary btn-small" disabled={busy}>{busy?'Saving…':'Save room category'}</button>
      </form>}
      {showRateForm && <form className="stay-inventory-form" onSubmit={event=>void submit(event,'rate')}>
        <h4>New rate plan</h4><label>Plan name<input name="name" required minLength={2} maxLength={120} placeholder="Flexible room only" /></label><label>Plan code<input name="code" required minLength={2} maxLength={40} placeholder="FLEX" /></label><label>Currency<select name="currencyCode" defaultValue="NGN"><option value="NGN">NGN · Naira</option></select></label><label>Meal plan<select name="mealPlan" defaultValue="ROOM_ONLY"><option value="ROOM_ONLY">Room only</option><option value="BREAKFAST">Breakfast included</option><option value="HALF_BOARD">Half board</option><option value="FULL_BOARD">Full board</option></select></label><label>Refundability<select name="refundable" defaultValue="unknown"><option value="unknown">Not specified</option><option value="yes">Refundable</option><option value="no">Non-refundable</option></select></label><label>Cancellation policy<textarea name="cancellationPolicy" maxLength={4000} /></label><button className="btn btn-primary btn-small" disabled={busy}>{busy?'Saving…':'Save rate plan'}</button>
      </form>}
      {showPriceForm && <form className="stay-inventory-form" onSubmit={event=>void submit(event,'price')}>
        <h4>Set nightly price and restrictions</h4><label>First night<input name="startDate" type="date" defaultValue={startDate} required /></label><label>Last night, inclusive<input name="endDate" type="date" defaultValue={endDate} required /></label><label>Price per room per night (NGN)<input name="price" type="number" min="0" step="0.01" required /></label><label>Minimum stay, nights<input name="minStayNights" type="number" min="1" max="365" /></label><label>Maximum stay, nights<input name="maxStayNights" type="number" min="1" max="365" /></label><label className="stay-inventory-check"><input name="closedToArrival" type="checkbox" /> Closed to arrival</label><label className="stay-inventory-check"><input name="closedToDeparture" type="checkbox" /> Closed to departure</label><button className="btn btn-primary btn-small" disabled={busy}>{busy?'Saving…':'Save nightly rates'}</button>
      </form>}
      {showCapacityForm && <form className="stay-inventory-form" onSubmit={event=>void submit(event,'capacity')}>
        <h4>Confirm rooms available</h4><p className="small-copy">This is total sellable capacity, including rooms already allocated to guests. Existing bookings cannot be displaced.</p><label>First night<input name="startDate" type="date" defaultValue={startDate} required /></label><label>Last night, inclusive<input name="endDate" type="date" defaultValue={endDate} required /></label><label>Total rooms available<input name="capacity" type="number" min="0" max="10000" required /></label><button className="btn btn-primary btn-small" disabled={busy}>{busy?'Saving…':'Confirm availability'}</button>
      </form>}
    </>}
  </section>;
}
